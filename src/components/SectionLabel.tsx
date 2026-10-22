import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-bold tracking-[.06em] text-muted uppercase">{children}</span>
  );
}
