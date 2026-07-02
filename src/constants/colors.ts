// ============================================================================
// VEBOSSO EMS — Brand Colors (Premium SaaS Aesthetic)
// ============================================================================

export const Colors = {
  // Primary palette (Vibrant but professional)
  primary: '#FFFFFF',        // Pure white background for elements
  primaryLight: '#FAFAFA',    // Ultra light gray for sub-elements
  accent: '#000000',          // High contrast black for primary actions (Linear style)
  accentLight: '#333333',     // Dark gray for hover/active
  accentDark: '#000000',      // Solid black for pressed states
  accentSubtle: 'rgba(0, 0, 0, 0.04)', // Subtle tint for backgrounds

  // Status colors (Muted, premium hues)
  success: '#17B877',         // Crisp Emerald - approved, done
  successLight: 'rgba(23, 184, 119, 0.1)',
  warning: '#F5A623',         // Vibrant Amber - pending, in progress
  warningLight: 'rgba(245, 166, 35, 0.1)',
  error: '#F43F5E',           // Rose Red - rejected, error
  errorLight: 'rgba(244, 63, 94, 0.1)',
  info: '#3B82F6',            // Bright Blue - info, announcements
  infoLight: 'rgba(59, 130, 246, 0.1)',

  // Surface colors
  surface: '#FFFFFF',         // Card/surface background
  surfaceLight: '#F9FAFB',    // Elevated surface background
  surfaceLighter: '#F3F4F6',  // Higher contrast elevated surfaces
  border: '#E5E7EB',          // Soft light border
  borderLight: '#F3F4F6',     // Very light border
  divider: 'rgba(0, 0, 0, 0.06)', // Subtle divider

  // Text colors
  text: '#111827',            // Deep charcoal for primary text
  textPrimary: '#1C1C1E',     // Premium text primary
  textSecondary: '#6B7280',   // Medium gray for secondary
  textTertiary: '#9CA3AF',    // Light gray for muted text
  textInverse: '#FFFFFF',     // Text on dark backgrounds

  // Background colors
  background: '#F2F2F7',      // Main app background (iOS System Gray 6)
  backgroundOverlay: 'rgba(0, 0, 0, 0.4)', // Dark overlay for modals (Glassmorphism backdrop)

  // Tab bar
  tabBar: 'rgba(255, 255, 255, 0.85)', // Translucent white
  tabBarBorder: '#E5E7EB',    
  tabInactive: '#9CA3AF',     
  tabActive: '#111827',       

  // Specific UI elements
  skeleton: '#F3F4F6',        
  skeletonHighlight: '#FFFFFF', 
  badge: '#F43F5E',           
  inputBackground: '#FFFFFF', 
  inputBorder: '#E5E7EB',     
  inputFocusBorder: '#111827', 
  placeholder: '#9CA3AF',     
  systemGray: '#8E8E93',      // Default system gray
  systemGray6: '#F4F4F6',     // Light system gray
  surfacePressed: '#F2F2F7',  // Pressed state for surfaces

  // Gradients (as arrays for LinearGradient) - Softer transitions
  gradientPrimary: ['#FFFFFF', '#F9FAFB'] as const,
  gradientAccent: ['#333333', '#000000'] as const,
  gradientSuccess: ['#34D399', '#17B877'] as const,
  gradientCard: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)'] as const, // Glass effect

  // Role-specific accent colors
  ownerAccent: '#8B5CF6',     // Violet
  managerAccent: '#3B82F6',   // Blue
  memberAccent: '#17B877',    // Emerald

  // Shadow properties for elevated surfaces (Premium soft shadows)
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  
  shadowHeavy: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },

  // Color utilities
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
  surfaceDisabled: 'rgba(17, 24, 39, 0.08)',
  onSurfaceDisabled: 'rgba(17, 24, 39, 0.38)',
  backdrop: Colors.backgroundOverlay,
};

export type ColorKey = keyof typeof Colors;

