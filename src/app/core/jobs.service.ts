import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { LocaleCode, LocaleService } from './locale.service';

/**
 * Wire shape for one source row in the final report. Mirrors the
 * backend record so client and server can exchange the report directly
 * without translation.
 */
export interface RankedSource {
  url: string;
  /**
   * Coarse tier label preserved for clients that bucket sources into
   * tiers; derived from the numeric confidence score below.
   */
  reliability: 'Tier 1' | 'Tier 2' | 'Tier 3';
  summary: string;
  /** Numeric confidence score on the supplied source. */
  confidenceScore: number;
  /** One-sentence justification for the score. */
  rationale: string;
}

/**
 * Wire shape for the deliverable produced at the end of a research run.
 *
 * `directAnswer` is the short, source-free natural-language answer
 * synthesised by the post-judge `FinalAnswerStateAction`. It is optional
 * on the wire so older backends and degraded runs (where the synthesis
 * step was skipped, errored, or timed out) can still emit a valid report;
 * the UI falls back to the ranked findings/sources in that case.
 */
export interface FinalReport {
  query: string;
  keyFindings: string[];
  conflicts: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: RankedSource[];
  directAnswer?: string | null;
}

/** Coarse lifecycle of a job from acceptance through terminal state. */
export type JobState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** Snapshot returned by both the polling and the streaming endpoints. */
export interface JobStatus {
  jobId: string;
  state: JobState;
  stage: string;
  updatedAt: string;
  result: FinalReport | null;
  error: string | null;
}

/** Acknowledgement payload returned by the submission endpoint. */
export interface JobAccepted {
  jobId: string;
}

/**
 * Singleton service that owns the conversation with the orchestrator's
 * job API.
 *
 * Exposes three operations: submit a job, fetch a snapshot, and
 * subscribe to the streaming progress feed. The streaming code uses
 * fetch with a readable stream rather than the browser's native event
 * source so the bearer token can be attached to the request.
 */
@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private locale = inject(LocaleService);

  /**
   * Submits a research job. The active UI locale rides on the request
   * so the orchestrator can request localised prompt material from the
   * prompt service. Callers can override the locale for one-off use
   * cases such as test fixtures or share links.
   */
  submit(query: string, overrideLocale?: LocaleCode): Observable<JobAccepted> {
    const locale = overrideLocale ?? this.locale.current();
    return this.http.post<JobAccepted>('/jobs', { query, locale });
  }

  /** Returns the latest snapshot for a known job. */
  get(jobId: string): Observable<JobStatus> {
    return this.http.get<JobStatus>(`/jobs/${jobId}`);
  }

  /**
   * Subscribes to incremental job updates over server-sent events.
   *
   * The native browser event source cannot attach custom headers, so
   * the stream is consumed manually with fetch and a text decoder. The
   * observable emits one parsed snapshot per event and completes when
   * the upstream closes the stream. Cancelling the subscription aborts
   * the underlying request.
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

            // Events are delimited by a blank line; consume each complete
            // event from the buffer and leave any partial tail for the
            // next read.
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
