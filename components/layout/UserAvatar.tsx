import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  className?: string;
}

/** Decorative; the name is always shown or announced next to it. */
export function UserAvatar({ name, className }: UserAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
