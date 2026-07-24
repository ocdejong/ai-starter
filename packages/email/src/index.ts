import "server-only";

export {
  createDevEmailSender,
  readMailbox,
  type StoredEmail,
} from "./adapters/dev-mailbox-sender";
export {
  createResendEmailSender,
  translateResendResult,
  type ResendLike,
} from "./adapters/resend-sender";
export {
  createEmailSender,
  type EmailSenderConfig,
} from "./create-email-sender";
export { renderEmail, type RenderedEmail } from "./render";
export * from "./templates";
