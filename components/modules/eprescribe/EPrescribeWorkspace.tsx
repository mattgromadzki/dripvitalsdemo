"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ReactNode, Key } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { usePharmacies } from "@/lib/hooks/usePharmacies";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";
import { usePatientDocuments } from "@/lib/hooks/usePatientDocuments";
import { useDoctors } from "@/lib/hooks/useDoctors";
import { submitGreenstone } from "@/lib/pharmacy/client";
import type { GsOrderInput } from "@/lib/pharmacy/greenstoneTypes";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { ClinicalSafetyStrip } from "@/components/clinical/ClinicalSafetyStrip";
import { useClinical } from "@/lib/hooks/useClinical";
import { seedChart } from "@/lib/clinical/chartTypes";
import { screenPrescription } from "@/lib/clinical/interactions";
import { RxAlertsPanel } from "@/components/clinical/RxAlertsPanel";
import { RxPreviewBask } from "@/components/modules/RxPreviewBask";
import {
  DRUG_CATALOG,
  SUPPLY_OPTIONS,
  DOSE_PRESETS,
  SEED_DOCUMENTS,
  findCatalogDrug,
  type DrugCatalogEntry,
  type SupplyOption,
  type SavedDocument,
} from "@/lib/data/eprescribeCatalog";
import type { TreatmentRequest, Patient, PatientExtra, PatientDocument, Pharmacy, Prescription, Doctor } from "@/lib/types";

const ROUTE_OPTIONS = ["Subcutaneous (SQ)", "Intramuscular (IM)", "Oral (PO)", "Topical", "Sublingual (SL)"];
const FREQ_OPTIONS  = ["Once daily (QD)", "Twice daily (BID)", "Three times daily (TID)", "Once weekly", "Every 2 weeks", "Monthly", "As needed (PRN)"];
const UNIT_OPTIONS  = ["Units", "Tablets", "Capsules", "mL", "Vials", "Patches", "Pens"];

// ── Cart line shape ────────────────────────────────────────────────────
interface MedicationLine {
  id: number;
  type: "medication";
  drug: DrugCatalogEntry;
  strength: string;
  route: string;
  freq: string;
  qty: number;
  unit: string;
  refills: number;
  daySupply: number;
  sig: string;
  daw: boolean;
  paRequired: boolean;
  controlled: boolean;
}
interface SupplyLine {
  id: number;
  type: "supply";
  supplyId: string;
  name: string;
  icon: string;
  category: string;
  qty: number;
  notes: string;
  linkedToId: number | null;
  linkedToName: string | null;
}
type CartLine = MedicationLine | SupplyLine;

export interface EPrescribeOrderContext { id: string; treatmentName: string; placedAt: string; price?: string }

