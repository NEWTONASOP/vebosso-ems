// ============================================================================
// VEBOSSO EMS — Bill preview frame (web)
// Same HTML as the native WebView, hosted in an <iframe srcdoc>.
// ============================================================================

export function BillPreviewFrame({ html }: { html: string }) {
  return (
    <iframe
      title="Bill preview"
      srcDoc={html}
      style={{ flex: 1, width: '100%', height: '100%', border: 0, background: 'transparent' }}
    />
  );
}
