const PNG_RENDER_MIN_DIMENSION = 1;
const PNG_RENDER_MIN_SCALE = 2;
const PNG_RENDER_MAX_SCALE = 3;
const PNG_RENDER_DEFAULT_SCALE = 2;

const nextFrame = async (): Promise<void> =>
    new Promise((resolve) => {
        if (typeof window === "undefined") {
            resolve();
            return;
        }
        window.requestAnimationFrame(() => resolve());
    });

const renderElementToPngBlob = async (
    element: HTMLElement,
): Promise<Blob | null> => {
    if (typeof window === "undefined") return null;
    const rect = element.getBoundingClientRect();
    const width = Math.max(PNG_RENDER_MIN_DIMENSION, Math.ceil(rect.width));
    const height = Math.max(PNG_RENDER_MIN_DIMENSION, Math.ceil(rect.height));
    const scale = Math.max(
        PNG_RENDER_MIN_SCALE,
        Math.min(
            PNG_RENDER_MAX_SCALE,
            window.devicePixelRatio || PNG_RENDER_DEFAULT_SCALE,
        ),
    );

    const serialized = new XMLSerializer().serializeToString(element);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("画像描画に失敗しました。"));
        img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
    });
};

export const renderMarkupToPngBlob = async (markup: string): Promise<Blob | null> => {
    if (typeof document === "undefined") return null;
    const mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-100000px";
    mount.style.top = "0";
    mount.style.pointerEvents = "none";
    mount.style.opacity = "0";
    mount.innerHTML = markup;
    const root = mount.firstElementChild as HTMLElement | null;
    if (!root) return null;
    root.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    document.body.appendChild(mount);
    try {
        await nextFrame();
        return await renderElementToPngBlob(root);
    } finally {
        document.body.removeChild(mount);
    }
};
