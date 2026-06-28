export const PERFORMER_PARTICIPATION_SOURCE_TYPES = {
    DIRECT_PERSON: "direct_person",
    GROUP_MEMBER: "group_member",
} as const;

export type PerformerParticipationSourceType =
    (typeof PERFORMER_PARTICIPATION_SOURCE_TYPES)[keyof typeof PERFORMER_PARTICIPATION_SOURCE_TYPES];
