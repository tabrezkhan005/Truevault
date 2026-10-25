import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary-foreground",
        muted: "border-border bg-muted text-muted-foreground",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        danger: "border-danger/30 bg-danger/15 text-danger",
        owner: "border-primary/40 bg-primary/20 text-[#c7c9ff]",
        edit: "border-warning/40 bg-warning/10 text-warning",
        read: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function accessBadgeVariant(
  level: string | undefined,
): NonNullable<VariantProps<typeof badgeVariants>["variant"]> {
  if (level === "owner") return "owner";
  if (level === "edit") return "edit";
  if (level === "read") return "read";
  return "muted";
}
