import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { InvitationScreen } from "../../components/groups/invitation-screen";

/**
 * Where `ai-starter:///invitations/<id>` lands.
 *
 * It sits outside the tab group because an invitation is not a place in the
 * application, and outside `(auth)` because answering one needs a session: the
 * gate sends a signed-out visitor to sign in, and they open the link again.
 */
export default function InvitationRoute() {
  const router = useRouter();
  const { invitationId } = useLocalSearchParams<{ invitationId: string }>();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <InvitationScreen
        invitationId={invitationId}
        onDone={() => {
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}
