// ============================================================================
// VEBOSSO EMS — Bill preview
// The bill exactly as the client gets it (same HTML the PDF is printed from),
// laid out as an A4 page and scaled to fit the screen. Works for drafts and
// unsaved edits too, so the owner can check before saving or sending.
// BillPage is the page on its own — also what a saved bill opens to.
// PDFs attached to the bill follow it, drawn page by page with PDF.js (the
// WebView can't show a PDF by itself), as they come after it when shared.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme as T } from '../constants/theme';
import { buildBillHtml } from '../lib/billPdf';
import { signBillImages } from '../lib/bills';
import { useSheetEntrance } from '../lib/useSheetEntrance';
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

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/** The attached PDFs' pages under the bill, one file after another. */
function withAttachedPdfs(html: string, files: { name: string; url: string }[]): string {
  if (!files.length) return html;
  // Safe inside <script>: no "</script>" can come out of a file name.
  const list = JSON.stringify(files).replace(/</g, '\\u003c');
  const part = `
<style>
  .att-head { background: #E6E9EF; padding: 18px 24px 8px; font: 600 14px sans-serif; color: #555; }
  .att-page { display: block; width: 100%; height: auto; border-bottom: 1px solid #ddd; }
  .att-error { padding: 16px 24px; font: 14px sans-serif; color: #c0392b; }
</style>
<div id="attached"></div>
<script src="${PDFJS}/pdf.min.js"></script>
<script>
(function () {
  var box = document.getElementById('attached');
  var note = function (text, cls) {
    var d = document.createElement('div'); d.className = cls; d.textContent = text; box.appendChild(d);
  };
  var files = ${list};
  if (!window.pdfjsLib) { note('Attached PDFs could not be shown — check the internet', 'att-error'); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
  files.reduce(function (done, f) {
    return done.then(function () {
      note(f.name, 'att-head');
      return pdfjsLib.getDocument(f.url).promise.then(function (doc) {
        var pages = Promise.resolve();
        for (var i = 1; i <= doc.numPages; i++) (function (n) {
          pages = pages.then(function () {
            return doc.getPage(n).then(function (page) {
              // A little over the sheet's width, so text stays sharp when zoomed.
              var vp = page.getViewport({ scale: 1.25 * ${PAGE_PX} / page.getViewport({ scale: 1 }).width });
              var c = document.createElement('canvas');
              c.width = vp.width; c.height = vp.height; c.className = 'att-page';
              box.appendChild(c);
              return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            });
          });
        })(i);
        return pages;
      }).catch(function () { note('Could not show ' + f.name, 'att-error'); });
    });
  }, Promise.resolve());
})();
</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${part}</body>`) : html + part;
}

/** The bill as an A4 page, fitted to the space it is given. */
export function BillPage({ bill, settings }: { bill: Bill; settings: BillSettings }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const pdfs = bill.pdfs ?? [];
    Promise.all([buildBillHtml(bill, settings), signBillImages(pdfs.map((p) => p.path))])
      .then(([h, urls]) => {
        const files = pdfs.filter((p) => urls[p.path]).map((p) => ({ name: p.name, url: urls[p.path] }));
        if (active) setHtml(asPreviewPage(withAttachedPdfs(h, files)));
      })
      .catch((e) => active && setError(e?.message || 'Could not build the preview'));
    return () => {
      active = false;
    };
  }, [bill, settings]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!html) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={T.charcoal} />
        <Text style={styles.loadingText}>Preparing preview…</Text>
      </View>
    );
  }
  return <BillPreviewFrame html={html} />;
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
  const entrance = useSheetEntrance('sheet');

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={[styles.container, { paddingTop: insets.top }, entrance]}>
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
          <BillPage bill={bill} settings={settings} />
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
