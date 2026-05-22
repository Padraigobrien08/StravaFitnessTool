"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStrava } from "@/lib/context/strava-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function RootPage() {
  const router = useRouter();
  const { importData } = useStrava();

  useEffect(() => {
    router.replace(importData ? "/home" : "/import");
  }, [importData, router]);

  return (
    <div className="space-y-4 py-20">
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="mx-auto h-4 w-64" />
    </div>
  );
}
