export const ALLOWED_RELEASE_TAGS = [
    "notice",
    "release",
    "ui",
    "search",
    "performance",
    "routing",
    "data",
    "db",
    "fix",
    "maintenance",
] as const;

export type ReleaseTag = (typeof ALLOWED_RELEASE_TAGS)[number];

const ALLOWED_RELEASE_TAG_SET = new Set<string>(ALLOWED_RELEASE_TAGS);

const normalizeTag = (value: string): string => value.trim().toLowerCase();

export const parseReleaseTagsCsv = (tagsCsv: string): {
    tags: ReleaseTag[];
    unknownTags: string[];
} => {
    const unique = new Set<string>();
    const tags: ReleaseTag[] = [];
    const unknownTags: string[] = [];

    for (const raw of tagsCsv.split(",")) {
        const tag = normalizeTag(raw);
        if (!tag || unique.has(tag)) continue;
        unique.add(tag);
        if (ALLOWED_RELEASE_TAG_SET.has(tag)) {
            tags.push(tag as ReleaseTag);
        } else {
            unknownTags.push(tag);
        }
    }

    return { tags, unknownTags };
};

export const joinReleaseTagsCsv = (tags: readonly ReleaseTag[]): string =>
    Array.from(new Set(tags)).join(",");
