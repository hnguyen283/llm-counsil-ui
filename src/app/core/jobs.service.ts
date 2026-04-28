import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { LocaleCode, LocaleService } from './locale.service';

// --- DTOs (mirror backend records) ---

export interface RankedSource {
  url: string;
  reliability: 'Tier 1' | 'Tier 2' | 'Tier 3';
  summary: string;
}

export interface FinalReport {
  query: string;
  keyFindings: string[];
  conflicts: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: RankedSource[];
}

export type JobState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface JobStatus {
  jobId: string;
  state: JobState;
  stage: string;
  updatedAt: string;
  result: FinalReport | null;
  error: string | null;
}

export interface JobAccepted {
  jobId: string;
}

@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private locale = inject(LocaleService);

  /**
   * Submit a research job. The active UI locale (from {@link LocaleService}) is
   * sent alongside the query so the orchestrator can surface localised prompts
   * via prompt-service. Pass {@code overrideLocale} to bypass the user choice
   * for one-off calls (testing, share-links, ...).
   */
  submit(query: string, overrideLocale?: LocaleCode): Observable<JobAccepted> {
    const locale = overrideLocale ?? this.locale.current();
    return this.http.post<JobAccepted>('/jobs', { query, locale });
  }

  get(jobId: string): Observable<JobStatus> {
    return this.http.get<JobStatus>(`/jobs/${jobId}`);
  }

  /**
   * Stream job updates via SSE.
   *
   * Native EventSource can't send Authorization headers, so we use fetch +
   * ReadableStream and parse text/event-stream manually. Returns an Observable
   * that emits each parsed JobStatus and completes when the stream ends.
   */
  stream(jobId: string): Observable<JobStatus> {
    return new Observable<JobStatus>(subscriber => {
      const controller = new AbortController();
      const token = this.auth.token();

      (async () => {
        try {
          const res = await fetch(`/jobs/${jobId}/stream`, {
            headers: {
              Accept: 'text/event-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            signal: controller.signal
          });
          if (!res.ok || !res.body) {
            subscriber.error(new Error(`SSE failed: HTTP ${res.status}`));
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sep: number;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              const dataLines = rawEvent
                .split('\n')
                .filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trim());
              if (dataLines.length === 0) continue;
              try {
                const status = JSON.parse(dataLines.join('\n')) as JobStatus;
                subscriber.next(status);
              } catch (e) {
                console.warn('Bad SSE chunk:', dataLines, e);
              }
            }
          }
          subscriber.complete();
        } catch (err) {
          if ((err as Error).name !== 'AbortError') subscriber.error(err);
        }
      })();

      return () => controller.abort();
    });
  }
}
