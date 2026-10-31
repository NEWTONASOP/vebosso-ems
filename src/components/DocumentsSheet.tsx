// ============================================================================
// VEBOSSO EMS — Documents Sheet
// One person's documents — photos, PDFs and Word files. The owner can add,
// rename and delete anyone's; everyone else can only view and add their own
// (enforced by RLS). Images preview in place; PDF/Word open in the phone's app.
// Uploads by members/managers wait for the owner to approve them or send them back.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SmoothTextInput as TextInput } from './SmoothTextInput';
import { Menu, Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  createFolder,
  deleteDocument,
  deleteFolder,
  downloadDocumentFile,
  documentKind,
  DocumentKind,
  fetchDocuments,
  fetchFolders,
  moveDocuments,
  renameFolder,
  openDocumentFile,
  renameDocument,
  reviewDocument,
  makeDocumentThumb,
  signDocumentUrls,
  thumbPath,
  uploadDocument,
} from '../lib/employeeRecords';
import { DocumentCategory, DocumentFolder, DocumentStatus, EmployeeDocument } from '../types/database';
import { ImageViewerModal } from './ImageViewerModal';
import { SheetFrame } from './SheetFrame';

async function loadDocuments(userId: string) {
  const res = await fetchDocuments(userId);
  if (!res.success) return res;
  // Full files, plus the small previews of photos (missing ones are just left out).
  const photos = res.data.filter((d) => documentKind(d.mime_type) === 'image');
  const [urls, thumbs] = await Promise.all([
    signDocumentUrls(res.data.map((d) => d.file_path)),
    signDocumentUrls(photos.map((d) => thumbPath(d.file_path))),
  ]);
  // Folders (060) — if that update isn't installed yet there are simply none.
  const folders = await fetchFolders(userId);
  return {
    success: true as const,
    data: { docs: res.data, urls, thumbs, folders: folders.success ? folders.data : [] },
  };
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
  rejected: { label: 'Needs a change', color: T.amber, bg: T.amberSoft },
};

const isWeb = Platform.OS === 'web';

/** Most files that go up in one go. */
const MAX_BATCH = 20;

