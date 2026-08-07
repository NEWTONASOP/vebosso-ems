// ============================================================================
// VEBOSSO EMS — Brand Colors (Premium SaaS Aesthetic)
// ============================================================================

import { AppTheme } from './theme';

export const Colors = {
  // Primary palette (Vibrant but professional)
  primary: '#FFFFFF',        // Pure white background for elements
  primaryLight: '#FAFAFA',    // Ultra light gray for sub-elements
  accent: '#000000',          // High contrast black for primary actions (Linear style)
  accentLight: '#333333',     // Dark gray for hover/active
  accentDark: '#000000',      // Solid black for pressed states
  accentSubtle: 'rgba(0, 0, 0, 0.04)', // Subtle tint for backgrounds

  // Status colors (Muted, premium hues)
  success: '#047857',         // Crisp Emerald - approved, done
  successLight: 'rgba(4, 120, 87, 0.1)',
  warning: '#B45309',         // Vibrant Amber - pending, in progress
  warningLight: 'rgba(180, 83, 9, 0.1)',
  error: '#BE123C',           // Rose Red - rejected, error
  errorLight: 'rgba(190, 18, 60, 0.1)',
  info: '#2563EB',            // Bright Blue - info, announcements
  infoLight: 'rgba(37, 99, 235, 0.1)',

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
  textSecondary: '#5E6672',   // Darker gray for secondary (WCAG AA compliant on background)
  textTertiary: '#6B7280',    // Medium gray for muted text (WCAG AA compliant on white)
  textInverse: '#FFFFFF',     // Text on dark backgrounds

  // Background colors
  background: '#F2F2F7',      // Main app background (iOS System Gray 6)
  backgroundOverlay: 'rgba(0, 0, 0, 0.4)', // Dark overlay for modals (Glassmorphism backdrop)

  // Tab bar
  tabBar: 'rgba(255, 255, 255, 0.85)', // Translucent white
  tabBarBorder: '#E5E7EB',    
  tabInactive: '#6B7280',     
  tabActive: '#111827',       

  // Specific UI elements
  skeleton: '#F3F4F6',        
  skeletonHighlight: '#FFFFFF', 
  badge: '#F43F5E',           
  inputBackground: '#FFFFFF', 
  inputBorder: '#E5E7EB',     
  inputFocusBorder: '#111827', 
  placeholder: '#6B7280',     
  systemGray: '#8E8E93',      // Default system gray
  systemGray6: '#F4F4F6',     // Light system gray
  surfacePressed: '#F2F2F7',  // Pressed state for surfaces

  // Gradients (as arrays for LinearGradient) - Softer transitions
  gradientPrimary: ['#FFFFFF', '#F9FAFB'] as const,
  gradientAccent: ['#333333', '#000000'] as const,
  gradientSuccess: ['#34D399', '#047857'] as const,
  gradientCard: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)'] as const, // Glass effect

  // Role-specific accent colors
  ownerAccent: '#7C3AED',     // Violet
  managerAccent: '#2563EB',   // Blue
  memberAccent: '#047857',    // Emerald

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

// React Native Paper custom theme colors — derived from AppTheme
export const PaperThemeColors = {
  primary: AppTheme.charcoal,
  onPrimary: AppTheme.white,
  primaryContainer: AppTheme.soft,
  onPrimaryContainer: AppTheme.charcoal,
  secondary: AppTheme.soft,
  onSecondary: AppTheme.ink,
  secondaryContainer: AppTheme.soft2,
  onSecondaryContainer: AppTheme.ink,
  tertiary: AppTheme.blue,
  onTertiary: AppTheme.white,
  tertiaryContainer: AppTheme.blueSoft,
  onTertiaryContainer: AppTheme.blue,
  error: AppTheme.coral,
  onError: AppTheme.white,
  errorContainer: AppTheme.coralSoft,
  onErrorContainer: AppTheme.coral,
  background: AppTheme.bg,
  onBackground: AppTheme.ink,
  surface: AppTheme.card,
  onSurface: AppTheme.ink,
  surfaceVariant: AppTheme.soft,
  onSurfaceVariant: AppTheme.mute,
  outline: AppTheme.soft2,
  outlineVariant: AppTheme.soft,
  inverseSurface: AppTheme.ink,
  inverseOnSurface: AppTheme.white,
  inversePrimary: AppTheme.inkSoft,
  elevation: {
    level0: 'transparent',
    level1: AppTheme.card,
    level2: AppTheme.soft,
    level3: AppTheme.soft2,
    level4: AppTheme.soft2,
    level5: AppTheme.soft2,
  },
  surfaceDisabled: 'rgba(15, 17, 22, 0.08)',
  onSurfaceDisabled: 'rgba(15, 17, 22, 0.38)',
  backdrop: 'rgba(0, 0, 0, 0.4)',
};

export type ColorKey = keyof typeof Colors;

