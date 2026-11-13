import { describe, expect, it } from "vitest";

import { englishName, Locales, nativeName, resolveLanguage, supportedLanguages } from "./languages";

const locales: Locales = new Map([["ja", async () => ({})]]);

describe("resolveLanguage", () => {
  it("uses the stored language when it has translations", () => {
    expect(resolveLanguage("ja", locales)).toBe("ja");
  });

  it("uses a statically bundled language even without a lazy loader", () => {
    expect(resolveLanguage("en", locales)).toBe("en");
  });

  it.each([null, "", "fr", "JA", "ja-JP", "__proto__"])("falls back to the default language when the stored value is %j", (stored) => {
    expect(resolveLanguage(stored, locales)).toBe("zh");
  });

  it("falls back to the default language even without translations", () => {
    expect(resolveLanguage("ja", new Map())).toBe("zh");
  });
});

describe("supportedLanguages", () => {
  it("puts the default language first, then the fallback and every other language", () => {
    expect(supportedLanguages(locales)).toEqual(["zh", "en", "ja"]);
    expect(supportedLanguages(new Map())).toEqual(["zh", "en"]);
    expect(supportedLanguages(new Map([["zh", locales.get("ja") as () => Promise<never>]]))).toEqual(["zh", "en"]);
  });
});

describe("language names", () => {
  it("names a language in itself, starting with a capital letter", () => {
    const spanish = nativeName("es");

    expect(spanish.toLocaleLowerCase("es")).toBe(
      new Intl.DisplayNames(["es"], { type: "language" }).of("es")?.toLocaleLowerCase("es"),
    );
    expect(spanish.charAt(0)).toBe(spanish.charAt(0).toLocaleUpperCase("es"));
  });

  it("names a language in English for the secondary label", () => {
    expect(englishName("ja")).toBe(new Intl.DisplayNames(["en"], { type: "language" }).of("ja"));
    expect(englishName("ja")).not.toBe(nativeName("ja"));
  });
});
