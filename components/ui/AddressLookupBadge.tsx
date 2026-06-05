"use client";

import { useEffect, useState } from "react";
import { fetchAddressMode } from "@/lib/usps/autocomplete";

/**
 * Tiny indicator next to an address field showing whether real address lookup
 * (Smarty) is connected, or the app is using the built-in demo generator.
 * Uses inline styles so it renders consistently in the EMR and the patient portal.
 */
export function AddressLookupBadge() {
  const [mode, setMode] = useState<"smarty" | "mock" | "loading">("loading");
  useEffect(() => { let on = true; fetchAddressMode().then((m) => { if (on) setMode(m); }); return () => { on = false; }; }, []);

  if (mode === "loading") return null;
  const live = mode === "smarty";
  const color = live ? "#1f8a70" : "#b86e1e";

  return (
    <span
      title={live
        ? "Real address verification is connected (Smarty). Suggestions and ZIP codes are live."
        : "Demo mode: addresses and ZIP codes are sample data. Set SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN to enable real lookup."}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
      {live ? "Live address lookup" : "Demo addresses"}
    </span>
  );
}
