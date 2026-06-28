import type { MemberStatus } from "./setlistSearchDb/types";

export function getMemberStatusLabel(
    status: MemberStatus | null | undefined,
): string | null {
    if (status === "activeHello") return "現役ハロメン";
    if (status === "trainee") return "研修生";
    if (status === "helloOg") return "ハロプロOG";
    if (status === "formerTrainee") return "元研";
    return null;
}
