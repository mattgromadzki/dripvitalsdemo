interface StubTabProps {
  name: string;
  phase: string;
}

export function StubTab({ name, phase }: StubTabProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-12 text-center">
      <div className="text-[42px] opacity-40 mb-3">🚧</div>
      <div className="text-[15px] font-bold mb-1.5 tracking-tight text-ink">{name} tab</div>
      <div className="text-[12.5px] text-ink-muted leading-relaxed max-w-md mx-auto">
        Coming in Phase {phase}. The chart shell, hero, vitals strip, alerts, and the Orders & Rx /
        Profile / Labs tabs are working. Ask Claude to continue with Phase {phase} when you&rsquo;re ready.
      </div>
    </div>
  );
}
