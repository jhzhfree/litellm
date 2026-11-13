"use client";

import type { i18n as I18n } from "i18next";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";

import LoadingScreen from "@/components/common_components/LoadingScreen";

import i18n from "./i18n";
import { browserLanguageStore, DEFAULT_LANGUAGE, LanguageStore, Locales, LOCALES, resolveLanguage } from "./languages";

type LanguageGateProps = {
  i18n: I18n;
  locales: Locales;
  store: LanguageStore;
  children: React.ReactNode;
};

export function LanguageGate({ i18n, locales, store, children }: LanguageGateProps) {
  // Read the stored language during the first client render. The gate renders
  // the same children for the default language, so SSR HTML still hydrates, and
  // we never start a lazy load for a language the user did not pick.
  const [language] = useState(() =>
    typeof window === "undefined" ? DEFAULT_LANGUAGE : resolveLanguage(store.read(), locales),
  );
  const [settled, setSettled] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    const load = locales.get(language);
    // Ignore settlements from a superseded language (e.g. the initial default
    // finishing after the stored language already took over).
    let cancelled = false;
    const apply = () =>
      i18n.changeLanguage(language).then(() => {
        if (!cancelled) document.documentElement.lang = language;
      });
    if (!load) {
      // Statically bundled language (e.g. en): resources are already in i18n.
      // Settle synchronously so a slow/never-resolving switch cannot pin the gate
      // on the loading screen.
      setSettled(language);
      apply().catch((error: unknown) => console.warn(`Couldn't switch to the "${language}" language`, error));
      return () => {
        cancelled = true;
      };
    }
    load()
      .then((messages) => {
        i18n.addResourceBundle(language, "translation", messages);
      })
      .then(apply)
      .catch((error: unknown) => console.warn(`Couldn't load the "${language}" translations`, error))
      .finally(() => {
        if (!cancelled) setSettled(language);
      });
    return () => {
      cancelled = true;
    };
  }, [i18n, language, locales]);

  // Statically bundled languages need no async load: never pin the gate on
  // the loading screen for them.
  const isStaticLanguage = !locales.has(language);
  return language === settled || isStaticLanguage ? children : <LoadingScreen />;
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageGate i18n={i18n} locales={LOCALES} store={browserLanguageStore}>
        {children}
      </LanguageGate>
    </I18nextProvider>
  );
}
