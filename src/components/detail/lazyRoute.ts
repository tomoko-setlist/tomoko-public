import { lazy, type FC, type LazyExoticComponent } from "react";

const LAZY_RETRY_DELAY_MS = 220;

async function retryImport<T>(
    factory: () => Promise<T>,
    retries: number,
): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await factory();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await new Promise<void>((resolve) =>
                    window.setTimeout(resolve, LAZY_RETRY_DELAY_MS),
                );
            }
        }
    }
    throw lastError;
}

type PropsOf<C extends FC<never>> = Parameters<C> extends [infer P, ...unknown[]] ? P : object;

export const lazyWithRetry = <C extends FC<never>>(
    factory: () => Promise<{ default: C }>,
    retries = 1,
): LazyExoticComponent<FC<PropsOf<C>>> => {
    const f = (): Promise<{ default: C }> => retryImport(factory, retries);
    return lazy(f as unknown as Parameters<typeof lazy>[0]) as unknown as LazyExoticComponent<FC<PropsOf<C>>>;
};
