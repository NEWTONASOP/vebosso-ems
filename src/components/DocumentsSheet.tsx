// ============================================================================
// VEBOSSO EMS — Documents Sheet
// One person's documents — photos, PDFs and Word files. The owner can add,
// rename and delete anyone's; everyone else can only view and add their own
// (enforced by RLS). Images preview in place; PDF/Word open in the phone's app.
// Uploads by members/managers wait for the owner to approve or reject them.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  deleteDocument,
  documentKind,
  DocumentKind,
  fetchDocuments,
  openDocumentFile,
  renameDocument,
  reviewDocument,
  signDocumentUrls,
  uploadDocument,
} from '../lib/employeeRecords';
import { DocumentStatus, EmployeeDocument } from '../types/database';
import { SheetFrame } from './SheetFrame';

async function loadDocuments(userId: string) {
  const res = await fetchDocuments(userId);
  if (!res.success) return res;
  const urls = await signDocumentUrls(res.data.map((d) => d.file_path));
  return { success: true as const, data: { docs: res.data, urls } };
}

const FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const KIND_BADGE: Record<Exclude<DocumentKind, 'image'>, { label: string; color: string; bg: string }> = {
  pdf: { label: 'PDF', color: T.coral, bg: T.coralSoft },
  word: { label: 'DOC', color: T.blue, bg: T.blueSoft },
  other: { label: 'FILE', color: T.inkSoft, bg: T.soft },
};

const STATUS_CHIP: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: T.amber, bg: T.amberSoft },
  approved: { label: 'Approved', color: T.green, bg: T.greenSoft },
  rejected: { label: 'Rejected', color: T.coral, bg: T.coralSoft },
};

interface PendingFile {
  uri: string;
  kind: DocumentKind;
  fileName?: string | null;
  mimeType?: string | null;
}

