"use client";

export type TabKey =
  | "orders"
  | "orders_current"
  | "profile"
  | "clinical"
  | "labs"
  | "visits"
  | "progress"
  | "messages"
  | "billing"
  | "documents"
  | "compliance"
  | "admin";

const TABS: { key: TabKey; label: string }[] = [
  { key: "orders",         label: "Orders" },
  { key: "orders_current", label: "Rx & Treatment" },
  { key: "profile",        label: "Profile" },
  { key: "clinical",       label: "Clinical" },
  { key: "labs",           label: "Labs" },
  { key: "visits",         label: "Visits & Notes" },
  { key: "progress",       label: "Progress" },
  { key: "messages",       label: "Messages" },
  { key: "billing",        label: "Billing" },
  { key: "documents",      label: "Documents" },
  { key: "compliance",     label: "Compliance" },
  { key: "admin",          label: "Admin" },
];

export function ChartTabs({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto flex-nowrap">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={[
              "py-2.5 px-4 text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors -mb-[1.5px] border-b-[2.5px]",
              isActive
                ? "text-brand border-brand"
                : "text-ink-muted border-transparent hover:text-ink hover:bg-surface-2",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
