import { render } from "@react-email/render";
import type { ReactElement } from "react";

export type RenderedEmail = { html: string; text: string };

/**
 * Renders a react-email template to the two strings the `EmailSender` port
 * carries. `render` is asynchronous in react-email v6; awaiting both variants
 * of the same element is what keeps the plaintext body — the part that makes a
 * dev-mailbox action link clickable — in step with the HTML.
 */
export async function renderEmail(
  element: ReactElement,
): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { html, text };
}
