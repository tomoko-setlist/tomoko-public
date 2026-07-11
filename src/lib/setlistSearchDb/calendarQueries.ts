import { toInt, toText } from "./queryUtils";
import { duckdbDateYmdExpr } from "../date/duckdbDateExpr";
import { parseTags } from "../uiFormat";

import type {
    CalendarAnniversaryEvent,
    CalendarBasicAnniversaryEvent,
    CalendarDay,
    CalendarEvent,
    CalendarGraduationEvent,
    CalendarGroupJoinEvent,
    CalendarLiveEvent,
    CalendarMonth,
    CalendarStage,
} from "./types";
import type * as duckdb from "@duckdb/duckdb-wasm";

const isValidMonth = (year: number, month: number): boolean =>
    Number.isInteger(year) && year >= 1900 && year <= 2200 && Number.isInteger(month) && month >= 1 && month <= 12;

const monthBounds = (year: number, month: number): { key: string; from: string; to: string } => {
    if (!isValidMonth(year, month)) throw new RangeError("Invalid calendar month");
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { key, from: `${key}-01`, to: `${key}-${String(lastDay).padStart(2, "0")}` };
};

const anniversaryDateSql = (source: string, year: number): string =>
    `TRY_CAST(CONCAT('${year}-', substr(CAST(${source} AS TEXT), 6, 5)) AS DATE)`;

type CalendarRow = Record<string, unknown>;

const mapStage = (row: CalendarRow): CalendarStage => ({
    stageId: toInt(row.stageId),
    startTime: row.startTime ? toText(row.startTime) : null,
    venueId: row.venueId === null || row.venueId === undefined ? null : toInt(row.venueId),
    venueName: row.venueName ? toText(row.venueName) : null,
    prefectureName: row.prefectureName ? toText(row.prefectureName) : null,
    cancelled: Boolean(row.cancelled),
    hasSetlist: toInt(row.setlistCount) > 0,
});

const mapBasicAnniversary = (row: CalendarRow): CalendarBasicAnniversaryEvent => ({
    id: toText(row.id),
    date: toText(row.date),
    sourceDate: toText(row.sourceDate),
    kind: toText(row.kind) as CalendarBasicAnniversaryEvent["kind"],
    title: toText(row.title),
    subtitle: row.subtitle ? toText(row.subtitle) : null,
    anniversaryYears: toInt(row.anniversaryYears),
    targetType: toText(row.targetType) as CalendarAnniversaryEvent["targetType"],
    targetId: toInt(row.targetId),
    relatedGroupId:
        row.relatedGroupId === null || row.relatedGroupId === undefined
            ? null
            : toInt(row.relatedGroupId),
});

