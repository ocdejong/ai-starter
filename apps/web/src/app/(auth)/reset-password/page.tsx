import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AuthHeader } from "~/components/auth/auth-header";
import { ResetPasswordForm } from "~/components/auth/reset-password-form";
import { parseQueryValue } from "~/lib/search-params";

/**
 * The visitor arrives here from the auth server, not from the email: the emailed
 * link hits `/api/auth/reset-password/<token>`, which checks the token and then
 * redirects here with `?token=` — or with `?error=` when it has already expired.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = parseQueryValue(query.token);
  const failed = parseQueryValue(query.error) !== undefined;

  if (token === undefined || failed) {
    const t = await getTranslations("auth.resetPassword");
    return (
      <div className="space-y-6">
        <AuthHeader description={t("invalid")} title={t("invalidTitle")} />
        <Link
          className="text-primary text-sm underline-offset-4 hover:underline"
          href="/forgot-password"
        >
          {t("requestNew")}
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
