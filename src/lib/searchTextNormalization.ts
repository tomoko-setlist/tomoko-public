const SEARCH_KEY_REMOVE_RE =
    /[\s\u3000!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。，．・･：；！？（）［］｛｝「」『』【】〈〉《》〔〕“”‘’｀´〜～ｰー－―‐]/g;

const HIRAGANA_RE = /[\u3041-\u3096]/g;

const kanaReadingPatterns: Array<[string, string]> = [
    ["サマー", "summer"],
    ["サマ", "summer"],
    ["ナイト", "night"],
    ["ラブ", "love"],
    ["トゥ", "two"],
    ["ツー", "two"],
    ["スリー", "three"],
    ["スリ", "three"],
    ["ワン", "one"],
];

const englishReadingPatterns: Array<[string, string]> = [
    ["summer", "サマー"],
    ["night", "ナイト"],
    ["love", "ラブ"],
    ["three", "スリー"],
    ["two", "トゥ"],
    ["one", "ワン"],
];

const toKatakana = (value: string): string =>
    value.replace(HIRAGANA_RE, (char) =>
        String.fromCharCode(char.charCodeAt(0) + 0x60),
    );

const applyKanaReadingPatterns = (value: string): string => {
    let next = value;
    kanaReadingPatterns.forEach(([kana, replacement]) => {
        next = next.replaceAll(kana, replacement);
    });
    return next;
};

const applyEnglishReadingPatterns = (value: string): string => {
    let next = value;
    englishReadingPatterns.forEach(([english, replacement]) => {
        next = next.replaceAll(english, replacement);
    });
    return next;
};

const normalizeSearchKeyBase = (value: string): string =>
    String(value ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(SEARCH_KEY_REMOVE_RE, "")
        .trim();

export const normalizeSearchKey = (value: string | null | undefined): string =>
    normalizeSearchKeyBase(toKatakana(String(value ?? "").normalize("NFKC")));

export const normalizeSearchKeyWithoutKanaFold = (
    value: string | null | undefined,
): string => normalizeSearchKeyBase(String(value ?? ""));

export const normalizeSearchKeyVariants = (
    value: string | null | undefined,
): string[] => {
    const base = normalizeSearchKey(value);
    if (!base) return [];

    const variants = new Set<string>([base]);
    const readingVariant = normalizeSearchKey(applyKanaReadingPatterns(base));
    if (readingVariant) {
        variants.add(readingVariant);
    }
    const kanaVariant = normalizeSearchKey(applyEnglishReadingPatterns(base));
    if (kanaVariant) {
        variants.add(kanaVariant);
    }
    return [...variants];
};
