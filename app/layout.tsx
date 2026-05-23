import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: "StrideIQ — Strava Running Insights",
  description:
    "Local-first running analytics from your Strava bulk export. Pace, HR zones, PRs, and training load.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
