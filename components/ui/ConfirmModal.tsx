"use client";

import { Modal } from "@/components/ui/Modal";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  icon?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  icon = "🗑️",
  confirmLabel = "Confirm",
  destructive = true,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} width={400}>
      <div className="text-center">
        <div className="text-[38px] mb-2.5">{icon}</div>
        <div className="text-[16px] font-bold mb-1.5 text-ink tracking-tight">{title}</div>
        <div className="text-[12.5px] text-ink-muted leading-relaxed mb-5">{message}</div>
        <div className="flex gap-2.5">
          <button className="btn btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button
            className={destructive ? "btn btn-danger flex-1 justify-center" : "btn btn-primary flex-1 justify-center"}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
