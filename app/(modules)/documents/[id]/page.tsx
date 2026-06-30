"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { RxPreviewBask } from "@/components/modules/RxPreviewBask";
import { VisitPacketPreview } from "@/components/modules/VisitPacketPreview";
import { usePatientDocuments } from "@/lib/hooks/usePatientDocuments";

export default function DocumentViewerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const docs   = usePatientDocuments((s) => s.documents);
  const doc    = useMemo(() => docs.find((d) => d.id === params.id), [docs, params.id]);

  if (!doc) {
    return (
      <div className="px-7 py-6">
        <div className="bg-surface border border-border rounded-lg p-12 text-center max-w-[640px] mx-auto">
          <div className="text-[42px] opacity-50 mb-3">🔍</div>
          <div className="text-[16px] font-bold text-ink mb-1.5">Document not found</div>
          <div className="text-[12.5px] text-ink-muted mb-4">
            No document with ID <span className="font-mono">{params.id}</span>. It may have been removed.
          </div>
          <button onClick={() => router.back()} className="btn btn-primary">← Back</button>
        </div>
        <Toast />
      </div>
    );
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }
  function handleDownload() {
    // The browser's print dialog includes "Save as PDF" — same code path.
    toast("💡 In the print dialog, choose 'Save as PDF' to download");
    setTimeout(() => {
      if (typeof window !== "undefined") window.print();
    }, 300);
  }

  return (
    <div className="px-7 py-6">
      {/* Toolbar — hidden when printing */}
      <div className="no-print flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">← Back</button>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold text-ink truncate">{doc.title}</div>
          <div className="text-[11px] text-ink-muted">
            {doc.createdDate} {doc.signedBy ? `· signed by ${doc.signedBy}` : ""}
          </div>
        </div>
        <button onClick={handlePrint}    className="btn btn-ghost btn-sm">🖨 Print</button>
        <button onClick={handleDownload} className="btn btn-primary btn-sm">⬇ Download PDF</button>
      </div>

      {/* Document body */}
      {doc.category === "rx" && doc.rxPayload ? (
        <RxPreviewBask rx={doc.rxPayload} status="signed" refNum={doc.rxPayload.refNum} />
      ) : doc.category === "visit" && doc.visitPayload ? (
        <VisitPacketPreview payload={doc.visitPayload} />
      ) : (
        <div className="bg-surface border border-border rounded-md p-8 text-center max-w-[640px] mx-auto">
          <div className="text-[36px] opacity-50 mb-3">{doc.icon}</div>
          <div className="text-[14px] font-bold text-ink mb-1">{doc.title}</div>
          <div className="text-[12px] text-ink-muted">
            Preview not implemented for this document type. Use Print to capture as PDF.
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
}
