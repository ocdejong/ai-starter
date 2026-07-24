/**
 * The transactional-email capability the API depends on, owned here by the
 * consumer rather than by any vendor. Callers hand over fully rendered strings,
 * so no React element or provider response type ever crosses this boundary and
 * the concrete sender (Resend in production, a local dev mailbox otherwise) is
 * an implementation detail wired only at the web composition root.
 */
export type EmailMessage = Readonly<{
  html: string;
  subject: string;
  text: string;
  to: string;
}>;

/**
 * A discriminated result instead of a thrown error: a failed send is an
 * expected outcome the caller decides how to handle, and Better Auth callbacks
 * dispatch email fire-and-forget where an exception would be lost.
 */
export type EmailSendResult =
  | Readonly<{ id: string | null; ok: true }>
  | Readonly<{ error: string; ok: false }>;

export type EmailSender = Readonly<{
  send: (message: EmailMessage) => Promise<EmailSendResult>;
}>;
