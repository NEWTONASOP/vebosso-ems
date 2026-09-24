// ============================================================================
// VEBOSSO EMS — Bill preview frame (native)
// Renders the bill's HTML in a WebView. Metro picks BillPreviewFrame.web.tsx
// on web, where react-native-webview isn't available.
// ============================================================================

import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export function BillPreviewFrame({ html }: { html: string }) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={styles.web}
      // Let the owner pinch in to read the fine print.
      scalesPageToFit
      setBuiltInZoomControls
      setDisplayZoomControls={false}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
