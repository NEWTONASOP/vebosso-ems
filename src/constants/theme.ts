// ============================================================================
// VEBOSSO EMS — App design tokens
// Airy light canvas, crisp near-black accents, restrained colour.
// Shared by owner, manager and member surfaces.
// ============================================================================

import { Platform, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export const AppTheme = {
  // Canvas & surfaces.
  // The canvas is deliberately a few shades below white so that white cards
  // read as raised objects. Airiness comes from whitespace and radius, not
  // from a near-white canvas.
  bg: '#EDF0F5',
  bgWarm: '#FFFFFF',
  card: '#FFFFFF',
  soft: '#EAEDF3',
  soft2: '#DCE1EA',
  hairline: 'rgba(18, 20, 25, 0.08)',

  // Text
  ink: '#0F1116',
  inkSoft: '#3A4049',
  mute: '#6B7280',

  // Dark surface — soft black, crisp against the light canvas
  charcoal: '#20242B',
  charcoalDeep: '#14171C',
  /** Attention accent for use ON charcoal, where `coral` is too dark to read */
  onDarkAccent: '#FF9478',

  // Accents. Tints sit around 16% so an icon on a chip still reads as coloured.
  green: '#08875D',
  greenSoft: 'rgba(8, 135, 93, 0.16)',
  blue: '#2563EB',
  blueSoft: 'rgba(37, 99, 235, 0.16)',
  amber: '#B45309',
  amberSoft: 'rgba(180, 83, 9, 0.16)',
  coral: '#D0304C',
  coralSoft: 'rgba(208, 48, 76, 0.15)',
  violet: '#6034DB',
  violetSoft: 'rgba(96, 52, 219, 0.15)',

  white: '#FFFFFF',
} as const;

/**
 * Per-role identity accent. Primary actions stay charcoal everywhere so the
 * three roles feel like one app; the accent is for role-identifying moments
 * only — active tab, avatars, hero highlights.
 */
export const RoleAccent = {
  owner: { color: AppTheme.violet, soft: AppTheme.violetSoft },
  manager: { color: AppTheme.blue, soft: AppTheme.blueSoft },
  member: { color: AppTheme.green, soft: AppTheme.greenSoft },
} as const;

export type Role = keyof typeof RoleAccent;

/** 4pt spacing scale */
export const AppSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  screen: 20,
} as const;

export const AppRadius = {
  chip: 12,
  card: 20,
  sheet: 26,
  hero: 28,
  pill: 999,
} as const;

/**
 * React Native Web treats the `shadow*` props as deprecated and drops them, so
 * cards there render flat unless a real `boxShadow` is supplied. Native keeps
 * the original props. CSS blur is roughly twice the native shadow radius.
 */
// Deliberately narrow: these tokens are spread into image and text styles too,
// where the full ViewStyle union would clash.
type Elevation = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function elevate({
  y,
  radius,
  opacity,
  elevation,
}: {
  y: number;
  radius: number;
  opacity: number;
  elevation: number;
}): Elevation {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${y}px ${radius * 2}px rgba(10, 12, 17, ${opacity})`,
    } as unknown as Elevation;
  }
  return {
    shadowColor: '#0A0C11',
    shadowOffset: { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

export const appShadow = elevate({ y: 8, radius: 20, opacity: 0.1, elevation: 4 });

export const appSoftShadow = elevate({ y: 3, radius: 10, opacity: 0.07, elevation: 2 });

/** Shared chrome for owner tab / stack screens */
export const screenChrome = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppTheme.bg,
  },
  header: {
    paddingHorizontal: AppSpace.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpace.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 12,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    color: AppTheme.ink,
    letterSpacing: -0.9,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
    marginTop: 3,
  } as TextStyle,
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.card,
    ...appSoftShadow,
  } as ViewStyle,

  // Primary action
  primaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.charcoal,
    borderRadius: AppRadius.pill,
    paddingHorizontal: 16,
    height: 44,
    gap: 6,
    ...appSoftShadow,
  } as ViewStyle,
  primaryPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.white,
    letterSpacing: -0.1,
  } as TextStyle,

  // Icon-only round button
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: AppTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...appSoftShadow,
  } as ViewStyle,

  // Segmented control
  // The trough reads as recessed, so it must be darker than the canvas
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: AppTheme.soft2,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  } as ViewStyle,
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  segmentBtnActive: {
    backgroundColor: AppTheme.card,
    ...appSoftShadow,
  } as ViewStyle,
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: AppTheme.inkSoft,
  } as TextStyle,
  segmentTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
  } as TextStyle,

  // Filter chips sit directly on the canvas, so inactive chips are white cards
  // rather than a grey tint that would disappear against the background.
  filterChip: {
    paddingHorizontal: 15,
    height: 36,
    borderRadius: AppRadius.pill,
    backgroundColor: AppTheme.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...appSoftShadow,
  } as ViewStyle,
  filterChipActive: {
    backgroundColor: AppTheme.charcoal,
  } as ViewStyle,
  filterChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: AppTheme.inkSoft,
  } as TextStyle,
  filterChipTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.white,
  } as TextStyle,
  /** Inline count trailing a filter chip label — muted, never parenthesised */
  filterChipCount: {
    fontFamily: 'Inter_500Medium',
    color: AppTheme.mute,
  } as TextStyle,
  filterChipCountActive: {
    color: 'rgba(255,255,255,0.55)',
  } as TextStyle,

  searchbar: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    borderWidth: 0,
    ...appSoftShadow,
  } as ViewStyle,

  listPad: {
    paddingHorizontal: AppSpace.screen,
    paddingBottom: 120,
  } as ViewStyle,

  // Section headings
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: AppTheme.ink,
    letterSpacing: -0.35,
    paddingHorizontal: AppSpace.screen,
    marginTop: 24,
    marginBottom: 10,
  } as TextStyle,
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginTop: 2,
  } as TextStyle,
});
