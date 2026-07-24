"use client";

import { type UseFormRegisterReturn } from "react-hook-form";

import { FieldError } from "~/components/auth/field-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

/**
 * One labelled field of an auth form, with its error wired to the input through
 * `aria-describedby` so a screen reader announces the reason a submission was
 * refused rather than only that something is invalid.
 */
export function AuthField({
  autoComplete,
  error,
  id,
  label,
  registration,
  type = "text",
}: {
  autoComplete: string;
  error?: string | undefined;
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  type?: "email" | "password" | "text";
}) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...registration}
        aria-describedby={error === undefined ? undefined : errorId}
        aria-invalid={error !== undefined}
        autoComplete={autoComplete}
        id={id}
        type={type}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
