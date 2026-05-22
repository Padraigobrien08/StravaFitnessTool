export function WhatThisMeans({
  children,
  formula,
}: {
  children: React.ReactNode;
  formula?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
      <p className="font-medium text-zinc-300">What this means</p>
      <div className="mt-1.5 leading-relaxed">{children}</div>
      {formula && (
        <p className="mt-2 font-mono text-xs text-zinc-600">{formula}</p>
      )}
    </div>
  );
}
