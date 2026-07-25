import type { EmailSender } from "@ai-starter/api";
import type { AuthEmailDispatch, AuthEmailDispatchers } from "@ai-starter/auth";
import {
  renderChangeEmailEmail,
  renderDeleteAccountEmail,
  renderGroupInvitationEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
  type RenderedEmail,
} from "@ai-starter/email";

/**
 * Where an emailed group invitation lands. Better Auth never builds this URL,
 * so the route lives here, in the application that serves it, and the page at
 * `${groupInvitationPath}/[invitationId]` must honour it.
 */
export const groupInvitationPath = "/invitations";

/**
 * Builds the dispatchers the auth factory calls, wiring each
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
  options: { readonly appUrl: string },
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

  const sendInvitation = dispatch(
    renderGroupInvitationEmail,
    "You have been invited to a group",
  );

  return {
    sendChangeEmailVerification: dispatch(
      renderChangeEmailEmail,
      "Confirm your email change",
    ),
    sendDeleteAccountVerification: dispatch(
      renderDeleteAccountEmail,
      "Confirm your account deletion",
    ),
    sendGroupInvitation: ({ invitationId, to }) => {
      sendInvitation({
        to,
        url: new URL(
          `${groupInvitationPath}/${invitationId}`,
          options.appUrl,
        ).toString(),
      });
    },
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
