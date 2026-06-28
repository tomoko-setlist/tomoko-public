const SONG_FALLBACK_PREFIX_LENGTHS = [8, 6, 4, 3, 2] as const;

export function normalizeSongKey(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[ \u3000]/g, "")
        .replace(/[!"#$%&'()=~\-|^\\@`[\]{};:+*<>,.?＿ー‐－―〜～・･、。！？"”’：「」『』【】]/g, "");
}

export function buildSongFallbackTerms(value: string): string[] {
    const compact = value
        .normalize("NFKC")
        .replace(/[ \u3000]/g, "")
        .trim();
    const chars = Array.from(compact);
    const out: string[] = [];
    for (const length of SONG_FALLBACK_PREFIX_LENGTHS) {
        if (chars.length <= length) continue;
        const candidate = chars.slice(0, length).join("");
        if (!candidate || out.includes(candidate)) continue;
        out.push(candidate);
    }
    return out;
}
