import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical insight-panel shell. Consolidates the `rounded-lg border
 * border-white/[0.06] bg-white/[0.02]` section + "title · muted hint" header
 * that was hand-rolled across the intelligence/analytics surfaces, so the shell
 * lives in one place instead of ~100 bespoke copies.
 *
 * Pass `title` (+ optional `hint`) for the standard header, or omit both and
 * render a fully custom header inside `children`.
 */
export function Panel({
  title,
  hint,
  headerRight,
  children,
  className,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  /** Optional control aligned to the right of the header row (link, toggle). */
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3", className)}
    >
      {title != null ? (
        <div className={headerRight ? "flex items-start justify-between gap-2" : undefined}>
          <p className="text-[11px] font-medium text-zinc-500">
            {title}
            {hint != null ? <span className="ml-1.5 text-zinc-600">{hint}</span> : null}
          </p>
          {headerRight}
        </div>
      ) : null}
      {children}
    </section>
  );
}
