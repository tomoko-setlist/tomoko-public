const formatMegabytes = (bytes: number): string =>
    (bytes / (1024 * 1024)).toFixed(1);

export function InitialSyncOverlay({
    show,
    progressTotal,
    progressLoaded,
    progressFileName,
    progressTotalBytes,
    progressLoadedBytes,
}: {
    show: boolean;
    progressTotal: number;
    progressLoaded: number;
    progressFileName?: string;
    progressTotalBytes?: number;
    progressLoadedBytes?: number;
}) {
    if (!show) {
        return null;
    }

    // Prefer byte-based progress (parquet phase) over file counts so large
    // files like setlists.parquet don't make the bar look stalled.
    const hasByteProgress =
        typeof progressTotalBytes === "number" &&
        progressTotalBytes > 0 &&
        typeof progressLoadedBytes === "number";

    const progressPercent = hasByteProgress
        ? Math.min(
              100,
              Math.max(
                  0,
                  Math.round((progressLoadedBytes / progressTotalBytes) * 100),
              ),
          )
        : progressTotal > 0
          ? Math.min(100, Math.max(0, Math.round((progressLoaded / progressTotal) * 100)))
          : 0;

    const progressLabel = hasByteProgress
        ? `${formatMegabytes(Math.min(progressLoadedBytes, progressTotalBytes))}/${formatMegabytes(progressTotalBytes)} MB (${progressPercent}%)`
        : progressTotal > 0
          ? `${progressLoaded}/${progressTotal} ファイル (${progressPercent}%)`
          : "接続を確認しています...";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white/90 backdrop-blur-[1px]">
            <div className="flex min-w-[280px] max-w-[88vw] flex-col gap-3 rounded-none border-2 border-slate-300 bg-white px-6 py-5 shadow-[4px_4px_0_0_#cbd5e1]">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Initial Sync
                </p>
                <div
                    className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-red-600"
                    aria-hidden="true"
                />
                <p className="text-sm font-semibold text-slate-700">
                    データをダウンロードして検索準備中...
                </p>
                <div className="h-3 w-full overflow-hidden rounded-none border-2 border-slate-300 bg-white">
                    <div
                        className="h-full bg-red-600 transition-[width] duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <p className="text-xs text-slate-600">{progressLabel}</p>
                {progressFileName ? (
                    <p className="max-w-[72vw] truncate text-xs text-slate-600">
                        読み込み中: {progressFileName}
                    </p>
                ) : null}
                <p className="text-xs text-slate-500">
                    初回はキャッシュ作成のため時間がかかる場合があります
                </p>
            </div>
        </div>
    );
}
