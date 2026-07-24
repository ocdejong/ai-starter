import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AuthHeader } from "~/components/auth/auth-header";
import { parseQueryValue } from "~/lib/search-params";

/**
 * Where a confirmation link lands when it does not work. A link that does work
 * never renders this page: the auth server verifies the token, signs the visitor
 * in, and redirects here — where the layout sends a signed-in visitor home.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const failed = parseQueryValue((await searchParams).error) !== undefined;
  const t = await getTranslations("auth.verifyEmail");

  return (
    <div className="space-y-6">
      <AuthHeader
        description={failed ? t("failed") : t("pending")}
        title={failed ? t("failedTitle") : t("pendingTitle")}
      />
      <Link
        className="text-primary text-sm underline-offset-4 hover:underline"
        href="/sign-in"
      >
        {t("backToSignIn")}
      </Link>
    </div>
  );
}
