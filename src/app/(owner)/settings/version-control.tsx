// ============================================================================
// VEBOSSO EMS — Version Control Management (Owner Only)
// ============================================================================

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, IconButton, Text, TextInput } from 'react-native-paper';
import { Colors } from '../../../constants/colors';
import { compareVersions, getCurrentVersion } from '../../../lib/versionCheck';
import { useWorkStore } from '../../../store/workStore';

export default function VersionControlScreen() {
  const router = useRouter();
  const { settings, updateSetting, fetchSettings } = useWorkStore();
  
  const [minimumVersion, setMinimumVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [apkDownloadUrl, setApkDownloadUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const currentVersion = getCurrentVersion();

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setMinimumVersion(settings['minimum_app_version'] || '1.0.0');
    setLatestVersion(settings['latest_app_version'] || '1.0.0');
    setUpdateMessage(
      settings['update_message'] || 
      'A new version is available. Please update to continue using the app.'
    );
    setApkDownloadUrl(
      settings['apk_download_url'] || 
      'https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/app.apk'
    );
  }, [settings]);

  const handleSave = async () => {
    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(minimumVersion)) {
      Alert.alert('Invalid Version', 'Minimum version must be in format: 1.0.0');
      return;
    }
    if (!versionRegex.test(latestVersion)) {
      Alert.alert('Invalid Version', 'Latest version must be in format: 1.0.0');
      return;
    }

    // Warn if minimum > latest
    if (compareVersions(minimumVersion, latestVersion) > 0) {
      Alert.alert(
        'Version Warning',
        'Minimum version is higher than latest version. This may cause issues.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: () => saveVersions() },
        ]
      );
      return;
    }

    saveVersions();
  };

  const saveVersions = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        updateSetting('minimum_app_version', minimumVersion),
        updateSetting('latest_app_version', latestVersion),
        updateSetting('update_message', updateMessage),
        updateSetting('apk_download_url', apkDownloadUrl),
      ]);
      
      Alert.alert(
        'Saved Successfully',
        'Version settings have been updated. Users below the minimum version will be forced to update.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save version settings');
      console.error('Save version settings error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all version settings to their default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setMinimumVersion(currentVersion);
            setLatestVersion(currentVersion);
            setUpdateMessage('A new version is available. Please update to continue using the app.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.headerRow}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={Colors.text}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Version Control</Text>
        <IconButton
          icon="refresh"
          size={24}
          iconColor={Colors.text}
          onPress={handleResetToDefaults}
          style={styles.backButton}
        />
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoEmoji}>ℹ️</Text>
        <Text style={styles.infoTitle}>How Version Control Works</Text>
        <Text style={styles.infoText}>
          • <Text style={styles.bold}>Minimum Version:</Text> Users below this version will be forced to update{'\n'}
          • <Text style={styles.bold}>Latest Version:</Text> Indicates the newest available version{'\n'}
          • <Text style={styles.bold}>Current APK Version:</Text> The version in your app.json file
        </Text>
      </View>

      {/* Current Version Display */}
      <View style={styles.currentVersionCard}>
        <Text style={styles.label}>Current APK Version</Text>
        <Text style={styles.currentVersionText}>{currentVersion}</Text>
        <Text style={styles.hint}>
          This is the version set in app.json. Update this before building new APK.
        </Text>
      </View>

      {/* Version Settings Form */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Version Requirements</Text>

        <Text style={styles.inputLabel}>Minimum Required Version</Text>
        <TextInput
          mode="outlined"
          value={minimumVersion}
          onChangeText={setMinimumVersion}
          placeholder="1.0.0"
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.accent}
          textColor={Colors.text}
          theme={{
            colors: {
              onSurfaceVariant: Colors.textTertiary,
              surface: Colors.inputBackground,
            },
          }}
        />
        <Text style={styles.helperText}>
          Users with versions below this will be forced to update
        </Text>

        <Text style={styles.inputLabel}>Latest Available Version</Text>
        <TextInput
          mode="outlined"
          value={latestVersion}
          onChangeText={setLatestVersion}
          placeholder="1.0.0"
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.accent}
          textColor={Colors.text}
          theme={{
            colors: {
              onSurfaceVariant: Colors.textTertiary,
              surface: Colors.inputBackground,
            },
          }}
        />
        <Text style={styles.helperText}>
          The current version available on Play Store/App Store
        </Text>

        <Divider style={styles.divider} />

        <Text style={styles.inputLabel}>APK Download URL</Text>
        <TextInput
          mode="outlined"
          value={apkDownloadUrl}
          onChangeText={setApkDownloadUrl}
          placeholder="https://github.com/user/repo/releases/latest/download/app.apk"
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.accent}
          textColor={Colors.text}
          autoCapitalize="none"
          theme={{
            colors: {
              onSurfaceVariant: Colors.textTertiary,
              surface: Colors.inputBackground,
            },
          }}
        />
        <Text style={styles.helperText}>
          Direct link to APK file (users will download this when updating)
        </Text>

        <Divider style={styles.divider} />

        <Text style={styles.inputLabel}>Update Message</Text>
        <TextInput
          mode="outlined"
          value={updateMessage}
          onChangeText={setUpdateMessage}
          placeholder="A new version is available..."
          multiline
          numberOfLines={3}
          style={styles.textArea}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.accent}
          textColor={Colors.text}
          theme={{
            colors: {
              onSurfaceVariant: Colors.textTertiary,
              surface: Colors.inputBackground,
            },
          }}
        />
        <Text style={styles.helperText}>
          This message will be shown to users when update is required
        </Text>
      </View>

      {/* Warning Box */}
      <View style={styles.warningCard}>
        <Text style={styles.warningEmoji}>⚠️</Text>
        <Text style={styles.warningText}>
          <Text style={styles.bold}>Important:</Text> After saving these settings, users with versions below the minimum will not be able to use the app until they update.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          disabled={isSaving}
          style={styles.cancelButton}
          textColor={Colors.textSecondary}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
          buttonColor={Colors.accent}
          textColor={Colors.white}
        >
          Save Changes
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: { margin: 0 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  infoCard: {
    backgroundColor: Colors.accentSubtle,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  infoEmoji: { fontSize: 24, marginBottom: 8 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: Colors.accent, marginBottom: 8 },
  infoText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  bold: { fontWeight: '600' },
  currentVersionCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Colors.shadow,
  },
  label: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  currentVersionText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.success,
    marginBottom: 4,
  },
  hint: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center' },
  formSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: { marginBottom: 4, backgroundColor: Colors.inputBackground },
  textArea: {
    marginBottom: 4,
    backgroundColor: Colors.inputBackground,
    minHeight: 80,
  },
  helperText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  divider: { backgroundColor: Colors.divider, marginVertical: 16 },
  warningCard: {
    backgroundColor: Colors.errorLight,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningEmoji: { fontSize: 20 },
  warningText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  cancelButton: { flex: 1, borderColor: Colors.border, borderRadius: 12 },
  saveButton: { flex: 1, borderRadius: 12 },
});
