import { getLocalStorageItem, setLocalStorageItem } from "@/utils/localStorageUtils";

export type Messages = { readonly [key: string]: string | Messages };
export type Locales = ReadonlyMap<string, () => Promise<Messages>>;
export type LanguageStore = { readonly read: () => string | null; readonly write: (language: string) => void };

// Default UI language for this enterprise deployment; shown to first-time
// visitors and used when a stored language is no longer supported.
export const DEFAULT_LANGUAGE = "zh";
// Statically bundled language every key falls back to when a translation is missing.
export const FALLBACK_LANGUAGE = "en";
// Languages bundled with the app itself (not lazily loaded via LOCALES).
const STATIC_LANGUAGES: readonly string[] = [FALLBACK_LANGUAGE];
export const LANGUAGE_STORAGE_KEY = "litellm_language";

export const LOCALES: Locales = new Map([
  [
    "zh",
    () =>
      import(
        /* webpackChunkName: "locale-zh" */ "./locales/zh.json"
      ).then((mod) => mod.default as Messages),
  ],
]);

export const browserLanguageStore: LanguageStore = {
  read: () => getLocalStorageItem(LANGUAGE_STORAGE_KEY),
  write: (language) => setLocalStorageItem(LANGUAGE_STORAGE_KEY, language),
};

export const resolveLanguage = (stored: string | null, locales: Locales): string =>
  stored !== null && (locales.has(stored) || STATIC_LANGUAGES.includes(stored))
    ? stored
    : DEFAULT_LANGUAGE;

export const supportedLanguages = (locales: Locales): readonly string[] => {
  const languages = new Set<string>(STATIC_LANGUAGES);
  for (const language of locales.keys()) languages.add(language);
  return [DEFAULT_LANGUAGE, ...[...languages].filter((language) => language !== DEFAULT_LANGUAGE)];
};

const displayName = (language: string, displayLanguage: string): string =>
  new Intl.DisplayNames([displayLanguage], { type: "language" }).of(language) ?? language;

export const nativeName = (language: string): string => {
  const name = displayName(language, language);
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
};

export const englishName = (language: string): string => displayName(language, FALLBACK_LANGUAGE);
