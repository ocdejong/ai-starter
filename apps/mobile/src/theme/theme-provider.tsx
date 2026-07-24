import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, type ColorScheme, type ThemeColors } from "@ai-starter/tokens";
import * as SplashScreen from "expo-splash-screen";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

/** What the user picked: a fixed scheme, or follow the device. */
export type ThemePreference = ColorScheme | "system";

const STORAGE_KEY = "theme-preference";

const preferences: readonly ThemePreference[] = ["light", "dark", "system"];

function isPreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" && preferences.includes(value as ThemePreference)
  );
}

type ThemeContextValue = {
  readonly preference: ThemePreference;
  /** The resolved scheme after applying the override or the device setting. */
  readonly scheme: ColorScheme;
  readonly theme: ThemeColors;
  readonly setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Hold the splash screen until the stored override has been read, so the first
// painted frame is already in the right scheme (no flash on native).
void SplashScreen.preventAutoHideAsync();

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useColorScheme can also report null or "unspecified"; treat anything that
  // is not an explicit dark preference as light.
  const systemScheme: ColorScheme =
    useColorScheme() === "dark" ? "dark" : "light";
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPreference() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (active && isPreference(stored)) {
          setPreferenceState(stored);
        }
      } finally {
        if (active) {
          setHydrated(true);
        }
      }
    }

    void loadPreference();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync();
    }
  }, [hydrated]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const scheme: ColorScheme =
    preference === "system" ? systemScheme : preference;

  const value: ThemeContextValue = {
    preference,
    scheme,
    setPreference,
    theme: colors[scheme],
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return value;
}
