import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@ai-starter/tokens";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Text } from "react-native";

import { ThemeProvider, useTheme } from "./theme-provider";

function Probe() {
  const { preference, setPreference, theme } = useTheme();
  return (
    <>
      <Text testID="background">{theme.background}</Text>
      <Text testID="preference">{preference}</Text>
      <Text testID="choose-dark" onPress={() => setPreference("dark")}>
        Dark
      </Text>
    </>
  );
}

afterEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("lets a manual override beat the system scheme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("preference")).toHaveTextContent("system"),
    );
    expect(screen.getByTestId("background")).toHaveTextContent(
      colors.light.background,
    );

    fireEvent.press(screen.getByTestId("choose-dark"));

    await waitFor(() =>
      expect(screen.getByTestId("background")).toHaveTextContent(
        colors.dark.background,
      ),
    );
    expect(screen.getByTestId("preference")).toHaveTextContent("dark");
    await waitFor(async () =>
      expect(await AsyncStorage.getItem("theme-preference")).toBe("dark"),
    );
  });

  it("restores the persisted override on a fresh start", async () => {
    await AsyncStorage.setItem("theme-preference", "dark");
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("preference")).toHaveTextContent("dark"),
    );
    expect(screen.getByTestId("background")).toHaveTextContent(
      colors.dark.background,
    );
  });
});
