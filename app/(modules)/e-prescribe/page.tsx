"use client";

import { Suspense } from "react";
import { EPrescribeWorkspace } from "@/components/modules/eprescribe/EPrescribeWorkspace";

export default function EPrescribeRoute() {
  return (
    <Suspense fallback={<div className="px-7 py-6 text-ink-muted text-[13px]">Loading e-Prescribe…</div>}>
      <EPrescribeWorkspace />
    </Suspense>
  );
}
