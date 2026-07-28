import { messages } from "@ai-starter/i18n";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE } from "./locale-cookie";
import { resolveLocale } from "./resolve-locale";

export default getRequestConfig(async () => {
  const locale = resolveLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get("accept-language"),
  );
  return { locale, messages: messages[locale] };
});
