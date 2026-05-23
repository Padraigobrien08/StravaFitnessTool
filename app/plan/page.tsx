"use client";

import { Suspense } from "react";
import { RequireData } from "@/components/require-data";
import { PlanWorkspace } from "@/components/plan/plan-workspace";

function PlanPageFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-12">
      <div className="skeleton-shimmer h-10 w-64 rounded" />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="skeleton-shimmer h-64 rounded-xl" />
        <div className="skeleton-shimmer h-48 rounded-xl" />
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <RequireData>
      <Suspense fallback={<PlanPageFallback />}>
        <PlanWorkspace />
      </Suspense>
    </RequireData>
  );
}
