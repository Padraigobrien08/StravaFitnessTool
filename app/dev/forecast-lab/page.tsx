import { notFound } from "next/navigation";
import { ForecastLabClient } from "@/components/dev/forecast-lab-client";

function isForecastLabEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_FORECAST_LAB === "1";
}

export const metadata = {
  title: "Forecast Lab · StrideIQ",
  robots: "noindex, nofollow",
};

export default function ForecastLabPage() {
  if (!isForecastLabEnabled()) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-[#09090b]">
      <ForecastLabClient />
    </main>
  );
}
