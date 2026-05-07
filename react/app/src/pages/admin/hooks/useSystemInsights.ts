import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/constants";
import {
  buildFallbackStrategyChips,
  normalizeStrategyChips,
  type StrategyChip,
  type SystemInsightsSummary,
} from "../utils/systemInsights";

const SYSTEM_INSIGHTS_DEBOUNCE_MS = 700;
const DEMO_ADMIN_TOKEN = "demo-admin-token";

interface UseSystemInsightsState {
  chips: StrategyChip[];
  loading: boolean;
  provider: string | null;
  fallback: boolean;
}

export function useSystemInsights(summary: SystemInsightsSummary): UseSystemInsightsState {
  const summaryKey = useMemo(() => JSON.stringify(summary), [summary]);
  const fallbackChips = useMemo(() => buildFallbackStrategyChips(summary), [summary]);
  const [chips, setChips] = useState<StrategyChip[]>(fallbackChips);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [fallback, setFallback] = useState(true);

  useEffect(() => {
    setChips(fallbackChips);
  }, [fallbackChips]);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const isDemoMode = localStorage.getItem("adminDemoMode") === "true" || !token || token === DEMO_ADMIN_TOKEN;

    if (isDemoMode) {
      setProvider("local");
      setFallback(true);
      setLoading(false);
      setChips(fallbackChips);
      return undefined;
    }

    const controller = new AbortController();
    let isCancelled = false;

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`${API}/admin/system-insights`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify(summary),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`System insights request failed with status ${response.status}`);
        }

        const payload = await response.json();
        if (isCancelled) return;

        setChips(normalizeStrategyChips(payload?.chips, summary));
        setProvider(typeof payload?.provider === "string" ? payload.provider : "cloud");
        setFallback(Boolean(payload?.fallback));
      } catch (error) {
        if (controller.signal.aborted || isCancelled) return;

        console.warn("[system-insights-hook]", error);
        setChips(fallbackChips);
        setProvider("local");
        setFallback(true);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, SYSTEM_INSIGHTS_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [summary, summaryKey, fallbackChips]);

  return {
    chips,
    loading,
    provider,
    fallback,
  };
}
