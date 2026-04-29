import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { JobsService, JobStatus } from '../../core/jobs.service';
import { LOCALES, LocaleCode, LocaleService } from '../../core/locale.service';

/**
 * Workflow stage labels in the order the orchestrator publishes them.
 * The keys must match the prefix the backend emits on the stage field
 * of the job snapshot so the timeline can light up the active stage.
 */
const STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'planning', label: 'Planning queries' },
  { key: 'collecting', label: 'Collecting (Gemini)' },
  { key: 'validating', label: 'Validating sources' },
  { key: 'analyzing', label: 'Analyzing (GPT)' },
  { key: 'debating', label: 'Debate round' },
  { key: 'scoring', label: 'Scoring sources (GPT)' },
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
      <div class="header-actions">
        <div class="lang-switcher" role="group" aria-label="Language">
          @for (l of locales; track l.code) {
            <button
              type="button"
              class="lang-btn"
              [class.active]="locale() === l.code"
              [disabled]="isRunning()"
              [attr.aria-pressed]="locale() === l.code"
              [title]="l.label"
              (click)="setLocale(l.code)"
            >
              {{ l.short }}
            </button>
          }
        </div>
        <button (click)="logout()">Logout</button>
      </div>
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
          <span class="lang-hint">Prompts in {{ activeLocaleLabel() }}</span>
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
                <tr>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>URL</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                @for (src of report.sources; track src.url) {
                  <tr>
                    <td><span class="tier tier-{{ tierClass(src.reliability) }}">{{ src.reliability }}</span></td>
                    <td>
                      <div class="score" [title]="src.rationale || ''">
                        <span class="score-num score-{{ scoreBand(src.confidenceScore) }}">{{ src.confidenceScore }}</span>
                        <div class="score-bar">
                          <div class="score-bar-fill score-{{ scoreBand(src.confidenceScore) }}"
                               [style.width.%]="src.confidenceScore"></div>
                        </div>
                      </div>
                    </td>
                    <td><a [href]="src.url" target="_blank" rel="noopener">{{ shortUrl(src.url) }}</a></td>
                    <td>{{ src.rationale || src.summary }}</td>
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
    .header-actions { display: flex; align-items: center; gap: 12px; }

    .lang-switcher {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      background: var(--bg);
    }
    .lang-btn {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: var(--text-dim);
      background: transparent;
      border: none;
      border-right: 1px solid var(--border);
      cursor: pointer;
    }
    .lang-btn:last-child { border-right: none; }
    .lang-btn:hover:not(:disabled) { color: var(--text); }
    .lang-btn.active {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent);
    }
    .lang-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .lang-hint {
      margin-left: auto;
      align-self: center;
      font-size: 12px;
      color: var(--text-dim);
    }

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
    .actions { display: flex; gap: 8px; margin-top: 12px; align-items: center; }

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
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
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

    /* Per-source confidence visual: numeric score plus a proportional
       bar; the full rationale surfaces in a tooltip via the title
       attribute on the wrapper element. */
    .score { display: flex; align-items: center; gap: 8px; min-width: 100px; }
    .score-num { font-weight: 600; font-size: 12px; min-width: 28px; text-align: right; }
    .score-bar {
      flex: 1;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
      min-width: 60px;
    }
    .score-bar-fill { height: 100%; transition: width 0.3s ease; }
    .score-high   { color: var(--green); background: var(--green); }
    .score-medium { color: var(--accent); background: var(--accent); }
    .score-low    { color: var(--red); background: var(--red); }
    .score-num.score-high   { color: var(--green); background: transparent; }
    .score-num.score-medium { color: var(--accent); background: transparent; }
    .score-num.score-low    { color: var(--red); background: transparent; }
  `]
})
/**
 * Authenticated dashboard page.
 *
 * Lets the user submit a research question, switch language, and watch
 * the workflow progress in real time. The component subscribes to the
 * job streaming endpoint as soon as the orchestrator accepts the
 * submission and renders the final report when the workflow completes.
 */
export class DashboardComponent {
  private jobs = inject(JobsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private localeService = inject(LocaleService);

  readonly stages = STAGES;
  readonly locales = LOCALES;
  query = '';
  status = signal<JobStatus | null>(null);
  isRunning = computed(() => {
    const s = this.status();
    return s !== null && (s.state === 'PENDING' || s.state === 'RUNNING');
  });

  locale = this.localeService.locale;
  activeLocaleLabel = computed(() => {
    const code = this.localeService.locale();
    return LOCALES.find(l => l.code === code)?.label ?? code;
  });

  private streamSub: Subscription | null = null;

  /** Switches the active locale via the shared locale service. */
  setLocale(code: LocaleCode) {
    this.localeService.set(code);
  }

  /**
   * Submits the current question and opens the streaming subscription
   * as soon as the orchestrator returns the new job identifier.
   */
  run() {
    this.cancelStream();
    this.status.set(null);
    this.jobs.submit(this.query.trim(), this.localeService.current()).subscribe({
      next: ({ jobId }) => this.openStream(jobId),
      error: err => this.status.set({
        jobId: '', state: 'FAILED', stage: 'failed',
        updatedAt: new Date().toISOString(),
        result: null,
        error: err?.message || 'Failed to submit job'
      })
    });
  }

  /** Cancels any active stream and clears the visible state. */
  reset() {
    this.cancelStream();
    this.status.set(null);
    this.query = '';
  }

  /** Cancels the stream, clears the session, and routes to the login page. */
  logout() {
    this.cancelStream();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Reports whether the timeline stage is the active one. */
  isActiveStage(key: string): boolean {
    const s = this.status();
    if (!s || s.state === 'DONE' || s.state === 'FAILED') return false;
    return (s.stage || '').startsWith(key);
  }
  /** Reports whether the timeline stage has already been completed. */
  isDoneStage(key: string): boolean {
    const s = this.status();
    if (!s) return false;
    if (s.state === 'DONE' && key === 'done') return true;
    if (s.state === 'DONE') return key !== 'done';
    const currentIdx = STAGES.findIndex(st => (s.stage || '').startsWith(st.key));
    const targetIdx = STAGES.findIndex(st => st.key === key);
    return currentIdx > targetIdx;
  }

  /** Extracts the numeric portion of a tier label for CSS class binding. */
  tierClass(reliability: string): string {
    if (reliability.endsWith('1')) return '1';
    if (reliability.endsWith('2')) return '2';
    return '3';
  }

  /**
   * Maps a numeric confidence score to one of three colour bands so the
   * score bar, the numeric label, and the overall confidence chip all
   * share consistent visual styling.
   */
  scoreBand(score: number): 'high' | 'medium' | 'low' {
    if (score == null) return 'low';
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  /**
   * Renders a compact representation of a URL for table display: host
   * plus a truncated path so long URLs do not blow up the column width.
   */
  shortUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.host + (u.pathname.length > 30 ? u.pathname.slice(0, 30) + '...' : u.pathname);
    } catch {
      return url;
    }
  }

  /**
   * Subscribes to the streaming feed for the given job id and pushes
   * each emitted snapshot into the visible state signal.
   */
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

  /** Cancels any active streaming subscription. */
  private cancelStream() {
    this.streamSub?.unsubscribe();
    this.streamSub = null;
  }
}
