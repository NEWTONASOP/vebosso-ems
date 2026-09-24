// ============================================================================
// VEBOSSO EMS — Bill preview
// The bill exactly as the client gets it (same HTML the PDF is printed from),
// laid out as an A4 page and scaled to fit the screen. Works for drafts and
// unsaved edits too, so the owner can check before saving or sending.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme as T } from '../constants/theme';
import { buildBillHtml } from '../lib/billPdf';
import { Bill, BillSettings } from '../types/database';
import { BillPreviewFrame } from './BillPreviewFrame';

/** A4 at 96 dpi. */
const PAGE_PX = 794;

/** Put the bill on a grey desk as one A4-width sheet, zoomed to fit. */
function asPreviewPage(html: string): string {
  const extra = `
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html { background: #E6E9EF; }
  body { width: ${PAGE_PX}px; margin: 12px auto; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
</style>
<script>
  function fitPage() {
    var z = Math.min(1, (window.innerWidth - 16) / ${PAGE_PX});
    document.body.style.zoom = z;
  }
  window.addEventListener('resize', fitPage);
  document.addEventListener('DOMContentLoaded', fitPage);
</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${extra}</head>`) : extra + html;
}

export function BillPreviewSheet({
  bill,
  settings,
  onDismiss,
  onShare,
  shareHint,
}: {
  bill: Bill;
  settings: BillSettings;
  onDismiss: () => void;
  /** Present when the bill can be shared as it stands. */
  onShare?: () => void;
  /** Why sharing isn't offered yet, e.g. "Save to share". */
  shareHint?: string;
}) {
  const insets = useSafeAreaInsets();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    buildBillHtml(bill, settings)
      .then((h) => active && setHtml(asPreviewPage(h)))
      .catch((e) => active && setError(e?.message || 'Could not build the preview'));
    return () => {
      active = false;
    };
  }, [bill, settings]);

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onDismiss} style={styles.iconBtn} hitSlop={8} accessibilityLabel="Close preview">
            <Feather name="x" size={18} color={T.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {bill.client_name || 'Preview'}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {bill.number ?? 'Draft'} · as the client will see it
            </Text>
          </View>
          {onShare ? (
            <Pressable onPress={onShare} style={styles.shareBtn} accessibilityRole="button" accessibilityLabel="Share PDF">
              <Feather name="share-2" size={15} color={T.white} />
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
          ) : shareHint ? (
            <Text style={styles.hint}>{shareHint}</Text>
          ) : null}
        </View>

        <View style={styles.body}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : html ? (
            <BillPreviewFrame html={html} />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={T.charcoal} />
              <Text style={styles.loadingText}>Preparing preview…</Text>
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 0,
    backgroundColor: '#E6E9EF',
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: T.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 1 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.charcoal,
  },
  shareText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.white },
  hint: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.mute, maxWidth: 110, textAlign: 'right' },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.mute },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, textAlign: 'center', padding: 24 },
});
