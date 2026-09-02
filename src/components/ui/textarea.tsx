import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-control border border-grey-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-grey-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grey-600/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
