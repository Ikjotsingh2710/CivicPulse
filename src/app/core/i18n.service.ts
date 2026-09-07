import { Injectable, signal } from '@angular/core';

import { LANGUAGES, STRINGS, type Lang, type StringKey } from './i18n';

const STORAGE_KEY = 'civicpulse.lang';

/**
 * The active language, and the lookup every template goes through.
 *
 * `lang` is a signal, so `t()` reading it inside a template makes that view
 * depend on it — switching language repaints the app with no reload and no
 * second bundle. That is the whole reason this is hand-rolled rather than
 * `$localize`, which decides the language at build time.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(detect());
  readonly languages = LANGUAGES;

  constructor() {
    this.applyToDocument(this.lang());
  }

  /**
   * Looks up a string, substituting `{name}` placeholders.
   *
   * Falls back to English when a Hindi value is missing, and to the key itself
   * only if the key does not exist — a half-translated screen stays usable,
   * and a typo is visible rather than blank.
   */
  t(key: StringKey, vars?: Record<string, string | number>): string {
    const entry = STRINGS[key] as { en: string; hi?: string } | undefined;
    if (!entry) return key;

    const value = (this.lang() === 'hi' ? entry.hi : entry.en) || entry.en;
    if (!vars) return value;

    return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
  }

  /**
   * Translates a value that arrives from the database as English text.
   *
   * Status and category are stored in English because RLS policies, admin
   * filters and CSV exports all compare them — translating the stored value
   * would break every one of those. So the column stays English and only the
   * display is localised. An unmapped value falls through unchanged, which is
   * what should happen when a new category is added before its translation is.
   */
  label(kind: 'status' | 'category' | 'urgency' | 'chip', value: string): string {
    const key = `${kind}.${value}` as StringKey;
    return key in STRINGS ? this.t(key) : value;
  }

  set(lang: Lang): void {
    this.lang.set(lang);
    this.applyToDocument(lang);

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Private browsing, or storage disabled. The choice still applies for
      // this visit; it just will not be remembered, which is not worth an error.
    }
  }

  /**
   * Keeps `<html lang>` honest.
   *
   * Screen readers pick their pronunciation from it, and a page of Devanagari
   * announced as English is unusable — so this is not decoration.
   */
  private applyToDocument(lang: Lang): void {
    document.documentElement.lang = lang;
  }
}

/**
 * Remembered choice first, then the browser's own preference.
 *
 * A phone set to Hindi should open in Hindi without anyone hunting for a
 * toggle; anyone who has chosen once should never be asked again.
 */
function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch {
    // Storage unavailable — fall through to the browser preference.
  }

  return navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
}
