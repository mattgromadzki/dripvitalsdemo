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
  { key: "orders",         label: "Summary" },
  { key: "orders_current", label: "Orders & Rx" },
  { key: "profile",        label: "Profile" },
  { key: "clinical",       label: "Clinical" },
  { key: "progress",       label: "Weight" },
  { key: "messages",       label: "Messages" },
  { key: "billing",        label: "Billing" },
  { key: "documents",      label: "Documents" },
  { key: "labs",           label: "Labs" },
  { key: "visits",         label: "Visits" },
  { key: "compliance",     label: "Compliance" },
  { key: "admin",          label: "Admin" },
];

export function ChartTabs({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div className="sticky top-[76px] z-20 bg-surface border border-border rounded-2xl p-1.5 mb-4 flex gap-1.5 overflow-x-auto shadow-xs">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={[
              "py-2 px-3.5 text-[12.5px] font-semibold cursor-pointer whitespace-nowrap transition-colors rounded-xl",
              isActive
                ? "text-ink bg-surface-3"
                : "text-ink-muted hover:text-ink hover:bg-surface-2",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
