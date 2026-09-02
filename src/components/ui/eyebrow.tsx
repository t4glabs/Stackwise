import * as React from "react";
import { cn } from "@/lib/utils";

function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-[13px] font-semibold uppercase tracking-[0.13em] text-stone-600",
        className
      )}
      {...props}
    />
  );
}

export { Eyebrow };
