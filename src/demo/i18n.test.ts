import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { translate, translationKeys } from "./i18n";

it("has Spanish translations for all declared interface text and accessible attributes", () => {
  const html = readFileSync("index.html", "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-(?:heading|label|placeholder|text|aria-label|title))?="([^"]+)"/g)].map(match => match[1]);
  expect(keys.length).toBeGreaterThan(50);
  for (const key of keys) expect(translationKeys, key).toContain(key);
});

it("renders count placeholders in both languages without translating source names", () => {
  const key = "{groups} groups in view · {items} communities";
  expect(translate(key, "en", { groups: 5, items: 22 })).toBe("5 groups in view · 22 communities");
  expect(translate(key, "es", { groups: 5, items: 22 })).toBe("5 grupos en vista · 22 comunidades");
  for (const lang of ["en", "es"] as const) expect(translate("Pamplona/Iruña", lang)).toBe("Pamplona/Iruña");
});
