import i18n, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";

import { registerFormats } from "./formats";
import en from "./locales/en.json";
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, LOCALES, resolveLanguage } from "./languages";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

// On the client, start in the language the user picked so statically bundled
// languages (en) paint correctly before LanguageGate's async switch.
const initialLanguage = (): string => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    return resolveLanguage(localStorage.getItem("litellm_language"), LOCALES);
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

const options: InitOptions = {
  lng: initialLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  resources: { en: { translation: en } },
  initAsync: false,
};

void i18n.use(initReactI18next).init(options);

if (i18n.services.formatter) registerFormats(i18n.services.formatter);

export default i18n;
