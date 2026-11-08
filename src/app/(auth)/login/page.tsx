// GCC - sign in.
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/security/redirect";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string | string[] }>;
}>) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = safeRedirectPath(rawNext);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">Accounts</p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-6 text-grey-300">
        Sign in with the verified email address on your GCC account.
      </p>
      <div className="mt-8">
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
