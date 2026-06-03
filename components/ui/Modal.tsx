"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, icon, width = 560, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width, maxWidth: "100%" }}>
        {title && (
          <div className="px-[22px] py-4 border-b border-border flex items-center gap-3 flex-shrink-0">
            {icon && <span className="text-[24px]">{icon}</span>}
            <div className="text-[14.5px] font-bold text-ink tracking-tight">{title}</div>
            <button
              onClick={onClose}
              className="w-[30px] h-[30px] rounded-md bg-surface-3 hover:bg-red-soft hover:text-red flex items-center justify-center text-[13px] text-ink-muted ml-auto border-none transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-[22px] py-4">{children}</div>
        {footer && <div className="px-[22px] py-3.5 border-t border-border flex gap-2.5 justify-end flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
