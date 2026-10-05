"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  /** Lands on the trigger button, so a `<label htmlFor>` names it. */
  id: string;
  name: string;
  options: FormSelectOption[];
  /** `""` shows the placeholder, or selects an option whose value is `""` when there is no placeholder. */
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
  /** Size and padding for the trigger, matching the surrounding inputs. */
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Trigger sizing for create and edit forms, matching their 48px inputs. */
export const fieldSelectClass = "data-[size=default]:h-12 ps-4 pe-3 md:text-base";

/** A themed select that submits like a native one: the value is posted under `name` via a hidden input. */
export function FormSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder,
  required,
  onValueChange,
  className,
  ...aria
}: FormSelectProps) {
  return (
    <Select
      id={id}
      name={name}
      required={required}
      items={options}
      defaultValue={defaultValue === "" && placeholder ? null : defaultValue}
      onValueChange={(value) => onValueChange?.(value ?? "")}
    >
      <SelectTrigger className={cn("w-full rounded-xl data-[size=default]:h-11 ps-3 pe-3", className)} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="p-1">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="py-2">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
