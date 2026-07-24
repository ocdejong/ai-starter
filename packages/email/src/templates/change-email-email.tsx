import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";

export type ChangeEmailEmailProps = { url: string };

export function ChangeEmailEmail({ url }: ChangeEmailEmailProps) {
  return (
    <BaseLayout preview="Confirm your new email address">
      <Heading>Confirm your new email address</Heading>
      <Text>
        Approve this change to start using your new email address to sign in.
      </Text>
      <Button href={url}>Confirm new email address</Button>
      <Text>Or paste this link into your browser: {url}</Text>
    </BaseLayout>
  );
}

ChangeEmailEmail.PreviewProps = {
  url: "https://app.example.com/change-email?token=preview-token",
} satisfies ChangeEmailEmailProps;

export default ChangeEmailEmail;
