import { useEffect, useState } from "react";

import type {
    SetlistSearchDb,
    StageDetail,
    VenueDetail,
    VenueTopPercentiles,
} from "../../../lib/setlistSearchDb/types";

type VenueDetailState = {
    loading: boolean;
    error: string;
    venue: VenueDetail | null;
    stages: StageDetail[];
    topPercentiles: VenueTopPercentiles | null;
    loadingPercentiles: boolean;
};

export function useVenueDetail(db: SetlistSearchDb, venueId: number): VenueDetailState {
    const [loading, setLoading] = useState(true);
    const [loadingPercentiles, setLoadingPercentiles] = useState(false);
    const [error, setError] = useState("");
    const [venue, setVenue] = useState<VenueDetail | null>(null);
    const [stages, setStages] = useState<StageDetail[]>([]);
    const [topPercentiles, setTopPercentiles] = useState<VenueTopPercentiles | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setLoadingPercentiles(false);
            setError("");
            try {
                const [venueResult, stageRows] = await Promise.all([
                    db.getVenueDetail(venueId),
                    db.getVenueStages(venueId),
                ]);
                if (!cancelled) {
                    setVenue(venueResult);
                    setStages(stageRows);
                    setLoading(false);
                }

                const dbCompat = db as Partial<SetlistSearchDb>;
                if (typeof dbCompat.getVenueTopPercentiles !== "function") {
                    return;
                }
                if (!cancelled) {
                    setLoadingPercentiles(true);
                }
                const percentileRows = await dbCompat.getVenueTopPercentiles(venueId);
                if (!cancelled) {
                    setTopPercentiles(percentileRows);
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setLoadingPercentiles(false);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [db, venueId]);

    return { loading, error, venue, stages, topPercentiles, loadingPercentiles };
}
