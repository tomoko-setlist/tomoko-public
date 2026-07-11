import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SetlistIcon, UserIcon, UsersIcon } from "../ui";
import { monthCells } from "./calendarMonth";
import { sortEventTagsByPriority } from "../../lib/eventTagPriority";
import { markFeatureSeen } from "../../lib/newFeatureState";

import type { AppRoute } from "../../lib/appRoute";
import type { CalendarEvent, CalendarEventKind, CalendarMonth, SetlistSearchDb } from "../../lib/setlistSearchDb/types";

type Category = "live" | "birthday" | "milestone" | "graduation";
type DatedEvent = { date: string; event: CalendarEvent };

const META: Record<Category, { label: string; color: string; text: string }> = {
    live: { label: "ライブ", color: "bg-rose-600", text: "text-rose-700" },
    birthday: { label: "誕生日", color: "bg-amber-400", text: "text-amber-700" },
    milestone: { label: "加入・結成", color: "bg-teal-500", text: "text-teal-700" },
    graduation: { label: "卒業・脱退", color: "bg-indigo-500", text: "text-indigo-700" },
};

const categoryOf = (kind: CalendarEventKind): Category =>
    kind === "stage" ? "live" : kind === "birthday" ? "birthday" : kind === "graduation" ? "graduation" : "milestone";
const todayJst = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const validMonth = (value: string | null) => value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
const initialMonth = () => validMonth(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("month")) ?? todayJst().slice(0, 7);
const shiftMonth = (value: string, amount: number) => {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 7);
};

