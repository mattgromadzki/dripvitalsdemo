import type { OrderRow } from "@/lib/types";

/**
 * Aggregated order feed for the /orders page.
 * Combines Rx and lab orders from across all patients into one chronological list.
 *
 * In production these would be live queries against your Rx and Labs tables;
 * here they're seeded with the same data as the source unified file plus a few
 * extras to demonstrate pagination behaviour.
 */
export const ORDERS: OrderRow[] = [
  // ── Prescriptions ──────────────────────────────────────────────────────
  { id: "RX-00441", kind: "rx", patientName: "Sarah Mitchell",   patientId: "PT-0041", item: "Semaglutide 0.5mg · 4 units · 2 refills", destination: "Partner Network FL", orderedDate: "May 7",  orderedAt: 20260507, status: "active",  orderedBy: "Dr. Rivera", refills: 2 },
  { id: "RX-00440", kind: "rx", patientName: "Marcus Liu",       patientId: "PT-0034", item: "Tirzepatide 5mg · 4 units · 1 refill",   destination: "Partner Network FL", orderedDate: "May 7",  orderedAt: 20260507, status: "active",  orderedBy: "Dr. Patel",  refills: 1 },
  { id: "RX-00439", kind: "rx", patientName: "Priya Krishnan",   patientId: "PT-0031", item: "Semaglutide 0.25mg · 4 units · 2 refills", destination: "Empower Pharmacy", orderedDate: "Apr 22", orderedAt: 20260422, status: "active",  orderedBy: "Dr. Rivera", refills: 2 },
  { id: "RX-00438", kind: "rx", patientName: "Carlos Reyes",     patientId: "PT-0025", item: "Semaglutide 1mg · 4 units · 1 refill",   destination: "Partner Network FL", orderedDate: "Apr 8",  orderedAt: 20260408, status: "refill",  orderedBy: "Dr. Patel",  refills: 1 },
  { id: "RX-00435", kind: "rx", patientName: "James Thornton",   patientId: "PT-0052", item: "Semaglutide 0.5mg · 4 units · 2 refills", destination: "Empower Pharmacy", orderedDate: "Apr 2",  orderedAt: 20260402, status: "pending", orderedBy: "Dr. Lee",    refills: 2 },
  { id: "RX-00430", kind: "rx", patientName: "Anna Bellamy",     patientId: "PT-0027", item: "Tirzepatide 2.5mg · 4 units · 2 refills", destination: "Partner Network FL", orderedDate: "May 5",  orderedAt: 20260505, status: "active",  orderedBy: "Dr. Patel",  refills: 2 },
  { id: "RX-00428", kind: "rx", patientName: "Emma Wilson",                            item: "Semaglutide 1mg · 4 units · 1 refill",   destination: "Empower Pharmacy",   orderedDate: "Apr 15", orderedAt: 20260415, status: "active",  orderedBy: "Dr. Patel",  refills: 1 },
  { id: "RX-00425", kind: "rx", patientName: "Sarah Mitchell",   patientId: "PT-0041", item: "Semaglutide 0.5mg · 4 units (history)", destination: "Partner Network FL", orderedDate: "Apr 7",  orderedAt: 20260407, status: "filled",  orderedBy: "Dr. Rivera", refills: 3 },
  { id: "RX-00420", kind: "rx", patientName: "Robert Kim",       patientId: "PT-0018", item: "Semaglutide 1mg · 4 units · 0 refills",  destination: "Partner Network FL", orderedDate: "Apr 22", orderedAt: 20260422, status: "active",  orderedBy: "Dr. Rivera", refills: 0 },

  // ── Lab orders ─────────────────────────────────────────────────────────
  { id: "LAB-0814", kind: "lab", patientName: "Sarah Mitchell",   patientId: "PT-0041", item: "CMP + Lipid + HbA1c",      destination: "LabCorp",       orderedDate: "May 7",  orderedAt: 20260507, status: "critical", orderedBy: "Dr. Rivera", resultDate: "May 9" },
  { id: "LAB-0813", kind: "lab", patientName: "Marcus Liu",       patientId: "PT-0034", item: "Lipid Panel",              destination: "Quest",         orderedDate: "May 7",  orderedAt: 20260507, status: "critical", orderedBy: "Dr. Patel",  resultDate: "May 10" },
  { id: "LAB-0812", kind: "lab", patientName: "Emma Wilson",                            item: "Basic Metabolic Panel",    destination: "LabCorp",       orderedDate: "May 5",  orderedAt: 20260505, status: "critical", orderedBy: "Dr. Patel",  resultDate: "May 7" },
  { id: "LAB-0811", kind: "lab", patientName: "Priya Krishnan",   patientId: "PT-0031", item: "CBC + CMP",                destination: "LabCorp",       orderedDate: "Apr 22", orderedAt: 20260422, status: "resulted", orderedBy: "Dr. Rivera", resultDate: "Apr 24" },
  { id: "LAB-0810", kind: "lab", patientName: "Carlos Reyes",     patientId: "PT-0025", item: "HbA1c + Lipid",            destination: "Quest",         orderedDate: "Apr 10", orderedAt: 20260410, status: "resulted", orderedBy: "Dr. Patel",  resultDate: "Apr 12" },
  { id: "LAB-0809", kind: "lab", patientName: "James Thornton",   patientId: "PT-0052", item: "Full Metabolic Panel",     destination: "LabCorp",       orderedDate: "May 3",  orderedAt: 20260503, status: "pending",  orderedBy: "Dr. Lee" },
  { id: "LAB-0808", kind: "lab", patientName: "David Nguyen",                           item: "CBC",                      destination: "LabCorp",       orderedDate: "May 1",  orderedAt: 20260501, status: "pending",  orderedBy: "Dr. Rivera" },
  { id: "LAB-0807", kind: "lab", patientName: "Anna Bellamy",     patientId: "PT-0027", item: "Thyroid Panel + Lipid",    destination: "LabCorp",       orderedDate: "Apr 28", orderedAt: 20260428, status: "ordered",  orderedBy: "Dr. Patel" },
  { id: "LAB-0806", kind: "lab", patientName: "Robert Kim",       patientId: "PT-0018", item: "HbA1c",                    destination: "Quest",         orderedDate: "Apr 20", orderedAt: 20260420, status: "resulted", orderedBy: "Dr. Rivera", resultDate: "Apr 22" },
];
