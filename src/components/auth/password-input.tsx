"use client";

// GCC - password input with visibility toggle and strength feedback.
import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useMemo, useState, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly invalid?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ id, className, ...props }, ref) {
    const generatedId = useId();
    const resolvedId = id ?? generatedId;
    const [visible, setVisible] = useState(false);

    return (
      <span className="relative block">
        <Input
          ref={ref}
          id={resolvedId}
          type={visible ? "text" : "password"}
          className={`pr-12 ${className ?? ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-grey-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </span>
    );
  },
);

export interface PasswordStrengthProps {
  readonly password: string;
}

export type PasswordStrengthLevel = "empty" | "weak" | "okay" | "strong";

interface Strength {
  readonly level: PasswordStrengthLevel;
  readonly score: number;
  readonly label: string;
  readonly tone: string;
  readonly advisory: string | null;
}

const WEAK_ADVISORY =
  "This password is easy to guess. You can still use it, but a longer one is safer.";

/**
 * Advisory feedback only. It never decides whether the form may submit: any
 * password of six or more characters is accepted by the server.
 */
export function getPasswordStrength(password: string): Strength {
  if (password.length === 0) {
    return { level: "empty", score: 0, label: "", tone: "bg-white/10", advisory: null };
  }

  // Length dominates, with a small bonus for variety. These are hints, not
  // requirements.
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return {
      level: "weak",
      score,
      label: "Weak password",
      tone: "bg-warning",
      advisory: WEAK_ADVISORY,
    };
  }

  if (score <= 4) {
    return {
      level: "okay",
      score,
      label: "Okay password",
      tone: "bg-electric-400",
      advisory: null,
    };
  }

  return { level: "strong", score, label: "Strong password", tone: "bg-success", advisory: null };
}

function scorePassword(password: string): Strength {
  return getPasswordStrength(password);
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => scorePassword(password), [password]);
  const segments = 5;

  if (strength.level === "empty") {
    return null;
  }

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index < Math.max(strength.score, 1) ? strength.tone : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-grey-400" role="status">
        {strength.label}
      </p>
      {strength.advisory ? (
        <p className="mt-1 text-xs leading-5 text-warning-soft">{strength.advisory}</p>
      ) : null}
    </div>
  );
}
