// ============================================================================
// VEBOSSO EMS — Sheet Frame
// The bottom sheet shell (title, scrolling body, Close) shared by the
// documents, salary, tasks and message sheets.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, appSoftShadow } from '../constants/theme';

interface SheetFrameProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  iconBg?: string;
  children: ReactNode;
  /** Pinned under the scrolling body — e.g. a message box. */
  footer?: ReactNode;
}

export function SheetFrame({
  visible,
  onDismiss,
  title,
  subtitle,
  icon,
  iconColor = AppTheme.charcoal,
  iconBg = AppTheme.soft,
  children,
  footer,
}: SheetFrameProps) {
  if (!visible) return null;

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            {icon ? (
              <View style={[styles.icon, { backgroundColor: iconBg }]}>
                <Feather name={icon} size={17} color={iconColor} />
              </View>
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={AppTheme.inkSoft} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

/** A tappable settings-style row, used to open these sheets. */
export function SheetLinkRow({
  label,
  hint,
  icon,
  iconColor,
  iconBg,
  onPress,
  badge,
}: {
  label: string;
  hint?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  badge?: string | null;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.linkIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.linkText}>
        <Text style={styles.linkLabel}>{label}</Text>
        {hint ? <Text style={styles.linkHint} numberOfLines={1}>{hint}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={16} color={AppTheme.mute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    marginHorizontal: 0,
    marginBottom: 0,
    marginTop: 'auto',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    maxHeight: '90%',
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: AppTheme.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginTop: 1,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.hairline,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: 52,
    borderRadius: 16,
  },
  linkRowPressed: {
    backgroundColor: AppTheme.soft,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    flex: 1,
    minWidth: 0,
  },
  linkLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
  },
  linkHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 1,
  },
  badge: {
    backgroundColor: AppTheme.coral,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: AppTheme.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
});
