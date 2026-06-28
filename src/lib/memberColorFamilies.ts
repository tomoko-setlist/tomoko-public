import type { DropdownOptionGroup } from "./prefectureRegions";

type MemberColorFamily = {
    id: string;
    label: string;
    test: (colorName: string) => boolean;
};

export const MEMBER_COLOR_FAMILIES: MemberColorFamily[] = [
    { id: "pink", label: "ピンク系", test: (name) => /ピンク|桃|ピーチ/.test(name) },
    {
        id: "red",
        label: "レッド・赤系",
        test: (name) => /レッド|赤|紅|緋|スカーレット|クリムゾン|りんご|リンゴ/.test(name),
    },
    {
        id: "aqua",
        label: "水色系",
        test: (name) => /水色|ターコイズ|アクア|シーブルー|ライトブルー|スカイ/.test(name),
    },
    {
        id: "blue",
        label: "青系",
        test: (name) => /ブルー|青|ネイビー|紺|インディゴ/.test(name),
    },
    {
        id: "yellowGreen",
        label: "黄緑・ライトグリーン系",
        test: (name) =>
            /(?<!ブ)ライトグリーン|黄緑|イエローグリーン|ライム|ミント|メロン/.test(name),
    },
    {
        id: "green",
        label: "グリーン・緑系",
        test: (name) => /ブライトグリーン|グリーン|緑|エメラルド/.test(name),
    },
    {
        id: "yellow",
        label: "イエロー・黄系",
        test: (name) => /イエロー|黄|ゴールド|レモン|デイジー|ハニー|マスタード/.test(name),
    },
    {
        id: "purple",
        label: "パープル・紫系",
        test: (name) => /パープル|紫|ラベンダー|バイオレット|むらさき|ブドウ|葡萄/.test(name),
    },
    { id: "orange", label: "オレンジ系", test: (name) => /オレンジ/.test(name) },
    { id: "white", label: "ホワイト・白系", test: (name) => /ホワイト|白/.test(name) },
    { id: "black", label: "ブラック・黒系", test: (name) => /ブラック|黒/.test(name) },
];

export const classifyMemberColorFamily = (colorName: string): string => {
    const normalized = colorName.trim();
    if (!normalized) return "other";
    for (const family of MEMBER_COLOR_FAMILIES) {
        if (family.test(normalized)) return family.id;
    }
    return "other";
};

export const buildMemberColorOptionGroups = (colorNames: string[]): DropdownOptionGroup[] => {
    const byFamily = new Map<string, string[]>();
    const unassigned: string[] = [];

    for (const rawName of colorNames) {
        const name = rawName.trim();
        if (!name) continue;
        const familyId = classifyMemberColorFamily(name);
        if (familyId === "other") {
            unassigned.push(name);
            continue;
        }
        const bucket = byFamily.get(familyId) ?? [];
        bucket.push(name);
        byFamily.set(familyId, bucket);
    }

    const groups: DropdownOptionGroup[] = [];
    for (const family of MEMBER_COLOR_FAMILIES) {
        const names = byFamily.get(family.id);
        if (!names || names.length === 0) continue;
        groups.push({
            id: family.id,
            label: family.label,
            options: [...names].sort((left, right) => left.localeCompare(right, "ja")).map((name) => ({
                value: name,
                label: name,
            })),
        });
    }

    if (unassigned.length > 0) {
        groups.push({
            id: "other",
            label: "その他",
            options: [...unassigned]
                .sort((left, right) => left.localeCompare(right, "ja"))
                .map((name) => ({
                    value: name,
                    label: name,
                })),
        });
    }

    return groups;
};

export const formatMemberColorNamesLabel = (value: string): string => {
    const names = value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    if (names.length === 0) return "";
    return names.join(", ");
};

export const getMemberColorFamilyLabel = (familyId: string): string | null => {
    if (familyId === "other") return "その他";
    return MEMBER_COLOR_FAMILIES.find((family) => family.id === familyId)?.label ?? null;
};
