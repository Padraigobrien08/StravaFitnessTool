"use client";

import { AppWorkspaceShell } from "@/components/workspace/shell";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppWorkspaceShell>{children}</AppWorkspaceShell>;
}
