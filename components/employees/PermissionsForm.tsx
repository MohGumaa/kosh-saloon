"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { updateUserPermissions, type PermissionsFormState } from "@/actions/permissions";
import { FormMessage } from "@/components/auth/FormMessage";
import { useSuccessToast } from "@/components/auth/useSuccessToast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  type PermissionGroup,
  type PermissionKey,
} from "@/lib/auth/permissions";

interface PermissionsFormProps {
  userId: string;
  /** The user's stored permissions. */
  current: readonly PermissionKey[];
  /** The permissions the viewer may give or remove; the server enforces the same rule. */
  changeable: readonly PermissionKey[];
  /** The user's role defaults, for the reset button. */
  defaults: readonly PermissionKey[];
  readOnly: boolean;
}

const GROUPS = Object.entries(PERMISSION_GROUPS) as [PermissionGroup, readonly string[]][];

export function PermissionsForm({ userId, current, changeable, defaults, readOnly }: PermissionsFormProps) {
  const t = useTranslations("permissions");
  const [state, action, pending] = useActionState<PermissionsFormState, FormData>(updateUserPermissions, null);
  useSuccessToast(state, t("saved"));
  const [checked, setChecked] = useState<ReadonlySet<PermissionKey>>(() => new Set(current));
  const canChange = new Set(changeable);
  const hasLocked = !readOnly && changeable.length < PERMISSION_KEYS.length;

  function toggle(key: PermissionKey, on: boolean) {
    setChecked((previous) => {
      const next = new Set(previous);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // Only re-ticks the boxes the viewer may change; nothing is stored until Save.
  function resetToDefaults() {
    setChecked((previous) => {
      const next = new Set(previous);
      for (const key of changeable) {
        if (defaults.includes(key)) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  // React resets a form after its `action` runs, which would put these controlled
  // boxes back to their page-load values while the new list is stored. Submitting
  // through onSubmit skips that reset.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="userId" value={userId} />
      {state && !state.success && <FormMessage tone="error">{t(`errors.${state.error}`)}</FormMessage>}
      {hasLocked && <p className="text-sm text-muted-foreground">{t("lockedNote")}</p>}

      <div className="grid gap-5 md:grid-cols-2">
        {GROUPS.map(([group, actions]) => (
          <fieldset key={group} className="min-w-0 rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">{t(`groups.${group}`)}</legend>
            <div className="flex flex-col gap-1">
              {actions.map((actionName) => {
                const key = `${group}.${actionName}` as PermissionKey;
                const disabled = readOnly || !canChange.has(key);
                return (
                  <label
                    key={key}
                    className="flex min-h-9 items-center gap-3 text-sm has-data-disabled:text-muted-foreground"
                  >
                    <Checkbox
                      name="permissions"
                      value={key}
                      checked={checked.has(key)}
                      disabled={disabled}
                      onCheckedChange={(on) => toggle(key, on)}
                    />
                    {t(`keys.${key}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-xl px-5">
            {pending ? t("saving") : t("save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={resetToDefaults}
            className="h-11 rounded-xl px-5"
          >
            {t("reset")}
          </Button>
        </div>
      )}
    </form>
  );
}
