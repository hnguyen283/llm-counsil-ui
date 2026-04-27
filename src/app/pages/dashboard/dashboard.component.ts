import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { JobsService, JobStatus } from '../../core/jobs.service';

// Stages in the order the WorkflowEngine emits them. Used to render the timeline.
const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'planning', label: 'Planning queries' },
  { key: 'collecting', label: 'Collecting (Gemini)' },
  { key: 'validating', label: 'Validating sources' },
  { key: 'analyzing', label: 'Analyzing (GPT)' },
  { key: 'debating', label: 'Debate round' },
  { key: 'judging', label: 'Final judgment' },
  { key: 'done', label: 'Done' }
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <header>
      <div class="brand">LLM Counsil</div>
      <button (click)="logout()">Logout</button>
    </header>

    <main>
      <section class="query-card">
        <label class="query-label">Research question</label>
        <textarea
          [(ngModel)]="query"
          rows="2"
          placeholder="e.g. Is intermittent fasting effective for weight loss?"
          [disabled]="isRunning()"
        ></textarea>
        <div class="actions">
          <button
            class="primary"
            (click)="run()"
            [disabled]="!query.trim() || isRunning()"
          >
            {{ isRunning() ? 'Running...' : 'Run research' }}
          </button>
          @if (status()) {
            <button (click)="reset()" [disabled]="isRunning()">Clear</button>
          }
        </div>
      </section>

      @if (status(); as s) {
        <section class="progress-card">
          <h2>Progress</h2>
          <div class="timeline">
            @for (stage of stages; track stage.key) {
              <div class="stage" [class.active]="isActiveStage(stage.key)" [class.done]="isDoneStage(stage.key)">
                <div class="dot"></div>
                <div class="label">{{ stage.label }}</div>
              </div>
            }
          </div>
          <div class="meta">
            <span class="state state-{{ s.state.toLowerCase() }}">{{ s.state }}</span>
            <span class="stage-text">{{ s.stage }}</span>
          </div>
          @if (s.error) {
            <div class="error">{{ s.error }}</div>
          }
        </section>
      }

      @if (status()?.result; as report) {
        <section class="report">
          <div class="report-header">
            <h2>Final report</h2>
            <span class="confidence confidence-{{ report.confidence.toLowerCase() }}">
              {{ report.confidence }} confidence
            </span>
          </div>

          <div class="block">
            <h3>Key findings</h3>
            @if (report.keyFindings.length === 0) {
              <p class="dim">No findings produced.</p>
            } @else {
              <ul>
                @for (f of report.keyFindings; track f) { <li>{{ f }}</li> }
              </ul>
            }
          </div>

          <div class="block">
            <h3>Conflicts &amp; contradictions</h3>
            @if (report.conflicts.length === 0) {
              <p class="dim">None detected.</p>
            } @else {
              <ul>
                @for (c of report.conflicts; track c) { <li>{{ c }}</li> }
              </ul>
            }
          </div>

          <div class="block">
            <h3>Sources ({{ report.sources.length }})</h3>
            <table>
              <thead>
                <tr><th>Tier</th><th>URL</th><th>Summary</th></tr>
              </thead>
              <tbody>
                @for (src of report.sources; track src.url) {
                  <tr>
                    <td><span class="tier tier-{{ tierClass(src.reliability) }}">{{ src.reliability }}</span></td>
                    <td><a [href]="src.url" target="_blank" rel="noopener">{{ shortUrl(src.url) }}</a></td>
                    <td>{{ src.summary }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </main>
  `,
  styles: [`
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 32px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-elev);
    }
    .brand { font-weight: 600; font-size: 16px; }

    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .query-card, .progress-card, .report {
      background: var(--bg-elev);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
    }
    .query-label { display: block; margin-bottom: 8px; color: var(--text-dim); font-size: 13px; }
    textarea { resize: vertical; min-height: 60px; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }

    h2 { margin: 0 0 16px 0; font-size: 16px; }
    h3 { margin: 0 0 8px 0; font-size: 14px; color: var(--text-dim); }
    .dim { color: var(--text-dim); margin: 0; }

    /* Timeline */
    .timeline {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .stage {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--radius);
      font-size: 12px;
      color: var(--text-dim);
    }
    .stage .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--border);
    }
    .stage.done .dot { background: var(--green); }
    .stage.active {
      background: rgba(59, 130, 246, 0.12);
      color: var(--text);
    }
    .stage.active .dot {
      background: var(--accent);
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.4); }
    }

    .meta { display: flex; gap: 12px; align-items: center; font-size: 13px; }
    .state {
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .state-pending  { background: rgba(148,163,184,0.15); color: var(--text-dim); }
    .state-running  { background: rgba(59,130,246,0.15); color: var(--accent); }
    .state-done     { background: rgba(16,185,129,0.15); color: var(--green); }
    .state-failed   { background: rgba(239,68,68,0.15); color: var(--red); }
    .stage-text { color: var(--text-dim); }
    .error {
      margin-top: 12px;
      padding: 10px 12px;
      background: rgba(239,68,68,0.1);
      border: 1px solid var(--red);
      color: var(--red);
      border-radius: var(--radius);
      font-size: 13px;
    }

    /* Report */
    .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .report-header h2 { margin: 0; }
    .confidence {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .confidence-high   { background: rgba(16,185,129,0.15); color: var(--green); }
    .confidence-medium { background: rgba(245,158,11,0.15); color: var(--amber); }
    .confidence-low    { background: rgba(239,68,68,0.15); color: var(--red); }

    .block { margin-top: 20px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 6px; line-height: 1.5; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
    th { color: var(--text-dim); font-weight: 500; font-size: 12px; }

    .tier {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .tier-1 { background: rgba(16,185,129,0.15); color: var(--green); }
    .tier-2 { background: rgba(59,130,246,0.15); color: var(--accent); }
    .tier-3 { background: rgba(148,163,184,0.15); color: var(--text-dim); }
  `]
})
export class DashboardComponent {
  private jobs = inject(JobsService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly stages = STAGES;
  query = '';
  status = signal<JobStatus | null>(null);
  isRunning = computed(() => {
    const s = this.status();
    return s !== null && (s.state === 'PENDING' || s.state === 'RUNNING');
  });

  private streamSub: Subscription | null = null;

  run() {
    this.cancelStream();
    this.status.set(null);

    this.jobs.submit(this.query.trim()).subscribe({
      next: ({ jobId }) => this.openStream(jobId),
      error: err => this.status.set({
        jobId: '', state: 'FAILED', stage: 'failed',
        updatedAt: new Date().toISOString(),
        result: null,
        error: err?.message || 'Failed to submit job'
      })
    });
  }

  reset() {
    this.cancelStream();
    this.status.set(null);
    this.query = '';
  }

  logout() {
    this.cancelStream();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // Stage matching: backend emits things like "debating-round-1", we want to highlight "debating".
  isActiveStage(key: string): boolean {
    const s = this.status();
    if (!s || s.state === 'DONE' || s.state === 'FAILED') return false;
    return (s.stage || '').startsWith(key);
  }
  isDoneStage(key: string): boolean {
    const s = this.status();
    if (!s) return false;
    if (s.state === 'DONE' && key === 'done') return true;
    if (s.state === 'DONE') return key !== 'done';
    const currentIdx = STAGES.findIndex(st => (s.stage || '').startsWith(st.key));
    const targetIdx = STAGES.findIndex(st => st.key === key);
    return currentIdx > targetIdx;
  }

  tierClass(reliability: string): string {
    if (reliability.endsWith('1')) return '1';
    if (reliability.endsWith('2')) return '2';
    return '3';
  }

  shortUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.host + (u.pathname.length > 30 ? u.pathname.slice(0, 30) + '...' : u.pathname);
    } catch {
      return url;
    }
  }

  private openStream(jobId: string) {
    this.streamSub = this.jobs.stream(jobId).subscribe({
      next: status => this.status.set(status),
      error: err => this.status.set({
        jobId, state: 'FAILED', stage: 'failed',
        updatedAt: new Date().toISOString(),
        result: null,
        error: err?.message || 'Stream error'
      })
    });
  }

  private cancelStream() {
    this.streamSub?.unsubscribe();
    this.streamSub = null;
  }
}
