// ============================================================================
// VEBOSSO EMS — Report a bug, from the home screen header
// A round button next to the notification bell that opens the bug report form,
// so people don't have to dig through Profile / Settings to find it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { Alert } from '../lib/alert';
import { AnimatedPressable } from './AnimatedPressable';
import { BugReportSheet } from './BugReportSheet';

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AnimatedPressable
        style={styles.container}
        onPress={() => setOpen(true)}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel="Report a bug"
      >
        <Feather name="alert-octagon" size={18} color={AppTheme.inkSoft} />
      </AnimatedPressable>
      {open ? <BugReportSheet onDismiss={() => setOpen(false)} onSent={(m) => Alert.alert(m)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppTheme.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...appSoftShadow,
  },
});
