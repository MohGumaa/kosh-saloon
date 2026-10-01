"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthErrorCode } from "@/actions/auth";

interface FormFieldProps extends Omit<ComponentProps<"input">, "id" | "name"> {
  name: string;
  label: string;
  error?: AuthErrorCode;
}

/** Labelled input whose error is announced and linked with aria-describedby. */
export function FormField({ name, label, error, ...inputProps }: FormFieldProps) {
  const t = useTranslations("auth.errors");
  const id = `field-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}
