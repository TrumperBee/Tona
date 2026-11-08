"use client";

// GCC - sign-out control for real sessions.
// The DELETE endpoint clears the cookie and revokes refresh tokens.
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutCompletely } from "@/lib/auth/client";

interface SignOutButtonProps {
  readonly variant?: "primary" | "secondary" | "ghost";
  readonly className?: string;
  readonly fullWidth?: boolean;
}

export function SignOutButton({
  variant = "secondary",
  className,
  fullWidth = false,
}: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut(): Promise<void> {
    setLoading(true);

    try {
      await signOutCompletely();
      router.refresh();
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      loading={loading}
      loadingLabel="Signing out"
      leftIcon={<LogOut aria-hidden="true" className="h-4 w-4" />}
      onClick={signOut}
      className={fullWidth ? `w-full ${className ?? ""}` : className}
    >
      Sign out
    </Button>
  );
}
