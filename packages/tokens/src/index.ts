/**
 * The single source of truth for theme values on every platform.
 *
 * Colors use the shadcn/ui semantic names. Keys are the exact CSS custom
 * property names the web emits (see `apps/web`'s theme codegen), so the mapping
 * to `--background`, `--muted-foreground`, … is a prefix, not a translation.
 * Values are plain hex strings because they must be consumable by both the web
 * (`var(--…)`) and React Native, whose color parser understands hex but not
 * `oklch()`. Native reads these objects directly through its theme context.
 *
 * Adding a color means adding the same key to `light` and `dark`; the web drift
 * test fails until the generated CSS matches, and TypeScript keeps the two
 * schemes structurally identical.
 */
export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    "card-foreground": "#0a0a0a",
    popover: "#ffffff",
    "popover-foreground": "#0a0a0a",
    primary: "#171717",
    "primary-foreground": "#fafafa",
    secondary: "#f5f5f5",
    "secondary-foreground": "#171717",
    muted: "#f5f5f5",
    "muted-foreground": "#737373",
    accent: "#f5f5f5",
    "accent-foreground": "#171717",
    destructive: "#e7000b",
    border: "#e5e5e5",
    input: "#e5e5e5",
    ring: "#a1a1a1",
    "chart-1": "#d4d4d4",
    "chart-2": "#737373",
    "chart-3": "#525252",
    "chart-4": "#404040",
    "chart-5": "#262626",
    sidebar: "#fafafa",
    "sidebar-foreground": "#0a0a0a",
    "sidebar-primary": "#171717",
    "sidebar-primary-foreground": "#fafafa",
    "sidebar-accent": "#f5f5f5",
    "sidebar-accent-foreground": "#171717",
    "sidebar-border": "#e5e5e5",
    "sidebar-ring": "#a1a1a1",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#171717",
    "card-foreground": "#fafafa",
    popover: "#171717",
    "popover-foreground": "#fafafa",
    primary: "#e5e5e5",
    "primary-foreground": "#171717",
    secondary: "#262626",
    "secondary-foreground": "#fafafa",
    muted: "#262626",
    "muted-foreground": "#a1a1a1",
    accent: "#262626",
    "accent-foreground": "#fafafa",
    destructive: "#ff6467",
    border: "#ffffff1a",
    input: "#ffffff26",
    ring: "#737373",
    "chart-1": "#d4d4d4",
    "chart-2": "#737373",
    "chart-3": "#525252",
    "chart-4": "#404040",
    "chart-5": "#262626",
    sidebar: "#171717",
    "sidebar-foreground": "#fafafa",
    "sidebar-primary": "#1447e6",
    "sidebar-primary-foreground": "#fafafa",
    "sidebar-accent": "#262626",
    "sidebar-accent-foreground": "#fafafa",
    "sidebar-border": "#ffffff1a",
    "sidebar-ring": "#737373",
  },
} as const;

/** The base corner radius, in `rem`. The web derives its radius scale from this. */
export const radius = 0.625;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** A single theme's resolved color set. */
export type ColorScheme = keyof typeof colors;
export type ThemeColors = (typeof colors)[ColorScheme];
