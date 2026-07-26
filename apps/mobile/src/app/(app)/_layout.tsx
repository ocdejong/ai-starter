import { Tabs } from "expo-router/js-tabs";
import { useTranslations } from "use-intl";

import { useTheme } from "../../theme/theme-provider";

/**
 * The signed-in shell: the two places a reader can be.
 *
 * The session gate lives above this in the root layout, so every screen in this
 * group is behind an account without repeating the check. Tabs are labelled from
 * the same catalog keys as the web navigation, so the two platforms name the same
 * places the same way.
 */
export default function AppTabsLayout() {
  const t = useTranslations("app.nav");
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme["muted-foreground"],
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("dashboard") }} />
      {/* A generated feature registers its tab on the line below. */}
      <Tabs.Screen
        name="announcements"
        options={{ title: t("announcements") }}
      />
      <Tabs.Screen name="settings" options={{ title: t("settings") }} />
    </Tabs>
  );
}
