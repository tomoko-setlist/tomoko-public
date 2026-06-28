type TagLike = {
    name: string;
};

const PRIORITY_RULES: Array<{ key: string; matchers: string[] }> = [
    { key: "単独", matchers: ["単独"] },
    { key: "ハロコン", matchers: ["ハロコン"] },
    { key: "FC", matchers: ["fc", "ファンクラブ"] },
    { key: "BD", matchers: ["bd", "バースデー", "birthday"] },
    { key: "リリイベ", matchers: ["リリイベ", "リリースイベント"] },
    { key: "フェス・対バン", matchers: ["フェス", "対バン"] },
    { key: "OG", matchers: ["og"] },
];

const normalize = (value: string): string =>
    value
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[・･\-_/()（）[\]【】]/g, "");

const priorityIndex = (name: string): number => {
    const normalized = normalize(name);
    const index = PRIORITY_RULES.findIndex((rule) =>
        rule.matchers.some((matcher) => normalized.includes(normalize(matcher))),
    );
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

export const sortEventTagsByPriority = <T extends TagLike>(tags: T[]): T[] =>
    [...tags].sort((a, b) => {
        const pa = priorityIndex(a.name);
        const pb = priorityIndex(b.name);
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name, "ja");
    });

