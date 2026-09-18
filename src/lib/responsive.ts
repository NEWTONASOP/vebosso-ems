// ============================================================================
// VEBOSSO EMS — Responsive breakpoint hook
// ============================================================================
// Thin wrapper around useWindowDimensions() that gives components a clean
// boolean API instead of raw pixel comparisons scattered everywhere.
// Breakpoints mirror the theme constants so they stay in sync.
// ============================================================================

import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS } from '../constants/theme';

export interface ResponsiveInfo {
  /** < 768px — phone portrait */
  isMobile: boolean;
  /** 768–1023px — tablet or phone landscape */
  isTablet: boolean;
  /** ≥ 1024px — laptop / desktop browser */
  isDesktop: boolean;
  width: number;
  height: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  return {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    width,
    height,
  };
}
