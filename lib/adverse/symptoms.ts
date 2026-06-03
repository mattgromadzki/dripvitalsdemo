export type Severity = "mild" | "moderate" | "severe";

export const COMMON_SYMPTOMS = [
  "Nausea", "Vomiting", "Diarrhea", "Constipation", "Injection site reaction",
  "Fatigue", "Headache", "Heartburn", "Decreased appetite", "Dizziness",
  "Severe abdominal pain", "Persistent vomiting", "Allergic reaction / rash", "Signs of gallbladder problems", "Vision changes",
];

// GLP-1 red-flag symptoms that warrant escalation regardless of severity.
const RED_FLAGS = new Set(["Severe abdominal pain", "Persistent vomiting", "Allergic reaction / rash", "Signs of gallbladder problems", "Vision changes"]);

export function escalationReason(symptom: string, severity: Severity): string | null {
  if (RED_FLAGS.has(symptom)) {
    if (symptom === "Severe abdominal pain") return "Possible pancreatitis — evaluate urgently.";
    if (symptom === "Persistent vomiting") return "Dehydration / acute kidney risk — evaluate.";
    if (symptom === "Allergic reaction / rash") return "Possible hypersensitivity reaction — evaluate.";
    if (symptom === "Signs of gallbladder problems") return "Possible cholelithiasis/cholecystitis — evaluate.";
    if (symptom === "Vision changes") return "Possible diabetic retinopathy change — evaluate.";
    return "Red-flag symptom — evaluate.";
  }
  if (severity === "severe") return "Severe-grade symptom — clinical review recommended.";
  return null;
}