export function EPrescribeWorkspace(
  { embeddedPatientId, orderContext }: { embeddedPatientId?: string; orderContext?: EPrescribeOrderContext } = {}
) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const requestId    = searchParams.get("request");

  // Store data
  const allRequests        = useTreatmentRequests((s) => s.requests);
  const markPrescribed     = useTreatmentRequests((s) => s.markPrescribed);
  const allPatients        = usePatients((s) => s.patients);
  const pharmacies         = usePharmacies((s) => s.pharmacies);
  const addPrescription    = usePrescriptions((s) => s.add);
  const addPatientDoc      = usePatientDocuments((s) => s.add);

  const request = useMemo<TreatmentRequest | null>(
    () => (requestId ? allRequests.find((r) => r.id === requestId) || null : null),
    [allRequests, requestId]
  );
  const patient = useMemo<Patient | null>(
    () => {
      if (embeddedPatientId) return allPatients.find((p) => p.id === embeddedPatientId) || null;
      return request ? allPatients.find((p) => p.id === request.patientId) || null : null;
    },
    [allPatients, request, embeddedPatientId]
  );
  // Address + insurance + DOB live on the PatientExtra blob (loaded synchronously
  // from a per-patient seed). We use these for the "Shipping To" sidebar card
  // and for the Review letterhead's Patient Information section.
  const extra = useMemo(() => (patient ? getPatientExtra(patient) : null), [patient]);

  // Structured clinical chart (store:clinical) — used for the safety strip and,
  // critically, to snapshot the patient's *structured* allergies onto the signed
  // Rx document instead of the legacy flat patient.allergies string.
  const storedChart    = useClinical((s) => (patient ? s.charts[patient.id] : undefined));
  const ensureSeededClin = useClinical((s) => s.ensureSeeded);
  useEffect(() => { if (patient) ensureSeededClin(patient.id, patient); }, [patient, ensureSeededClin]);
  const clinChart = useMemo(() => (patient ? (storedChart ?? seedChart(patient)) : null), [storedChart, patient]);

  // One canonical structured-allergy string, reused by the signed Rx document and
  // the live Rx preview so both match the on-screen safety strip.
  const allergiesSnapshot = useMemo(() => {
    const active = clinChart ? clinChart.allergies.filter((a) => a.status === "active") : [];
    if (active.length) return active.map((a) => (a.reaction ? `${a.allergen} (${a.reaction})` : a.allergen)).join(", ");
    if (clinChart?.nkda) return "NKDA";
    return patient?.allergies || "";
  }, [clinChart, patient]);

  // ── Cart & item-type toggle ─────────────────────────────────────────
  const [orderCart, setOrderCart] = useState<CartLine[]>([]);
  const [currentItemType, setCurrentItemType] = useState<"medication" | "supply">("medication");
  const nextLineId = useRef(1);

  // ── Drug search + selection ─────────────────────────────────────────
  const [drugSearch, setDrugSearch] = useState("");
  const [dropOpen,   setDropOpen]   = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugCatalogEntry | null>(null);
  // Refs anchor the click-outside detection — clicking the dropdown's
  // scrollbar shouldn't close the dropdown (which is what onBlur was doing)
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Close the dropdown only when clicking truly outside it.
  useEffect(() => {
    if (!dropOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        inputRef.current    && !inputRef.current.contains(target)
      ) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropOpen]);

  const filteredDrugs = useMemo(() => {
    const q = drugSearch.trim().toLowerCase();
    if (!q) return DRUG_CATALOG;
    return DRUG_CATALOG.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.detail.toLowerCase().includes(q) ||
      d.drugClass.toLowerCase().includes(q)
    );
  }, [drugSearch]);

  // ── Medication form ─────────────────────────────────────────────────
  const [activePresetIdx, setActivePresetIdx] = useState(1);
  const [strength,  setStrength]    = useState("0.5mg");
  const [route,     setRoute]       = useState("Subcutaneous (SQ)");
  const [freq,      setFreq]        = useState("Once weekly");
  const [qty,       setQty]         = useState(4);
  const [unit,      setUnit]        = useState("Units");
  const [refills,   setRefills]     = useState(2);
  const [daySupply, setDaySupply]   = useState(28);
  const [sig,       setSig]         = useState("Inject 0.5mg subcutaneously once weekly. Rotate injection sites. Refrigerate after opening.");
  const [daw,       setDaw]         = useState(false);
  const [paRequired, setPaRequired] = useState(false);
  const [controlled, setControlled] = useState(false);

  // ── Supply form ─────────────────────────────────────────────────────
  const [supplyType,     setSupplyType]     = useState(SUPPLY_OPTIONS[0].value);
  const [supplyQty,      setSupplyQty]      = useState(1);
  const [supplyLinkedTo, setSupplyLinkedTo] = useState<string>(""); // line id as string ("" = unlinked)
  const [supplyNotes,    setSupplyNotes]    = useState("Use one syringe per dose. Dispose in sharps container after each use.");

  // ── Pharmacy + prescriber ───────────────────────────────────────────
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>("");
  const doctors = useDoctors((st) => st.doctors);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || null;
  const prescriber = selectedDoctor ? doctorLabel(selectedDoctor) : "";
  const [sending, setSending] = useState(false);

  // ── Review modal & saved docs ───────────────────────────────────────
  const [reviewOpen,   setReviewOpen]   = useState(false);
  const [finalRefNum,  setFinalRefNum]  = useState<string>("");
  const [submittedDocId, setSubmittedDocId] = useState<string>(""); // for "View / Print" deep link after send
  const [savedDocs,    setSavedDocs]    = useState<SavedDocument[]>(SEED_DOCUMENTS);
  const [docsOpen,     setDocsOpen]     = useState(false);
  const [currentDocTab, setCurrentDocTab] = useState<"rx" | "intake" | "labs" | "other">("rx");

  // Track whether we've already auto-added the pre-populated medication
  // for this request — prevents re-adding on every re-render.
  const [didAutoAdd, setDidAutoAdd] = useState(false);

  // Auto-add the request's medication to cart once on first render
  useEffect(() => {
    if (didAutoAdd || !request || request.status !== "approved") return;
    const drug = findCatalogDrug(request.medication);
    if (!drug) {
      setDidAutoAdd(true);
      return;
    }
    // Pick a preset matching the request's dosing protocol
    const dp = request.dosingProtocol.toLowerCase();
    let preset = DOSE_PRESETS[1]; // default 0.5mg
    if      (dp.includes("0.25"))                              preset = DOSE_PRESETS[0];
    else if (dp.includes("0.5"))                               preset = DOSE_PRESETS[1];
    else if (dp.includes("1.0") || dp.includes("1 mg"))        preset = DOSE_PRESETS[2];
    else if (dp.includes("2.5"))                               preset = DOSE_PRESETS[3];
    else if (dp.includes("5") && drug.id.includes("tirz"))     preset = DOSE_PRESETS[4];

    const line: MedicationLine = {
      id: nextLineId.current++,
      type: "medication",
      drug,
      strength: preset.strength || "0.5mg",
      route:    "Subcutaneous (SQ)",
      freq:     preset.freq || "Once weekly",
      qty:      preset.qty || 4,
      unit:     "Units",
      refills:  2,
      daySupply: 28,
      sig:      preset.sig || `Inject ${preset.strength} subcutaneously once weekly. Rotate injection sites.`,
      daw: false, paRequired: false, controlled: false,
    };
    setOrderCart([line]);
    setDidAutoAdd(true);
    toast(`✓ ${drug.name} pre-populated from approved request`);
  }, [didAutoAdd, request]);

  // Default pharmacy = first connected compounding
  useEffect(() => {
    if (selectedPharmacyId) return;
    const compounding = pharmacies.find((p) => p.type === "compounding" && p.status === "connected");
    setSelectedPharmacyId(compounding?.id || pharmacies[0]?.id || "");
  }, [pharmacies, selectedPharmacyId]);

  // Default prescriber = first active provider with a valid 10-digit NPI
  useEffect(() => {
    if (selectedDoctorId) return;
    const withNpi = doctors.find((d) => d.active && /^\d{10}$/.test((d.npi || "").trim()));
    setSelectedDoctorId(withNpi?.id || doctors[0]?.id || "");
  }, [doctors, selectedDoctorId]);

  // Step indicator state
  const total = orderCart.length;
  const currentStep = useMemo(() => {
    if (!patient) return 1;
    if (total === 0) return 2;
    if (!selectedPharmacyId) return 3;
    return 4;
  }, [patient, total, selectedPharmacyId]);

  // Derived counts
  const meds = orderCart.filter((l): l is MedicationLine => l.type === "medication");
  const sups = orderCart.filter((l): l is SupplyLine => l.type === "supply");

  // Decision support — drug–allergy + curated drug–drug screening, live as the
  // cart changes. Danger-level alerts must be acknowledged before signing.
  const screening = useMemo(
    () => screenPrescription({
      proposed: meds.map((m) => ({ name: m.drug.name, drugClass: m.drug.drugClass })),
      allergies: clinChart?.allergies ?? [],
      currentMeds: clinChart?.meds ?? [],
    }),
    [meds, clinChart]
  );
  const [alertsAck, setAlertsAck] = useState(false);
  useEffect(() => { if (!screening.danger) setAlertsAck(false); }, [screening.danger]);
  const rxCount = savedDocs.filter((d) => d.category === "rx").length;

  // ── Drug + supply form handlers ─────────────────────────────────────
  function handleDrugSearch(val: string) {
    setDrugSearch(val);
    setDropOpen(true);
  }
  function selectDrugById(id: string) {
    const d = DRUG_CATALOG.find((x) => x.id === id);
    if (!d) return;
    setSelectedDrug(d);
    setDrugSearch(d.name);
    setDropOpen(false);
  }
  function clearDrug() {
    setSelectedDrug(null);
    setDrugSearch("");
    setDaw(false); setPaRequired(false); setControlled(false);
  }
  function setPresetByIdx(idx: number) {
    const p = DOSE_PRESETS[idx];
    setActivePresetIdx(idx);
    if (p.strength) setStrength(p.strength);
    if (p.freq)     setFreq(p.freq);
    if (p.qty)      setQty(p.qty);
    if (p.sig)      setSig(p.sig);
  }
  function addMedicationToCart() {
    if (!selectedDrug) {
      toast("⚠ Search and select a medication first");
      return;
    }
    if (!sig.trim()) {
      toast("⚠ Sig / patient instructions are required");
      return;
    }
    const line: MedicationLine = {
      id: nextLineId.current++,
      type: "medication",
      drug: selectedDrug,
      strength, route, freq,
      qty, unit, refills, daySupply,
      sig: sig.trim(),
      daw, paRequired, controlled,
    };
    setOrderCart((c) => [...c, line]);
    toast(`✓ Added: ${selectedDrug.name}`);
    clearDrug();
  }
  function resetSupplyForm() {
    setSupplyType(SUPPLY_OPTIONS[0].value);
    setSupplyQty(1);
    setSupplyLinkedTo("");
    setSupplyNotes("Use one syringe per dose. Dispose in sharps container after each use.");
  }
  function addSupplyToCart() {
    if (!supplyQty || supplyQty < 1) {
      toast("⚠ Enter a valid quantity");
      return;
    }
    const opt = SUPPLY_OPTIONS.find((o) => o.value === supplyType);
    if (!opt) return;
    const linked = supplyLinkedTo ? meds.find((m) => String(m.id) === supplyLinkedTo) : null;
    const line: SupplyLine = {
      id: nextLineId.current++,
      type: "supply",
      supplyId: supplyType,
      name: opt.label,
      icon: opt.icon,
      category: opt.category,
      qty: supplyQty,
      notes: supplyNotes.trim(),
      linkedToId: linked ? linked.id : null,
      linkedToName: linked ? linked.drug.name : null,
    };
    setOrderCart((c) => [...c, line]);
    toast(`✓ Added: ${opt.label}`);
    resetSupplyForm();
  }
  function removeLine(id: number) {
    setOrderCart((c) => c.filter((l) => l.id !== id));
    toast("✕ Removed from order");
  }

  // ── Review + submit ────────────────────────────────────────────────
  // Two-step flow:
  //   1. Click "Review & Send Order →" → opens modal in DRAFT state showing
  //      the bask Electronic Prescription preview (nothing submitted yet)
  //   2. Click "✓ Confirm & Send" inside the modal → submitOrder() fires →
  //      modal switches to SIGNED state with print / download actions
  function openReview() {
    if (total === 0)             { toast("⚠ Add at least one item to the order"); return; }
    if (!selectedPharmacyId)     { toast("⚠ Select a pharmacy"); return; }
    setReviewOpen(true);
  }

  // Map the live form state to a 5Axis order document for GreenstoneRX. Returns
  // an { error } object if a required piece is missing so we can block cleanly.
  function buildGreenstoneInput(): GsOrderInput | { error: string } {
    if (!patient) return { error: "No patient selected." };
    if (!selectedDoctor) return { error: "Select a signing provider." };
    const npi = (selectedDoctor.npi || "").trim();
    if (!/^\d{10}$/.test(npi)) return { error: `${doctorLabel(selectedDoctor)} has no valid 10-digit NPI — add it on the Doctor record before sending to GreenstoneRX.` };
    const addr = extra?.address;
    if (!addr?.street || !addr?.city || !addr?.state || !addr?.zip) return { error: "Patient address is incomplete — GreenstoneRX needs street, city, state, and ZIP." };
    const parts = patient.name.trim().split(/\s+/);
    const firstName = parts[0] || patient.name;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : (parts[0] || patient.name);
    const today = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();
    return {
      internalOrderId: `DV-${patient.id}-${nowMs}`,
      internalCustomerId: patient.id,
      firstName,
      lastName,
      dob: extra?.dob,
      gender: extra?.gender,
      email: patient.email,
      phoneNumber: patient.phone,
      address: { address: addr.street, city: addr.city, state: addr.state, zipCode: addr.zip },
      scripts: meds.map((m) => ({
        name: `${m.drug.name} ${m.strength}`.trim(),
        dispense_quantity: String(m.qty),
        dispense_unit: m.unit || "unit",
        sig: m.sig,
        doctor: selectedDoctor.id,
        doctor_name: doctorLabel(selectedDoctor),
        doctor_npi: npi,
        number_refills: m.refills,
        date_prescribed: today,
        timeStamp: nowMs,
      })),
      deliveryType: "direct",
    };
  }

  async function submitOrder() {
    if (!patient || !selectedPharmacyId) return;
    if (screening.danger && !alertsAck) { toast("⛔ Acknowledge the contraindication alert before signing"); return; }
    const selectedPharmacy = pharmacies.find((p) => p.id === selectedPharmacyId);
    if (!selectedPharmacy) return;

    // If this pharmacy transmits via the GreenstoneRX (5Axis) API, send the
    // order for real BEFORE writing the signed records — only persist on success.
    const isGreenstone = selectedPharmacy.connector === "greenstone";
    let gsOrderId: string | number | undefined;
    if (isGreenstone) {
      if (meds.length === 0) { toast("⚠ GreenstoneRX orders need at least one medication"); return; }
      const built = buildGreenstoneInput();
      if ("error" in built) { toast(`⚠ ${built.error}`); return; }
      setSending(true);
      const res = await submitGreenstone(built);
      setSending(false);
      if (!res.ok) { toast(`⚠ GreenstoneRX rejected the order: ${res.error || "unknown error"}`); return; }
      gsOrderId = res.orderId;
    }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const dateInt = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);
    const refNum = `DVRx-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${String(today.getHours()).padStart(2, "0")}${String(today.getMinutes()).padStart(2, "0")}${String(today.getSeconds()).padStart(2, "0")}`;
    const signedAt = today.toISOString().slice(0, 16).replace("T", " · ") + " UTC";

    // Create one Prescription per medication line
    const createdRxIds: string[] = [];
    meds.forEach((m) => {
      const rxInput: Omit<Prescription, "id"> = {
        patientName:      patient.name,
        patientId:        patient.id,
        medication:       m.drug.name,
        dose:             `${m.strength} ${m.freq.toLowerCase().includes("weekly") ? "weekly" : m.freq.toLowerCase()}`,
        strength:         m.strength,
        qty:              m.qty,
        refillsRemaining: m.refills,
        pharmacy:         selectedPharmacy.name,
        prescribedDate:   dateStr,
        prescribedAt:     dateInt,
        prescriber,
        status:           "pending",
        daySupply:        m.daySupply,
        sig:              m.sig,
        controlled:       m.controlled,
      };
      const created = addPrescription(rxInput);
      createdRxIds.push(created.id);
    });

    // If this came from a treatment request, mark it prescribed against the first Rx
    if (request && createdRxIds.length > 0) {
      markPrescribed(request.id, createdRxIds[0]);
    }

    // Save full Rx document to the SHARED patient-documents store. The same
    // record is read by the patient chart's Documents tab and by the
    // standalone /documents/[id] viewer (for print / Save-as-PDF).
    const primaryName = meds[0]?.drug.name || "Supplies order";
    const rxPayload: NonNullable<PatientDocument["rxPayload"]> = {
      refNum,
      pharmacyName:    selectedPharmacy.name,
      pharmacyLocation: selectedPharmacy.location,
      prescriberName:  prescriber,
      prescriberNpi:   selectedDoctor?.npi || "",
      prescriberDea:   selectedDoctor?.dea || "",
      patient: {
        name:    patient.name,
        id:      patient.id,
        dob:     extra?.dob || "",
        phone:   patient.phone,
        email:   patient.email,
        address: extra?.address,
        allergies: allergiesSnapshot,
        insurance: extra?.insurance,
      },
      medications: meds.map((m) => ({
        name:      m.drug.name,
        drugClass: m.drug.drugClass,
        icon:      m.drug.icon,
        strength:  m.strength,
        route:     m.route,
        freq:      m.freq,
        qty:       m.qty,
        unit:      m.unit,
        refills:   m.refills,
        daySupply: m.daySupply,
        sig:       m.sig,
        daw:       m.daw,
        paRequired: m.paRequired,
        controlled: m.controlled,
      })),
      supplies: sups.map((s) => ({
        name:         s.name,
        icon:         s.icon,
        qty:          s.qty,
        category:     s.category,
        linkedToName: s.linkedToName ?? undefined,
        notes:        s.notes || undefined,
      })),
      dateWritten:    dateStr,
      signedAt,
      signatureText:  prescriber.split(",")[0],
    };
    const savedDoc = addPatientDoc({
      patientId:   patient.id,
      category:    "rx",
      title:       `Rx Order — ${primaryName}${meds.length > 1 ? ` (+${meds.length - 1} more)` : ""}`,
      icon:        "℞",
      createdAt:   dateInt,
      createdDate: `${dateStr} · ${today.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      signedBy:    prescriber,
      rxPayload,
    });

    // Also keep a record in the local Documents drawer for in-page access
    const drawerDoc: SavedDocument = {
      id: savedDoc.id,
      category: "rx",
      title: savedDoc.title,
      date: savedDoc.createdDate,
      meta: `${meds.length} medication${meds.length === 1 ? "" : "s"}, ${sups.length} suppl${sups.length === 1 ? "y" : "ies"} · ${selectedPharmacy.name} · Ref ${refNum}${gsOrderId ? ` · GS ${gsOrderId}` : ""}`,
      icon: "℞",
      rxId: refNum,
      pharmacy: selectedPharmacy.name,
      submittedAt: today.toISOString(),
    };
    setSavedDocs((d) => [drawerDoc, ...d]);
    setFinalRefNum(refNum);
    setSubmittedDocId(savedDoc.id);
    toast(isGreenstone
      ? `✓ Order ${refNum} transmitted to GreenstoneRX · pharmacy order ${gsOrderId} · saved to chart`
      : `✓ Order ${refNum} submitted via Surescripts · saved to chart Documents`);
  }

  function closeReviewAndReset() {
    setReviewOpen(false);
    setTimeout(() => {
      // After successful submission, redirect to the patient chart so the user
      // sees the updated "prescribed" state on the treatment-requests card.
      if (finalRefNum && patient) {
        router.push(`/patients/${patient.id}`);
      }
    }, 200);
  }

  // ── Missing-context guards ──────────────────────────────────────────
  if (requestId && !request) {
    return <EmptyState
      icon="🔍"
      title="Treatment request not found"
      description={`No treatment request with ID "${requestId}". It may have been removed or the URL is incorrect.`}
      cta={<Link href="/patients" className="btn btn-primary">Browse patients</Link>}
    />;
  }
  if (request && request.status === "denied") {
    return <EmptyState
      icon="✕"
      title="This request was denied"
      description={request.deniedReason || "Cannot prescribe — the underlying treatment request was denied."}
      cta={<Link href={`/patients/${request.patientId}`} className="btn btn-primary">Back to patient chart</Link>}
    />;
  }
  if (request && request.status === "prescribed") {
    return <EmptyState
      icon="✓"
      title="Already prescribed"
      description={`This treatment was already prescribed${request.prescribedDate ? ` on ${request.prescribedDate}` : ""}.${request.prescriptionId ? ` Rx ID: ${request.prescriptionId}` : ""}`}
      cta={
        <div className="flex gap-2 justify-center">
          <Link href={`/patients/${request.patientId}`} className="btn btn-ghost">Back to chart</Link>
          <Link href="/rx" className="btn btn-primary">View in Prescriptions →</Link>
        </div>
      }
    />;
  }
  if (request && request.status === "pending") {
    return <EmptyState
      icon="⏳"
      title="Approval required first"
      description="This treatment request hasn't been approved yet. Approve it on the patient chart before prescribing."
      cta={<Link href={`/patients/${request.patientId}`} className="btn btn-primary">Open patient chart →</Link>}
    />;
  }
  // Standalone mode (no request param) — allowed, just no auto-population

  const selectedPharmacy = pharmacies.find((p) => p.id === selectedPharmacyId) || null;
  const initials = patient ? (patient.first[0] + patient.last[0]).toUpperCase() : "??";

  return (
    <div className="px-7 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Link href="/patients" className="hover:text-brand-dk hover:underline">Patients</Link>
          {patient && (
            <>
              <span className="text-ink-muted-2">›</span>
              <Link href={`/patients/${patient.id}`} className="hover:text-brand-dk hover:underline">{patient.name}</Link>
            </>
          )}
          <span className="text-ink-muted-2">›</span>
          <span className="text-ink font-semibold">e-Prescribe</span>
        </div>
        <div className="flex-1" />

        {/* Documents button */}
        <button
          className="btn btn-ghost btn-sm flex items-center gap-1.5"
          onClick={() => setDocsOpen(true)}
        >
          📄 Documents
          <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-pill bg-surface-3 text-ink-muted text-[10px] font-bold">
            {rxCount}
          </span>
        </button>

        {patient && (
          <div className="flex items-center gap-2.5 bg-surface border border-border rounded-pill py-1.5 px-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: patient.color }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-ink leading-tight">{patient.name}</div>
              <div className="text-[10px] text-ink-muted leading-tight">#{patient.id} · {patient.provider}</div>
            </div>
            <Pill intent="green" dot>Active</Pill>
          </div>
        )}
        {patient && (
          <Link href={`/patients/${patient.id}`} className="btn btn-ghost btn-sm">Cancel</Link>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-4 px-4 py-3 bg-surface border border-border rounded-lg overflow-x-auto">
        <StepIndicator n={1} current={currentStep} label="Patient" />
        <StepConnector done={currentStep > 1} />
        <StepIndicator n={2} current={currentStep} label="Add Items" />
        <StepConnector done={currentStep > 2} />
        <StepIndicator n={3} current={currentStep} label="Pharmacy" />
        <StepConnector done={currentStep > 3} />
        <StepIndicator n={4} current={currentStep} label="Review & Send" />
      </div>

      {/* Allergy + problem safety check, surfaced throughout the prescribe flow */}
      {patient && <ClinicalSafetyStrip patient={patient} className="mb-4" />}
      {patient && <RxAlertsPanel result={screening} className="mb-4" />}

      {/* Order context (when launched from a paid order on the chart) */}
      {orderContext && (
        <div className="bg-green-soft border border-green-soft rounded-lg p-3 mb-4 flex items-center gap-3" style={{ borderLeft: "3px solid var(--color-green)" }}>
          <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-[15px]">🧾</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-ink">Prescribing for paid order {orderContext.id}</div>
            <div className="text-[11.5px] text-ink-muted">{orderContext.treatmentName} · Paid {orderContext.placedAt}{orderContext.price ? ` · ${orderContext.price}` : ""}</div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-pill bg-surface border border-border text-green">Paid</span>
        </div>
      )}

      {/* Approved request banner */}
      {request && request.status === "approved" && (
        <div className="bg-green-soft border border-green-soft rounded-lg p-3 mb-4 flex items-center gap-3" style={{ borderLeft: "3px solid var(--color-green)" }}>
          <div className="text-[20px]">✓</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-bold text-green">
              Approved Treatment Request · {request.id}
            </div>
            <div className="text-[11px] text-ink-2 mt-0.5">
              <strong>{request.treatmentName}</strong> · {request.medication} · approved by <strong>{request.approvedBy}</strong>
              {request.approvedDate ? ` on ${request.approvedDate}` : ""}.
              {request.notes ? <span className="italic"> {request.notes}</span> : ""}
            </div>
          </div>
        </div>
      )}

      {/* Standalone mode banner */}
      {!request && (
        <div className="bg-surface-2 border border-border rounded-lg p-3 mb-4 flex items-center gap-3">
          <div className="text-[20px]">💡</div>
          <div className="flex-1 min-w-0 text-[11.5px] text-ink-2">
            <strong className="text-ink">Standalone e-Prescribe mode.</strong> Most prescriptions originate from an approved treatment request on a patient chart. You can still build an order here for ad-hoc prescriptions, but you'll need to pick a patient context manually before sending.
          </div>
          <Link href="/patients" className="btn btn-ghost btn-sm">Pick a patient →</Link>
        </div>
      )}

      {/* 2-column shell */}
      <div className="grid grid-cols-[1fr_360px] gap-4 max-[1100px]:grid-cols-1">
        {/* LEFT — main pane */}
        <div className="space-y-4">
          {/* Add items card — allowOverflow lets the drug-search dropdown
              escape the card boundary so all 8 medications are visible */}
          <Card
            icon={currentItemType === "medication" ? "💊" : "🪡"}
            iconBg={currentItemType === "medication" ? "var(--color-blue-soft)" : "var(--color-amber-soft)"}
            iconColor={currentItemType === "medication" ? "var(--color-blue)" : "var(--color-amber)"}
            title={currentItemType === "medication" ? "Add Medication to Order" : "Add Medical Supplies"}
            sub={currentItemType === "medication"
              ? "Search to add. You can include multiple items."
              : "Syringes, needles, alcohol pads, and other supplies"}
            stepBadge="Step 2"
            allowOverflow={currentItemType === "medication"}
          >
            {/* Item type toggle */}
            <div className="flex gap-1 mb-4 p-1 bg-surface-2 border border-border rounded-md">
              <button
                onClick={() => setCurrentItemType("medication")}
                className={[
                  "flex-1 py-1.5 px-3 rounded text-[12px] font-semibold transition-colors",
                  currentItemType === "medication"
                    ? "bg-surface text-brand-dk shadow-sm border border-border"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                💊 Medication
              </button>
              <button
                onClick={() => setCurrentItemType("supply")}
                className={[
                  "flex-1 py-1.5 px-3 rounded text-[12px] font-semibold transition-colors",
                  currentItemType === "supply"
                    ? "bg-surface text-brand-dk shadow-sm border border-border"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                🪡 Supplies
              </button>
            </div>

            {/* MEDICATION form */}
            {currentItemType === "medication" && (
              <div>
                {/* Drug search */}
                <div className="mb-4 relative">
                  <label className="fl">Drug Name or NDC<span className="text-red ml-0.5">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-[14px] pointer-events-none">🔍</span>
                    <input
                      ref={inputRef}
                      type="text"
                      className="fi pl-9"
                      placeholder="e.g. Semaglutide, Metformin, NDC 00169-4060…"
                      value={drugSearch}
                      onChange={(e) => handleDrugSearch(e.target.value)}
                      onFocus={() => setDropOpen(true)}
                    />
                  </div>
                  {dropOpen && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] bg-surface border border-border rounded-md shadow-lg max-h-[440px] overflow-y-auto"
                    >
                      {filteredDrugs.length === 0 ? (
                        <div className="py-4 px-3 text-center text-ink-muted text-[12px]">No matches</div>
                      ) : (
                        filteredDrugs.map((d) => (
                          <button
                            key={d.id}
                            onMouseDown={() => selectDrugById(d.id)}
                            className="w-full text-left flex items-center gap-2.5 py-2.5 px-3 hover:bg-surface-2 transition-colors border-b border-border last:border-b-0"
                          >
                            <div
                              className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 border border-border"
                              style={{ background: d.iconBg, color: d.iconColor }}
                            >
                              {d.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-bold text-ink truncate">{d.name}</div>
                              <div className="text-[10.5px] text-ink-muted truncate">{d.detail}</div>
                            </div>
                            <Pill intent={d.badgeIntent}>{d.badge}</Pill>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected drug card */}
                {selectedDrug && (
                  <div className="bg-surface-2 border border-border rounded-md p-3 mb-4 flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-md flex items-center justify-center text-[20px] flex-shrink-0 border border-border bg-surface"
                      style={{ color: selectedDrug.iconColor }}
                    >
                      {selectedDrug.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-ink">{selectedDrug.name}</div>
                      <div className="text-[11px] text-ink-muted">{selectedDrug.detail}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={clearDrug}>Change</button>
                  </div>
                )}

                {/* Dose fields (only show when a drug is selected) */}
                {selectedDrug && (
                  <>
                    <div className="mb-4">
                      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Quick Dose Presets</div>
                      <div className="flex flex-wrap gap-1.5">
                        {DOSE_PRESETS.map((p, i) => (
                          <button
                            key={p.label}
                            onClick={() => setPresetByIdx(i)}
                            className={[
                              "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
                              activePresetIdx === i
                                ? "bg-brand text-white border-brand"
                                : "bg-surface border-border text-ink-2 hover:border-border-2",
                            ].join(" ")}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3 max-[600px]:grid-cols-1">
                      <Field label="Dose Strength" required>
                        <input className="fi font-mono" value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="e.g. 0.5mg" />
                      </Field>
                      <Field label="Route" required>
                        <select className="fsel" value={route} onChange={(e) => setRoute(e.target.value)}>
                          {ROUTE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </Field>
                      <Field label="Frequency" required>
                        <select className="fsel" value={freq} onChange={(e) => setFreq(e.target.value)}>
                          {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </Field>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-3 max-[700px]:grid-cols-2 max-[450px]:grid-cols-1">
                      <Field label="Quantity" required>
                        <input type="number" className="fi font-mono" value={qty} min={1} onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)} />
                      </Field>
                      <Field label="Unit">
                        <select className="fsel" value={unit} onChange={(e) => setUnit(e.target.value)}>
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </Field>
                      <Field label="Refills">
                        <select className="fsel" value={refills} onChange={(e) => setRefills(parseInt(e.target.value, 10))}>
                          <option value={0}>0 (No refills)</option>
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                          <option value={11}>11</option>
                        </select>
                      </Field>
                      <Field label="Days Supply">
                        <input type="number" className="fi font-mono" value={daySupply} min={1} onChange={(e) => setDaySupply(parseInt(e.target.value, 10) || 0)} />
                      </Field>
                    </div>

                    <Field label="Sig — Patient Instructions" required>
                      <textarea
                        className="fta font-mono"
                        rows={3}
                        value={sig}
                        onChange={(e) => setSig(e.target.value)}
                      />
                      <div className="text-[10.5px] text-ink-muted mt-1">
                        This will appear on the pharmacy label exactly as written.
                      </div>
                    </Field>

                    <div className="bg-surface-2 border border-border rounded-md py-0.5 px-3.5 mt-4">
                      <RxToggle label="DAW — Dispense as Written" sub="Prohibit generic substitution" checked={daw} onChange={setDaw} />
                      <RxToggle label="Prior Authorization Required" sub="Mark for PA workflow" checked={paRequired} onChange={setPaRequired} />
                      <RxToggle label="Controlled Substance" sub="Requires DEA number + EPCS" checked={controlled} onChange={setControlled} isLast />
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                      <button className="btn btn-ghost btn-sm" onClick={clearDrug}>Clear</button>
                      <div className="flex-1" />
                      <button className="btn btn-primary" onClick={addMedicationToCart}>+ Add to Order</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* SUPPLY form */}
            {currentItemType === "supply" && (
              <div>
                <div className="bg-amber-soft border border-amber-soft rounded-md p-3 mb-4 flex items-start gap-2.5" style={{ borderLeft: "3px solid var(--color-amber)" }}>
                  <div className="text-[16px] flex-shrink-0 text-amber">⚠</div>
                  <div className="text-[11.5px] flex-1">
                    <div className="font-bold text-amber mb-0.5">Some pharmacies don't include syringes / needles</div>
                    <div className="text-ink-2">
                      Compounded GLP-1s often ship without injection supplies. Add them here to ensure your client receives everything they need.
                    </div>
                  </div>
                </div>

                <Field label="Supply Type" required>
                  <select className="fsel" value={supplyType} onChange={(e) => setSupplyType(e.target.value)}>
                    {SUPPLY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3 mt-3 max-[600px]:grid-cols-1">
                  <Field label="Quantity" required>
                    <input type="number" className="fi font-mono" value={supplyQty} min={1} onChange={(e) => setSupplyQty(parseInt(e.target.value, 10) || 0)} />
                  </Field>
                  <Field label="Linked to Medication">
                    <select className="fsel" value={supplyLinkedTo} onChange={(e) => setSupplyLinkedTo(e.target.value)}>
                      <option value="">— Not linked —</option>
                      {meds.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.drug.name} {m.strength}
                        </option>
                      ))}
                    </select>
                    <div className="text-[10.5px] text-ink-muted mt-1">
                      Helps the pharmacy package supplies with the right Rx
                    </div>
                  </Field>
                </div>

                <div className="mt-3">
                  <Field label="Patient Instructions / Notes">
                    <textarea
                      className="fta"
                      rows={2}
                      value={supplyNotes}
                      onChange={(e) => setSupplyNotes(e.target.value)}
                      placeholder="e.g. Use one syringe per weekly injection. Dispose in sharps container."
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <button className="btn btn-ghost btn-sm" onClick={resetSupplyForm}>Clear</button>
                  <div className="flex-1" />
                  <button className="btn btn-primary" onClick={addSupplyToCart}>+ Add to Order</button>
                </div>
              </div>
            )}
          </Card>

          {/* Pharmacy card */}
          <Card icon="🏥" iconBg="var(--color-green-soft)" iconColor="var(--color-green)" title="Select Pharmacy" sub="Partner network plus patient's preferred" stepBadge="Step 3">
            <div className="space-y-2">
              {pharmacies.map((ph) => (
                <PharmacyOption
                  key={ph.id}
                  pharmacy={ph}
                  selected={ph.id === selectedPharmacyId}
                  onSelect={() => setSelectedPharmacyId(ph.id)}
                  showSuppliesWarning={ph.type === "compounding" && sups.length === 0 && meds.length > 0}
                />
              ))}
            </div>
          </Card>

          {/* Prescriber */}
          <Card icon="✍" iconBg="var(--color-purple-soft)" iconColor="var(--color-purple)" title="Signing Provider" sub="Provider whose DEA / NPI signs this Rx">
            <Field label="Prescriber">
              <select className="fsel" value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
                {doctors.length === 0 && <option value="">No providers on file</option>}
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {doctorLabel(d)}{/^\d{10}$/.test((d.npi || "").trim()) ? "" : " — NPI missing"}
                  </option>
                ))}
              </select>
              <div className="text-[10.5px] text-ink-muted mt-1.5">
                The selected provider will be the legal prescriber of record. State licensure is checked automatically against patient's state of residence.
              </div>
            </Field>
          </Card>

          {/* Bottom action row */}
          <div className="flex items-center gap-2 py-2">
            {patient ? (
              <Link href={`/patients/${patient.id}`} className="btn btn-ghost">← Back to chart</Link>
            ) : (
              <Link href="/patients" className="btn btn-ghost">← Back</Link>
            )}
            <div className="flex-1" />
            <button className="btn btn-ghost btn-sm" onClick={() => toast("📝 Draft saved to patient chart")}>Save Draft</button>
            <button
              className="btn btn-primary"
              style={{ padding: "10px 24px", fontSize: "13.5px" }}
              onClick={openReview}
              disabled={total === 0 || !selectedPharmacy}
            >
              Review &amp; Send Order →
            </button>
          </div>
        </div>

        {/* RIGHT — order summary */}
        <div className="space-y-3 max-[1100px]:order-first">
          <div className="bg-surface border border-border rounded-lg overflow-hidden sticky top-4 max-h-[calc(100vh-32px)] flex flex-col">
            {/* Header */}
            <div className="py-3 px-4 border-b border-border bg-surface-2 flex items-center gap-2.5 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-ink">Order Summary</div>
                <div className="text-[10.5px] text-ink-muted">All items shipping to patient</div>
              </div>
              <span className="inline-flex items-center justify-center min-w-[24px] h-[20px] px-1.5 rounded-pill bg-brand text-white text-[11px] font-bold">
                {total}
              </span>
            </div>

            {/* Scrollable body */}
            <div className="p-3.5 overflow-y-auto flex-1">
              {/* Surescripts badge */}
              <div className="bg-brand-soft border border-brand-soft rounded-md p-2.5 flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 bg-surface border border-brand-soft" style={{ color: "var(--color-brand-dk)" }}>
                  🛡
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-bold text-brand-dk">Surescripts Certified</div>
                  <div className="text-[10px] text-ink-muted">EPCS-enabled · DEA compliant · HIPAA secured</div>
                </div>
              </div>

              {/* Cart items */}
              {total === 0 ? (
                <div className="py-8 text-center text-ink-muted">
                  <div className="text-[28px] opacity-40 mb-1.5">📋</div>
                  <div className="text-[12px] font-bold text-ink">No items yet</div>
                  <div className="text-[10.5px] mt-0.5">Add medications or supplies to build the order.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderCart.map((l) => (
                    <CartLineCard key={l.id} line={l} onRemove={() => removeLine(l.id)} />
                  ))}
                </div>
              )}

              {/* Totals (port of original cart-totals block) */}
              {total > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-muted">Medications</span>
                    <span className="font-bold text-ink">{meds.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-muted">Supplies</span>
                    <span className="font-bold text-ink">{sups.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12.5px] pt-1.5 mt-1.5 border-t border-border">
                    <span className="font-bold text-ink">Total Line Items</span>
                    <span className="font-bold text-brand-dk text-[14px]">{total}</span>
                  </div>
                </div>
              )}

              {/* Shipping To */}
              {patient && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Shipping To</span>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-md py-2 px-3 space-y-1.5">
                    <SummaryRow label="Name" value={patient.name} />
                    {extra?.address ? (
                      <>
                        <SummaryRow
                          label="Address"
                          value={extra.address.street}
                          mono
                        />
                        <SummaryRow
                          label="City / State"
                          value={`${extra.address.city}, ${extra.address.state}`}
                        />
                        <SummaryRow
                          label="ZIP"
                          value={extra.address.zip}
                          mono
                        />
                      </>
                    ) : (
                      <div className="text-[10.5px] text-ink-muted italic">Address not on file — must be added before sending</div>
                    )}
                    <SummaryRow label="Phone" value={patient.phone} mono />
                  </div>
                </div>
              )}

              {/* Clinical */}
              {patient && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
                    <span>🩺</span>
                    <span>Clinical</span>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-md py-2 px-3 space-y-1.5">
                    <SummaryRow
                      label="Allergies"
                      value={patient.allergies && patient.allergies !== "None" ? patient.allergies : "None documented"}
                      danger={!!patient.allergies && patient.allergies !== "None"}
                    />
                    <SummaryRow label="Weight" value={`${patient.wt} lbs`} mono />
                    <SummaryRow label="BMI" value={String(patient.bmi)} mono />
                    {extra?.insurance && (
                      <SummaryRow
                        label="Insurance"
                        value={extra.insurance.carrier}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Routing */}
              {selectedPharmacy && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1">Routing to</div>
                  <div className="text-[12px] font-bold text-ink">{selectedPharmacy.name}</div>
                  <div className="text-[10.5px] text-ink-muted">{selectedPharmacy.location} · {selectedPharmacy.turnaround} turnaround</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review modal — bask "Electronic Prescription" preview.
          Opens in DRAFT state when the user clicks "Review & Send Order →".
          After the user clicks "Confirm & Send" inside, the order submits
          and the modal switches to a SIGNED-state receipt that can be
          printed or saved as PDF. */}
      <Modal
        open={reviewOpen}
        onClose={closeReviewAndReset}
        title={finalRefNum ? `Prescription Order — ${finalRefNum}` : "Prescription Order — Review"}
        icon="℞"
        width={720}
        footer={
          finalRefNum ? (
            // SIGNED — receipt mode
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => typeof window !== "undefined" && window.print()}>🖨 Print</button>
              {submittedDocId && (
                <Link href={`/documents/${submittedDocId}`} className="btn btn-ghost btn-sm">📄 Open Document</Link>
              )}
              <div className="flex-1" />
              {patient && (
                <Link href={`/patients/${patient.id}`} className="btn btn-primary">
                  👤 View in Patient Details
                </Link>
              )}
              <Link href="/rx" className="btn btn-primary">
                📋 View in Prescriptions →
              </Link>
            </>
          ) : (
            // DRAFT — review mode
            <>
              <button className="btn btn-ghost" onClick={closeReviewAndReset}>← Edit Order</button>
              <div className="flex-1" />
              {screening.danger && (
                <label className="flex items-center gap-1.5 text-[11.5px] text-red font-semibold mr-1 cursor-pointer">
                  <input type="checkbox" checked={alertsAck} onChange={(e) => setAlertsAck(e.target.checked)} />
                  I&rsquo;ve reviewed the contraindication alert
                </label>
              )}
              <button className="btn btn-primary" onClick={submitOrder} disabled={(screening.danger && !alertsAck) || sending}>{sending ? "Sending…" : "✓ Confirm & Send"}</button>
            </>
          )
        }
      >
        {patient && (
          <RxPreviewBask
            rx={buildPreviewPayload({
              patient, extra, meds, sups,
              pharmacy: selectedPharmacy,
              prescriber,
              prescriberNpi: selectedDoctor?.npi || "",
              prescriberDea: selectedDoctor?.dea || "",
              refNum: finalRefNum || "DVRx-PENDING",
              dateWritten: previewToday(),
              signedAt: finalRefNum ? signedAtNow() : "",
              allergies: allergiesSnapshot,
            })}
            status={finalRefNum ? "signed" : "draft"}
            refNum={finalRefNum || "DVRx-PENDING"}
          />
        )}
      </Modal>

      {/* Documents drawer */}
      <DocumentsDrawer
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        currentTab={currentDocTab}
        onTabChange={setCurrentDocTab}
        documents={savedDocs}
        patientName={patient?.name}
      />

      <Toast />
    </div>
  );
}

// Display label for a prescriber, e.g. "Dr. Carlos Rivera, MD" or "Angela Wang, NP".
function doctorLabel(d: Doctor): string {
  const name = `${d.first} ${d.last}`.trim();
  const usesDr = d.title === "MD" || d.title === "DO";
  return `${usesDr ? "Dr. " : ""}${name}, ${d.title}`;
}

// ─── Preview-payload builder (used by Review modal pre-submission) ─────
// Constructs the same rxPayload shape that submitOrder() writes to the
// shared documents store, but from live form state — so the user sees the
// exact prescription content before signing it.
function buildPreviewPayload({ patient, extra, meds, sups, pharmacy, prescriber, prescriberNpi, prescriberDea, refNum, dateWritten, signedAt, allergies }: {
  patient:     Patient;
  extra:       PatientExtra | null;
  meds:        MedicationLine[];
  sups:        SupplyLine[];
  pharmacy:    Pharmacy | null;
  prescriber:  string;
  prescriberNpi: string;
  prescriberDea: string;
  refNum:      string;
  dateWritten: string;
  signedAt:    string;
  allergies:   string;
}): NonNullable<PatientDocument["rxPayload"]> {
  return {
    refNum,
    pharmacyName:     pharmacy?.name     || "—",
    pharmacyLocation: pharmacy?.location || "",
    prescriberName:   prescriber,
    prescriberNpi:    prescriberNpi || "—",
    prescriberDea:    prescriberDea || "—",
    patient: {
      name:      patient.name,
      id:        patient.id,
      dob:       extra?.dob || "",
      phone:     patient.phone,
      email:     patient.email,
      address:   extra?.address,
      allergies: allergies,
      insurance: extra?.insurance,
    },
    medications: meds.map((m) => ({
      name:      m.drug.name,
      drugClass: m.drug.drugClass,
      icon:      m.drug.icon,
      strength:  m.strength,
      route:     m.route,
      freq:      m.freq,
      qty:       m.qty,
      unit:      m.unit,
      refills:   m.refills,
      daySupply: m.daySupply,
      sig:       m.sig,
      daw:       m.daw,
      paRequired: m.paRequired,
      controlled: m.controlled,
    })),
    supplies: sups.map((s) => ({
      name:         s.name,
      icon:         s.icon,
      qty:          s.qty,
      category:     s.category,
      linkedToName: s.linkedToName ?? undefined,
      notes:        s.notes || undefined,
    })),
    dateWritten,
    signedAt,
    signatureText: prescriber.split(",")[0],
  };
}

function previewToday(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function signedAtNow(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " · ") + " UTC";
}

// ─── Step indicator ────────────────────────────────────────────────────
function StepIndicator({ n, current, label }: { n: number; current: number; label: string }) {
  const done   = n < current;
  const active = n === current;
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div
        className={[
          "w-7 h-7 rounded-full flex items-center justify-center text-[11.5px] font-bold border-2",
          done   ? "bg-brand text-white border-brand"
          : active ? "bg-brand-soft text-brand-dk border-brand"
                   : "bg-surface text-ink-muted border-border",
        ].join(" ")}
      >
        {done ? "✓" : n}
      </div>
      <div className={["text-[12px] font-semibold whitespace-nowrap", done || active ? "text-brand-dk" : "text-ink-muted"].join(" ")}>
        {label}
      </div>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return <div className={`flex-1 h-px mx-3 ${done ? "bg-brand" : "bg-border"}`} style={{ minWidth: 24 }} />;
}

// ─── Card wrapper ──────────────────────────────────────────────────────
function Card({ icon, iconBg, iconColor, title, sub, stepBadge, allowOverflow, children }: { icon: string; iconBg: string; iconColor: string; title: string; sub?: string; stepBadge?: string; allowOverflow?: boolean; children: ReactNode }) {
  return (
    <div className={`bg-surface border border-border rounded-lg ${allowOverflow ? "" : "overflow-hidden"}`}>
      <div
        className={`py-3 px-4 border-b border-border flex items-center gap-3 bg-surface-2 ${allowOverflow ? "rounded-t-lg" : ""}`}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 border border-border bg-surface"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-ink">{title}</div>
          {sub && <div className="text-[11px] text-ink-muted">{sub}</div>}
        </div>
        {stepBadge && <Pill intent="brand">{stepBadge}</Pill>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="fl">
        {label}
        {required && <span className="text-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, mono, danger }: { label: string; value: string; mono?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="text-ink-muted flex-shrink-0">{label}</span>
      <span
        className={[
          "text-right font-semibold break-words",
          mono   ? "font-mono"             : "",
          danger ? "text-red"              : "text-ink",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function RxToggle({ label, sub, checked, onChange, isLast }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; isLast?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-2.5 cursor-pointer ${isLast ? "" : "border-b border-border"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-ink">{label}</div>
        <div className="text-[10.5px] text-ink-muted">{sub}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative w-9 h-5 rounded-pill border transition-colors flex-shrink-0",
          checked ? "bg-brand border-brand" : "bg-surface-3 border-border-2",
        ].join(" ")}
      >
        <span
          className="absolute top-[1px] left-[1px] w-[15px] h-[15px] rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}

// ─── Pharmacy option ───────────────────────────────────────────────────
function PharmacyOption({ pharmacy, selected, onSelect, showSuppliesWarning }: { key?: Key; pharmacy: Pharmacy; selected: boolean; onSelect: () => void; showSuppliesWarning?: boolean }) {
  return (
    <button
      onClick={onSelect}
      className={[
        "w-full text-left p-3 rounded-md border transition-colors flex items-start gap-3",
        selected ? "bg-brand-soft border-brand" : "bg-surface border-border hover:border-border-2",
      ].join(" ")}
    >
      <div
        className={[
          "w-10 h-10 rounded-md flex items-center justify-center text-[18px] flex-shrink-0 border mt-0.5",
          selected ? "border-brand bg-surface" : "border-border bg-surface-2",
        ].join(" ")}
      >
        {pharmacy.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <div className="text-[12.5px] font-bold text-ink truncate">{pharmacy.name}</div>
          <Pill intent={pharmacy.type === "compounding" ? "purple" : pharmacy.type === "mail-order" ? "coral" : "blue"}>
            {pharmacy.type === "compounding" ? "Compound" : pharmacy.type === "mail-order" ? "Mail Order" : "Retail"}
          </Pill>
          {pharmacy.status === "connected" && <Pill intent="green" dot>In Network</Pill>}
        </div>
        <div className="text-[11px] text-ink-muted">
          📍 {pharmacy.location} · ships to {pharmacy.states} · {pharmacy.turnaround}
        </div>
        {showSuppliesWarning && (
          <div className="mt-1.5 text-[10.5px] text-amber flex items-center gap-1.5">
            <span>⚠</span>
            <span>Syringes / needles NOT included — add supplies above</span>
          </div>
        )}
      </div>
      <div
        className={[
          "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-1",
          selected ? "bg-brand border-brand" : "bg-surface border-border-2",
        ].join(" ")}
      >
        {selected && <span className="text-white text-[10px]">✓</span>}
      </div>
    </button>
  );
}

// ─── Cart line card (in sidebar) ───────────────────────────────────────
function CartLineCard({ line, onRemove }: { key?: Key; line: CartLine; onRemove: () => void }) {
  if (line.type === "medication") {
    return (
      <div className="bg-surface-2 border border-border rounded-md p-2.5 flex items-start gap-2.5">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 border border-border"
          style={{ background: line.drug.iconBg, color: line.drug.iconColor }}
        >
          {line.drug.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-ink leading-tight">{line.drug.name}</div>
          <div className="text-[10.5px] text-ink-muted mt-0.5">
            {line.strength} · {line.route} · {line.freq}
          </div>
          <div className="text-[10px] text-ink-muted">
            {line.qty} {line.unit} · {line.daySupply} days · {line.refills} refills
          </div>
          <div className="text-[10.5px] text-ink-2 mt-1 italic line-clamp-2">{line.sig}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {line.daw         && <Pill intent="blue">DAW</Pill>}
            {line.paRequired  && <Pill intent="amber">PA Required</Pill>}
            {line.controlled  && <Pill intent="red">Controlled</Pill>}
            <Pill intent="muted">Refills: {line.refills}</Pill>
          </div>
        </div>
        <button
          onClick={onRemove}
          title="Remove"
          className="w-6 h-6 rounded text-ink-muted hover:bg-red-soft hover:text-red transition-colors flex items-center justify-center text-[12px] flex-shrink-0"
        >
          ✕
        </button>
      </div>
    );
  }
  // Supply line
  return (
    <div className="bg-amber-soft/40 border border-amber-soft rounded-md p-2.5 flex items-start gap-2.5">
      <div className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 border border-amber-soft bg-surface" style={{ color: "var(--color-amber)" }}>
        {line.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-ink leading-tight">{line.name}</div>
        <div className="text-[10.5px] text-ink-muted mt-0.5">
          Qty: {line.qty} · {line.category}
          {line.linkedToName ? ` · For: ${line.linkedToName}` : ""}
        </div>
        {line.notes && <div className="text-[10.5px] text-ink-2 mt-1 italic line-clamp-2">{line.notes}</div>}
      </div>
      <button
        onClick={onRemove}
        title="Remove"
        className="w-6 h-6 rounded text-ink-muted hover:bg-red-soft hover:text-red transition-colors flex items-center justify-center text-[12px] flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Documents drawer ──────────────────────────────────────────────────
function DocumentsDrawer({ open, onClose, currentTab, onTabChange, documents, patientName }: {
  open: boolean;
  onClose: () => void;
  currentTab: "rx" | "intake" | "labs" | "other";
  onTabChange: (t: "rx" | "intake" | "labs" | "other") => void;
  documents: SavedDocument[];
  patientName?: string;
}) {
  const counts = useMemo(() => ({
    rx:     documents.filter((d) => d.category === "rx").length,
    intake: documents.filter((d) => d.category === "intake").length,
    labs:   documents.filter((d) => d.category === "labs").length,
    other:  documents.filter((d) => d.category === "other").length,
  }), [documents]);

  const filtered = documents.filter((d) => d.category === currentTab);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity z-30 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[420px] bg-surface border-l border-border z-40 transition-transform ${open ? "translate-x-0" : "translate-x-full"} flex flex-col max-w-[90vw]`}
      >
        <div className="py-4 px-5 border-b border-border flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-ink">{patientName ? `${patientName} — Documents` : "Patient Documents"}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">Saved prescriptions, intake forms, lab reports</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-surface-2 transition-colors flex items-center justify-center text-ink-muted">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-3 gap-1 overflow-x-auto">
          {(["rx", "intake", "labs", "other"] as const).map((cat) => {
            const labels = { rx: "Prescriptions", intake: "Intake Forms", labs: "Labs", other: "Other" };
            const active = currentTab === cat;
            return (
              <button
                key={cat}
                onClick={() => onTabChange(cat)}
                className={[
                  "py-2.5 px-3 text-[12px] font-semibold whitespace-nowrap transition-colors -mb-px border-b-[2.5px] flex items-center gap-1.5",
                  active ? "text-brand border-brand" : "text-ink-muted border-transparent hover:text-ink",
                ].join(" ")}
              >
                {labels[cat]}
                <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-pill bg-surface-3 text-ink-muted text-[10px] font-bold">
                  {counts[cat]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-ink-muted">
              <div className="text-[36px] opacity-40 mb-2">{currentTab === "rx" ? "℞" : "📄"}</div>
              <div className="text-[13px] font-bold text-ink mb-0.5">No {currentTab === "rx" ? "prescriptions" : "documents"} yet</div>
              <div className="text-[11.5px]">{currentTab === "rx" ? "Submitted Rx orders will appear here automatically." : "Documents in this category will appear here."}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  className="bg-surface-2 border border-border rounded-md p-3 hover:bg-surface-3 hover:border-border-2 transition-colors cursor-pointer flex items-start gap-3"
                  onClick={() => {
                    onClose();
                    if (d.category === "rx") {
                      toast(`📄 Opening Rx ${d.rxId} — see Prescriptions module`);
                    } else {
                      toast(`📄 Opening "${d.title}" (preview not implemented here)`);
                    }
                  }}
                >
                  <div className="text-[20px] flex-shrink-0 mt-0.5">{d.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold text-ink truncate">{d.title}</div>
                    <div className="text-[10.5px] text-ink-muted font-mono mt-0.5">📅 {d.date}</div>
                    <div className="text-[10.5px] text-ink-muted mt-0.5">{d.meta}</div>
                    {d.category === "rx" && (
                      <div className="flex gap-1 mt-1.5">
                        <Pill intent="green" dot>Submitted</Pill>
                        <Pill intent="muted">{d.rxId}</Pill>
                      </div>
                    )}
                  </div>
                  <span className="text-ink-muted text-[14px] flex-shrink-0">›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────
function EmptyState({ icon, title, description, cta }: { icon: string; title: string; description: string; cta: ReactNode }) {
  return (
    <div className="px-7 py-6">
      <div className="bg-surface border border-border rounded-lg p-12 text-center max-w-[640px] mx-auto">
        <div className="text-[42px] opacity-50 mb-3">{icon}</div>
        <div className="text-[16px] font-bold text-ink mb-1.5">{title}</div>
        <div className="text-[12.5px] text-ink-muted max-w-[420px] mx-auto mb-4 leading-relaxed">{description}</div>
        {cta}
      </div>
      <Toast />
    </div>
  );
}
