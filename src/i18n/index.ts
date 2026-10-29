import { useSyncExternalStore } from "react";
import { fr } from "./fr";
import { de } from "./de";

export type Language = "en" | "fr" | "de";

/** Each language by its own name for itself */
export const LANGUAGES: { id: Language; name: string }[] = [
  { id: "en", name: "English" },
  { id: "fr", name: "Français" },
  { id: "de", name: "Deutsch" },
];

const STORAGE_KEY = "cursed-chess-language";

/** Each language's wording, by the English it stands for */
const DICTIONARIES: Record<Language, Record<string, string>> = {
  en: {},
  fr,
  de,
};

const isLanguage = (id: string | null): id is Language =>
  LANGUAGES.some((l) => l.id === id);

/** The language chosen before, or else the browser's, if the game speaks it */
function startingLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) return stored;
  const browser = navigator.language.slice(0, 2);
  return isLanguage(browser) ? browser : "en";
}

let language = startingLanguage();
document.documentElement.lang = language;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return language;
}

export function setLanguage(next: Language): void {
  if (next === language) return;
  language = next;
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage);
}

/** `text` in the chosen language, with each `{name}` in it filled in from `vars` */
export function t(
  text: string,
  vars?: Record<string, string | number>,
): string {
  const said = DICTIONARIES[language][text] ?? text;
  if (!vars) return said;
  return said.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
