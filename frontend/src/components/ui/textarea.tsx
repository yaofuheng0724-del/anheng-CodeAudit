import * as React from "react";

import { cn } from "@/shared/utils/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-focus aria-invalid:border-destructive flex field-sizing-content min-h-28 w-full rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed shadow-none transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
