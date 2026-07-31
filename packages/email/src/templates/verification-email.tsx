import { Button, Heading, Text } from "react-email";

import { BaseLayout } from "./base-layout";

export type VerificationEmailProps = { url: string };

export function VerificationEmail({ url }: VerificationEmailProps) {
  return (
    <BaseLayout preview="Verify your email address">
      <Heading>Verify your email address</Heading>
      <Text>Confirm your email address to finish setting up your account.</Text>
      <Button href={url}>Verify email address</Button>
      <Text>Or paste this link into your browser: {url}</Text>
    </BaseLayout>
  );
}

VerificationEmail.PreviewProps = {
  url: "https://app.example.com/verify-email?token=preview-token",
} satisfies VerificationEmailProps;

export default VerificationEmail;
