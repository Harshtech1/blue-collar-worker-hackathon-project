import { type FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchGeocodedMarkets, type GeocodedMarketResult } from "@/utils/geocoding";

interface MarketCommandSearchProps {
  className?: string;
  initialValue?: string;
  placeholder?: string;
  radiusKm?: number;
  variant?: "light" | "dark";
  onSelect: (result: GeocodedMarketResult) => void;
}

export function MarketCommandSearch({
  className,
  initialValue = "",
  placeholder = "Search Chandigarh Sector 17 or New Delhi...",
  radiusKm = 12,
  variant = "light",
  onSelect,
}: MarketCommandSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<GeocodedMarketResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    skipNextSearchRef.current = true;
    setQuery(initialValue);
    setResults([]);
    setOpen(false);
  }, [initialValue]);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return undefined;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      setResults([]);
      setOpen(false);
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      return undefined;
    }

    const controller = new AbortController();
    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const nextResults = await searchGeocodedMarkets(trimmedQuery, {
          limit: 5,
          radiusKm,
          signal: controller.signal,
        });
        setResults(nextResults);
        setOpen(nextResults.length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, radiusKm]);

  const commitSelection = (result: GeocodedMarketResult) => {
    setQuery(result.label);
    setOpen(false);
    onSelect(result);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      return;
    }

    try {
      setIsSearching(true);
      const nextResults = await searchGeocodedMarkets(trimmedQuery, { limit: 1, radiusKm });
      if (nextResults[0]) {
        commitSelection(nextResults[0]);
      } else {
        setOpen(false);
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
            variant === "dark" ? "text-slate-500" : "text-slate-400",
          )}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (results.length > 0) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          className={cn(
            "h-11 rounded-2xl pl-10 pr-10 text-sm font-semibold shadow-sm",
            variant === "dark"
              ? "border-white/10 bg-slate-950/80 text-white placeholder:text-slate-500 shadow-[0_20px_60px_-36px_rgba(2,6,23,1)]"
              : "border-slate-200 bg-white/95 text-slate-900",
          )}
        />
        {isSearching ? (
          <Loader2
            className={cn(
              "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin",
              variant === "dark" ? "text-slate-400" : "text-slate-500",
            )}
          />
        ) : (
          <MapPin
            className={cn(
              "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2",
              variant === "dark" ? "text-emerald-300" : "text-indigo-500",
            )}
          />
        )}
      </form>

      {open && (
        <div
          className={cn(
            "absolute z-[1200] mt-2 w-full overflow-hidden rounded-2xl border shadow-[0_22px_60px_-24px_rgba(15,23,42,0.4)]",
            variant === "dark"
              ? "border-white/10 bg-slate-950/96 shadow-[0_24px_70px_-30px_rgba(2,6,23,1)]"
              : "border-slate-200 bg-white",
          )}
        >
          {results.map((result) => (
            <button
              key={`${result.lat}:${result.lng}:${result.label}`}
              type="button"
              onClick={() => commitSelection(result)}
              className={cn(
                "flex w-full items-start justify-between gap-3 border-b px-4 py-3 text-left transition last:border-b-0",
                variant === "dark"
                  ? "border-white/10 hover:bg-white/[0.04]"
                  : "border-slate-100 hover:bg-slate-50",
              )}
            >
              <div>
                <p className={cn("text-sm font-black", variant === "dark" ? "text-white" : "text-slate-950")}>
                  {result.cityName}{result.stateCode ? `, ${result.stateCode}` : ""}
                </p>
                <p className={cn("mt-1 text-xs font-semibold leading-5", variant === "dark" ? "text-slate-400" : "text-slate-500")}>
                  {result.label}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                  variant === "dark"
                    ? "border border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                    : "bg-indigo-50 text-indigo-700",
                )}
              >
                {result.geoConfig.cityTier.replace("_", "-")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
