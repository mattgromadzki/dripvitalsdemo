"use client";

import { Modal } from "@/components/ui/Modal";
import type { IntakeForm } from "@/lib/types";

interface FormPreviewModalProps {
  form: IntakeForm | null;
  onClose: () => void;
}

export function FormPreviewModal({ form, onClose }: FormPreviewModalProps) {
  if (!form) return null;

  return (
    <Modal
      open={!!form}
      onClose={onClose}
      title={`Preview · ${form.name}`}
      icon="👁"
      width={640}
      footer={
        <>
          <span className="text-[11px] text-ink-muted self-center mr-auto">
            🔗 app.dripvitals.com/intake/<span className="font-mono">{form.slug}</span>
          </span>
          <button className="btn btn-ghost" onClick={onClose}>Close Preview</button>
        </>
      }
    >
      <div className="bg-surface-2 border border-border rounded-md p-4 mb-4">
        <div className="text-[13.5px] font-bold text-ink mb-1">{form.name}</div>
        <div className="text-[12px] text-ink-muted">{form.description}</div>
        <div className="text-[11px] text-ink-muted mt-2">
          ⏱ Average completion: <strong>{form.avgCompletionMinutes} minutes</strong> · {form.questions.length} questions
        </div>
      </div>

      <div className="space-y-4">
        {form.questions.map((q, idx) => {
          if (q.type === "section") {
            return (
              <div key={q.id} className="pt-3 pb-1 border-b border-border-2">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-brand-dk">
                  {q.label}
                </div>
              </div>
            );
          }
          return (
            <div key={q.id}>
              <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                {q.label}
                {q.required && <span className="text-red ml-0.5">*</span>}
              </label>
              {q.helpText && (
                <div className="text-[11px] text-ink-muted mb-1.5">{q.helpText}</div>
              )}

              {q.type === "text" && (
                <input className="fi" placeholder="Your answer…" disabled />
              )}
              {q.type === "number" && (
                <input className="fi" type="number" placeholder="0" disabled />
              )}
              {q.type === "date" && (
                <input className="fi" type="date" disabled />
              )}
              {q.type === "yesno" && (
                <div className="flex gap-2">
                  <button className="flex-1 py-2 px-3 rounded-md border border-border bg-surface text-[12.5px] font-semibold text-ink-2 cursor-not-allowed">Yes</button>
                  <button className="flex-1 py-2 px-3 rounded-md border border-border bg-surface text-[12.5px] font-semibold text-ink-2 cursor-not-allowed">No</button>
                </div>
              )}
              {q.type === "single_choice" && q.options && (
                <div className="space-y-1.5">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 py-2 px-3 border border-border rounded-md bg-surface cursor-not-allowed text-[12.5px]">
                      <input type="radio" name={q.id} disabled />
                      <span className="text-ink-2">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === "multiple_choice" && q.options && (
                <div className="space-y-1.5">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 py-2 px-3 border border-border rounded-md bg-surface cursor-not-allowed text-[12.5px]">
                      <input type="checkbox" disabled />
                      <span className="text-ink-2">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.disqualifyOn && q.disqualifyOn.length > 0 && (
                <div className="text-[10.5px] text-red mt-1">
                  ⚠ Answers that disqualify: <strong>{q.disqualifyOn.join(", ")}</strong>
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-4 mt-2 border-t border-border-2">
          <button className="btn btn-primary w-full" disabled>
            Submit & Continue →
          </button>
          <div className="text-[10.5px] text-ink-muted text-center mt-2">
            By submitting, the patient agrees to telehealth evaluation and HIPAA disclosures.
          </div>
        </div>
      </div>
    </Modal>
  );
}
