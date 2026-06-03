"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Subscription, BillingCycle } from "@/lib/types";

interface NewSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (sub: Omit<Subscription, "id">) => void;
}

const PLAN_PRESETS = [
  { name: "1-Month Semaglutide",   amount: 189, cycle: "monthly"     as BillingCycle },
  { name: "3-Month Semaglutide",   amount: 499, cycle: "quarterly"   as BillingCycle },
  { name: "3-Month Tirzepatide",   amount: 749, cycle: "quarterly"   as BillingCycle },
  { name: "6-Month Sema",          amount: 899, cycle: "semi-annual" as BillingCycle },
  { name: "Annual GLP-1+NAD+",     amount: 2400, cycle: "annual"     as BillingCycle },
  { name: "Custom",                amount: 0,   cycle: "monthly"     as BillingCycle },
];

interface FormState {
  patientId: string;
  planPreset: string;
  customPlan: string;
  amount: number;
  cycle: BillingCycle;
  startDate: string;
}

function defaultStartDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BLANK: FormState = {
  patientId: "",
  planPreset: "3-Month Semaglutide",
  customPlan: "",
  amount: 499,
  cycle: "quarterly",
  startDate: defaultStartDate(),
};

export function NewSubscriptionModal({ open, onClose, onCreate }: NewSubscriptionModalProps) {
  const patients = usePatients((s) => s.patients);
  const [form, setForm] = useState<FormState>(() => ({ ...BLANK, patientId: patients[0]?.id || "" }));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...BLANK, patientId: patients[0]?.id || "" });
      setError("");
    }
  }, [open, patients]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePresetChange(name: string) {
    const preset = PLAN_PRESETS.find((p) => p.name === name);
    if (preset && preset.name !== "Custom") {
      setForm((f) => ({ ...f, planPreset: name, amount: preset.amount, cycle: preset.cycle }));
    } else {
      setForm((f) => ({ ...f, planPreset: name }));
    }
  }

  function handleSubmit() {
    if (!form.patientId) { setError("Pick a patient"); return; }
    if (form.amount <= 0) { setError("Amount must be greater than zero"); return; }
    const patient = patients.find((p) => p.id === form.patientId);
    if (!patient) { setError("Patient not found"); return; }
    const planName = form.planPreset === "Custom" ? form.customPlan.trim() : form.planPreset;
    if (!planName) { setError("Custom plan name is required"); return; }

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const start = new Date(form.startDate);
    const startedDate = `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
    const startedAt = parseInt(`${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, "0")}${String(start.getDate()).padStart(2, "0")}`, 10);

    // Next payment = start + 1 cycle
    const next = new Date(start);
    if (form.cycle === "monthly")        next.setMonth(next.getMonth() + 1);
    else if (form.cycle === "quarterly") next.setMonth(next.getMonth() + 3);
    else if (form.cycle === "semi-annual") next.setMonth(next.getMonth() + 6);
    else if (form.cycle === "annual")    next.setFullYear(next.getFullYear() + 1);
    const nextPaymentDate = `${months[next.getMonth()]} ${next.getDate()}, ${next.getFullYear()}`;
    const nextPaymentAt = parseInt(`${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`, 10);

    onCreate({
      patientName: patient.name,
      patientId: patient.id,
      patientColor: patient.color,
      plan: planName,
      cycleAmount: form.amount,
      billingCycle: form.cycle,
      status: "active",
      startedDate, startedAt,
      nextPaymentDate, nextPaymentAt,
      stripeId: `sub_1Q${Math.random().toString(36).slice(2, 10)}`,
      totalPaid: form.amount,
      paymentsCount: 1,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Subscription"
      icon="💳"
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>💳 Create &amp; Charge</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Patient<span className="text-red ml-0.5">*</span></label>
        <select className="fsel" value={form.patientId} onChange={(e) => field("patientId", e.target.value)}>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <label className="fl">Plan</label>
        <select className="fsel" value={form.planPreset} onChange={(e) => handlePresetChange(e.target.value)}>
          {PLAN_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}{p.name !== "Custom" && ` — $${p.amount}/${p.cycle === "quarterly" ? "qtr" : p.cycle === "semi-annual" ? "6mo" : p.cycle === "annual" ? "yr" : "mo"}`}
            </option>
          ))}
        </select>
      </div>

      {form.planPreset === "Custom" && (
        <div className="mb-3">
          <label className="fl">Custom Plan Name<span className="text-red ml-0.5">*</span></label>
          <input
            className="fi"
            placeholder="e.g. Tirzepatide Maintenance"
            value={form.customPlan}
            onChange={(e) => field("customPlan", e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Amount</label>
          <input
            type="number"
            min={1}
            className="fi"
            value={form.amount}
            onChange={(e) => field("amount", parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div>
          <label className="fl">Billing Cycle</label>
          <select className="fsel" value={form.cycle} onChange={(e) => field("cycle", e.target.value as BillingCycle)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi-annual">Every 6 months</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Start Date</label>
        <input
          type="date"
          className="fi"
          value={form.startDate}
          onChange={(e) => field("startDate", e.target.value)}
        />
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">💳</span>
        <span>Charge will be processed via <strong>Stripe</strong>. Patient receives a receipt email and the subscription auto-renews until paused or cancelled.</span>
      </div>
    </Modal>
  );
}
