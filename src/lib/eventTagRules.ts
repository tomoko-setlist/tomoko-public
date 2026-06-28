export type EventTagInferenceParams = {
    eventName: string;
    category?: string | null;
    groups?: readonly string[] | null;
    performerLine?: string | null;
};

type EventTagRule = {
    tagName: string;
    matches: (params: {
        eventName: string;
        category: string;
        groups: string[];
        performerLine: string;
    }) => boolean;
};

const normalizeText = (value: unknown): string =>
    (typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
        ? String(value)
        : "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t\r\n]+/g, " ")
        .trim();

const includesAny = (value: string, patterns: RegExp[]): boolean =>
    patterns.some((pattern) => pattern.test(value));

const normalizeParams = (params: EventTagInferenceParams) => ({
    eventName: normalizeText(params.eventName),
    category: normalizeText(params.category ?? "").toUpperCase(),
    groups: (params.groups ?? [])
        .map((value) => normalizeText(value))
        .filter(Boolean),
    performerLine: normalizeText(params.performerLine ?? ""),
});

const isHelloProjectConcertLike = (eventName: string): boolean =>
    includesAny(eventName, [
        /Hello!\s*Project/u,
        /ハロ！?コン/u,
        /花鳥風月/u,
        /THREE OF US/u,
        /TWO OF US/u,
        /ALL OF US/u,
    ]);

const isHelloProjectMixedEvent = (eventName: string): boolean =>
    isHelloProjectConcertLike(eventName) ||
    includesAny(eventName, [/Hello!\s*Project/u, /ハロプロ/u]);

const isHelloProjectCityCircuit = (eventName: string): boolean =>
    /Hello!\s*Project.+CITY\s+CIRCUIT/iu.test(eventName);

const isFestivalLike = (eventName: string): boolean =>
    includesAny(eventName, [
        /FES/iu,
        /FESTIVAL/iu,
        /フェス/u,
        /フェスタ/u,
        /EXPO/iu,
        /(?:^|[^A-Za-z])JAM(?:$|[^A-Za-z])/iu,
        /@ ?JAM/iu,
        /対バン/u,
        /SUPER LIVE/iu,
        /UP GATE/iu,
        /アイドルパーク/u,
        /コラボステージ/u,
        /ライブフェス/u,
        /音楽祭/u,
        /IDOL COLLECTION/iu,
        /IDOL SQUARE/iu,
        /SQUARE PARTY/iu,
        /ちかっぱ祭/u,
        /KAWAII SONIC/iu,
        /GIGA[･・\s-]*GIGA SONIC/iu,
        /NATSUZOME/iu,
        /IDOL LIVE JAPAN/iu,
        /ISE GIRLS FRONTIER/iu,
        /SMILE PLUS/iu,
        /COUNTDOWN JAPAN/iu,
        /a-nation/iu,
        /TOKYO GIRLS MUSIC FES/iu,
        /ナタリー.+×.+/u,
    ]);

const isSinglePerformanceLike = (params: {
    eventName: string;
    category: string;
    groups: string[];
}): boolean => {
    if (params.category !== "CONCERT") return false;
    if (params.groups.length === 0) return false;
    if (
        includesAny(params.eventName, [
            /Hello!\s*Project/u,
            /ハロプロ/u,
            /研修生/u,
            /プレミアム/u,
            /合同/u,
            /対バン/u,
        ])
    ) {
        return false;
    }
    return true;
};

export const EVENT_TAG_RULES: readonly EventTagRule[] = [
    {
        tagName: "カウコン",
        matches: ({ eventName }) =>
            includesAny(eventName, [
                /COUNTDOWN PARTY/iu,
                /Year-End Party/iu,
                /カウントダウン/u,
                /カウコン/u,
            ]),
    },
    {
        tagName: "BDイベント",
        matches: ({ eventName }) =>
            includesAny(eventName, [
                /バースデー/u,
                /BIRTHDAY/iu,
                /生誕/u,
            ]),
    },
    {
        tagName: "FCイベント",
        matches: ({ eventName }) =>
            includesAny(eventName, [
                /FCイベント/u,
                /ファンクラブイベント/u,
                /ＦＣイベント/u,
                /FCツアー/u,
                /FCソロライブ/u,
                /ANNEX/u,
                /Hello!\s*Project\s*FCイベント/iu,
                /^℃フェス/u,
            ]),
    },
    {
        tagName: "FCツアー",
        matches: ({ eventName }) =>
            includesAny(eventName, [/FCツアー/u, /ファンクラブツアー/u]),
    },
    {
        tagName: "名古屋イベ",
        matches: ({ eventName }) =>
            includesAny(eventName, [/ in 名古屋/u, /in 名古屋/u]),
    },
    {
        tagName: "大阪イベ",
        matches: ({ eventName }) =>
            includesAny(eventName, [/ in 大阪/u, /in 大阪/u, /【大阪公演】/u, /大阪公演/u]),
    },
    {
        tagName: "リリイベ",
        matches: ({ eventName }) =>
            includesAny(eventName, [
                /発売記念/u,
                /リリースイベント/u,
                /リリイベ/u,
            ]),
    },
    {
        tagName: "シリイベ",
        matches: ({ eventName }) =>
            includesAny(eventName, [/シリアルイベント/u, /シリイベ/u]),
    },
    {
        tagName: "ひなフェス",
        matches: ({ eventName }) =>
            includesAny(eventName, [/ひなフェス/u, /ハロ！フェス/u, /ひな祭りフェスティバル/u]),
    },
    {
        tagName: "ハロコン",
        matches: ({ eventName }) =>
            isHelloProjectConcertLike(eventName) &&
            !includesAny(eventName, [
                /ひなフェス/u,
                /ハロ！フェス/u,
                /ひな祭りフェスティバル/u,
                /研修生発表会/u,
                /COUNTDOWN PARTY/iu,
                /Year-End Party/iu,
                /FCイベント/u,
                /ファンクラブイベント/u,
                /Hello!\s*Project\s+New\s+Fes!?/iu,
                /Hello!\s*Project.+CITY\s+CIRCUIT/iu,
            ]),
    },
    {
        tagName: "合同コンサート",
        matches: ({ eventName }) =>
            includesAny(eventName, [/Hello!\s*Project\s+New\s+Fes!?/iu]),
    },
    {
        tagName: "発表会",
        matches: ({ eventName }) => /研修生発表会/u.test(eventName),
    },
    {
        tagName: "実力診断テスト",
        matches: ({ eventName }) => /実力診断テスト/u.test(eventName),
    },
    {
        tagName: "MSMW",
        matches: ({ eventName }) => /M-line Special/u.test(eventName),
    },
    {
        tagName: "公開収録",
        matches: ({ eventName, performerLine }) =>
            includesAny(`${eventName} ${performerLine}`, [/公開収録/u, /公録/u]),
    },
    {
        tagName: "ハーフタイムショー",
        matches: ({ eventName }) => /ハーフタイムショー/u.test(eventName),
    },
    {
        tagName: "クリイベ",
        matches: ({ eventName }) =>
            includesAny(eventName, [/クリスマス/iu, /Xmas/iu, /X'mas/iu, /メリクリ/u]),
    },
    {
        tagName: "海外",
        matches: ({ eventName }) =>
            includesAny(eventName, [
                /Taipei/iu,
                /台北/u,
                /Hong Kong/iu,
                /香港/u,
                /THAILAND/iu,
                /海外/u,
                /中国単独公演/u,
            ]),
    },
    {
        tagName: "卒コン",
        matches: ({ eventName }) =>
            includesAny(eventName, [/卒業スペシャル/u, /卒業公演/u, /卒業記念/u]),
    },
    {
        tagName: "ソロライブ",
        matches: ({ eventName }) =>
            includesAny(eventName, [/ソロライブ/u, /単独ライブ/u]),
    },
    {
        tagName: "ライブツアー",
        matches: ({ eventName }) =>
            !isHelloProjectMixedEvent(eventName) &&
            includesAny(eventName, [/\bLIVE\s+TOUR\b/iu, /ライブツアー/u]),
    },
    {
        tagName: "コンサートツアー",
        matches: ({ eventName }) =>
            !isHelloProjectMixedEvent(eventName) &&
            includesAny(eventName, [/\bCONCERT\s+TOUR\b/iu, /コンサートツアー/u]),
    },
    {
        tagName: "灼熱",
        matches: ({ eventName }) => /灼熱/u.test(eventName),
    },
    {
        tagName: "音霊",
        matches: ({ eventName }) => /音霊/u.test(eventName),
    },
    {
        tagName: "バラッド",
        matches: ({ eventName }) =>
            includesAny(eventName, [/Ballad/iu, /バラッド/u]),
    },
    {
        tagName: "エムハロ",
        matches: ({ eventName }) => /エムハロ/u.test(eventName),
    },
    {
        tagName: "フェス・対バン",
        matches: ({ eventName }) =>
            !includesAny(eventName, [
                /ひなフェス/u,
                /ハロ！フェス/u,
                /ひな祭りフェスティバル/u,
                /^℃フェス/u,
                /FCイベント/u,
                /ファンクラブイベント/u,
                /ＦＣイベント/u,
                /ANNEX/u,
                /外フェス/u,
                /Hello!\s*Project\s+New\s+Fes!?/iu,
            ]) &&
            isFestivalLike(eventName),
    },
    {
        tagName: "単独公演",
        matches: (params) =>
            ((!isHelloProjectMixedEvent(params.eventName) ||
                isHelloProjectCityCircuit(params.eventName)) &&
                isSinglePerformanceLike(params)) ||
            ((!isHelloProjectMixedEvent(params.eventName) ||
                isHelloProjectCityCircuit(params.eventName)) &&
                includesAny(params.eventName, [
                    /ナルチカ/u,
                    /\bLIVE\s+TOUR\b/iu,
                    /\bCONCERT\s+TOUR\b/iu,
                    /ライブツアー/u,
                    /コンサートツアー/u,
                    /Spring Live/iu,
                    /BAND LIVE/iu,
                    /LIVE at BUDOKAN/iu,
                ])),
    },
];

export const inferEventTagNames = (
    params: EventTagInferenceParams,
): string[] => {
    const normalized = normalizeParams(params);
    const tags = new Set<string>();
    for (const rule of EVENT_TAG_RULES) {
        if (rule.matches(normalized)) {
            tags.add(rule.tagName);
        }
    }
    return Array.from(tags);
};
