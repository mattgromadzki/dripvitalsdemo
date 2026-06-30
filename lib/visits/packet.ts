// Assembles the self-contained Visit Packet snapshot (visit record + intake
// Q&A) that gets stored on a PatientDocument. Pure + client-safe.
import type { BaskQuestion, BaskCheckboxOption } from "@/lib/types/treatmentsIntake";
import type { VisitPacket, VisitPacketSection, VisitPacketQA } from "@/lib/types/index";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type RawAnswer = string | number | string[] | undefined;

function fmtAnswer(q: BaskQuestion, raw: RawAnswer): { answer: string; flagged: boolean } {
  if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) return { answer: "—", flagged: false };

  // Multi-select / checkbox — join labels, flag if any selected option carries a review/disqualifier flag.
  if (Array.isArray(raw)) {
    let flagged = false;
    const labels = raw.map((val) => {
      const opt = (q.options || []).find(
        (o) => typeof o === "object" && (o as BaskCheckboxOption).label === val,
      ) as BaskCheckboxOption | undefined;
      if (opt && (opt.flag === "review" || opt.flag === "disq")) flagged = true;
      return String(val);
    });
    return { answer: labels.join("; "), flagged };
  }

  const s = String(raw);
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s);
      if (q.type === "bmi") {
        const wt = o.weightLbs ? `Weight ${o.weightLbs} lbs` : o.weightKg ? `Weight ${o.weightKg} kg` : "";
        const ht = o.heightFt ? `Height ${o.heightFt} ft ${o.heightIn || 0} in` : o.heightCm ? `Height ${o.heightCm} cm` : "";
        const bmi = o.bmi ? `BMI ${o.bmi}` : "";
        return { answer: [wt, ht, bmi].filter(Boolean).join(" · "), flagged: false };
      }
      if (q.type === "date" && o.y && o.m && o.d) {
        return { answer: `${MONTHS[(+o.m || 1) - 1]} ${+o.d}, ${o.y}`, flagged: false };
      }
      if (q.type === "address") {
        const cityLine = [o.city, o.state, o.zip].filter(Boolean).join(o.city ? ", " : " ").replace(", ", ", ");
        const line3 = [o.city && `${o.city},`, o.state, o.zip].filter(Boolean).join(" ");
        return { answer: [o.line1, o.line2 || o.apt, line3 || cityLine].filter(Boolean).join(", "), flagged: false };
      }
      if (q.type === "personal_info") {
        return { answer: [`${o.first || ""} ${o.last || ""}`.trim(), o.email, o.phone].filter(Boolean).join(" · "), flagged: false };
      }
      return { answer: Object.values(o).filter(Boolean).join(", "), flagged: false };
    } catch {
      /* fall through to raw */
    }
  }
  return { answer: s, flagged: false };
}

export function buildSections(questions: BaskQuestion[], answers: Record<number, RawAnswer>): VisitPacketSection[] {
  const sections: VisitPacketSection[] = [];
  let cur: VisitPacketSection | null = null;
  const ensure = (): VisitPacketSection => {
    if (!cur) { cur = { title: "Responses", items: [] }; sections.push(cur); }
    return cur;
  };
  for (const q of questions) {
    if (q.type === "section") { cur = { title: q.text || "Section", items: [] }; sections.push(cur); continue; }
    const { answer, flagged } = fmtAnswer(q, answers[q.id]);
    const item: VisitPacketQA = { question: q.text, helper: q.helper || undefined, answer, flagged };
    ensure().items.push(item);
  }
  return sections.filter((s) => s.items.length > 0);
}

export function buildVisitPacket(input: {
  visitId: string;
  createdDisplay: string;
  status?: string;
  provider?: string;
  pharmacyOrder?: string;
  patient: VisitPacket["patient"];
  shipping?: VisitPacket["shipping"];
  treatment: VisitPacket["treatment"];
  screening: VisitPacket["screening"];
  consents: VisitPacket["consents"];
  questions: BaskQuestion[];
  answers: Record<number, RawAnswer>;
  signedName?: string;
  signedDisplay?: string;
}): VisitPacket {
  return {
    visitId: input.visitId,
    createdDisplay: input.createdDisplay,
    status: input.status || "Paid",
    provider: input.provider,
    pharmacyOrder: input.pharmacyOrder,
    patient: input.patient,
    shipping: input.shipping,
    treatment: input.treatment,
    screening: input.screening,
    consents: input.consents,
    sections: buildSections(input.questions, input.answers),
    signedName: input.signedName,
    signedDisplay: input.signedDisplay,
  };
}
