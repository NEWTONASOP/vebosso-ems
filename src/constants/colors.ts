// ============================================================================
// VEBOSSO EMS — Brand Colors
// ============================================================================

export const Colors = {
  // Primary palette
  primary: '#0A0F1E',        // Dark navy - main background
  primaryLight: '#111827',    // Slightly lighter navy
  accent: '#2563EB',          // Electric blue - primary action color
  accentLight: '#3B82F6',     // Lighter blue for hover/active
  accentDark: '#1D4ED8',      // Darker blue for pressed states
  accentSubtle: 'rgba(37, 99, 235, 0.12)', // Subtle blue tint for backgrounds

  // Status colors
  success: '#10B981',         // Green - approved, done, active
  successLight: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',         // Amber - pending, in progress
  warningLight: 'rgba(245, 158, 11, 0.12)',
  error: '#EF4444',           // Red - rejected, error
  errorLight: 'rgba(239, 68, 68, 0.12)',
  info: '#6366F1',            // Indigo - info, announcements
  infoLight: 'rgba(99, 102, 241, 0.12)',

  // Surface colors
  surface: '#111827',         // Card/surface background
  surfaceLight: '#1F2937',    // Elevated surface
  surfaceLighter: '#374151',  // Higher elevation surface
  border: '#1F2937',          // Default border
  borderLight: '#374151',     // Lighter border
  divider: 'rgba(255, 255, 255, 0.06)',

  // Text colors
  text: '#F9FAFB',            // Primary text (white-ish)
  textSecondary: '#9CA3AF',   // Secondary text
  textTertiary: '#6B7280',    // Muted text
  textInverse: '#0A0F1E',     // Text on light backgrounds

  // Background colors
  background: '#0A0F1E',      // Main app background
  backgroundOverlay: 'rgba(0, 0, 0, 0.6)', // Modal overlay

  // Tab bar
  tabBar: '#0D1321',          // Tab bar background
  tabBarBorder: '#1F2937',    // Tab bar top border
  tabInactive: '#6B7280',     // Inactive tab icon/label
  tabActive: '#2563EB',       // Active tab icon/label

  // Specific UI elements
  skeleton: '#1F2937',        // Skeleton loading base
  skeletonHighlight: '#374151', // Skeleton shimmer highlight
  badge: '#EF4444',           // Notification badge
  inputBackground: '#1F2937', // Text input background
  inputBorder: '#374151',     // Text input border
  inputFocusBorder: '#2563EB', // Text input focus border
  placeholder: '#6B7280',     // Input placeholder text

  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#0A0F1E', '#111827'] as const,
  gradientAccent: ['#2563EB', '#1D4ED8'] as const,
  gradientSuccess: ['#10B981', '#059669'] as const,
  gradientCard: ['#1F2937', '#111827'] as const,

  // Role-specific accent colors
  ownerAccent: '#8B5CF6',     // Purple for owner elements
  managerAccent: '#2563EB',   // Blue for manager elements
  memberAccent: '#10B981',    // Green for member elements

  // Shadows (for Paper theme)
  shadow: 'rgba(0, 0, 0, 0.3)',

  // White with opacity
  white: '#FFFFFF',
  white10: 'rgba(255, 255, 255, 0.1)',
  white20: 'rgba(255, 255, 255, 0.2)',
  white60: 'rgba(255, 255, 255, 0.6)',
  black: '#000000',
  transparent: 'transparent',
} as const;

// React Native Paper custom theme colors
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
  inverseSurface: Colors.white,
  inverseOnSurface: Colors.primary,
  inversePrimary: Colors.accentDark,
  elevation: {
    level0: Colors.transparent,
    level1: Colors.surface,
    level2: Colors.surfaceLight,
    level3: Colors.surfaceLighter,
    level4: Colors.surfaceLighter,
    level5: Colors.surfaceLighter,
  },
  surfaceDisabled: 'rgba(255, 255, 255, 0.12)',
  onSurfaceDisabled: 'rgba(255, 255, 255, 0.38)',
  backdrop: Colors.backgroundOverlay,
};

export type ColorKey = keyof typeof Colors;
