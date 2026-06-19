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
import { useClinical } from "@/lib/hooks/useClinical";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import { useMedications } from "@/lib/hooks/useMedications";
import { usePharmacies } from "@/lib/hooks/usePharmacies";
import { useDoctors } from "@/lib/hooks/useDoctors";
import { useShop } from "@/lib/hooks/useShop";
import { useProviders } from "@/lib/hooks/useProviders";
import { useStaff } from "@/lib/hooks/useStaff";
import { useIntegrations } from "@/lib/hooks/useIntegrations";
import { useRbac } from "@/lib/hooks/useRbac";
import { useKnowledgeBase } from "@/lib/hooks/useKnowledgeBase";
import { useReviews } from "@/lib/hooks/useReviews";
import { useLeads } from "@/lib/hooks/useLeads";
import { useConsent } from "@/lib/hooks/useConsent";
import { useInventory } from "@/lib/hooks/useInventory";
import { usePatientDocuments } from "@/lib/hooks/usePatientDocuments";
import { useTitration } from "@/lib/hooks/useTitration";
import { useReferrals } from "@/lib/hooks/useReferrals";
import { useAdverse } from "@/lib/hooks/useAdverse";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useAffiliates } from "@/lib/hooks/useAffiliates";
import { useBilling } from "@/lib/hooks/useBilling";
import { useEmails } from "@/lib/hooks/useEmails";
import { useSms } from "@/lib/hooks/useSms";

const CATALOG_POLL = 30000; // config/reference data changes rarely

/** Mirrors the core clinical stores to the server. Renders nothing. */
export function PersistHydrator() {
  useEffect(() => {
    // Hot clinical data (fast)
    serverPersist(useTreatmentRequests, "treatment-requests", "requests");
    serverPersist(useSoapNotes, "soap-notes", "notes");
    serverPersist(usePrescriptions, "prescriptions", "prescriptions");
    serverPersist(useLabs, "labs", "orders");
    serverPersist(useOrders, "orders", "orders");
    serverPersist(useShipments, "shipments", "shipments");
    serverPersist(useTasks, "tasks", "tasks");
    serverPersist(useSubscriptions, "subscriptions", "subscriptions");
    serverPersist(useClinical, "clinical", "charts");
    // Communications — so the patient-chart Messages tab and the Email/SMS pages
    // mirror each other and survive reloads / sync across devices.
    serverPersist(useEmails, "emails", "emails");
    serverPersist(useSms, "sms", "threads");
    // Treatments (incl. base64 thumbnails) + intake forms — so staff edits go
    // live for patients across devices.
    serverPersist(useTreatmentsIntake, "treatments", "treatments");
    serverPersist(useTreatmentsIntake, "intake-forms", "forms");
    // Config catalogs / reference data (slower poll)
    serverPersist(useMedications, "medications", "meds", CATALOG_POLL);
    serverPersist(usePharmacies, "pharmacies", "pharmacies", CATALOG_POLL);
    serverPersist(useDoctors, "doctors", "doctors", CATALOG_POLL);
    serverPersist(useProviders, "providers", "providers", CATALOG_POLL);
    serverPersist(useShop, "shop", "products", CATALOG_POLL);
    serverPersist(useStaff, "staff", "staff", CATALOG_POLL);
    serverPersist(useIntegrations, "integrations", "integrations", CATALOG_POLL);
    serverPersist(useRbac, "rbac", "rolePerms", CATALOG_POLL);
    serverPersist(useKnowledgeBase, "knowledge-base", "articles", CATALOG_POLL);
    serverPersist(useReviews, "reviews", "reviews", CATALOG_POLL);
    serverPersist(useLeads, "leads", "leads", CATALOG_POLL);
    serverPersist(useConsent, "consent", "records", CATALOG_POLL);
    serverPersist(useInventory, "inventory", "items", CATALOG_POLL);
    serverPersist(usePatientDocuments, "patient-documents", "documents", CATALOG_POLL);
    serverPersist(useTitration, "titration", "plans", CATALOG_POLL);
    serverPersist(useReferrals, "referrals", "referrals", CATALOG_POLL);
    serverPersist(useAdverse, "adverse", "reports", CATALOG_POLL);
    serverPersist(useCampaigns, "campaigns", "campaigns", CATALOG_POLL);
    serverPersist(useAffiliates, "affiliates", "affiliates", CATALOG_POLL);
    serverPersist(useBilling, "billing", "claims", CATALOG_POLL);
  }, []);
  return null;
}
