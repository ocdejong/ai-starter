import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";

export type GroupInvitationEmailProps = { url: string };

export function GroupInvitationEmail({ url }: GroupInvitationEmailProps) {
  return (
    <BaseLayout preview="You have been invited to a group">
      <Heading>You have been invited to a group</Heading>
      <Text>Accept the invitation below to join the group.</Text>
      <Button href={url}>Accept invitation</Button>
      <Text>Or paste this link into your browser: {url}</Text>
    </BaseLayout>
  );
}

GroupInvitationEmail.PreviewProps = {
  url: "https://app.example.com/invitations/preview-token",
} satisfies GroupInvitationEmailProps;

export default GroupInvitationEmail;
