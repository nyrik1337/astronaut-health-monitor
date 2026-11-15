/**
 * One dictionary section: English is the source of truth for the keys, and the Russian object
 * must provide exactly the same keys (checked by the compiler).
 */
export function section<E extends Record<string, string>>(en: E, ru: Record<keyof E, string>) {
  return { en, ru };
}
