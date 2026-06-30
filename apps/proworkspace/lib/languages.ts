export const SUPPORTED_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिन्दी" },
    { code: "fr", label: "Français" },
    { code: "ko", label: "한국어" },
    { code: "ja", label: "日本語" },
    { code: "zh-CN", label: "中文（简体）" },
    { code: "nl", label: "Nederlands" },
    { code: "ru", label: "Русский" },
    { code: "pt", label: "Português" },
    { code: "sv", label: "Svenska" },
    { code: "id", label: "Bahasa Indonesia" },
    { code: "it", label: "Italiano" },
    { code: "zh-TW", label: "中文（台灣）" }
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en";

export const isSupportedLanguage = (value: string): value is SupportedLanguageCode =>
    SUPPORTED_LANGUAGES.some((language) => language.code === value);

export const normalizeLanguage = (value: string) =>
    isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
