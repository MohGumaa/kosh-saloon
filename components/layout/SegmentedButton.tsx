import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface SegmentedButtonProps extends Omit<ComponentProps<"button">, "type"> {
  pressed: boolean;
}

/** One option of a segmented control; the group supplies the border. */
export function SegmentedButton({ pressed, className, ...props }: SegmentedButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-7 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors outline-none",
        "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60",
        pressed && "bg-card text-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