export function CalendarPage({ db, navigate }: { db: SetlistSearchDb | null; navigate: (route: AppRoute) => void }) {
    useEffect(() => { markFeatureSeen("calendar"); }, []);
    const [month, setMonth] = useState(initialMonth);
    const [selectedDate, setSelectedDate] = useState("");
    const [data, setData] = useState<CalendarMonth | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [categories, setCategories] = useState<Set<Category>>(new Set(Object.keys(META) as Category[]));

    useEffect(() => {
        const onPopState = () => {
            const next = validMonth(new URLSearchParams(window.location.search).get("month"));
            if (next) setMonth(next);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("month", month);
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }, [month]);

    useEffect(() => {
        let cancelled = false;
        if (!db) return () => { cancelled = true; };
        const load = async () => {
            await Promise.resolve();
            if (cancelled) return;
            const [year, monthNumber] = month.split("-").map(Number);
            setLoading(true);
            setError("");
            try {
                const result = await db.getCalendarMonth(year, monthNumber);
                if (cancelled) return;
                setData(result);
                const today = todayJst();
                setSelectedDate(today.startsWith(month) ? today : result.days[0]?.date ?? `${month}-01`);
            } catch (reason) {
                if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [db, month]);

    const eventsByDate = useMemo(() => new Map(data?.days.map((day) => [day.date, day.events]) ?? []), [data]);
    const cells = useMemo(() => monthCells(month), [month]);
    const selectedEvents = (eventsByDate.get(selectedDate) ?? []).filter((event) => categories.has(categoryOf(event.kind)));
    const monthlyEvents = useMemo(() => {
        const grouped: Record<Category, DatedEvent[]> = { live: [], birthday: [], milestone: [], graduation: [] };
        for (const day of data?.days ?? []) {
            for (const event of day.events) {
                const category = categoryOf(event.kind);
                if (categories.has(category)) grouped[category].push({ date: day.date, event });
            }
        }
        return grouped;
    }, [categories, data]);
    const handleSelectDate = (date: string) => {
        setSelectedDate(date);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const [year, monthNumber] = month.split("-").map(Number);
    const toggleCategory = (category: Category) => setCategories((current) => {
        const next = new Set(current);
        if (next.has(category)) next.delete(category); else next.add(category);
        return next;
    });
    const currentMonth = todayJst().slice(0, 7);

    return <div className="mx-auto min-w-0 max-w-[1500px] overflow-x-hidden">
        <header className="mb-3 min-w-0 max-w-full border-b-2 border-gray-800 bg-white px-3 py-3 md:px-5">
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-rose-700">SETLIST CALENDAR</p>
                    <div className="mt-0.5 flex items-center gap-1">
                        <MonthArrow label="前の月" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeftIcon className="h-5 w-5" /></MonthArrow>
                        <MonthPicker month={month} onChange={setMonth} />
                        <MonthArrow label="次の月" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRightIcon className="h-5 w-5" /></MonthArrow>
                    </div>
                </div>
                {month !== currentMonth ? <button type="button" onClick={() => setMonth(currentMonth)} className="mb-0.5 shrink-0 border-b border-gray-400 px-1 py-1 text-xs font-bold text-gray-600 hover:border-gray-900 hover:text-gray-950">今月</button> : null}
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" aria-label="表示カテゴリ">
                {(Object.keys(META) as Category[]).map((category) => <button key={category} type="button" aria-pressed={categories.has(category)} onClick={() => toggleCategory(category)} className={`flex h-8 shrink-0 items-center gap-1.5 border px-2 text-xs font-bold ${categories.has(category) ? "border-gray-800 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-500"}`}><span className={`h-2 w-2 ${META[category].color}`} />{META[category].label}</button>)}
            </div>
        </header>

        {error ? <Empty title="カレンダーを読み込めませんでした" detail={error} /> : <>
            <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
                <section className="min-w-0 max-w-full border-2 border-gray-800 bg-white" aria-label={`${year}年${monthNumber}月のカレンダー`}>
                    <div className="grid grid-cols-7 border-b-2 border-gray-800 bg-gray-900 text-center text-[10px] font-bold text-white">{["月", "火", "水", "木", "金", "土", "日"].map((day, index) => <div key={day} className={`py-1.5 ${index === 5 ? "text-sky-300" : index === 6 ? "text-rose-300" : ""}`}>{day}</div>)}</div>
                    <div className="grid grid-cols-7">{cells.map((cell) => <CalendarCell key={cell.key} cell={cell} events={(cell.date ? eventsByDate.get(cell.date) : []) ?? []} selected={cell.date === selectedDate} categories={categories} onSelect={setSelectedDate} />)}</div>
                </section>
                <aside className="min-w-0 max-w-full border-2 border-gray-800 bg-white lg:sticky lg:top-16">
                    <div className="flex items-center justify-between border-b-2 border-gray-800 px-3 py-2"><h2 className="font-black">{selectedDate ? `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8))}日` : "日付を選択"}</h2><span className="text-xs font-bold text-gray-500">{selectedEvents.length}件</span></div>
                    <div className="divide-y divide-gray-200 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">{loading ? <Empty title="月の記録を読み込み中" /> : selectedEvents.length ? selectedEvents.map((event) => <EventRow key={event.id} event={event} navigate={navigate} />) : <Empty title="この日の記録はありません" detail="カテゴリ切替で表示される場合あり。" />}</div>
                </aside>
            </div>
            {!loading ? <MonthlyEventIndex groups={monthlyEvents} onSelectDate={handleSelectDate} /> : null}
        </>}
    </div>;
}

function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
    const [open, setOpen] = useState(false);
    const [displayYear, setDisplayYear] = useState(() => Number(month.slice(0, 4)));
    const rootRef = useRef<HTMLDivElement>(null);
    const selectedYear = Number(month.slice(0, 4));
    const selectedMonth = Number(month.slice(5, 7));
    const currentMonth = todayJst().slice(0, 7);

    useEffect(() => {
        if (!open) return;
        const closeOnOutside = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", closeOnOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    const toggle = () => {
        if (!open) setDisplayYear(selectedYear);
        setOpen((current) => !current);
    };
    const select = (monthNumber: number) => {
        onChange(`${displayYear}-${String(monthNumber).padStart(2, "0")}`);
        setOpen(false);
    };

    return <div ref={rootRef} className="relative shrink-0">
        <h1>
            <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={`${selectedYear}年${selectedMonth}月。月を選択`} className="group flex h-10 min-w-[142px] items-center justify-center gap-1 whitespace-nowrap px-2 text-xl font-black text-gray-950 hover:bg-gray-100 md:min-w-[168px] md:text-2xl">
                <span>{selectedYear}年 {selectedMonth}月</span>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
        </h1>
        {open ? <div role="dialog" aria-label="月を選択" className="absolute left-1/2 top-full z-50 mt-2 w-[280px] -translate-x-1/2 border-2 border-gray-800 bg-white p-3 shadow-[4px_4px_0_0_rgba(31,41,55,0.8)]">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <button type="button" onClick={() => setDisplayYear((year) => year - 1)} aria-label="前年" title="前年" className="inline-flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-950"><ChevronLeftIcon className="h-4 w-4" /></button>
                <span className="text-base font-black tabular-nums">{displayYear}年</span>
                <button type="button" onClick={() => setDisplayYear((year) => year + 1)} aria-label="翌年" title="翌年" className="inline-flex h-8 w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-950"><ChevronRightIcon className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => {
                    const key = `${displayYear}-${String(monthNumber).padStart(2, "0")}`;
                    const selected = displayYear === selectedYear && monthNumber === selectedMonth;
                    const current = key === currentMonth;
                    return <button key={monthNumber} type="button" onClick={() => select(monthNumber)} aria-pressed={selected} className={`relative h-9 text-sm font-bold transition-colors ${selected ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}>{monthNumber}月{current ? <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 ${selected ? "bg-rose-300" : "bg-rose-600"}`} /> : null}</button>;
                })}
            </div>
        </div> : null}
    </div>;
}

function MonthArrow({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-700 hover:bg-gray-50 hover:text-gray-950">{children}</button>;
}

function CalendarCell({ cell, events, selected, categories, onSelect }: { cell: ReturnType<typeof monthCells>[number]; events: CalendarEvent[]; selected: boolean; categories: Set<Category>; onSelect: (date: string) => void }) {
    const visible = events.filter((event) => categories.has(categoryOf(event.kind)));
    return <button type="button" disabled={!cell.date} onClick={() => cell.date && onSelect(cell.date)} className={`relative aspect-square min-w-0 border-b border-r border-gray-200 p-1 text-left disabled:bg-slate-50 sm:aspect-auto sm:min-h-[92px] sm:p-2 ${selected ? "bg-rose-50 shadow-[inset_0_0_0_2px_#be123c]" : "hover:bg-slate-50"}`}>
        {cell.date ? <><span className={`inline-flex h-6 w-6 items-center justify-center text-xs font-black ${cell.date === todayJst() ? "bg-gray-900 text-white" : cell.weekday === 0 ? "text-rose-700" : cell.weekday === 6 ? "text-sky-700" : ""}`}>{cell.day}</span><span className="absolute right-1 top-1 text-[9px] font-bold text-gray-400 sm:hidden">{visible.length || ""}</span><div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">{[...new Set(visible.map((event) => categoryOf(event.kind)))].map((category) => <span key={category} className={`h-1.5 w-1.5 ${META[category].color}`} />)}</div><div className="mt-1 hidden space-y-1 sm:block">{visible.slice(0, 3).map((event) => <div key={event.id} className="flex min-w-0 items-center gap-1 text-[10px]"><span className={`h-1.5 w-1.5 shrink-0 ${META[categoryOf(event.kind)].color}`} /><span className="truncate font-semibold">{event.title}</span>{event.kind === "stage" && event.eventTags.length > 0 ? <span className="shrink-0 text-[9px] font-bold text-gray-400">{sortEventTagsByPriority(event.eventTags.map((t) => ({ name: t })))[0].name}</span> : null}</div>)}{visible.length > 3 ? <p className="text-[9px] font-bold text-gray-400">ほか {visible.length - 3}件</p> : null}</div></> : null}
    </button>;
}

function EventRow({ event, navigate }: { event: CalendarEvent; navigate: (route: AppRoute) => void }) {
    if (event.kind === "stage") return <LiveEventRow event={event} navigate={navigate} />;
    if (event.kind === "groupJoin") return <GroupJoinRow event={event} navigate={navigate} />;
    const label = eventLabel(event);
    return <button type="button" onClick={() => navigate(eventRoute(event))} className="flex w-full items-start gap-2 p-3 text-left hover:bg-gray-50"><span className={`mt-0.5 p-1.5 text-white ${META[categoryOf(event.kind)].color}`}>{event.kind === "birthday" ? <UserIcon className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}</span><span className="min-w-0"><span className="block text-[10px] font-black text-gray-500">{label}</span><span className="block font-bold">{event.title}</span>{event.kind === "graduation" ? <span className="block text-xs text-gray-500">{event.scopes.map((scope) => scope.label).join("・")}</span> : event.relatedGroupId ? <span className="block text-xs text-gray-500">{event.subtitle}</span> : null}</span></button>;
}

function LiveEventRow({ event, navigate }: { event: Extract<CalendarEvent, { kind: "stage" }>; navigate: (route: AppRoute) => void }) {
    const sortedTags = sortEventTagsByPriority(event.eventTags.map((t) => ({ name: t })));
    return <article className="p-3"><button type="button" onClick={() => navigate({ name: "event", id: event.eventId })} className="group flex w-full items-start gap-2 text-left"><span className="mt-0.5 bg-rose-600 p-1.5 text-white"><SetlistIcon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[10px] font-black text-rose-700">LIVE</span><span className="block font-bold leading-5 group-hover:underline">{event.title}</span>{sortedTags.length > 0 ? <span className="mt-1 flex flex-wrap gap-1">{sortedTags.map((tag) => <span key={tag.name} className="inline-block border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">{tag.name}</span>)}</span> : null}</span></button><div className="mt-2 ml-8 space-y-1">{event.stages.map((stage) => <button key={stage.stageId} type="button" onClick={() => navigate({ name: "stage", id: stage.stageId })} className="flex w-full items-center justify-between gap-2 border-l-2 border-gray-300 px-2 py-1 text-left text-xs hover:bg-gray-100"><span className="min-w-0 flex items-center gap-0.5"><b className="shrink-0">{stage.startTime?.slice(0, 5) || "時刻未定"}</b> <span className="truncate">{stage.venueName ?? "会場未定"}</span>{stage.prefectureName ? <span className="shrink-0 text-gray-400">@{stage.prefectureName}</span> : null}</span><span className={`shrink-0 font-bold ${stage.hasSetlist ? "text-rose-700" : "text-gray-400"}`}>{stage.cancelled ? "中止" : stage.hasSetlist ? "セトリ" : "未登録"}</span></button>)}</div></article>;
}

function GroupJoinRow({ event, navigate }: { event: Extract<CalendarEvent, { kind: "groupJoin" }>; navigate: (route: AppRoute) => void }) {
    return <article className="p-3"><div className="flex items-start gap-2"><span className={`mt-0.5 p-1.5 text-white ${META.milestone.color}`}><UsersIcon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><span className="block text-[10px] font-black text-gray-500">{eventLabel(event)}</span><button type="button" onClick={() => navigate({ name: "group", id: event.targetId })} className="text-left font-bold hover:underline">{event.title}</button></div></div><div className="mt-2 ml-8 flex flex-wrap gap-1.5">{event.members.map((member) => <button key={member.personId} type="button" onClick={() => navigate({ name: "member", id: member.personId })} className="inline-flex h-7 items-center border border-teal-200 bg-teal-50 px-2 text-xs font-semibold text-teal-950 shadow-[1px_1px_0_0_rgba(13,148,136,0.25)] transition-colors hover:border-teal-700 hover:bg-white">{member.personName}</button>)}</div></article>;
}

function MonthlyEventIndex({ groups, onSelectDate }: { groups: Record<Category, DatedEvent[]>; onSelectDate: (date: string) => void }) {
    return <section className="mt-3 border-2 border-gray-800 bg-white" aria-label="月のイベント一覧"><div className="border-b-2 border-gray-800 px-3 py-2"><h2 className="font-black">月のイベント一覧</h2></div><div className="grid divide-y divide-gray-200 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">{(Object.keys(META) as Category[]).map((category) => <div key={category} className="min-w-0 p-3"><div className="mb-2 flex items-center justify-between"><h3 className={`flex items-center gap-1.5 text-sm font-black ${META[category].text}`}><span className={`h-2 w-2 ${META[category].color}`} />{META[category].label}</h3><span className="text-xs font-bold text-gray-400">{groups[category].length}件</span></div>{groups[category].length ? <ul className="space-y-1">{groups[category].map(({ date, event }) => <li key={event.id}><button type="button" onClick={() => onSelectDate(date)} className="flex w-full items-start gap-2 border-l-2 border-gray-200 py-1 pl-2 text-left hover:border-gray-900 hover:bg-gray-50"><time className="shrink-0 font-mono text-[11px] font-bold text-gray-500">{date.slice(8)}日</time><span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-900">{event.title}</span><span className="block truncate text-[10px] text-gray-500">{event.kind === "groupJoin" ? `${event.members.map((m) => m.personName).join("、")} 加入${event.anniversaryYears > 0 ? ` ${event.anniversaryYears}周年` : ""}` : event.kind === "stage" && event.eventTags.length > 0 ? sortEventTagsByPriority(event.eventTags.map((t) => ({ name: t }))).map((t) => t.name).join("・") : eventLabel(event)}</span></span></button></li>)}</ul> : <p className="text-xs text-gray-400">記録なし</p>}</div>)}</div></section>;
}

function eventLabel(event: CalendarEvent): string {
    if (event.kind === "stage") return `${event.stages.length}公演`;
    if (event.kind === "birthday") return `${event.anniversaryYears}歳の誕生日`;
    if (event.kind === "graduation") return event.anniversaryYears === 0 ? "卒業" : `${event.anniversaryYears}周年・卒業`;
    if (event.kind === "groupJoin") return event.anniversaryYears === 0 ? "加入" : `加入 ${event.anniversaryYears}周年`;
    return event.anniversaryYears === 0 ? event.subtitle ?? "" : `${event.anniversaryYears}周年・${event.subtitle ?? ""}`;
}

function eventRoute(event: CalendarEvent): AppRoute {
    if (event.kind === "stage") return { name: "event", id: event.eventId };
    return { name: event.targetType === "member" ? "member" : "group", id: event.targetId };
}

function Empty({ title, detail }: { title: string; detail?: string }) {
    return <div className="bg-white p-6 text-center"><CalendarIcon className="mx-auto h-6 w-6 text-gray-300" /><p className="mt-2 text-sm font-bold text-gray-700">{title}</p>{detail ? <p className="mt-1 break-words text-xs text-gray-500">{detail}</p> : null}</div>;
}
