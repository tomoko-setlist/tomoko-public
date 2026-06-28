import { DetailPanel } from "./DetailUi";

import type { InitialDetailData } from "../../lib/initialDetailData";

type InitialDetailSummaryPanelProps = {
    data: InitialDetailData;
};

export function InitialDetailSummaryPanel({ data }: InitialDetailSummaryPanelProps) {
    return (
        <DetailPanel className="p-5 md:p-6">
            <div className="space-y-5">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        ToMoKo
                    </p>
                    <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
                        {data.title}
                    </h1>
                    <p className="text-sm leading-6 text-slate-700">
                        {data.description}
                    </p>
                </div>

                {data.summary.length > 0 ? (
                    <dl className="grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                        {data.summary.map((item) => (
                            <div key={`${item.label}:${item.value}`}>
                                <dt className="text-xs text-slate-500">{item.label}</dt>
                                <dd className="mt-1 text-sm font-semibold text-slate-900">
                                    {item.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ) : null}

                {data.stats.length > 0 ? (
                    <ul className="grid gap-3 md:grid-cols-4">
                        {data.stats.map((item) => (
                            <li
                                key={`${item.label}:${item.value}`}
                                className="border-2 border-slate-800 bg-slate-50 p-3"
                            >
                                <span className="block text-xs text-slate-500">
                                    {item.label}
                                </span>
                                <strong className="mt-1 block text-sm text-slate-950">
                                    {item.value}
                                </strong>
                            </li>
                        ))}
                    </ul>
                ) : null}

                {data.links.length > 0 ? (
                    <nav aria-label="関連ページ" className="flex flex-wrap gap-2">
                        {data.links.map((link) => (
                            <a
                                key={`${link.href}:${link.label}`}
                                href={link.href}
                                className="inline-flex rounded-none border-2 border-slate-800 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>
                ) : null}

                <p className="text-xs text-slate-500">詳細データを読み込み中...</p>
            </div>
        </DetailPanel>
    );
}