interface PendingFile {
  /** What the document is called — starts as the file's own name; editable. */
  name: string;
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
  /** Show in place (e.g. a dropdown in the member sheet) instead of as a sheet. */
  inline?: boolean;
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

/** Memoised: screens behind it refresh often, and re-drawing it made scrolling stutter. */
export const DocumentsSheet = memo(function DocumentsSheet({
  visible,
  onDismiss,
  userId,
  userName,
  currentUserId,
  canManage,
  inline,
}: DocumentsSheetProps) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  // Small previews by document id (photos only).
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [pending, setPending] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Work folders (060): the one open (null = the top level), plus the small
  // forms for a new folder / renaming one / filing a document.
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [makingFolder, setMakingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderMenuFor, setFolderMenuFor] = useState<string | null>(null);
  const [filing, setFiling] = useState<EmployeeDocument | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const isUploading = progress !== null;

  // The photo open in the big popup.
  const [viewerDoc, setViewerDoc] = useState<EmployeeDocument | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // The document whose ⋮ menu is open.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const isOwnDocs = userId === currentUserId;
  // Personal documents, or work files attached at check-in / check-out.
  const [tab, setTab] = useState<DocumentCategory>('personal');
  const workCount = docs.filter((d) => d.category === 'work').length;
  // The owner, or the person themselves, can organise their work documents.
  const canOrganise = canManage || isOwnDocs;
  const openFolder = folderId ? folders.find((f) => f.id === folderId) ?? null : null;
  // In the Work tab: what is in the open folder, or what sits outside any folder.
  const inTab = docs.filter((d) => {
    if ((d.category ?? 'personal') !== tab) return false;
    if (tab !== 'work') return true;
    return openFolder ? d.folder_id === openFolder.id : !d.folder_id || !folders.some((f) => f.id === d.folder_id);
  });
  const countIn = (id: string) => docs.filter((d) => d.category === 'work' && d.folder_id === id).length;

  const apply = useCallback((res: Awaited<ReturnType<typeof loadDocuments>>) => {
    if (res.success) {
      setDocs(res.data.docs);
      setFolders(res.data.folders);
      setUrls(res.data.urls);
      const byId: Record<string, string> = {};
      for (const d of res.data.docs) {
        const t = res.data.thumbs[thumbPath(d.file_path)];
        if (t) byId[d.id] = t;
      }
      setThumbs(byId);
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await loadDocuments(userId)), [apply, userId]);

  // Photos from before previews existed: make each one's preview once, one
  // at a time, by whoever may add to these documents (owner, or the person).
  const canAdd = canManage || isOwnDocs;
  useEffect(() => {
    if (!canAdd) return;
    const missing = docs.filter((d) => documentKind(d.mime_type) === 'image' && !thumbs[d.id] && urls[d.file_path]);
    if (missing.length === 0) return;
    let active = true;
    void (async () => {
      for (const d of missing) {
        if (!active) return;
        const t = await makeDocumentThumb(d.file_path, urls[d.file_path]);
        if (t && active) setThumbs((prev) => ({ ...prev, [d.id]: t }));
      }
    })();
    return () => {
      active = false;
    };
    // Once per load — not again for each preview made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, urls, canAdd]);

  // Mounted only while open, so this loads once on open.
  useEffect(() => {
    let active = true;
    loadDocuments(userId).then((res) => active && apply(res));
    return () => {
      active = false;
    };
  }, [apply, userId]);

  const baseName = (n: string | null | undefined, fallback: string) =>
    (n ? n.replace(/\.[^.]+$/, '') : fallback).slice(0, 120) || fallback;

  /** Adds picked files to the list waiting to upload (up to MAX_BATCH). */
  const addPending = (files: PendingFile[]) => {
    setPending((prev) => {
      const room = MAX_BATCH - prev.length;
      if (files.length > room) setError(`You can upload ${MAX_BATCH} files at a time — the first ${Math.max(room, 0)} were added`);
      return [...prev, ...files.slice(0, Math.max(room, 0))];
    });
  };

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
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: 'images',
              quality: 0.8,
              allowsMultipleSelection: true,
              selectionLimit: MAX_BATCH,
            });
      if (result.canceled || !result.assets?.length) return;
      addPending(
        result.assets.map((a, i) => ({
          name: baseName(a.fileName, `Photo ${pending.length + i + 1}`),
          uri: a.uri,
          kind: 'image' as const,
          mimeType: a.mimeType,
        }))
      );
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
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const ok: PendingFile[] = [];
      for (const asset of result.assets) {
        if (asset.size && asset.size > 20 * 1024 * 1024) {
          setError(`"${asset.name}" is over 20 MB`);
          continue;
        }
        ok.push({
          name: baseName(asset.name, 'Document'),
          uri: asset.uri,
          kind: documentKind(asset.mimeType),
          fileName: asset.name,
          mimeType: asset.mimeType,
        });
      }
      addPending(ok);
    } catch {
      setError('Could not open the file picker');
    }
  };

