// ============================================================================
// VEBOSSO EMS — Work file picker
// "Attach files" for the check-in and check-out forms: PDF and Word, up to
// MAX_WORK_FILES. They end up in the person's Documents under Work. The forms
// put the File button in one row with Camera and Gallery, and show the
// picked files with WorkFileList.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppRadius, AppTheme } from '../constants/theme';
import { MAX_WORK_FILE_BYTES, MAX_WORK_FILES, WORK_FILE_TYPES } from '../lib/employeeRecords';
import { WorkFile } from '../types/database';

/** Opens the file picker and adds what was chosen (PDF / Word, size and count checked). */
export async function pickWorkFiles(
  files: WorkFile[],
  onChange: (files: WorkFile[]) => void,
  onError: (message: string) => void,
) {
    if (files.length >= MAX_WORK_FILES) {
      onError(`You can attach a maximum of ${MAX_WORK_FILES} files`);
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: WORK_FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const next = [...files];
      for (const a of res.assets) {
        if (next.length >= MAX_WORK_FILES) {
          onError(`Only the first ${MAX_WORK_FILES} files were added`);
          break;
        }
        if (a.size && a.size > MAX_WORK_FILE_BYTES) {
          onError(`"${a.name}" is over 20 MB`);
          continue;
        }
        next.push({ uri: a.uri, name: a.name, mimeType: a.mimeType });
      }
      onChange(next);
    } catch {
      onError('Could not open the file picker');
    }
}

/** The picked files, each with a remove button. */
export function WorkFileList({
  files,
  onChange,
  disabled,
}: {
  files: WorkFile[];
  onChange: (files: WorkFile[]) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {files.map((f, i) => (
        <View key={`${f.uri}-${i}`} style={styles.row}>
          <Feather name="file-text" size={16} color={AppTheme.inkSoft} />
          <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
          <TouchableOpacity
            onPress={() => onChange(files.filter((_, j) => j !== i))}
            disabled={disabled}
            hitSlop={8}
            accessibilityLabel={`Remove ${f.name}`}
          >
            <Feather name="x" size={16} color={AppTheme.coral} />
          </TouchableOpacity>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppRadius.chip,
    backgroundColor: AppTheme.soft,
    marginBottom: 6,
  },
  name: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: AppTheme.ink },
});
