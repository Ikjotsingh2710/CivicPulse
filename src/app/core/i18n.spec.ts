import { LANGUAGES, STRINGS, type StringKey } from './i18n';

/**
 * A missing translation does not break a build or fail a request — it shows an
 * English sentence in the middle of a Hindi page, and the person who needed
 * Hindi is the one who finds out. These cases are the only thing standing
 * between a half-translated screen and a citizen.
 */

const keys = Object.keys(STRINGS) as StringKey[];

describe('the string table', () => {
  it('has a Hindi translation for every key', () => {
    const untranslated = keys.filter((key) => {
      const entry = STRINGS[key] as { en: string; hi?: string };
      return !entry.hi?.trim();
    });

    expect(untranslated).toEqual([]);
  });

  it('never leaves a Hindi value identical to its English one', () => {
    // A copy-paste that forgot to translate looks complete but is not. Product
    // names are the honest exception and none are currently stored bare.
    const copied = keys.filter((key) => {
      const entry = STRINGS[key] as { en: string; hi?: string };
      return entry.hi === entry.en;
    });

    expect(copied).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    // `{metres}` present in English but misspelt in Hindi renders the braces
    // to the citizen. This is the failure most likely to slip through review.
    const mismatched: string[] = [];

    for (const key of keys) {
      const entry = STRINGS[key] as { en: string; hi?: string };
      const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort().join(',');

      if (entry.hi && placeholders(entry.en) !== placeholders(entry.hi)) {
        mismatched.push(key);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('offers exactly the two languages the app is built for', () => {
    expect(LANGUAGES.map((language) => language.code)).toEqual(['en', 'hi']);
  });

  it('translates every status and category the database can store', () => {
    // These arrive from Postgres as English text. An untranslated one shows a
    // raw column value on an otherwise Hindi card.
    const required = [
      'status.Submitted',
      'status.In Progress',
      'status.Resolved',
      'status.Rejected',
      'category.Potholes',
      'category.Broken Streetlight',
      'category.Waste',
      'category.Water Leakage',
      'category.Other',
      'urgency.Low',
      'urgency.Medium',
      'urgency.High',
    ];

    for (const key of required) {
      expect(keys).toContain(key as StringKey);
    }
  });
});
