import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div
        className="h-1 w-full"
        style={{ background: accent ?? "linear-gradient(90deg, #10b981, #34d399)" }}
      />
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
