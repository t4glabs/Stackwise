import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-[7px] py-[3px] text-[12px] font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-grey-100 text-grey-700",
        accent: "bg-accent-soft text-accent",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
      },
      pill: {
        true: "rounded-full bg-grey-100 px-2.5 py-1 font-normal text-grey-700",
        false: "",
      },
    },
    defaultVariants: { variant: "neutral", pill: false },
  }
);

function Badge({
  className,
  variant,
  pill,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant, pill, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
