import { type ReactNode } from "react";

/** The heading every auth panel opens with, so each state names itself. */
export function AuthHeader({
  description,
  title,
}: {
  description: ReactNode;
  title: string;
}) {
  return (
    <header className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </header>
  );
}
