"use client";

import { useToast } from "@/lib/hooks/useToast";

export function Toast() {
  const visible = useToast((s) => s.visible);
  const message = useToast((s) => s.message);

  return (
    <div
      className={[
        "fixed bottom-6 right-6 z-[999] bg-ink text-white py-3 px-5 rounded-md text-[13px] font-medium shadow-xl max-w-[380px] pointer-events-none transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0",
      ].join(" ")}
      style={{ transitionTimingFunction: "cubic-bezier(.34,1.5,.64,1)" }}
    >
      {message}
    </div>
  );
}
