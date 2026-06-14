// localization.ts
// Auto-generated from contracts/localization.md
// Do not edit manually

export interface Locale {
  code: unknown;
  name: unknown;
  direction: ltr|rtl;
  numberFormat: unknown;
  dateFormat: unknown;
  currency: unknown;
}

export interface LocalizationContract {
  getTranslation(key: unknown, locale: unknown, variables?: unknown): Promise<string>;
  getTranslations(keys: unknown, locale: unknown): Promise<Record<string, string>>;
  setTranslation(key: unknown, locale: unknown, value: unknown): Promise<void>;
  listLocales(): Promise<Locale[]>;
  getLocale(localeCode: unknown): Promise<Locale>;
  detectLocale(acceptLanguage: unknown): Promise<string>;
  formatCurrency(amount: unknown, currency: unknown, locale: unknown): Promise<string>;
  formatDate(date: unknown, format: unknown, locale: unknown): Promise<string>;
  formatNumber(number: unknown, locale: unknown, options?: unknown): Promise<string>;
}
