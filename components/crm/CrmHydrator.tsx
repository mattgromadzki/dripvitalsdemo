"use client";

import { useEffect } from "react";
import { startPatientsSync } from "@/lib/persist/patientsSync";

/**
 * Syncs the patient roster with the server (hydrate + write-back). Edits to a
 * patient chart now persist and survive refresh; new intake patients appear
 * across devices. Renders nothing.
 */
export function CrmHydrator() {
  useEffect(() => { startPatientsSync(); }, []);
  return null;
}
