import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  defaultLocale,
  messages,
  parseLocale,
  type Locale,
} from "@ai-starter/i18n";
import { getLocales } from "expo-localization";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { IntlProvider } from "use-intl";

const STORAGE_KEY = "locale-override";

/** The device's preferred supported language, resolved synchronously so the
 * first painted frame is already correct for a visitor with no saved override. */
function deviceLocale(): Locale {
  for (const { languageCode } of getLocales()) {
    const match = parseLocale(languageCode);
    if (match !== null) {
      return match;
    }
  }
  return defaultLocale;
}

type LocaleContextValue = {
  readonly locale: Locale;
  /** Persists an explicit choice that outranks the device language. */
  readonly setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Resolves the active locale (saved override, else device, else `en`), keeps it
 * in AsyncStorage, and feeds it to use-intl. `getLocales()` is synchronous, so
 * only a returning visitor whose saved override differs from their device
 * language sees a one-frame device-language flash while the async read settles;
 * the theme provider above owns the splash gate and does not wait on this read.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<Locale | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOverride() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = parseLocale(stored);
        if (active && parsed !== null) {
          setOverride(parsed);
        }
      } catch {
        // A failed read just leaves the device language in place.
      }
    }

    void loadOverride();

    return () => {
      active = false;
    };
  }, []);

  const locale = override ?? deviceLocale();

  const setLocale = useCallback((next: Locale) => {
    setOverride(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} messages={messages[locale]}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value === null) {
    throw new Error("useLocale must be used within a LocaleProvider.");
  }
  return value;
}
