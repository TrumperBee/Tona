// GCC - sign in.
import { Info } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/security/redirect";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
}>) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const rawReason = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const nextPath = safeRedirectPath(rawNext);
  // Only the fixed `permissions` value produces a notice. The string is never
  // rendered from the query parameter itself.
  const permissionNotice =
    rawReason === "permissions"
      ? "Your session ended because your account permissions changed. Sign in again to continue."
      : null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">Accounts</p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-6 text-grey-300">
        Sign in with the email address on your GCC account.
      </p>
      {permissionNotice ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-md border border-electric-400/30 bg-electric-500/10 p-3 text-sm leading-6 text-electric-100"
        >
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{permissionNotice}</p>
        </div>
      ) : null}
      <div className="mt-8">
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
