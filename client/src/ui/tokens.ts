// The UI kit's design tokens: the one place colours, fonts, spacing, glows and borders are
// defined. They become CSS variables (`--pp-color-ink`, `--pp-space-3`, …) that the kit's
// stylesheets read; nothing in the kit writes a raw colour.
//
// The look is the Backlog Basement's: warm cream ink on dark plum panels, coin gold for what
// matters. Neon pink and cyan are rare accents (the logo, the title screen), never the base.

export const tokens = {
  color: {
    // the room and its panels
    backdrop: "#07050a",
    panel: "rgba(18, 11, 16, 0.86)",
    panelSolid: "#170e13",
    panelRaised: "#2a1c21",
    well: "#120b0f",
    edge: "rgba(230, 190, 90, 0.28)",
    edgeSoft: "rgba(255, 255, 255, 0.1)",
    shade: "rgba(0, 0, 0, 0.5)",
    // text
    ink: "#f3e7cf",
    dim: "#b9a98f",
    faint: "#7d6f5f",
    // the default button: dark felt-backed wood
    button: "#3d2b31",
    buttonLow: "#2a1c21",
    buttonHover: "#4a353c",
    buttonHoverLow: "#33232a",
    // coin gold: primary actions, focus, the coin counter
    gold: "#e6be5a",
    goldHi: "#ffe08a",
    goldMid: "#e6b03c",
    goldLow: "#c98d1c",
    goldShadow: "#7a4d0c",
    goldInk: "#3a2208",
    // states
    danger: "#d24b3a",
    dangerLow: "#9e2a1f",
    error: "#ff6b4a",
    success: "#3bce6c",
    successLow: "#163a22",
    // accents, used sparingly
    neonPink: "#ff3fa4",
    neonCyan: "#3ff0ff",
    // playing-card paper
    paper: "#f6f1e6",
    paperLow: "#ddd2bb",
    paperInk: "#1d1a1a",
  },
  font: {
    display: `"Fredoka", "Trebuchet MS", system-ui, sans-serif`,
    body: `"Fredoka", "Trebuchet MS", system-ui, sans-serif`,
    card: `Georgia, "Times New Roman", serif`,
    mono: `ui-monospace, "SF Mono", monospace`,
  },
  weight: { body: "400", strong: "600", display: "700" },
  size: { xs: "12px", sm: "13px", md: "15px", lg: "18px", xl: "22px", xxl: "32px", title: "54px" },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "22px", 6: "28px", 7: "40px" },
  radius: { sm: "6px", md: "10px", lg: "14px", pill: "999px" },
  border: {
    panel: "1px solid rgba(230, 190, 90, 0.28)",
    soft: "1px solid rgba(255, 255, 255, 0.1)",
    focus: "2px solid #e6be5a",
  },
  glow: {
    focus: "0 0 0 2px #e6be5a, 0 0 18px rgba(230, 190, 90, 0.45)",
    gold: "0 0 24px rgba(230, 176, 60, 0.45)",
    pink: "0 0 18px #ff3fa4, 0 0 40px rgba(255, 63, 164, 0.53)",
    cyan: "0 0 14px rgba(63, 240, 255, 0.7)",
    error: "0 0 14px rgba(255, 107, 74, 0.55)",
  },
  shadow: {
    panel: "0 10px 40px rgba(0, 0, 0, 0.5)",
    button: "0 2px 0 rgba(0, 0, 0, 0.53), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    buttonGold: "0 3px 0 #7a4d0c, 0 8px 22px rgba(230, 176, 60, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
    card: "0 6px 14px rgba(0, 0, 0, 0.7)",
  },
  motion: { fast: "80ms", base: "160ms", slow: "320ms", spring: "cubic-bezier(.2, 1.4, .4, 1)" },
  layer: { tooltip: "60", toast: "50", dialog: "40" },
} as const;

export type Tokens = typeof tokens;

/** `color.neonPink` → `--pp-color-neon-pink`. */
export function varName(group: string, key: string | number): string {
  const kebab = String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `--pp-${group}-${kebab}`;
}

/** Every token as a CSS variable. */
export function cssVars(t: Tokens = tokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [group, values] of Object.entries(t)) {
    for (const [key, value] of Object.entries(values)) vars[varName(group, key)] = value;
  }
  return vars;
}

/** A `:root { … }` block declaring every token. */
export function tokensCss(t: Tokens = tokens): string {
  const lines = Object.entries(cssVars(t)).map(([k, v]) => `  ${k}: ${v};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}
