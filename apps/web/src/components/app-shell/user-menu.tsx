"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { SignOutButton } from "~/components/app-shell/sign-out-button";
import { accountSettingsPath } from "~/lib/routes";

export type ShellUser = {
  readonly name: string;
  readonly email: string;
};

/**
 * Who is signed in, and the two things they can do about it.
 *
 * A plain button with `aria-expanded` rather than `details`/`summary`: Chromium
 * exposes a summary as a disclosure triangle, not a button, so neither a screen
 * reader user nor a test can address it by the role it plays. The account name is
 * the button's own label, which is also what makes "who am I signed in as"
 * answerable without opening anything.
 */
export function UserMenu({ user }: { readonly user: ShellUser }) {
  const t = useTranslations("app.userMenu");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-controls="user-menu"
        aria-expanded={isOpen}
        className="border-border bg-card hover:bg-accent rounded-lg border px-3 py-2 text-sm font-medium"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        type="button"
      >
        {user.name}
      </button>
      {isOpen && (
        <div
          className="border-border bg-popover text-popover-foreground absolute right-0 z-10 mt-2 w-56 space-y-3 rounded-lg border p-3 shadow-md"
          id="user-menu"
        >
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          <Link
            className="text-primary block text-sm underline-offset-4 hover:underline"
            href={accountSettingsPath}
          >
            {t("profile")}
          </Link>
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
