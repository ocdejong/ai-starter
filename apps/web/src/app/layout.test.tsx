import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "geist" }) }));
vi.mock("~/styles/globals.css", () => ({}));
vi.mock("~/trpc/react", () => ({ TRPCReactProvider: () => null }));
vi.mock("next-intl/server", () => ({
  getLocale: () => Promise.resolve("nl"),
  getMessages: () => Promise.resolve({}),
  getTranslations: () => Promise.resolve(() => ""),
}));

import RootLayout from "./layout";

function onlyChild(element: ReactElement): ReactElement {
  const [child] = Children.toArray(
    (element.props as { children?: ReactNode }).children,
  );
  if (!isValidElement(child)) {
    throw new Error("The layout no longer nests the element this test reads.");
  }
  return child;
}

/**
 * The two preferences a visitor sets are read here, once, for every page: the
 * locale the request resolved becomes the document's language, and the theme
 * class is applied by a provider the layout configures. A reload keeps them
 * only if the root layout still wires both, which no page-level test sees.
 */
describe("RootLayout", () => {
  it("sets the document language from the locale the request resolved", async () => {
    const html: ReactElement<{ lang: string }> = await RootLayout({
      children: "page",
    });

    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("nl");
  });

  it("applies the stored theme as a class, following the system by default", async () => {
    const html = await RootLayout({ children: "page" });
    const themeProvider = onlyChild(onlyChild(html));

    expect(themeProvider.props).toMatchObject({
      attribute: "class",
      defaultTheme: "system",
      enableSystem: true,
    });
  });
});
