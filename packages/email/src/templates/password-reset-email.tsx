import { Button, Heading, Text } from "react-email";

import { BaseLayout } from "./base-layout";

export type PasswordResetEmailProps = { url: string };

export function PasswordResetEmail({ url }: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Reset your password">
      <Heading>Reset your password</Heading>
      <Text>
        Choose a new password using the link below. Ignore this email if you did
        not request it.
      </Text>
      <Button href={url}>Reset password</Button>
      <Text>Or paste this link into your browser: {url}</Text>
    </BaseLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  url: "https://app.example.com/reset-password?token=preview-token",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
