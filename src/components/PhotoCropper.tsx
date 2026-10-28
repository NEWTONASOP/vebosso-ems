// ============================================================================
// VEBOSSO EMS — Photo cropper
// Full-screen crop for one photo: drag the box to move it, drag a corner to
// resize it. Works on the phone and on web (plain touch handling and
// expo-image-manipulator, nothing native to install). Done hands back the
// cropped file; Cancel leaves the photo as it was.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme as T } from '../constants/theme';

type Rect = { x: number; y: number; w: number; h: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';

const MIN = 64;
const HANDLE = 28;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function PhotoCropper({
  uri,
  onDone,
  onCancel,
  doneLabel = 'Done',
}: {
  /** The photo to crop, local or a link; null keeps it closed. */
  uri: string | null;
  /** The cropped photo (the original, unchanged in content, if the box was left alone). */
  onDone: (uri: string) => void;
  onCancel: () => void;
  doneLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  // The photo as a local, upright file (camera shots carry a rotation flag).
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!uri) return;
    let active = true;
    setPhoto(null);
    setFailed(false);
    (async () => {
      try {
        let local = uri;
        // The manipulator reads local files; bring a link down first.
        if (Platform.OS !== 'web' && /^https?:/.test(uri)) {
          local = `${FileSystem.cacheDirectory}crop_${Date.now()}.jpg`;
          await FileSystem.downloadAsync(uri, local);
        }
        const upright = await ImageManipulator.manipulateAsync(local, [], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        if (active) setPhoto(upright);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [uri]);

  // Where the photo sits inside the stage (fitted, centred).
  const fit = useMemo(() => {
    if (!photo || !stage.w || !stage.h) return null;
    const scale = Math.min(stage.w / photo.width, stage.h / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    return { scale, x: (stage.w - w) / 2, y: (stage.h - h) / 2, w, h };
  }, [photo, stage]);

  // Start with the whole photo selected.
  useEffect(() => {
    if (fit) setRect({ x: fit.x, y: fit.y, w: fit.w, h: fit.h });
  }, [fit]);

  // Gestures read the latest rect and fit through refs, so they are made once.
  const live = useRef({ rect, fit });
  live.current = { rect, fit };
  const start = useRef<Rect>(rect);

  const responder = (kind: 'move' | Corner) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = live.current.rect;
      },
      onPanResponderMove: (_, g) => {
        const f = live.current.fit;
        if (!f) return;
        const s = start.current;
        const left = f.x;
        const top = f.y;
        const right = f.x + f.w;
        const bottom = f.y + f.h;
        if (kind === 'move') {
          setRect({
            ...s,
            x: clamp(s.x + g.dx, left, right - s.w),
            y: clamp(s.y + g.dy, top, bottom - s.h),
          });
          return;
        }
        // A corner moves its own two edges; the opposite corner stays put.
        let x1 = s.x;
        let y1 = s.y;
        let x2 = s.x + s.w;
        let y2 = s.y + s.h;
        if (kind === 'tl' || kind === 'bl') x1 = clamp(s.x + g.dx, left, x2 - MIN);
        if (kind === 'tr' || kind === 'br') x2 = clamp(s.x + s.w + g.dx, x1 + MIN, right);
        if (kind === 'tl' || kind === 'tr') y1 = clamp(s.y + g.dy, top, y2 - MIN);
        if (kind === 'bl' || kind === 'br') y2 = clamp(s.y + s.h + g.dy, y1 + MIN, bottom);
        setRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      },
    });

  const pans = useMemo(
    () => ({
      move: responder('move'),
      tl: responder('tl'),
      tr: responder('tr'),
      bl: responder('bl'),
      br: responder('br'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reset = () => fit && setRect({ x: fit.x, y: fit.y, w: fit.w, h: fit.h });

  const done = async () => {
    if (!photo || !fit) return;
    const whole = rect.w >= fit.w - 1 && rect.h >= fit.h - 1;
    if (whole) return onDone(photo.uri);
    setWorking(true);
    try {
      const originX = clamp(Math.round((rect.x - fit.x) / fit.scale), 0, photo.width - 1);
      const originY = clamp(Math.round((rect.y - fit.y) / fit.scale), 0, photo.height - 1);
      const width = clamp(Math.round(rect.w / fit.scale), 1, photo.width - originX);
      const height = clamp(Math.round(rect.h / fit.scale), 1, photo.height - originY);
      const out = await ImageManipulator.manipulateAsync(photo.uri, [{ crop: { originX, originY, width, height } }], {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onDone(out.uri);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  // A round grip centred on each corner of the box.
  const corner = (c: Corner) => (
    <View
      key={c}
      {...pans[c].panHandlers}
      style={[
        styles.handle,
        {
          left: (c === 'tl' || c === 'bl' ? rect.x : rect.x + rect.w) - HANDLE / 2,
          top: (c === 'tl' || c === 'tr' ? rect.y : rect.y + rect.h) - HANDLE / 2,
        },
      ]}
    >
      <View style={styles.grip} />
    </View>
  );

  return (
    <Portal>
      <Modal visible={!!uri} onDismiss={onCancel} dismissable={false} contentContainerStyle={styles.container}>
        <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onCancel} style={styles.headBtn} hitSlop={8} accessibilityLabel="Cancel crop">
            <Feather name="x" size={18} color={T.white} />
          </Pressable>
          <Text style={styles.title}>Crop photo</Text>
          <Pressable
            onPress={() => void done()}
            disabled={!photo || working}
            style={[styles.doneBtn, (!photo || working) && { opacity: 0.5 }]}
            accessibilityRole="button"
          >
            {working ? <ActivityIndicator size="small" color={T.charcoal} /> : <Text style={styles.doneText}>{doneLabel}</Text>}
          </Pressable>
        </View>

        <View style={styles.stage} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {failed ? (
            <Text style={styles.msg}>Could not open this photo</Text>
          ) : !photo || !fit ? (
            <ActivityIndicator color={T.white} />
          ) : (
            <>
              <Image source={{ uri: photo.uri }} style={{ position: 'absolute', left: fit.x, top: fit.y, width: fit.w, height: fit.h }} contentFit="fill" />
              {/* Dim everything outside the box. */}
              <View style={[styles.dim, { left: fit.x, top: fit.y, width: fit.w, height: rect.y - fit.y }]} pointerEvents="none" />
              <View style={[styles.dim, { left: fit.x, top: rect.y + rect.h, width: fit.w, height: fit.y + fit.h - (rect.y + rect.h) }]} pointerEvents="none" />
              <View style={[styles.dim, { left: fit.x, top: rect.y, width: rect.x - fit.x, height: rect.h }]} pointerEvents="none" />
              <View style={[styles.dim, { left: rect.x + rect.w, top: rect.y, width: fit.x + fit.w - (rect.x + rect.w), height: rect.h }]} pointerEvents="none" />
              <View
                {...pans.move.panHandlers}
                style={[styles.box, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
                accessibilityLabel="Crop area"
              />
              {(['tl', 'tr', 'bl', 'br'] as Corner[]).map(corner)}
            </>
          )}
        </View>

        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={reset} style={styles.resetBtn} accessibilityRole="button">
            <Feather name="maximize" size={15} color={T.white} />
            <Text style={styles.resetText}>Whole photo</Text>
          </Pressable>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, margin: 0, backgroundColor: '#000', justifyContent: 'flex-start' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  headBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  doneBtn: { height: 36, paddingHorizontal: 18, borderRadius: 18, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.charcoal },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msg: { fontFamily: 'Inter_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  box: { position: 'absolute', borderWidth: 1.5, borderColor: T.white },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 16, height: 16, borderRadius: 8, backgroundColor: T.white, borderWidth: 2, borderColor: T.charcoal },
  foot: { alignItems: 'center', paddingTop: 12 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  resetText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.white },
});