export const buildCalendarMonth = (key: string, rows: CalendarRow[]): CalendarMonth => {
    const eventsByDate = new Map<string, CalendarEvent[]>();
    const liveByKey = new Map<string, CalendarLiveEvent>();
    const seenAnniversaries = new Set<string>();
    const groupJoins = new Map<string, CalendarGroupJoinEvent>();
    const graduationEvents = new Map<string, CalendarGraduationEvent>();
    const representedJoinPeople = new Set<string>();

    for (const row of rows) {
        if (toText(row.kind) === "groupJoin") {
            representedJoinPeople.add(`${toText(row.sourceDate)}:${toInt(row.personId)}`);
        }
    }

    const addEvent = (date: string, event: CalendarEvent) => {
        const events = eventsByDate.get(date) ?? [];
        if (!eventsByDate.has(date)) eventsByDate.set(date, events);
        events.push(event);
    };

    for (const row of rows) {
        const date = toText(row.date);
        const kind = toText(row.kind);
        if (kind === "stage") {
            const liveKey = `${date}:${toInt(row.eventId)}`;
            let live = liveByKey.get(liveKey);
            if (!live) {
                live = {
                    id: `stage:${liveKey}`,
                    date,
                    kind: "stage",
                    eventId: toInt(row.eventId),
                    title: toText(row.title),
                    stages: [],
                    eventTags: [],
                };
                liveByKey.set(liveKey, live);
                addEvent(date, live);
            }
            live.stages.push(mapStage(row));
            const tags = parseTags(toText(row.eventTagsJson || "[]"));
            for (const tag of tags) {
                if (!live.eventTags.includes(tag)) live.eventTags.push(tag);
            }
            continue;
        }

        if (kind === "groupJoin") {
            const sourceDate = toText(row.sourceDate);
            const groupId = toInt(row.relatedGroupId);
            const joinKey = `${date}:${sourceDate}:${groupId}`;
            let event = groupJoins.get(joinKey);
            if (!event) {
                event = {
                    id: `groupJoin:${groupId}:${sourceDate}`,
                    date,
                    sourceDate,
                    kind: "groupJoin",
                    title: toText(row.groupName),
                    subtitle: "加入",
                    anniversaryYears: toInt(row.anniversaryYears),
                    targetType: "group",
                    targetId: groupId,
                    relatedGroupId: groupId,
                    members: [],
                };
                groupJoins.set(joinKey, event);
            }
            const personId = toInt(row.personId);
            if (!event.members.some((member) => member.personId === personId)) {
                event.members.push({ personId, personName: toText(row.personName) });
            }
            representedJoinPeople.add(`${sourceDate}:${personId}`);
            continue;
        }

        if (kind === "groupLeave" || kind === "hpGrad") {
            const sourceDate = toText(row.sourceDate);
            const personId = toInt(row.personId ?? row.targetId);
            const graduationKey = `${date}:${sourceDate}:${personId}`;
            let event = graduationEvents.get(graduationKey);
            if (!event) {
                event = {
                    id: `graduation:${personId}:${sourceDate}`,
                    date,
                    sourceDate,
                    kind: "graduation",
                    title: toText(row.personName ?? row.title),
                    subtitle: "卒業",
                    anniversaryYears: toInt(row.anniversaryYears),
                    targetType: "member",
                    targetId: personId,
                    relatedGroupId: null,
                    scopes: [],
                };
                graduationEvents.set(graduationKey, event);
            }
            const groupId = row.relatedGroupId === null || row.relatedGroupId === undefined ? null : toInt(row.relatedGroupId);
            const scope = kind === "hpGrad"
                ? { type: "helloProject" as const, groupId: null, label: "ハロー！プロジェクト" }
                : { type: "group" as const, groupId, label: toText(row.groupName) };
            if (!event.scopes.some((item) => item.type === scope.type && item.groupId === scope.groupId)) event.scopes.push(scope);
            continue;
        }

        const anniversary = mapBasicAnniversary(row);
        if (seenAnniversaries.has(anniversary.id)) continue;
        if (anniversary.kind === "hpJoin" && representedJoinPeople.has(`${anniversary.sourceDate}:${anniversary.targetId}`)) continue;
        seenAnniversaries.add(anniversary.id);
        addEvent(date, anniversary);
    }

    for (const event of groupJoins.values()) {
        event.members.sort((left, right) => left.personName.localeCompare(right.personName, "ja"));
        addEvent(event.date, event);
        seenAnniversaries.add(event.id);
    }
    for (const event of graduationEvents.values()) {
        event.scopes.sort((left, right) => left.type === right.type ? left.label.localeCompare(right.label, "ja") : left.type === "group" ? -1 : 1);
        event.subtitle = event.scopes.map((scope) => scope.label).join("・") + " 卒業";
        addEvent(event.date, event);
        seenAnniversaries.add(event.id);
    }

    const days: CalendarDay[] = [...eventsByDate.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, events]) => ({
            date,
            events: events.sort((left, right) => {
                if (left.kind === "stage" && right.kind !== "stage") return -1;
                if (left.kind !== "stage" && right.kind === "stage") return 1;
                return left.title.localeCompare(right.title, "ja");
            }),
        }));
    for (const live of liveByKey.values()) {
        live.stages.sort((left, right) => (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99"));
        live.eventTags.sort((left, right) => left.localeCompare(right, "ja"));
    }
    return {
        month: key,
        days,
        totals: {
            liveEvents: liveByKey.size,
            stages: [...liveByKey.values()].reduce((sum, event) => sum + event.stages.length, 0),
            anniversaries: seenAnniversaries.size,
        },
    };
};

export const getCalendarMonth = async (
    conn: duckdb.AsyncDuckDBConnection,
    year: number,
    month: number,
): Promise<CalendarMonth> => {
    const range = monthBounds(year, month);
    const birthday = duckdbDateYmdExpr("p.birthday");
    const hpJoin = duckdbDateYmdExpr("p.hpJoinDate");
    const hpGrad = duckdbDateYmdExpr("p.hpGradDate");
    const formation = duckdbDateYmdExpr("g.formationDate");
    const debut = duckdbDateYmdExpr("g.debutDate");
    const joinDate = duckdbDateYmdExpr("gm.joinDate");
    const leaveDate = duckdbDateYmdExpr("gm.leaveDate");
    const stageDate = duckdbDateYmdExpr("s.date");

    const anniversarySelect = (
        kind: "birthday" | "hpJoin" | "hpGrad" | "groupFormation" | "groupDebut" | "groupJoin" | "groupLeave",
        source: string,
        title: string,
        subtitle: string,
        targetType: "member" | "group",
        targetId: string,
        relatedGroupId: string,
        groupName: string,
        from: string,
        where: string,
    ): string => `
        SELECT CONCAT('${kind}:', CAST(${targetId} AS TEXT), ':', COALESCE(CAST(${relatedGroupId} AS TEXT), ''), ':', CAST(${source} AS TEXT)) AS id,
          CAST(${anniversaryDateSql(source, year)} AS TEXT) AS date, CAST(${source} AS TEXT) AS sourceDate,
          '${kind}' AS kind, CAST(${title} AS TEXT) AS title, CAST(${subtitle} AS TEXT) AS subtitle,
          ${year} - TRY_CAST(substr(CAST(${source} AS TEXT), 1, 4) AS INTEGER) AS anniversaryYears,
          '${targetType}' AS targetType, CAST(${targetId} AS INTEGER) AS targetId,
          CAST(${relatedGroupId} AS INTEGER) AS relatedGroupId,
          CAST(${targetId} AS INTEGER) AS personId, CAST(${title} AS TEXT) AS personName,
          CAST(${groupName} AS TEXT) AS groupName,
          NULL::INTEGER AS eventId, NULL::INTEGER AS stageId, NULL::TEXT AS startTime,
          NULL::INTEGER AS venueId, NULL::TEXT AS venueName, FALSE AS cancelled, 0 AS setlistCount,
          '[]' AS eventTagsJson, NULL::TEXT AS prefectureName
        FROM ${from}
        WHERE ${where} AND ${anniversaryDateSql(source, year)} BETWEEN DATE '${range.from}' AND DATE '${range.to}'
          AND ${year} >= TRY_CAST(substr(CAST(${source} AS TEXT), 1, 4) AS INTEGER)`;

    const parts = [
        anniversarySelect("birthday", birthday, "p.personName", "'誕生日'", "member", "p.personId", "NULL", "NULL", "persons p", `COALESCE(TRIM(CAST(p.birthday AS TEXT)), '') <> ''`),
        anniversarySelect("hpJoin", hpJoin, "p.personName", "'ハロー！プロジェクト加入'", "member", "p.personId", "NULL", "NULL", "persons p", `COALESCE(TRIM(CAST(p.hpJoinDate AS TEXT)), '') <> ''`),
        anniversarySelect("hpGrad", hpGrad, "p.personName", "'ハロー！プロジェクト卒業'", "member", "p.personId", "NULL", "NULL", "persons p", `COALESCE(TRIM(CAST(p.hpGradDate AS TEXT)), '') <> ''`),
        anniversarySelect("groupFormation", formation, "g.groupName", "'結成'", "group", "g.groupId", "NULL", "g.groupName", "groups g", `COALESCE(TRIM(CAST(g.formationDate AS TEXT)), '') <> '' AND CAST(g.groupType AS INTEGER) = 10`),
        anniversarySelect("groupDebut", debut, "g.groupName", "'デビュー'", "group", "g.groupId", "NULL", "g.groupName", "groups g", `COALESCE(TRIM(CAST(g.debutDate AS TEXT)), '') <> '' AND CAST(g.groupType AS INTEGER) = 10`),
        anniversarySelect("groupJoin", joinDate, "gm.personName", "CONCAT(gm.groupName, ' 加入')", "member", "gm.personId", "gm.groupId", "gm.groupName", "group_memberships gm JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)", `COALESCE(TRIM(CAST(gm.joinDate AS TEXT)), '') <> '' AND CAST(g.groupType AS INTEGER) IN (10, 70)`),
        anniversarySelect("groupLeave", leaveDate, "gm.personName", "CONCAT(gm.groupName, ' 卒業・脱退')", "member", "gm.personId", "gm.groupId", "gm.groupName", "group_memberships gm JOIN groups g ON CAST(g.groupId AS INTEGER) = CAST(gm.groupId AS INTEGER)", `COALESCE(TRIM(CAST(gm.leaveDate AS TEXT)), '') <> '' AND CAST(g.groupType AS INTEGER) IN (10, 70)`),
        `SELECT CONCAT('stage:', CAST(s.stageId AS TEXT)) AS id, CAST(${stageDate} AS TEXT) AS date,
          CAST(${stageDate} AS TEXT) AS sourceDate, 'stage' AS kind, CAST(s.eventName AS TEXT) AS title,
          CAST(s.venueName AS TEXT) AS subtitle, 0 AS anniversaryYears, 'stage' AS targetType,
          CAST(s.stageId AS INTEGER) AS targetId, NULL::INTEGER AS relatedGroupId,
          NULL::INTEGER AS personId, NULL::TEXT AS personName, NULL::TEXT AS groupName,
          CAST(s.eventId AS INTEGER) AS eventId, CAST(s.stageId AS INTEGER) AS stageId,
          CAST(s.startTime AS TEXT) AS startTime, CAST(s.venueId AS INTEGER) AS venueId,
          CAST(s.venueName AS TEXT) AS venueName, COALESCE(s.cancelled, FALSE) AS cancelled,
          CAST((SELECT COUNT(*) FROM setlists sl WHERE CAST(sl.stageId AS INTEGER) = CAST(s.stageId AS INTEGER)) AS INTEGER) AS setlistCount,
          CAST(s.eventTagsJson AS TEXT) AS eventTagsJson,
          CAST(v.prefectureName AS TEXT) AS prefectureName
        FROM stages s
        LEFT JOIN venues v ON CAST(v.venueId AS INTEGER) = CAST(s.venueId AS INTEGER)
        WHERE CAST(${stageDate} AS DATE) BETWEEN DATE '${range.from}' AND DATE '${range.to}'`,
    ];
    const result = await conn.query(`${parts.join("\nUNION ALL\n")} ORDER BY date, kind, title, startTime`);
    return buildCalendarMonth(range.key, result.toArray() as CalendarRow[]);
};
