// ============================================================================
// VEBOSSO EMS — Update Required Screen
// ============================================================================

import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { openAppStore } from '../lib/versionCheck';

interface UpdateRequiredProps {
  currentVersion: string;
  minimumVersion: string;
  latestVersion: string;
  message?: string;
  forceUpdate: boolean;
}

export function UpdateRequired({
  currentVersion,
  minimumVersion,
  latestVersion,
  message,
  forceUpdate,
}: UpdateRequiredProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🚀</Text>
        <Text style={styles.title}>
          {forceUpdate ? 'Update Required' : 'Update Available'}
        </Text>
        <Text style={styles.message}>
          {message ||
            (forceUpdate
              ? 'A critical update is required to continue using the app.'
              : 'A new version is available with improvements and bug fixes.')}
        </Text>

        <View style={styles.versionInfo}>
          <VersionRow label="Current Version" value={currentVersion} />
          {forceUpdate && (
            <VersionRow label="Minimum Required" value={minimumVersion} color={Colors.error} />
          )}
          <VersionRow label="Latest Version" value={latestVersion} color={Colors.success} />
        </View>

        <Button
          mode="contained"
          onPress={openAppStore}
          style={styles.updateButton}
          contentStyle={styles.updateButtonContent}
          buttonColor={Colors.accent}
          textColor={Colors.white}
          icon="download"
        >
          Download Update
        </Button>

        {forceUpdate && (
          <Text style={styles.forceText}>
            You must update to continue using the app
          </Text>
        )}

        {!forceUpdate && (
          <Button
            mode="text"
            onPress={() => {
              // Allow user to skip optional updates (for now)
              console.log('User skipped update');
            }}
            style={styles.skipButton}
            textColor={Colors.textSecondary}
          >
            Skip for Now
          </Button>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>VEBOSSO EMS</Text>
        <Text style={styles.footerSubtext}>Employee Management System</Text>
      </View>
    </View>
  );
}

function VersionRow({
  label,
  value,
  color = Colors.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={versionRowStyles.row}>
      <Text style={versionRowStyles.label}>{label}</Text>
      <Text style={[versionRowStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const versionRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  versionInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    ...Colors.shadow,
  },
  updateButton: {
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  updateButtonContent: {
    height: 56,
  },
  forceText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  skipButton: {
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
