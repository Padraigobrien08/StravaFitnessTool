import * as React from "react";

import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";

type TypographyProps = {
  as?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

function typography(defaultTag: React.ElementType, baseClass: string) {
  return function Typography({
    as,
    className,
    children,
    ...props
  }: TypographyProps) {
    const Comp = as ?? defaultTag;
    return (
      <Comp className={cn(baseClass, className)} {...props}>
        {children}
      </Comp>
    );
  };
}

/** Hero / marketing headline */
export const TypographyDisplay = typography("h1", type.display);

/** Page-level H1 */
export const TypographyPageTitle = typography("h1", type.pageTitle);

/** Section H2 */
export const TypographyTitle = typography("h2", type.title);

/** Uppercase panel label */
export const TypographySectionLabel = typography("h3", type.sectionLabel);

/** Accent eyebrow above titles */
export const TypographyEyebrow = typography("p", type.eyebrow);

/** Default paragraph */
export const TypographyP = typography("p", type.body);

/** Lead / intro paragraph */
export const TypographyLead = typography(
  "p",
  cn(type.bodyMuted, "text-[1rem] sm:text-[1.0625rem]")
);

/** Muted supporting text */
export const TypographyMuted = typography("p", type.bodyMuted);

/** Fine print */
export const TypographyCaption = typography("p", type.caption);

/** Large metric value */
export const TypographyMetric = typography("p", type.metric);

/** Inline code */
export function TypographyInlineCode({
  className,
  ...props
}: React.ComponentProps<"code">) {
  return (
    <code
      className={cn(
        "relative rounded-md bg-muted px-[0.35rem] py-[0.15rem] font-mono text-[0.8125rem] font-medium text-foreground",
        className
      )}
      {...props}
    />
  );
}

/** Bulleted list with comfortable rhythm */
export function TypographyList({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("my-3 ml-4 list-disc space-y-1.5 text-[0.9375rem] leading-[1.55] text-muted-foreground [&>li]:mt-0", className)}
      {...props}
    />
  );
}
