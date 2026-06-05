"use client";

import { useEffect } from "react";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Patient } from "@/lib/types";

/**
 * Pulls intake-created patients from the server into the in-memory roster so
 * they appear in the CRM (roster + chart) across devices. Polls so newly
 * captured intakes show up within seconds. Renders nothing.
 */
export function CrmHydrator() {
  const upsert = usePatients((s) => s.upsert);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/crm/patients", { cache: "no-store" });
        const d = await r.json();
        if (alive && Array.isArray(d?.patients)) (d.patients as Patient[]).forEach((p) => { if (p?.id) upsert(p); });
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 12000);
    return () => { alive = false; clearInterval(t); };
  }, [upsert]);
  return null;
}
