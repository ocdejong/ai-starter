import { type ReactNode } from "react";

/**
 * The card an invitation link lands in, whatever it has to say.
 *
 * Every state of the page — sign in first, here is the invitation, this one is
 * spent — is a heading, a sentence and whatever can be done about it, so they
 * share one shape rather than three near-identical ones.
 */
export function InvitationPanel({
  children,
  description,
  title,
}: {
  readonly children?: ReactNode;
  readonly description: string;
  readonly title: string;
}) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      {children}
    </div>
  );
}
