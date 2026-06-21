// Predefined themes for the Appearance & Personalization system.
// Each theme provides a set of CSS custom-property overrides applied to the
// document root. Values use oklch to match the design system (src/styles.css).
// Themes are additive: only the listed tokens are overridden, the rest fall
// back to the base values defined in styles.css.

export type ThemeKey =
  | "light"
  | "dark"
  | "gold"
  | "black-gold"
  | "emerald"
  | "midnight";

export type ColorMode = "light" | "dark";
export type Density = "comfortable" | "compact";

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  /** When set, forces the color mode regardless of the user's mode toggle. */
  forceMode?: ColorMode;
  /** Swatches shown in the theme picker (primary, secondary/sidebar, accent). */
  swatches: [string, string, string];
  /** CSS variable overrides. */
  vars: Record<string, string>;
}

export const THEMES: ThemeDefinition[] = [
  {
    key: "light",
    label: "Clair",
    forceMode: "light",
    swatches: ["#caa15a", "#efe9dc", "#3a3a3a"],
    vars: {},
  },
  {
    key: "dark",
    label: "Sombre",
    forceMode: "dark",
    swatches: ["#e8d3a0", "#2a2a33", "#15151c"],
    vars: {},
  },
  {
    key: "gold",
    label: "Or",
    swatches: ["#c89b46", "#f3ecda", "#3b3526"],
    vars: {
      "--primary": "oklch(0.62 0.11 72)",
      "--ring": "oklch(0.62 0.11 72)",
      "--sidebar-primary": "oklch(0.7 0.12 75)",
    },
  },
  {
    key: "black-gold",
    label: "Noir & Or",
    forceMode: "dark",
    swatches: ["#d4af37", "#1a1a1a", "#0a0a0a"],
    vars: {
      "--background": "oklch(0.16 0.005 80)",
      "--foreground": "oklch(0.92 0.02 85)",
      "--card": "oklch(0.2 0.006 80)",
      "--card-foreground": "oklch(0.92 0.02 85)",
      "--popover": "oklch(0.2 0.006 80)",
      "--popover-foreground": "oklch(0.92 0.02 85)",
      "--primary": "oklch(0.78 0.13 85)",
      "--primary-foreground": "oklch(0.16 0.01 80)",
      "--secondary": "oklch(0.26 0.008 80)",
      "--secondary-foreground": "oklch(0.92 0.02 85)",
      "--muted": "oklch(0.26 0.008 80)",
      "--muted-foreground": "oklch(0.72 0.03 82)",
      "--accent": "oklch(0.32 0.04 85)",
      "--accent-foreground": "oklch(0.92 0.03 85)",
      "--border": "oklch(0.3 0.01 80)",
      "--input": "oklch(0.3 0.01 80)",
      "--ring": "oklch(0.78 0.13 85)",
      "--sidebar": "oklch(0.1 0.004 80)",
      "--sidebar-foreground": "oklch(0.9 0.02 85)",
      "--sidebar-primary": "oklch(0.78 0.13 85)",
      "--sidebar-primary-foreground": "oklch(0.12 0.01 80)",
      "--sidebar-accent": "oklch(0.24 0.01 80)",
      "--sidebar-accent-foreground": "oklch(0.92 0.02 85)",
      "--sidebar-border": "oklch(0.28 0.01 80)",
    },
  },
  {
    key: "emerald",
    label: "Émeraude",
    swatches: ["#1f9d70", "#e7f3ec", "#173d30"],
    vars: {
      "--primary": "oklch(0.58 0.12 162)",
      "--primary-foreground": "oklch(0.99 0.01 160)",
      "--accent": "oklch(0.9 0.05 162)",
      "--accent-foreground": "oklch(0.3 0.06 162)",
      "--ring": "oklch(0.58 0.12 162)",
      "--sidebar": "oklch(0.24 0.03 165)",
      "--sidebar-foreground": "oklch(0.93 0.02 162)",
      "--sidebar-primary": "oklch(0.66 0.13 162)",
      "--sidebar-primary-foreground": "oklch(0.18 0.02 165)",
      "--sidebar-accent": "oklch(0.3 0.035 165)",
      "--sidebar-accent-foreground": "oklch(0.95 0.02 162)",
      "--sidebar-border": "oklch(0.32 0.03 165)",
    },
  },
  {
    key: "midnight",
    label: "Minuit",
    forceMode: "dark",
    swatches: ["#7aa2f7", "#1a1b26", "#0e0f17"],
    vars: {
      "--background": "oklch(0.17 0.03 265)",
      "--foreground": "oklch(0.95 0.01 250)",
      "--card": "oklch(0.21 0.035 265)",
      "--card-foreground": "oklch(0.95 0.01 250)",
      "--popover": "oklch(0.21 0.035 265)",
      "--popover-foreground": "oklch(0.95 0.01 250)",
      "--primary": "oklch(0.68 0.13 260)",
      "--primary-foreground": "oklch(0.16 0.03 265)",
      "--secondary": "oklch(0.27 0.04 265)",
      "--secondary-foreground": "oklch(0.95 0.01 250)",
      "--muted": "oklch(0.27 0.04 265)",
      "--muted-foreground": "oklch(0.72 0.03 255)",
      "--accent": "oklch(0.32 0.05 265)",
      "--accent-foreground": "oklch(0.95 0.01 250)",
      "--border": "oklch(0.3 0.03 265)",
      "--input": "oklch(0.3 0.03 265)",
      "--ring": "oklch(0.68 0.13 260)",
      "--sidebar": "oklch(0.13 0.025 265)",
      "--sidebar-foreground": "oklch(0.92 0.01 250)",
      "--sidebar-primary": "oklch(0.68 0.13 260)",
      "--sidebar-primary-foreground": "oklch(0.15 0.03 265)",
      "--sidebar-accent": "oklch(0.25 0.04 265)",
      "--sidebar-accent-foreground": "oklch(0.95 0.01 250)",
      "--sidebar-border": "oklch(0.3 0.03 265)",
    },
  },
];

export function getTheme(key: string | null | undefined): ThemeDefinition {
  return THEMES.find((t) => t.key === key) ?? THEMES[2]; // default: gold
}
