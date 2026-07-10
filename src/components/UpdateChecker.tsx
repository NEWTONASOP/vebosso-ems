// ============================================================================
// VEBOSSO EMS — In-App Update Checker (Required Updates)
// ============================================================================

import { useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, ProgressBar, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import {
  checkAppVersion,
  downloadAndInstallApk,
  hasCachedApk,
  openAppStore,
  openInstallPermissionSettings,
  relaunchCachedApkInstaller,
} from '../lib/versionCheck';

type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'error';

export function UpdateChecker() {
  const [checked, setChecked] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [targetVersion, setTargetVersion] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isOpeningInstaller, setIsOpeningInstaller] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || checked) return;

    setChecked(true);
    checkForRequiredUpdate();
  }, [checked]);

  useEffect(() => {
    if (!modalVisible) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [modalVisible]);

  const checkForRequiredUpdate = async () => {
    try {
      const result = await checkAppVersion();

      if (result.needsUpdate) {
        await startInAppUpdate(result.latestVersion);
      }
    } catch (error) {
      if (__DEV__) console.error('Error checking for updates:', error);
    }
  };

  const resumeFromCachedApk = async (version: string) => {
    setProgress(1);
    setPhase('installing');

    try {
      await relaunchCachedApkInstaller(version);
    } catch (error) {
      if (__DEV__) console.warn('Could not auto-open installer from cache:', error);
    }
  };

  const startInAppUpdate = async (
    version: string,
    options?: { forceRedownload?: boolean }
  ) => {
    setTargetVersion(version);
    setErrorMessage('');
    setModalVisible(true);
    setIsBusy(true);

    try {
      if (!options?.forceRedownload && (await hasCachedApk(version))) {
        await resumeFromCachedApk(version);
        return;
      }

      setProgress(0);
      setPhase('downloading');

      await downloadAndInstallApk(
        (value) => setProgress(value),
        version,
        options
      );
      setPhase('installing');
    } catch (error: any) {
      setPhase('error');
      setErrorMessage(
        error?.message || 'Update failed. Please try again or download from the browser.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetry = () => {
    if (!targetVersion || isBusy) return;
    startInAppUpdate(targetVersion, { forceRedownload: true }).catch((err) => {
      if (__DEV__) console.error('Failed to retry in-app update:', err);
    });
  };

  const handleRedownload = () => {
    if (!targetVersion || isBusy || isOpeningInstaller) return;
    startInAppUpdate(targetVersion, { forceRedownload: true }).catch((err) => {
      if (__DEV__) console.error('Failed to re-download update:', err);
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
      Alert.alert('Download failed', 'Could not open the download page. Please try again.');
    });
  };

  const handleOpenInstaller = async () => {
    if (!targetVersion || isOpeningInstaller || isBusy) return;

    setIsOpeningInstaller(true);
    try {
      await relaunchCachedApkInstaller(targetVersion);
    } catch (error: any) {
      if (error?.message?.includes('not found')) {
        startInAppUpdate(targetVersion, { forceRedownload: true }).catch((err) => {
          if (__DEV__) console.error('Failed to re-download update:', err);
        });
        return;
      }

      setPhase('error');
      setErrorMessage(
        error?.message || 'Could not open the installer. Please try again.'
      );
    } finally {
      setIsOpeningInstaller(false);
    }
  };

  const progressLabel =
    phase === 'installing'
      ? 'Download complete'
      : phase === 'error'
        ? 'Update failed'
        : `Downloading v${targetVersion}...`;

  const actionsDisabled = isBusy || isOpeningInstaller;

  return (
    <Portal>
      <Modal
        visible={modalVisible}
        dismissable={false}
        contentContainerStyle={styles.modal}
      >
        <Text variant="titleLarge" style={styles.title}>
          Update Required
        </Text>

        <Text variant="bodyMedium" style={styles.subtitle}>
          {phase === 'error'
            ? errorMessage
            : phase === 'installing'
              ? 'Tap Install Now to open the system installer. If nothing happens, use Redownload or check install permissions.'
              : `Version ${targetVersion} is required before you can continue.`}
        </Text>

        {phase !== 'error' && (
          <View style={styles.keepOpenNotice}>
            <Text variant="labelMedium" style={styles.keepOpenTitle}>
              Keep this app open
            </Text>
            <Text variant="bodySmall" style={styles.keepOpenText}>
              {phase === 'installing'
                ? 'Do not close or swipe away VEBOSSO EMS until the update is fully installed.'
                : 'Do not close or swipe away the app while the update is downloading.'}
            </Text>
          </View>
        )}

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

        {phase === 'installing' && (
          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleOpenInstaller}
              loading={isOpeningInstaller}
              disabled={actionsDisabled}
              style={styles.button}
              buttonColor={Colors.accent}
            >
              Install Now
            </Button>
            <Button
              mode="outlined"
              onPress={handleRedownload}
              disabled={actionsDisabled}
              style={styles.button}
            >
              Redownload
            </Button>
            <Button
              mode="text"
              onPress={handleOpenSettings}
              disabled={actionsDisabled}
            >
              Open Install Settings
            </Button>
          </View>
        )}

        {phase === 'downloading' && (
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={handleRedownload}
              disabled={actionsDisabled}
              style={styles.button}
            >
              Redownload
            </Button>
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
    marginBottom: 16,
    lineHeight: 22,
  },
  keepOpenNotice: {
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.2)',
  },
  keepOpenTitle: {
    color: Colors.warning,
    fontWeight: '700',
    marginBottom: 4,
  },
  keepOpenText: {
    color: Colors.textSecondary,
    lineHeight: 18,
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
