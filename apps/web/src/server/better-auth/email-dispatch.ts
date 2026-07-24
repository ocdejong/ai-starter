import type { EmailSender } from "@ai-starter/api";
import type { AuthEmailDispatch, AuthEmailDispatchers } from "@ai-starter/auth";
import {
  renderChangeEmailEmail,
  renderDeleteAccountEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
  type RenderedEmail,
} from "@ai-starter/email";

/**
 * Builds the four account-flow dispatchers the auth factory calls, wiring each
 * to a template and a subject and sending through the injected `EmailSender`
 * port. The port is a parameter so this wiring is testable against a fake sender
 * without standing up the composition root's real adapter or environment.
 *
 * Each dispatch is fire-and-forget: it renders and sends off the request path so
 * a slow render or send never lengthens (and so never signals through) the
 * flow's response — Better Auth's timing guidance for reset and verification
 * mail. A failed render is logged without the recipient or link, so nothing
 * sensitive reaches the logs.
 */
export function createAuthEmailDispatchers(
  sender: EmailSender,
): AuthEmailDispatchers {
  const dispatch =
    (
      render: (props: { url: string }) => Promise<RenderedEmail>,
      subject: string,
    ): AuthEmailDispatch =>
    ({ to, url }) => {
      void (async () => {
        try {
          const { html, text } = await render({ url });
          await sender.send({ html, subject, text, to });
        } catch {
          console.error(`Failed to dispatch the "${subject}" email.`);
        }
      })();
    };

  return {
    sendChangeEmailVerification: dispatch(
      renderChangeEmailEmail,
      "Confirm your email change",
    ),
    sendDeleteAccountVerification: dispatch(
      renderDeleteAccountEmail,
      "Confirm your account deletion",
    ),
    sendPasswordReset: dispatch(
      renderPasswordResetEmail,
      "Reset your password",
    ),
    sendVerification: dispatch(
      renderVerificationEmail,
      "Verify your email address",
    ),
  };
}
