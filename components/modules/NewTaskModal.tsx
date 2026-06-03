"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import { useStaff } from "@/lib/hooks/useStaff";
import type { Task, TaskPriority, TaskCategory } from "@/lib/types";

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, "id" | "createdAt">) => void;
  defaultStatus?: Task["status"];
}

const PRIORITIES: TaskPriority[] = ["urgent", "high", "normal", "low"];
const CATEGORIES: TaskCategory[] = ["Lab Review", "Consent", "Billing", "Follow-up", "Prescription", "Internal", "Patient Care", "Other"];

interface FormState {
  title: string;
  description: string;
  patientId: string;
  assignee: string;
  priority: TaskPriority;
  due: string;
  category: TaskCategory;
}

function defaultDue(): string {
  // Default to 3 days from "today" (May 29, 2026 in the prototype)
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BLANK: FormState = {
  title: "",
  description: "",
  patientId: "",
  assignee: "Dr. Rivera",
  priority: "normal",
  due: defaultDue(),
  category: "Follow-up",
};

export function NewTaskModal({ open, onClose, onSave, defaultStatus = "todo" }: NewTaskModalProps) {
  const patients = usePatients((s) => s.patients);
  const staff    = useStaff((s) => s.staff);
  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(BLANK);
      setError("");
    }
  }, [open]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!form.title.trim()) { setError("Task title is required"); return; }
    const patient = patients.find((p) => p.id === form.patientId);
    const staffer = staff.find((s) => s.name === form.assignee);

    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      patientName: patient?.name,
      patientId:   patient?.id,
      assignee:    form.assignee,
      assigneeColor: staffer?.color,
      priority:    form.priority,
      due:         form.due,
      category:    form.category,
      status:      defaultStatus,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Task"
      icon="✅"
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>+ Create Task</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Task Title<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          placeholder="e.g. Review Sarah Mitchell lab results"
          value={form.title}
          onChange={(e) => field("title", e.target.value)}
          autoFocus
        />
      </div>

      <div className="mb-3">
        <label className="fl">Description</label>
        <textarea
          className="fta"
          rows={3}
          placeholder="Action items, notes, links to charts…"
          value={form.description}
          onChange={(e) => field("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Related Patient</label>
          <select className="fsel" value={form.patientId} onChange={(e) => field("patientId", e.target.value)}>
            <option value="">— None —</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Assignee</label>
          <select className="fsel" value={form.assignee} onChange={(e) => field("assignee", e.target.value)}>
            {staff.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="fl">Priority</label>
          <select className="fsel" value={form.priority} onChange={(e) => field("priority", e.target.value as TaskPriority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p === "urgent" ? "🔴 Urgent" : p === "high" ? "🟡 High" : p === "normal" ? "Normal" : "Low"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="fl">Category</label>
          <select className="fsel" value={form.category} onChange={(e) => field("category", e.target.value as TaskCategory)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Due Date</label>
          <input
            className="fi"
            type="date"
            value={form.due}
            onChange={(e) => field("due", e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
