export type CalendarMonthCell = {
    key: string;
    day: number;
    date: string | null;
    weekday: number;
};

export function monthCells(month: string): CalendarMonthCell[] {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
        const day = index - first + 1;
        const valid = day >= 1 && day <= total;
        const column = index % 7;
        return {
            key: `${month}:${index}`,
            day,
            date: valid ? `${month}-${String(day).padStart(2, "0")}` : null,
            weekday: column === 5 ? 6 : column === 6 ? 0 : column,
        };
    });
}
