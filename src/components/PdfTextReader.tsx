// ============================================================================
// VEBOSSO EMS — Reading the text out of a PDF (bank statements)
// PDF.js (Mozilla) does the reading, password-protected files included. On
// the web it runs in the page; on a phone, in a small hidden WebView. Either
// way the file and its password stay on the device — PDF.js itself is loaded
// from the cdnjs CDN, so it needs a connection the first time.
//
//   const pdf = usePdfReader();
//   …{pdf.node}…                       // mount it (renders nothing on the web)
//   const pages = await pdf.read(file, password);
// ============================================================================

import { useCallback, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import type { PdfReader, PickedFile } from '../lib/accountsFile';
import { PasswordNeededError } from '../lib/officeCrypto';
import type { PdfItem } from '../lib/statementPdf';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/**
 * Runs where PDF.js is loaded. With pdf.worker.min.js included as a plain
 * script, PDF.js works in the page itself — no separate worker needed.
 */
const READ_FN = `
window.__readPdf = async function (data, password) {
  try {
    const doc = await pdfjsLib.getDocument({ data: data, password: password || undefined, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      pages.push(tc.items.filter(function (i) { return typeof i.str === 'string'; }).map(function (i) {
        return { s: i.str, x: Math.round(i.transform[4] * 10) / 10, y: Math.round(i.transform[5] * 10) / 10 };
      }));
    }
    return { ok: true, pages: pages };
  } catch (e) {
    if (e && e.name === 'PasswordException') return { ok: false, password: e.code === 2 ? 'wrong' : 'needed' };
    return { ok: false, error: String((e && e.message) || e) };
  }
};
`;

type Answer = { ok: true; pages: PdfItem[][] } | { ok: false; password?: 'wrong' | 'needed'; error?: string };

function toPages(a: Answer): PdfItem[][] {
  if (a.ok) return a.pages;
  if (a.password) throw new PasswordNeededError(a.password === 'wrong');
  throw new Error(a.error ? `Could not read the PDF: ${a.error}` : 'Could not read the PDF');
}

// ---- Web --------------------------------------------------------------------

let webReady: Promise<void> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load the PDF reader — check the internet connection'));
    document.head.appendChild(el);
  });
}

function loadOnWeb() {
  webReady ??= (async () => {
    await loadScript(`${PDFJS}/pdf.min.js`);
    await loadScript(`${PDFJS}/pdf.worker.min.js`);
    // eslint-disable-next-line no-new-func
    new Function(READ_FN)();
  })().catch((e) => {
    webReady = null;
    throw e;
  });
  return webReady;
}

// ---- Phone (hidden WebView) ---------------------------------------------------

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script src="${PDFJS}/pdf.min.js"></script>
<script src="${PDFJS}/pdf.worker.min.js"></script>
<script>
${READ_FN}
window.__run = async function (id, b64, password) {
  let answer;
  try {
    const bin = atob(b64);
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    answer = await window.__readPdf(data, password);
  } catch (e) {
    answer = { ok: false, error: String((e && e.message) || e) };
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, answer: answer }));
};
window.ReactNativeWebView.postMessage(JSON.stringify({ ready: typeof pdfjsLib !== 'undefined' }));
</script></body></html>`;

export function usePdfReader(): { node: React.ReactNode; read: PdfReader } {
  const web = Platform.OS === 'web';
  const view = useRef<WebView>(null);
  const ready = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(null);
  const waiting = useRef(new Map<number, (a: Answer) => void>());
  const nextId = useRef(1);

  if (!ready.current) {
    let resolve: (ok: boolean) => void = () => {};
    const promise = new Promise<boolean>((r) => (resolve = r));
    ready.current = { promise, resolve };
  }

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if ('ready' in msg) return ready.current?.resolve(!!msg.ready);
      const done = waiting.current.get(msg.id);
      waiting.current.delete(msg.id);
      done?.(msg.answer);
    } catch {
      // not ours
    }
  }, []);

  const read = useCallback<PdfReader>(
    async (file: PickedFile, password?: string) => {
      if (web) {
        await loadOnWeb();
        return toPages(await (window as any).__readPdf(file.bytes.slice(), password));
      }
      const loaded = await Promise.race([
        ready.current!.promise,
        new Promise<boolean>((r) => setTimeout(() => r(false), 20000)),
      ]);
      if (!loaded) throw new Error('Could not load the PDF reader — check the internet connection');
      const id = nextId.current++;
      const answer = await new Promise<Answer>((resolve) => {
        waiting.current.set(id, resolve);
        view.current?.injectJavaScript(
          `window.__run(${id}, ${JSON.stringify(file.base64)}, ${JSON.stringify(password ?? '')}); true;`,
        );
      });
      return toPages(answer);
    },
    [web],
  );

  const node = useMemo(
    () =>
      web ? null : (
        <View style={styles.hidden} pointerEvents="none">
          <WebView
            ref={view}
            originWhitelist={['*']}
            source={{ html: HTML, baseUrl: 'https://localhost/' }}
            onMessage={onMessage}
            javaScriptEnabled
            onError={() => ready.current?.resolve(false)}
          />
        </View>
      ),
    [web, onMessage],
  );

  return { node, read };
}

const styles = StyleSheet.create({
  // Has to be laid out to run, but nobody should see it.
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', left: -10, top: -10 },
});
