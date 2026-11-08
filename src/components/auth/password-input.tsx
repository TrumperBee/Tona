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

interface Strength {
  readonly score: number;
  readonly label: string;
  readonly tone: string;
}

function scorePassword(password: string): Strength {
  let score = 0;

  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length === 0) {
    return { score: 0, label: "Use at least 10 characters.", tone: "bg-white/10" };
  }

  if (score <= 2) {
    return { score, label: "Weak password. Add length and variety.", tone: "bg-danger" };
  }

  if (score <= 3) {
    return { score, label: "Fair password. Longer is safer.", tone: "bg-warning" };
  }

  if (score === 4) {
    return { score, label: "Strong password.", tone: "bg-electric-400" };
  }

  return { score, label: "Very strong password.", tone: "bg-success" };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => scorePassword(password), [password]);
  const segments = 5;

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index < Math.max(strength.score, password ? 1 : 0) ? strength.tone : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-grey-400" role="status">
        {strength.label}
      </p>
    </div>
  );
}
