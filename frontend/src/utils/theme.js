/**
 * Bookie-scoped UI theme for user app.
 * Only users with referredBy (bookie's users) get their bookie's theme; others use default.
 */

const THEME_PRESETS = {
  default: { primary: '#f3b61b', accent: '#e5a914' },
  gold: { primary: '#d4af37', accent: '#b8960c' },
  blue: { primary: '#3b82f6', accent: '#2563eb' },
  green: { primary: '#22c55e', accent: '#16a34a' },
  red: { primary: '#ef4444', accent: '#dc2626' },
  purple: { primary: '#a855f7', accent: '#9333ea' },
};

const DEFAULT_THEME = THEME_PRESETS.default;

export function getThemeColors(bookieTheme) {
  if (!bookieTheme || !bookieTheme.themeId) return DEFAULT_THEME;
  const preset = THEME_PRESETS[bookieTheme.themeId] || DEFAULT_THEME;
  return {
    primary: bookieTheme.primaryColor || preset.primary,
    accent: bookieTheme.accentColor || preset.accent,
  };
}

/**
 * Apply bookie theme to document (CSS variables). Call on app load and after login.
 * Only applies when user has referredBy and bookieTheme (bookie's user).
 */
export function applyBookieTheme() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (!raw) {
      setThemeVars(DEFAULT_THEME.primary, DEFAULT_THEME.accent);
      return;
    }
    const user = JSON.parse(raw);
    if (!user.referredBy || !user.bookieTheme) {
      setThemeVars(DEFAULT_THEME.primary, DEFAULT_THEME.accent);
      return;
    }
    const { primary, accent } = getThemeColors(user.bookieTheme);
    setThemeVars(primary, accent);
  } catch (e) {
    setThemeVars(DEFAULT_THEME.primary, DEFAULT_THEME.accent);
  }
}

function setThemeVars(primary, accent) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', primary);
  root.style.setProperty('--theme-accent', accent);
}
