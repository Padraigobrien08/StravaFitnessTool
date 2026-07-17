import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/15">
          <Compass className="h-6 w-6 text-teal-300" />
        </div>
        <h2 className="text-lg font-medium text-zinc-100">Page not found</h2>
        <p className="mt-2 text-sm text-zinc-400">
          That route doesn&apos;t exist. Let&apos;s get you back to your
          training.
        </p>
        <Link
          href="/home"
          className={cn(buttonVariants({ variant: "default" }), "mt-6")}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
