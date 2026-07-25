import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";

import { authClient } from "../auth/client";
import { mobileEnv } from "../env";

/**
 * The transport the chat screen speaks to `POST /api/chat` over.
 *
 * Three platform facts are settled here. The request goes to
 * `EXPO_PUBLIC_API_URL` because a native app has no origin of its own, and it is
 * the same variable the tRPC client uses — both must agree on one origin or the
 * session cookie authorizes neither. That cookie is attached by hand and read per
 * request, since React Native has no cookie jar and a captured value would
 * authorize whoever was signed in when the module loaded. And the fetch is
 * `expo/fetch`: React Native's own `fetch` buffers the whole body, which would
 * turn a token stream into one late paragraph. Expo installs `expo/fetch` as the
 * global unless `EXPO_PUBLIC_USE_RN_FETCH` is set, so passing it explicitly is
 * what makes the requirement independent of that switch.
 */
/**
 * `expo/fetch` accepts a URL or a request-like object where the platform's own
 * `fetch` also accepts a `Request`; calling through rather than asserting the two
 * signatures are the same keeps the difference visible instead of suppressed.
 */
const streamingFetch: typeof globalThis.fetch = (input, init) =>
  expoFetch(input instanceof Request ? input.url : input, init);

export const chatTransport = new DefaultChatTransport({
  api: `${mobileEnv.EXPO_PUBLIC_API_URL}/api/chat`,
  credentials: "omit",
  fetch: streamingFetch,
  headers: () => {
    const cookie = authClient.getCookie();
    return cookie === "" ? {} : { Cookie: cookie };
  },
});
