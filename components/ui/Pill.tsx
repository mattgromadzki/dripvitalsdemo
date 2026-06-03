import type { Key, ReactNode } from "react";
type Intent = "brand" | "green" | "blue" | "amber" | "red" | "purple" | "teal" | "coral" | "pink" | "muted";

interface PillProps {
  key?: Key;
  intent?: Intent;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Pill({ intent = "muted", dot, children, className = "" }: PillProps) {
  return (
    <span className={`pill pill-${intent} ${className}`}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}
