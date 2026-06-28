type SearchDesktopHeaderProps = {
    onOpenHome: () => void;
};

export function SearchDesktopHeader({ onOpenHome }: SearchDesktopHeaderProps) {
    return (
        <header className="sticky top-0 z-40 hidden h-12 items-center border-b border-gray-200 bg-white md:flex">
            <div className="w-64 border-r border-gray-200 px-4 flex items-center gap-2">
                <button type="button" onClick={onOpenHome} title="トップへ戻る" aria-label="トップへ戻る">
                    <img
                        src="/Tomoko_logo.png"
                        alt="Tomoko"
                        className="pl-8 h-20 w-auto"
                    />
                </button>
            </div>
            <div className="flex-1 px-4">
                <p className="text-sm text-gray-600">
                    ハロプロセトリ検索システム
                </p>
            </div>
        </header>
    );
}
