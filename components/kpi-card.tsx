import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyMetric, TypographyMuted } from "@/components/ui/typography";

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
        <TypographyMetric className="text-foreground">{value}</TypographyMetric>
        {subtitle ? <TypographyMuted className="mt-2">{subtitle}</TypographyMuted> : null}
      </CardContent>
    </Card>
  );
}