/** A coloured "PDF" / "DOC" tile standing in for a thumbnail. */
function FileTile({ kind, size }: { kind: DocumentKind; size: { width: number; height: number } }) {
  const badge = KIND_BADGE[kind === 'image' ? 'other' : kind];
  return (
    <View style={[styles.fileTile, size, { backgroundColor: badge.bg }]}>
      <Feather name="file-text" size={16} color={badge.color} />
      <Text style={[styles.fileTileText, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

interface DocumentsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Whose documents. */
  userId: string;
  userName: string;
  /** The signed-in user — the uploader. */
  currentUserId: string;
  /** Owner: rename and delete as well. */
  canManage: boolean;
}

export function DocumentsSheet({
  visible,
  onDismiss,
  userId,
  userName,
  currentUserId,
  canManage,
}: DocumentsSheetProps) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [pending, setPending] = useState<PendingFile | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [preview, setPreview] = useState<EmployeeDocument | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const isOwnDocs = userId === currentUserId;

  const apply = useCallback((res: Awaited<ReturnType<typeof loadDocuments>>) => {
    if (res.success) {
      setDocs(res.data.docs);
      setUrls(res.data.urls);
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await loadDocuments(userId)), [apply, userId]);

  // Mounted only while open, so this loads once on open.
  useEffect(() => {
    let active = true;
    loadDocuments(userId).then((res) => active && apply(res));
    return () => {
      active = false;
    };
  }, [apply, userId]);

  const pick = async (source: 'library' | 'camera') => {
    setError('');
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        setError(source === 'camera' ? 'Camera permission is needed' : 'Photo permission is needed');
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) {
        setPending({ uri: result.assets[0].uri, kind: 'image', mimeType: result.assets[0].mimeType });
      }
    } catch {
      setError('Could not open the picker');
    }
  };

  const pickFile = async () => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.canceled ? null : result.assets?.[0];
      if (!asset) return;
      if (asset.size && asset.size > 20 * 1024 * 1024) {
        setError('That file is over 20 MB');
        return;
      }
      setPending({
        uri: asset.uri,
        kind: documentKind(asset.mimeType),
        fileName: asset.name,
        mimeType: asset.mimeType,
      });
      // Start with the file's own name; the uploader can tidy it up.
      if (!newName.trim() && asset.name) setNewName(asset.name.replace(/\.[^.]+$/, '').slice(0, 120));
    } catch {
      setError('Could not open the file picker');
    }
  };

  const openDoc = async (doc: EmployeeDocument) => {
    if (documentKind(doc.mime_type) === 'image') {
      setPreview(doc);
      return;
    }
    const url = urls[doc.file_path];
    if (!url) {
      setError('Could not load this file. Close and reopen documents.');
      return;
    }
    setOpeningId(doc.id);
    const res = await openDocumentFile(doc, url);
    setOpeningId(null);
    if (!res.success) setError(res.error);
  };

  const handleUpload = async () => {
    if (!pending) return;
    if (!newName.trim()) {
      setError('Give the document a name, e.g. "Aadhaar card"');
      return;
    }
    setIsUploading(true);
    const res = await uploadDocument({
      userId,
      uploaderId: currentUserId,
      name: newName,
      uri: pending.uri,
      fileName: pending.fileName,
      mimeType: pending.mimeType,
    });
    setIsUploading(false);
    if (res.success) {
      setPending(null);
      setNewName('');
      await load();
    } else {
      setError(res.error);
    }
  };

  const handleReview = async (doc: EmployeeDocument, decision: 'approved' | 'rejected') => {
    setReviewingId(doc.id);
    setError('');
    const res = await reviewDocument(doc, decision, currentUserId);
    setReviewingId(null);
    if (res.success) await load();
    else setError(res.error);
  };

  const handleRename = async (doc: EmployeeDocument) => {
    if (!renameText.trim()) return;
    const res = await renameDocument(doc.id, renameText);
    if (res.success) {
      setRenamingId(null);
      await load();
    } else {
      setError(res.error);
    }
  };

  const confirmDelete = (doc: EmployeeDocument) => {
    Alert.alert('Delete document?', `"${doc.name}" will be removed for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteDocument(doc);
          if (res.success) {
            if (preview?.id === doc.id) setPreview(null);
            await load();
          } else {
            setError(res.error);
          }
        },
      },
    ]);
  };

  const addSection = pending ? (
    <View style={styles.addCard}>
      {pending.kind === 'image' ? (
        <Image source={{ uri: pending.uri }} style={styles.pendingImage} contentFit="cover" />
      ) : (
        <FileTile kind={pending.kind} size={styles.pendingImage} />
      )}
      <View style={{ flex: 1, gap: 8 }}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Document name"
          placeholderTextColor={T.mute}
          style={styles.input}
          maxLength={120}
          editable={!isUploading}
          autoFocus
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => {
              setPending(null);
              setNewName('');
            }}
            disabled={isUploading}
          >
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnDark]} onPress={handleUpload} disabled={isUploading}>
            {isUploading ? (
              <ActivityIndicator size="small" color={T.white} />
            ) : (
              <Text style={styles.btnDarkText}>Upload</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  ) : (
    <View>
      <Text style={styles.addLabel}>Add a document</Text>
      <View style={styles.row}>
        <Pressable style={styles.addBtn} onPress={() => pick('library')} accessibilityLabel="Add from photos">
          <Feather name="image" size={17} color={T.ink} />
          <Text style={styles.addBtnText}>Photos</Text>
        </Pressable>
        <Pressable style={styles.addBtn} onPress={() => pick('camera')} accessibilityLabel="Take a photo">
          <Feather name="camera" size={17} color={T.ink} />
          <Text style={styles.addBtnText}>Camera</Text>
        </Pressable>
        <Pressable style={styles.addBtn} onPress={pickFile} accessibilityLabel="Add a PDF or Word file">
          <Feather name="file-plus" size={17} color={T.ink} />
          <Text style={styles.addBtnText}>PDF / Word</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SheetFrame
      visible={visible}
      onDismiss={onDismiss}
      title={isOwnDocs ? 'My Documents' : 'Documents'}
      subtitle={isOwnDocs ? 'The boss approves each upload; only the boss can change them' : userName}
      icon="file-text"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={addSection}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {preview && urls[preview.file_path] ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: urls[preview.file_path] }} style={styles.preview} contentFit="contain" />
          <Pressable style={styles.previewClose} onPress={() => setPreview(null)} hitSlop={8}>
            <Feather name="x" size={16} color={T.white} />
          </Pressable>
          <Text style={styles.previewName}>{preview.name}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : docs.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="folder" size={22} color={T.mute} />
          <Text style={styles.emptyText}>No documents yet</Text>
        </View>
      ) : (
        (canManage
          ? [...docs].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
          : docs
        ).map((doc) => {
          const url = urls[doc.file_path];
          const chip = STATUS_CHIP[doc.status] ?? STATUS_CHIP.pending;
          const needsReview = canManage && doc.status === 'pending';
          const kind = documentKind(doc.mime_type);
          return (
            <View key={doc.id} style={[styles.docItem, needsReview && styles.docItemPending]}>
            <View style={styles.docRow}>
              <Pressable
                style={styles.docMain}
                onPress={() => openDoc(doc)}
                disabled={openingId === doc.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${doc.name}`}
              >
                {kind === 'image' && url ? (
                  <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
                ) : kind === 'image' ? (
                  <View style={[styles.thumb, styles.thumbIcon]}>
                    <Feather name="image" size={18} color={T.mute} />
                  </View>
                ) : (
                  <FileTile kind={kind} size={styles.thumb} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === doc.id ? (
                    <TextInput
                      value={renameText}
                      onChangeText={setRenameText}
                      style={[styles.input, { height: 36 }]}
                      maxLength={120}
                      autoFocus
                      onSubmitEditing={() => handleRename(doc)}
                    />
                  ) : (
                    <View style={styles.nameRow}>
                      <Text style={[styles.docName, { flexShrink: 1 }]} numberOfLines={1}>{doc.name}</Text>
                      <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
                        <Text style={[styles.statusChipText, { color: chip.color }]}>{chip.label}</Text>
                      </View>
                    </View>
                  )}
                  <Text style={styles.docMeta}>
                    {format(new Date(doc.created_at), 'd MMM yyyy')}
                    {kind !== 'image' ? ` · ${KIND_BADGE[kind].label} · tap to open` : ''}
                  </Text>
                </View>
                {openingId === doc.id ? <ActivityIndicator size="small" color={T.charcoal} /> : null}
              </Pressable>

              {canManage ? (
                renamingId === doc.id ? (
                  <Pressable style={styles.iconBtn} onPress={() => handleRename(doc)} hitSlop={6}>
                    <Feather name="check" size={16} color={T.green} />
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => {
                        setRenamingId(doc.id);
                        setRenameText(doc.name);
                      }}
                      hitSlop={6}
                      accessibilityLabel={`Rename ${doc.name}`}
                    >
                      <Feather name="edit-2" size={15} color={T.inkSoft} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => confirmDelete(doc)}
                      hitSlop={6}
                      accessibilityLabel={`Delete ${doc.name}`}
                    >
                      <Feather name="trash-2" size={15} color={T.coral} />
                    </Pressable>
                  </>
                )
              ) : null}
            </View>

            {needsReview ? (
              <View style={styles.reviewRow}>
                <Pressable
                  style={[styles.reviewBtn, styles.rejectBtn]}
                  onPress={() => handleReview(doc, 'rejected')}
                  disabled={reviewingId === doc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Reject ${doc.name}`}
                >
                  <Text style={styles.rejectText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={[styles.reviewBtn, styles.approveBtn]}
                  onPress={() => handleReview(doc, 'approved')}
                  disabled={reviewingId === doc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Approve ${doc.name}`}
                >
                  {reviewingId === doc.id ? (
                    <ActivityIndicator size="small" color={T.white} />
                  ) : (
                    <>
                      <Feather name="check" size={14} color={T.white} />
                      <Text style={styles.approveText}>Approve</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
            </View>
          );
        })
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    marginBottom: 10,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.mute,
  },
  docItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  docItemPending: {
    backgroundColor: T.amberSoft,
    borderRadius: 16,
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusChipText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10.5,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  reviewBtn: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: T.card,
  },
  rejectText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.coral,
  },
  approveBtn: {
    backgroundColor: T.charcoal,
  },
  approveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
  },
  docMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: T.soft,
  },
  thumbIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  docMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: T.charcoalDeep,
    marginBottom: 12,
  },
  preview: {
    width: '100%',
    height: 320,
  },
  previewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.white,
    padding: 10,
  },
  fileTile: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  fileTileText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  addLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 62,
    borderRadius: 16,
    backgroundColor: T.soft,
  },
  addBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: T.ink,
  },
  addCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  pendingImage: {
    width: 72,
    height: 90,
    borderRadius: 12,
    backgroundColor: T.soft,
  },
  input: {
    height: 42,
    borderRadius: 12,
    backgroundColor: T.soft,
    paddingHorizontal: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.ink,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  btnDark: {
    backgroundColor: T.charcoal,
  },
  btnDarkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
  },
  btnGhost: {
    backgroundColor: T.soft,
  },
  btnGhostText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
});
