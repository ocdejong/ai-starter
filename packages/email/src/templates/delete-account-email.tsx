import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";

export type DeleteAccountEmailProps = { url: string };

export function DeleteAccountEmail({ url }: DeleteAccountEmailProps) {
  return (
    <BaseLayout preview="Confirm your account deletion">
      <Heading>Confirm your account deletion</Heading>
      <Text>
        Confirm the link below to permanently delete your account. Ignore this
        email if you did not request it.
      </Text>
      <Button href={url}>Delete my account</Button>
      <Text>Or paste this link into your browser: {url}</Text>
    </BaseLayout>
  );
}

DeleteAccountEmail.PreviewProps = {
  url: "https://app.example.com/delete-account?token=preview-token",
} satisfies DeleteAccountEmailProps;

export default DeleteAccountEmail;
