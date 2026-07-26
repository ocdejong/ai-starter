import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, Text } from "react-native";
import { useTranslations } from "use-intl";

import { ThemeToggle } from "../components/theme-toggle";
import { TestProviders } from "../test/providers";
import { LocaleProvider, useLocale } from "./locale-provider";

// A device that reports English, so the persistence test starts from a known
// default and only the saved override moves it.
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
}));

/**
 * Compile-time guard that the use-intl `AppConfig` augmentation is in force on
 * native. Never rendered — if the augmentation lapses, keys widen to `string`,
 * `t("nope")` stops erroring, and the unused `@ts-expect-error` fails typecheck.
 */
export function TypedKeyProbe() {
  const t = useTranslations("mobile");
  t("openLinkOnThisDevice");
  // @ts-expect-error "nope" is not a key in the mobile namespace
  t("nope");
  return null;
}

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  return (
    <>
      <Text>current:{locale}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setLocale("nl");
        }}
      >
        <Text>to-nl</Text>
      </Pressable>
    </>
  );
}

describe("native i18n", () => {
  it("renders a real component against the Dutch catalog", async () => {
    await render(
      <TestProviders locale="nl">
        <ThemeToggle />
      </TestProviders>,
    );

    await waitFor(() => expect(screen.getByText("Systeem")).toBeOnTheScreen());
  });

  it("persists the chosen locale across a remount", async () => {
    await AsyncStorage.clear();

    const first = await render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("current:en")).toBeOnTheScreen(),
    );

    await fireEvent.press(screen.getByText("to-nl"));
    await waitFor(() =>
      expect(screen.getByText("current:nl")).toBeOnTheScreen(),
    );
    expect(await AsyncStorage.getItem("locale-override")).toBe("nl");
    await first.unmount();

    await render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("current:nl")).toBeOnTheScreen(),
    );
  });
});
