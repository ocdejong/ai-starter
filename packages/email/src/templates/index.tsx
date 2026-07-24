import { renderEmail, type RenderedEmail } from "../render";
import {
  ChangeEmailEmail,
  type ChangeEmailEmailProps,
} from "./change-email-email";
import {
  DeleteAccountEmail,
  type DeleteAccountEmailProps,
} from "./delete-account-email";
import {
  GroupInvitationEmail,
  type GroupInvitationEmailProps,
} from "./group-invitation-email";
import {
  PasswordResetEmail,
  type PasswordResetEmailProps,
} from "./password-reset-email";
import {
  VerificationEmail,
  type VerificationEmailProps,
} from "./verification-email";

export { ChangeEmailEmail, type ChangeEmailEmailProps };
export { DeleteAccountEmail, type DeleteAccountEmailProps };
export { GroupInvitationEmail, type GroupInvitationEmailProps };
export { PasswordResetEmail, type PasswordResetEmailProps };
export { VerificationEmail, type VerificationEmailProps };

export function renderVerificationEmail(
  props: VerificationEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(<VerificationEmail {...props} />);
}

export function renderPasswordResetEmail(
  props: PasswordResetEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(<PasswordResetEmail {...props} />);
}

export function renderChangeEmailEmail(
  props: ChangeEmailEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(<ChangeEmailEmail {...props} />);
}

export function renderDeleteAccountEmail(
  props: DeleteAccountEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(<DeleteAccountEmail {...props} />);
}

export function renderGroupInvitationEmail(
  props: GroupInvitationEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(<GroupInvitationEmail {...props} />);
}