  const openDoc = async (doc: EmployeeDocument) => {
    if (documentKind(doc.mime_type) === 'image') {
      setViewerDoc(doc);
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

  const downloadDoc = async (doc: EmployeeDocument) => {
    const url = urls[doc.file_path];
    if (!url) {
      setError('Could not load this file. Close and reopen documents.');
      return;
    }
    setOpeningId(doc.id);
    const res = await downloadDocumentFile(doc, url);
    setOpeningId(null);
    if (!res.success) setError(res.error);
  };

  const docMenuItems = (doc: EmployeeDocument) => {
    const close = () => setMenuFor(null);
    const items: { title: string; icon: string; danger?: boolean; onPress: () => void }[] = [
      { title: 'Download', icon: 'download-outline', onPress: () => { close(); void downloadDoc(doc); } },
    ];
    if (doc.category === 'work' && canOrganise) {
      items.push({ title: 'Move to folder', icon: 'folder-move-outline', onPress: () => { close(); setFiling(doc); } });
    }
    if (canManage) {
      items.push({ title: 'Rename', icon: 'pencil-outline', onPress: () => { close(); setRenamingId(doc.id); setRenameText(doc.name); } });
      items.push({ title: 'Delete', icon: 'trash-can-outline', danger: true, onPress: () => { close(); confirmDelete(doc); } });
    }
    return items;
  };

  const handleUpload = async () => {
    if (pending.length === 0) return;
    if (pending.some((f) => !f.name.trim())) {
      setError('Every file needs a name');
      return;
    }
    setError('');
    const queue = pending;
    const failed: PendingFile[] = [];
    let lastError = '';
    setProgress({ done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      const res = await uploadDocument({
        userId,
        uploaderId: currentUserId,
        category: tab,
        folderId: tab === 'work' ? folderId : null,
        name: f.name,
        uri: f.uri,
        fileName: f.fileName,
        mimeType: f.mimeType,
      });
      if (!res.success) {
        failed.push(f);
        lastError = res.error;
      }
      setProgress({ done: i + 1, total: queue.length });
    }
    setProgress(null);
    // Whatever didn't go up stays in the list, ready to try again.
    setPending(failed);
    if (failed.length) {
      setError(
        `${queue.length - failed.length} of ${queue.length} uploaded. ${failed.length} didn't go up: ${lastError}`
      );
    }
    await load();
  };

  // ---- Folders -----------------------------------------------------------------
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    const res = await createFolder(userId, folderName);
    if (!res.success) return setError(res.error);
    setMakingFolder(false);
    setFolderName('');
    await load();
  };

  const handleRenameFolder = async (f: DocumentFolder) => {
    if (!folderName.trim()) return;
    const res = await renameFolder(f.id, folderName);
    if (!res.success) return setError(res.error);
    setRenamingFolderId(null);
    setFolderName('');
    await load();
  };

  const confirmDeleteFolder = (f: DocumentFolder) => {
    const n = countIn(f.id);
    Alert.alert(
      'Delete folder?',
      n ? `"${f.name}" is deleted. Its ${n} document${n === 1 ? '' : 's'} are kept, outside any folder.` : `"${f.name}" will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteFolder(f.id);
            if (!res.success) return setError(res.error);
            if (folderId === f.id) setFolderId(null);
            await load();
          },
        },
      ]
    );
  };

  const fileDoc = async (doc: EmployeeDocument, target: string | null) => {
    setFiling(null);
    const res = await moveDocuments([doc.id], target);
    if (!res.success) return setError(res.error);
    await load();
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
    Alert.alert('Delete document?', `"${doc.name}" will be deleted. You can restore it from the recycle bin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteDocument(doc);
          if (res.success) {
            if (viewerDoc?.id === doc.id) setViewerDoc(null);
            await load();
          } else {
            setError(res.error);
          }
        },
      },
    ]);
  };

  const addSection =
    pending.length > 0 ? (
      <View style={{ gap: 10 }}>
        <Text style={styles.addLabel}>
          {pending.length} file{pending.length === 1 ? '' : 's'} to upload
          {tab === 'work' ? (openFolder ? ` · into "${openFolder.name}"` : '') : ''}
        </Text>
        {/* Many files scroll here, so the buttons below stay on screen. */}
        <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={{ gap: 10 }} nestedScrollEnabled>
        {pending.map((f, i) => (
          <View key={`${f.uri}-${i}`} style={styles.addCard}>
            {f.kind === 'image' ? (
              <Image source={{ uri: f.uri }} style={styles.pendingImage} contentFit="cover" />
            ) : (
              <FileTile kind={f.kind} size={styles.pendingImage} />
            )}
            <TextInput
              value={f.name}
              onChangeText={(v) => setPending((prev) => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))}
              style={[styles.input, { flex: 1, height: 40 }]}
              maxLength={120}
              editable={!isUploading}
              placeholder="Name"
            />
            <Pressable
              style={styles.iconBtn}
              onPress={() => setPending((prev) => prev.filter((_, j) => j !== i))}
              disabled={isUploading}
              hitSlop={6}
              accessibilityLabel={`Remove ${f.name}`}
            >
              <Feather name="x" size={15} color={T.inkSoft} />
            </Pressable>
          </View>
        ))}
        </ScrollView>
        {pending.length < MAX_BATCH && !isUploading ? (
          <View style={styles.row}>
            <Pressable style={styles.addBtn} onPress={() => pick('library')}>
              <Feather name="image" size={16} color={T.ink} />
              <Text style={styles.addBtnText}>More photos</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={pickFile}>
              <Feather name="file-plus" size={16} color={T.ink} />
              <Text style={styles.addBtnText}>More files</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => setPending([])}
            disabled={isUploading}
          >
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnDark]} onPress={handleUpload} disabled={isUploading}>
            {isUploading ? (
              <>
                <ActivityIndicator size="small" color={T.white} />
                <Text style={styles.btnDarkText}>
                  {progress ? ` ${progress.done} / ${progress.total}` : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.btnDarkText}>
                Upload {pending.length} file{pending.length === 1 ? '' : 's'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    ) : (
      <View>
        <Text style={styles.addLabel}>
          {tab === 'work'
            ? openFolder
              ? `Add to "${openFolder.name}"`
              : 'Add work documents'
            : 'Add documents'}
        </Text>
        <View style={styles.row}>
          <Pressable style={styles.addBtn} onPress={() => pick('library')} accessibilityLabel="Add from photos">
            <Feather name="image" size={17} color={T.ink} />
            <Text style={styles.addBtnText}>Photos</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => pick('camera')} accessibilityLabel="Take a photo">
            <Feather name="camera" size={17} color={T.ink} />
            <Text style={styles.addBtnText}>Camera</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={pickFile} accessibilityLabel="Add PDF or Word files">
            <Feather name="file-plus" size={17} color={T.ink} />
            <Text style={styles.addBtnText}>PDF / Word</Text>
          </Pressable>
        </View>
      </View>
    );

  return (
    <SheetFrame
      inline={inline}
      visible={visible}
      onDismiss={onDismiss}
      title={isOwnDocs ? 'My Documents' : 'Documents'}
      subtitle={
        isOwnDocs
          ? tab === 'work'
            ? 'Work files need no approval; only the boss can change them'
            : 'The boss approves each upload; only the boss can change them'
          : userName
      }
      icon="file-text"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={addSection}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ImageViewerModal
        uri={viewerDoc ? urls[viewerDoc.file_path] ?? null : null}
        title={viewerDoc?.name}
        onDismiss={() => setViewerDoc(null)}
      />

      <View style={styles.tabs}>
        {(['personal', 'work'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => {
              setTab(t);
              setFolderId(null);
              setFiling(null);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'personal' ? 'Personal' : `Work${workCount ? ` · ${workCount}` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'work' && !isLoading ? (
        <View style={styles.folderArea}>
          {openFolder ? (
            <Pressable style={styles.crumb} onPress={() => setFolderId(null)} accessibilityRole="button">
              <Feather name="chevron-left" size={18} color={T.ink} />
              <Text style={styles.crumbText} numberOfLines={1}>
                Work · {openFolder.name}
              </Text>
            </Pressable>
          ) : (
            <>
              {folders.map((f) => (
                <View key={f.id} style={styles.folderRow}>
                  {renamingFolderId === f.id ? (
                    <>
                      <TextInput
                        value={folderName}
                        onChangeText={setFolderName}
                        style={[styles.input, { flex: 1, height: 38 }]}
                        maxLength={60}
                        autoFocus
                        onSubmitEditing={() => handleRenameFolder(f)}
                      />
                      <Pressable style={styles.iconBtn} onPress={() => handleRenameFolder(f)} hitSlop={6}>
                        <Feather name="check" size={16} color={T.green} />
                      </Pressable>
                      <Pressable
                        style={styles.iconBtn}
                        onPress={() => {
                          setRenamingFolderId(null);
                          setFolderName('');
                        }}
                        hitSlop={6}
                      >
                        <Feather name="x" size={16} color={T.inkSoft} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        style={styles.folderMain}
                        onPress={() => setFolderId(f.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open folder ${f.name}`}
                      >
                        <View style={styles.folderIcon}>
                          <Feather name="folder" size={18} color={T.violet} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.docName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.docMeta}>
                            {countIn(f.id)} document{countIn(f.id) === 1 ? '' : 's'}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={T.mute} />
                      </Pressable>
                      {canOrganise ? (
                        <Menu
                          visible={folderMenuFor === f.id}
                          onDismiss={() => setFolderMenuFor(null)}
                          anchor={
                            <Pressable
                              style={styles.iconBtn}
                              onPress={() => setFolderMenuFor(f.id)}
                              hitSlop={6}
                              accessibilityLabel={`More for folder ${f.name}`}
                            >
                              <Feather name="more-vertical" size={16} color={T.inkSoft} />
                            </Pressable>
                          }
                          contentStyle={styles.menu}
                        >
                          <Menu.Item
                            leadingIcon="pencil-outline"
                            title="Rename"
                            onPress={() => {
                              setFolderMenuFor(null);
                              setRenamingFolderId(f.id);
                              setFolderName(f.name);
                            }}
                          />
                          <Menu.Item
                            leadingIcon="trash-can-outline"
                            title="Delete folder"
                            titleStyle={{ color: T.coral }}
                            onPress={() => {
                              setFolderMenuFor(null);
                              confirmDeleteFolder(f);
                            }}
                          />
                        </Menu>
                      ) : null}
                    </>
                  )}
                </View>
              ))}
              {canOrganise ? (
                makingFolder ? (
                  <View style={styles.folderRow}>
                    <TextInput
                      value={folderName}
                      onChangeText={setFolderName}
                      style={[styles.input, { flex: 1, height: 38 }]}
                      placeholder="Folder name"
                      maxLength={60}
                      autoFocus
                      onSubmitEditing={handleCreateFolder}
                    />
                    <Pressable style={styles.iconBtn} onPress={handleCreateFolder} hitSlop={6} accessibilityLabel="Create folder">
                      <Feather name="check" size={16} color={T.green} />
                    </Pressable>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => {
                        setMakingFolder(false);
                        setFolderName('');
                      }}
                      hitSlop={6}
                    >
                      <Feather name="x" size={16} color={T.inkSoft} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.newFolder}
                    onPress={() => {
                      setMakingFolder(true);
                      setFolderName('');
                    }}
                    accessibilityRole="button"
                  >
                    <Feather name="folder-plus" size={16} color={T.ink} />
                    <Text style={styles.addBtnText}>New folder</Text>
                  </Pressable>
                )
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {filing ? (
        <View style={styles.filePanel}>
          <Text style={styles.addLabel} numberOfLines={2}>Move “{filing.name}” to</Text>
          <Pressable style={styles.fileOption} onPress={() => fileDoc(filing, null)} accessibilityRole="button">
            <Feather name="file-text" size={15} color={T.inkSoft} />
            <Text style={styles.fileOptionText}>No folder</Text>
            {!filing.folder_id ? <Feather name="check" size={15} color={T.green} /> : null}
          </Pressable>
          {folders.map((f) => (
            <Pressable key={f.id} style={styles.fileOption} onPress={() => fileDoc(filing, f.id)} accessibilityRole="button">
              <Feather name="folder" size={15} color={T.violet} />
              <Text style={styles.fileOptionText} numberOfLines={1}>{f.name}</Text>
              {filing.folder_id === f.id ? <Feather name="check" size={15} color={T.green} /> : null}
            </Pressable>
          ))}
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setFiling(null)}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : inTab.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="folder" size={22} color={T.mute} />
          <Text style={styles.emptyText}>
            {tab === 'work'
              ? openFolder
                ? 'This folder is empty — add files below'
                : folders.length
                  ? 'No documents outside folders'
                  : 'No work documents yet — add some below, or attach files at check-in or check-out'
              : 'No documents yet'}
          </Text>
        </View>
      ) : (
        (canManage
          ? [...inTab].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
          : inTab
        ).map((doc) => {
          const url = urls[doc.file_path];
          const thumb = thumbs[doc.id];
          const chip = STATUS_CHIP[doc.status] ?? STATUS_CHIP.pending;
          const needsReview = canManage && doc.status === 'pending';
          const kind = documentKind(doc.mime_type);
          return (
            <View key={doc.id} style={[styles.docItem, needsReview && styles.docItemPending, menuFor === doc.id && { zIndex: 30 }]}>
            <View style={styles.docRow}>
              <Pressable
                style={styles.docMain}
                onPress={() => openDoc(doc)}
                disabled={openingId === doc.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${doc.name}`}
              >
                {kind === 'image' && thumb ? (
                  // The small preview, never the full photo (that opens on tap).
                  <Image
                    source={{ uri: thumb, cacheKey: thumbPath(doc.file_path) }}
                    style={styles.thumb}
                    contentFit="cover"
                    cachePolicy="disk"
                    recyclingKey={doc.id}
                  />
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
                    // The whole name, wrapping if it is long; the status sits under it.
                    <Text style={styles.docName}>{doc.name}</Text>
                  )}
                  <View style={styles.statusRow}>
                    {doc.category === 'work' ? (
                      doc.work_phase ? (
                        <View style={[styles.statusChip, { backgroundColor: T.blueSoft }]}>
                          <Text style={[styles.statusChipText, { color: T.blue }]}>
                            {doc.work_phase === 'check_out' ? 'Check-out' : 'Check-in'}
                          </Text>
                        </View>
                      ) : null
                    ) : (
                      <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
                        <Text style={[styles.statusChipText, { color: chip.color }]}>{chip.label}</Text>
                      </View>
                    )}
                    <Text style={[styles.docMeta, { marginTop: 0, flexShrink: 1 }]}>
                      {format(new Date(doc.created_at), 'd MMM yyyy')}
                      {kind !== 'image' ? ` · ${KIND_BADGE[kind].label} · tap to open` : ''}
                    </Text>
                  </View>
                </View>
                {openingId === doc.id ? <ActivityIndicator size="small" color={T.charcoal} /> : null}
              </Pressable>

              {renamingId === doc.id ? (
                <Pressable style={styles.iconBtn} onPress={() => handleRename(doc)} hitSlop={6}>
                  <Feather name="check" size={16} color={T.green} />
                </Pressable>
              ) : isWeb ? (
                // Web: Paper's floating menu drifted off the sheet, so this one is
                // placed by the button itself.
                <View style={{ position: 'relative', zIndex: menuFor === doc.id ? 20 : 0 }}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => setMenuFor(menuFor === doc.id ? null : doc.id)}
                    hitSlop={6}
                    accessibilityLabel={`More for ${doc.name}`}
                  >
                    <Feather name="more-vertical" size={16} color={T.inkSoft} />
                  </Pressable>
                  {menuFor === doc.id ? (
                    <View style={styles.webMenu}>
                      {docMenuItems(doc).map((it) => (
                        <Pressable key={it.title} style={styles.webMenuItem} onPress={it.onPress} accessibilityRole="button">
                          <Text style={[styles.webMenuText, it.danger && { color: T.coral }]}>{it.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : (
                <Menu
                  visible={menuFor === doc.id}
                  onDismiss={() => setMenuFor(null)}
                  anchor={
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => setMenuFor(doc.id)}
                      hitSlop={6}
                      accessibilityLabel={`More for ${doc.name}`}
                    >
                      <Feather name="more-vertical" size={16} color={T.inkSoft} />
                    </Pressable>
                  }
                  contentStyle={styles.menu}
                >
                  {docMenuItems(doc).map((it) => (
                    <Menu.Item key={it.title} leadingIcon={it.icon} title={it.title} titleStyle={it.danger ? { color: T.coral } : undefined} onPress={it.onPress} />
                  ))}
                </Menu>
              )}
            </View>

            {/* Seen big and in full before Approve / Reject. Tap to open it properly. */}
            {needsReview && kind === 'image' ? (
              <Pressable
                style={styles.reviewImageWrap}
                onPress={() => setViewerDoc(doc)}
                disabled={!url}
                accessibilityRole="button"
                accessibilityLabel={`Open ${doc.name}`}
              >
                {url ? (
                  <Image source={{ uri: url, cacheKey: doc.file_path }} style={styles.reviewImage} contentFit="cover" cachePolicy="disk" recyclingKey={doc.id} />
                ) : (
                  <ActivityIndicator color={T.charcoal} />
                )}
              </Pressable>
            ) : null}

            {needsReview ? (
              <View style={styles.reviewRow}>
                <Pressable
                  style={[styles.reviewBtn, styles.rejectBtn]}
                  onPress={() => handleReview(doc, 'rejected')}
                  disabled={reviewingId === doc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Send back ${doc.name}`}
                >
                  <Text style={styles.rejectText}>Send back</Text>
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
});

const styles = StyleSheet.create({
  folderArea: { gap: 6, marginBottom: 10 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  folderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: T.soft,
  },
  folderIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: T.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFolder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.hairline,
    borderStyle: 'dashed',
  },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  crumbText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15, color: T.ink },
  filePanel: { gap: 4, padding: 12, borderRadius: 16, backgroundColor: T.soft, marginBottom: 10 },
  fileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  fileOptionText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    marginBottom: 10,
    borderRadius: 999,
    backgroundColor: T.soft,
  },
  tab: { flex: 1, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: T.card },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  tabTextActive: { color: T.ink },
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
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
    color: T.ink,
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
  reviewImageWrap: {
    height: 200,
    borderRadius: 14,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 10,
  },
  reviewImage: { width: '100%', height: '100%' },
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
  menu: { backgroundColor: T.card, borderRadius: 14 },
  webMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 170,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.hairline,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  webMenuItem: { paddingVertical: 11, paddingHorizontal: 16 },
  webMenuText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink },
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
    gap: 10,
    alignItems: 'center',
  },
  pendingImage: {
    width: 52,
    height: 52,
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
