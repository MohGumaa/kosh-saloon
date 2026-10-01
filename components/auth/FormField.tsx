"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AuthErrorCode } from "@/actions/auth";

interface FormFieldProps extends Omit<ComponentProps<"input">, "id" | "name"> {
  name: string;
  label: string;
  error?: AuthErrorCode;
  hint?: string;
  icon?: LucideIcon;
}

/**
 * Labelled input whose error and hint are linked with aria-describedby.
 * Password fields get a show/hide button.
 */
export function FormField({ name, label, error, hint, icon: Icon, type, className, ...inputProps }: FormFieldProps) {
  const t = useTranslations("auth");
  const [revealed, setRevealed] = useState(false);
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const isPassword = type === "password";
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-4 my-auto size-[1.125rem] text-muted-foreground"
          />
        )}
        <Input
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("h-12 rounded-xl px-4 md:text-base", Icon && "ps-12", isPassword && "pe-12", className)}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            aria-pressed={revealed}
            aria-label={t("showPassword")}
            title={t(revealed ? "hidePassword" : "showPassword")}
            onClick={() => setRevealed((value) => !value)}
            className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-e-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
          >
            {revealed ? <EyeOff aria-hidden className="size-[1.125rem]" /> : <Eye aria-hidden className="size-[1.125rem]" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
