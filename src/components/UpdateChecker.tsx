// ============================================================================
// VEBOSSO EMS — In-App Update Checker (Optional Updates)
// ============================================================================

import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, ProgressBar, Text } from 'react-native-paper';
import {
  checkAppVersion,
  downloadAndInstallApk,
  openAppStore,
  openInstallPermissionSettings,
} from '../lib/versionCheck';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';

type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'error';

export function UpdateChecker() {
  const [checked, setChecked] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [targetVersion, setTargetVersion] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (Platform.OS !== 'android' || checked || !isAuthenticated) return;

    setChecked(true);
    checkForOptionalUpdate();
  }, [isAuthenticated, checked]);

  const checkForOptionalUpdate = async () => {
    try {
      const result = await checkAppVersion();

      if (result.needsUpdate) {
        showUpdateAlert(result.latestVersion);
      }
    } catch (error) {
      if (__DEV__) console.error('Error checking for updates:', error);
    }
  };

  const showUpdateAlert = (version: string) => {
    Alert.alert(
      'Update Available',
      `Version ${version} is now available. Download and install it directly in the app to get the latest features and fixes.`,
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'Download & Install',
          onPress: () => {
            startInAppUpdate(version).catch((err) => {
              if (__DEV__) console.error('Failed to start in-app update:', err);
            });
          },
        },
      ]
    );
  };

  const startInAppUpdate = async (version: string) => {
    setTargetVersion(version);
    setProgress(0);
    setErrorMessage('');
    setPhase('downloading');
    setModalVisible(true);

    try {
      await downloadAndInstallApk((value) => setProgress(value), version);
      setPhase('installing');
    } catch (error: any) {
      setPhase('error');
      setErrorMessage(
        error?.message || 'Update failed. Please try again or download from the browser.'
      );
    }
  };

  const handleRetry = () => {
    if (!targetVersion) return;
    startInAppUpdate(targetVersion).catch((err) => {
      if (__DEV__) console.error('Failed to retry in-app update:', err);
    });
  };

  const handleOpenSettings = () => {
    openInstallPermissionSettings().catch((err) => {
      if (__DEV__) console.error('Failed to open install settings:', err);
      Alert.alert(
        'Settings',
        'Open Settings → Apps → VEBOSSO EMS → Install unknown apps → Allow.'
      );
    });
  };

  const handleBrowserFallback = () => {
    openAppStore().catch((err) => {
      if (__DEV__) console.error('Failed to open browser download:', err);
      Alert.alert('Download failed', 'Could not open the download page. Please try again later.');
    });
  };

  const handleDismiss = () => {
    setModalVisible(false);
    setPhase('idle');
    setProgress(0);
    setErrorMessage('');
  };

  const progressLabel =
    phase === 'installing'
      ? 'Opening installer...'
      : phase === 'error'
        ? 'Update failed'
        : `Downloading v${targetVersion}...`;

  return (
    <Portal>
      <Modal
        visible={modalVisible}
        onDismiss={phase === 'downloading' ? undefined : handleDismiss}
        dismissable={phase !== 'downloading'}
        contentContainerStyle={styles.modal}
      >
        <Text variant="titleLarge" style={styles.title}>
          {phase === 'error' ? 'Update Failed' : 'Updating App'}
        </Text>

        <Text variant="bodyMedium" style={styles.subtitle}>
          {phase === 'error'
            ? errorMessage
            : phase === 'installing'
              ? 'Follow the system prompt to finish installing the update.'
              : `Downloading version ${targetVersion}. Keep the app open until the download completes.`}
        </Text>

        {phase !== 'error' && (
          <View style={styles.progressSection}>
            <Text variant="labelMedium" style={styles.progressLabel}>
              {progressLabel}
            </Text>
            <ProgressBar
              progress={phase === 'installing' ? 1 : progress}
              color={Colors.info}
              style={styles.progressBar}
            />
            <Text variant="labelSmall" style={styles.progressPercent}>
              {Math.round((phase === 'installing' ? 1 : progress) * 100)}%
            </Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.actions}>
            <Button mode="contained" onPress={handleRetry} style={styles.button}>
              Try Again
            </Button>
            <Button mode="outlined" onPress={handleOpenSettings} style={styles.button}>
              Open Install Settings
            </Button>
            <Button mode="text" onPress={handleBrowserFallback}>
              Download in Browser
            </Button>
            <Button mode="text" onPress={handleDismiss}>
              Later
            </Button>
          </View>
        )}

        {phase === 'installing' && (
          <View style={styles.actions}>
            <Button mode="contained" onPress={handleDismiss}>
              Done
            </Button>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: Colors.surface,
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    color: Colors.text,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  progressSection: {
    gap: 8,
  },
  progressLabel: {
    color: Colors.textSecondary,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  progressPercent: {
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  actions: {
    marginTop: 20,
    gap: 8,
  },
  button: {
    borderRadius: 10,
  },
});
