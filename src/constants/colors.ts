// ============================================================================
// VEBOSSO EMS — Brand Colors (Tamagui-Inspired Light Mode)
// ============================================================================

export const Colors = {
  // Primary palette
  primary: '#FFFFFF',        // Pure white background for elements
  primaryLight: '#F8FAFC',    // Light slate gray for sub-elements
  accent: '#4F46E5',          // Indigo - primary action color
  accentLight: '#6366F1',     // Lighter indigo for hover/active
  accentDark: '#3730A3',      // Darker indigo for pressed states
  accentSubtle: 'rgba(79, 70, 229, 0.08)', // Subtle indigo tint for backgrounds

  // Status colors
  success: '#10B981',         // Green - approved, done, active
  successLight: 'rgba(16, 185, 129, 0.08)',
  warning: '#F59E0B',         // Amber - pending, in progress
  warningLight: 'rgba(245, 158, 11, 0.08)',
  error: '#EF4444',           // Red - rejected, error
  errorLight: 'rgba(239, 68, 68, 0.08)',
  info: '#0EA5E9',            // Sky Blue - info, announcements
  infoLight: 'rgba(14, 165, 233, 0.08)',

  // Surface colors
  surface: '#FFFFFF',         // Card/surface background (pure white)
  surfaceLight: '#F8FAFC',    // Elevated surface background
  surfaceLighter: '#F1F5F9',  // Higher contrast elevated surfaces
  border: '#E2E8F0',          // Default thin light border (slate-200)
  borderLight: '#F1F5F9',     // Very light border (slate-100)
  divider: 'rgba(15, 23, 42, 0.06)', // Slate-900 divider at low opacity

  // Text colors
  text: '#0F172A',            // Primary text (slate-900)
  textSecondary: '#475569',   // Secondary text (slate-600)
  textTertiary: '#94A3B8',    // Muted text (slate-400)
  textInverse: '#FFFFFF',     // Text on dark backgrounds (e.g. colored buttons)

  // Background colors
  background: '#F8FAFC',      // Main app background (slate-50 style cool white)
  backgroundOverlay: 'rgba(15, 23, 42, 0.3)', // Soft dark overlay for modals

  // Tab bar
  tabBar: '#FFFFFF',          // Clean white tab bar
  tabBarBorder: '#E2E8F0',    // Slate border top
  tabInactive: '#94A3B8',     // Muted tabs
  tabActive: '#4F46E5',       // Highlighted tab

  // Specific UI elements
  skeleton: '#E2E8F0',        // Light grey skeleton base
  skeletonHighlight: '#F1F5F9', // Shimmer highlight
  badge: '#EF4444',           // Notification badge
  inputBackground: '#FFFFFF', // Clean white input fields
  inputBorder: '#E2E8F0',     // Light input borders
  inputFocusBorder: '#4F46E5', // Focused input border
  placeholder: '#94A3B8',     // Placeholder slate

  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#FFFFFF', '#F8FAFC'] as const,
  gradientAccent: ['#6366F1', '#4F46E5'] as const,
  gradientSuccess: ['#34D399', '#10B981'] as const,
  gradientCard: ['#FFFFFF', '#F8FAFC'] as const,

  // Role-specific accent colors
  ownerAccent: '#7C3AED',     // Deep Violet for owner elements
  managerAccent: '#2563EB',   // Cobalt Blue for manager elements
  memberAccent: '#10B981',    // Emerald Green for member elements

  // Shadow properties for elevated surfaces
  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // Color utilities
  white: '#FFFFFF',
  white10: 'rgba(255, 255, 255, 0.1)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white60: 'rgba(255, 255, 255, 0.6)',
  black: '#000000',
  transparent: 'transparent',
} as const;

// React Native Paper custom theme colors (Optimized for MD3LightTheme)
export const PaperThemeColors = {
  primary: Colors.accent,
  onPrimary: Colors.white,
  primaryContainer: Colors.accentSubtle,
  onPrimaryContainer: Colors.accent,
  secondary: Colors.surfaceLight,
  onSecondary: Colors.text,
  secondaryContainer: Colors.surfaceLighter,
  onSecondaryContainer: Colors.text,
  tertiary: Colors.info,
  onTertiary: Colors.white,
  tertiaryContainer: Colors.infoLight,
  onTertiaryContainer: Colors.info,
  error: Colors.error,
  onError: Colors.white,
  errorContainer: Colors.errorLight,
  onErrorContainer: Colors.error,
  background: Colors.background,
  onBackground: Colors.text,
  surface: Colors.surface,
  onSurface: Colors.text,
  surfaceVariant: Colors.surfaceLight,
  onSurfaceVariant: Colors.textSecondary,
  outline: Colors.border,
  outlineVariant: Colors.borderLight,
  inverseSurface: Colors.text,
  inverseOnSurface: Colors.white,
  inversePrimary: Colors.accentLight,
  elevation: {
    level0: Colors.transparent,
    level1: Colors.surface,
    level2: Colors.surfaceLight,
    level3: Colors.surfaceLighter,
    level4: Colors.surfaceLighter,
    level5: Colors.surfaceLighter,
  },
  surfaceDisabled: 'rgba(15, 23, 42, 0.08)',
  onSurfaceDisabled: 'rgba(15, 23, 42, 0.38)',
  backdrop: Colors.backgroundOverlay,
};

export type ColorKey = keyof typeof Colors;
