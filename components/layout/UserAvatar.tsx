import Image from "next/image";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  /** The stored profile image URL; initials are shown without one. */
  image?: string | null;
  className?: string;
}

/** Decorative; the name is always shown or announced next to it. */
export function UserAvatar({ name, image, className }: UserAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground",
        className,
      )}
    >
      {image ? (
        // 112px is the largest size an avatar is shown at.
        <Image src={image} alt="" width={112} height={112} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
