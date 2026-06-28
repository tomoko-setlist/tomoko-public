import { toNodeeEmbedUrl, toSafeNodeeUrl } from "../../shared/url/externalUrl";

type MusicServicePlayControlsProps = {
  nodeeUrl: string | null;
  label?: string;
  title?: string;
  compact?: boolean;
  showExternalLink?: boolean;
  className?: string;
};

export function MusicServicePlayControls({
  nodeeUrl,
  label = "nodeeで再生",
  title = "ストリーミング",
  compact = false,
  showExternalLink = true,
  className,
}: MusicServicePlayControlsProps) {
  const safeNodeeUrl = toSafeNodeeUrl(nodeeUrl);
  if (!safeNodeeUrl) return null;
  const embedUrl = toNodeeEmbedUrl(safeNodeeUrl);
  const iframeClassName = compact
    ? "block h-[460px] w-full border-0 bg-white sm:h-[515px]"
    : "block h-[380px] w-full border-0 bg-white";
  const containerClassName = compact
    ? "mt-2 w-full max-w-[280px]"
    : "mt-4 overflow-hidden rounded-none border-2 border-gray-800 bg-slate-50 shadow-[3px_3px_0px_0px_rgba(31,41,55,0.8)]";
  const shouldShowHeader = !compact || showExternalLink;

  return (
    <div className={[containerClassName, className].filter(Boolean).join(" ")}>
      {shouldShowHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-white px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">
              STREAMING
            </p>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
          </div>
          {showExternalLink ? (
            <a
              href={safeNodeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 text-right text-xs font-semibold text-blue-700 hover:underline"
              title={label}
            >
              {label}
            </a>
          ) : null}
        </div>
      ) : null}
      {embedUrl ? (
        <iframe
          title={`${title}-nodee-embed`}
          src={embedUrl}
          frameBorder="0"
          loading="lazy"
          className={`${iframeClassName} rounded-md`}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="px-3 py-4 text-sm text-slate-600">
          <a
            href={safeNodeeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline"
          >
            nodee を開く
          </a>
        </div>
      )}
    </div>
  );
}
