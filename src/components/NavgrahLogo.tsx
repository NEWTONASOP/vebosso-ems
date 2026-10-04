// ============================================================================
// VEBOSSO EMS — Navgrah Leads logo: a bold "N"
// Used for the Leads tab, the home shortcut and the access switch, so the
// feature reads the same everywhere.
// ============================================================================

import { StyleSheet, Text, View } from 'react-native';

export function NavgrahLogo({
  size = 18,
  color,
  bg,
}: {
  size?: number;
  /** Letter colour. */
  color: string;
  /** A tile behind the letter; none = just the letter (e.g. in the tab bar). */
  bg?: string;
}) {
  const letter = (
    <Text
      style={[styles.letter, { color, fontSize: Math.round(size * (bg ? 0.62 : 0.95)), lineHeight: Math.round(size * (bg ? 0.8 : 1.15)) }]}
      allowFontScaling={false}
    >
      N
    </Text>
  );
  if (!bg) return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{letter}</View>;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.33), backgroundColor: bg }]}>
      {letter}
    </View>
  );
}

const styles = StyleSheet.create({
  letter: { fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.5, includeFontPadding: false, textAlign: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
