import { Injectable, signal } from '@angular/core';

/**
 * Locale codes recognised by prompt-service. The strings must match column
 * headers in {@code prompt-text.csv}; if you add a new locale there, add it
 * here and to the {@link LOCALES} list so the UI switcher exposes it.
 */
export type LocaleCode = 'en_US' | 'vn_VN';

/** Display metadata for the language switcher. */
export interface LocaleOption {
  code: LocaleCode;
  label: string;   // shown in the UI
  short: string;   // shown on the toggle button itself
}

export const LOCALES: LocaleOption[] = [
  { code: 'en_US', label: 'English',    short: 'EN' },
  { code: 'vn_VN', label: 'Tiếng Việt', short: 'VN' }
];

const STORAGE_KEY = 'llm-counsil.locale';
const DEFAULT_LOCALE: LocaleCode = 'en_US';

/**
 * Holds the active UI locale and persists it across reloads. The chosen
 * locale is sent to the backend on every job submission and ultimately drives
 * which {@code prompt-text.csv} column the prompt-service reads from.
 *
 * Components read {@link locale} (a signal) for reactive bindings and call
 * {@link set} to switch language.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly _locale = signal<LocaleCode>(this.readInitial());

  readonly locale = this._locale.asReadonly();

  /** Convenience for non-reactive callers (services). */
  current(): LocaleCode {
    return this._locale();
  }

  set(code: LocaleCode): void {
    if (code === this._locale()) return;
    this._locale.set(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode etc. */ }
  }

  /** Toggle through the available locales (used by the simple chip switcher). */
  cycle(): void {
    const i = LOCALES.findIndex(l => l.code === this._locale());
    const next = LOCALES[(i + 1) % LOCALES.length];
    this.set(next.code);
  }

  private readInitial(): LocaleCode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && LOCALES.some(l => l.code === v)) return v as LocaleCode;
    } catch { /* private mode etc. */ }
    return DEFAULT_LOCALE;
  }
}
