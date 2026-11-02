"use client";

import { useSyncExternalStore } from "react";
import { ANALYTICS_OPTOUT_KEY } from "@/src/site/analytics-public";

const listeners = new Set<() => void>();

function readOptOut(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_OPTOUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Suit le choix enregistré, y compris depuis un autre onglet (`storage`). */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function AnalyticsOptOut({ offLabel, onLabel }: { offLabel: string; onLabel: string }) {
  // Côté serveur, et au premier rendu, le choix est inconnu : mesure active.
  const off = useSyncExternalStore(subscribe, readOptOut, () => false);

  function toggle() {
    try {
      if (off) localStorage.removeItem(ANALYTICS_OPTOUT_KEY);
      else localStorage.setItem(ANALYTICS_OPTOUT_KEY, "1");
    } catch {
      return;
    }
    for (const listener of listeners) listener();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={off}
      className="inline-flex min-h-6 items-center rounded-sm font-medium text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
    >
      {off ? onLabel : offLabel}
    </button>
  );
}
