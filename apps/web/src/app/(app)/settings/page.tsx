import { redirect } from "next/navigation";

import { accountSettingsPath } from "~/lib/routes";

/**
 * `/settings` is the navigation target, not a page of its own: it opens the first
 * section so the visitor never lands on an empty frame.
 */
export default function SettingsPage() {
  redirect(accountSettingsPath);
}
