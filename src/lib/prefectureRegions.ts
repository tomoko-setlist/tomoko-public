import type { MasterOption } from "./setlistSearchDb/types";

export type DropdownOption = {
    value: string;
    label: string;
};

export type DropdownOptionGroup = {
    id: string;
    label: string;
    options: DropdownOption[];
};

export const PREFECTURE_REGIONS: Array<{ id: string; label: string; names: readonly string[] }> = [
    { id: "hokkaido", label: "北海道", names: ["北海道"] },
    {
        id: "tohoku",
        label: "東北",
        names: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
    },
    {
        id: "kanto",
        label: "関東",
        names: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
    },
    {
        id: "hokuriku",
        label: "北陸",
        names: ["富山県", "石川県", "福井県"],
    },
    {
        id: "koshinetsu",
        label: "甲信越",
        names: ["新潟県", "山梨県", "長野県"],
    },
    {
        id: "tokai",
        label: "東海",
        names: ["岐阜県", "静岡県", "愛知県", "三重県"],
    },
    {
        id: "kinki",
        label: "近畿",
        names: ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
    },
    {
        id: "chugoku",
        label: "中国",
        names: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
    },
    {
        id: "shikoku",
        label: "四国",
        names: ["徳島県", "香川県", "愛媛県", "高知県"],
    },
    {
        id: "kyushu_okinawa",
        label: "九州・沖縄",
        names: [
            "福岡県",
            "佐賀県",
            "長崎県",
            "熊本県",
            "大分県",
            "宮崎県",
            "鹿児島県",
            "沖縄県",
        ],
    },
];

export const buildPrefectureOptionGroups = (
    options: MasterOption[],
): DropdownOptionGroup[] => {
    const byName = new Map(options.map((option) => [option.name, option]));
    const assignedIds = new Set<number>();
    const groups: DropdownOptionGroup[] = [];

    for (const region of PREFECTURE_REGIONS) {
        const regionOptions: DropdownOption[] = [];
        for (const name of region.names) {
            const option = byName.get(name);
            if (!option) continue;
            regionOptions.push({
                value: String(option.id),
                label: option.name,
            });
            assignedIds.add(option.id);
        }
        if (regionOptions.length > 0) {
            groups.push({
                id: region.id,
                label: region.label,
                options: regionOptions,
            });
        }
    }

    const unassigned = options.filter((option) => !assignedIds.has(option.id));
    if (unassigned.length > 0) {
        groups.push({
            id: "other",
            label: "その他",
            options: unassigned.map((option) => ({
                value: String(option.id),
                label: option.name,
            })),
        });
    }

    return groups;
};

export const flattenDropdownOptionGroups = (
    groups: DropdownOptionGroup[],
): DropdownOption[] => groups.flatMap((group) => group.options);
