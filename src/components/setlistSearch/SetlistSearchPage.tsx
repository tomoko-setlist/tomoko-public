import { MODE_LABELS, useSearchPageState } from "../../hooks/useSearchPageState";
import { isDbStatusUsable } from "../../hooks/useSetlistSearchDb";
import { HomeSearchContent } from "../app";

import type { DbState } from "../../hooks/useSetlistSearchDb";
import type { AppRoute } from "../../lib/appRoute";
import type { SetlistSearchDb } from "../../lib/setlistSearchDb/types";

type SetlistSearchPageProps = {
    db: SetlistSearchDb | null;
    dbState: DbState;
    navigate: (route: AppRoute) => void;
};

export function SetlistSearchPage({
    db,
    dbState,
    navigate,
}: SetlistSearchPageProps) {
    const search = useSearchPageState({
        db,
        dbState,
        navigateHome: () => navigate({ name: "home" }),
        syncUrlWithSearchState: true,
    });

    return (
        <HomeSearchContent
            dbReady={isDbStatusUsable(dbState.status)}
            modeLabels={MODE_LABELS}
            search={search}
            navigate={navigate}
        />
    );
}
