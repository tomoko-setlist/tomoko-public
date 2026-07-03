import type { FC, LazyExoticComponent } from "react";
import type { SetlistSearchDb } from "./setlistSearchDb/types";

export type AdminPrivatePageProps = Record<string, never>;

export type StatsPrivatePageProps = {
    db: SetlistSearchDb;
    onOpenEvent: (eventId: number) => void;
    onOpenStage: (stageId: number) => void;
    onOpenVenue: (venueId: number) => void;
    onOpenSong: (songId: number) => void;
    onOpenArtist: (artistId: number) => void;
    onOpenMember: (memberId: number) => void;
    onOpenGroup: (groupId: number) => void;
    onOpenCreator: (creatorId: number) => void;
};

type PrivateFeatureSlot<Props> = {
    isEnabled: () => boolean;
    Page: LazyExoticComponent<FC<Props>> | null;
};

export const privateFeatureRegistry: {
    admin: PrivateFeatureSlot<AdminPrivatePageProps>;
    stats: PrivateFeatureSlot<StatsPrivatePageProps>;
} = {
    admin: {
        isEnabled: () => false,
        Page: null,
    },
    stats: {
        isEnabled: () => false,
        Page: null,
    },
};
