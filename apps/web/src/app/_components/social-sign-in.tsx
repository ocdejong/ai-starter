import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { type SocialProvider } from "~/lib/social-providers";

export type SocialSignInProps = {
  /** `null` when the deployment configured no OAuth credentials. */
  readonly provider: SocialProvider | null;
  /** Starts the provider redirect; a server action at the composition root. */
  readonly signIn: () => void | Promise<void>;
};

/**
 * The third way in, or an honest note that there isn't one.
 *
 * Which branch a deployment renders is decided by credentials it either has or
 * does not, so no deployment ever shows both — and a component is what lets the
 * other one be seen anyway.
 */
export function SocialSignIn({ provider, signIn }: SocialSignInProps) {
  const t = useTranslations("home");

  if (provider === null) {
    return <p className="text-muted-foreground text-sm">{t("oauthHint")}</p>;
  }

  return (
    <form>
      <Button formAction={signIn} variant="ghost">
        {t("signInWith", { provider })}
      </Button>
    </form>
  );
}
