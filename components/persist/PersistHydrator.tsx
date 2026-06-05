"use client";

import { useEffect } from "react";
import { serverPersist } from "@/lib/persist/serverPersist";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";
import { useSoapNotes } from "@/lib/hooks/useSoapNotes";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { useLabs } from "@/lib/hooks/useLabs";
import { useOrders } from "@/lib/hooks/useOrders";
import { useShipments } from "@/lib/hooks/useShipments";
import { useTasks } from "@/lib/hooks/useTasks";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useVisitQueue } from "@/lib/hooks/useVisitQueue";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";

/** Mirrors the core clinical stores to the server. Renders nothing. */
export function PersistHydrator() {
  useEffect(() => {
    serverPersist(useTreatmentRequests, "treatment-requests", "requests");
    serverPersist(useSoapNotes, "soap-notes", "notes");
    serverPersist(usePrescriptions, "prescriptions", "prescriptions");
    serverPersist(useLabs, "labs", "orders");
    serverPersist(useOrders, "orders", "orders");
    serverPersist(useShipments, "shipments", "shipments");
    serverPersist(useTasks, "tasks", "tasks");
    serverPersist(useSubscriptions, "subscriptions", "subscriptions");
    serverPersist(useVisitQueue, "visit-queue", "visits");
    // Treatments (incl. base64 thumbnails) + intake forms — so staff edits go
    // live for patients across devices.
    serverPersist(useTreatmentsIntake, "treatments", "treatments");
    serverPersist(useTreatmentsIntake, "intake-forms", "forms");
  }, []);
  return null;
}
