// ============================================================================
// VEBOSSO EMS — Location map
// ============================================================================
// Leaflet on OpenStreetMap tiles inside a WebView: no Google Cloud project, no
// API key, no native map dependency. The HTML is built once and later updates
// are injected as JS, so panning is not lost every time a live fix arrives.
// ============================================================================

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { AppTheme as T } from '../constants/theme';

export interface MapMarker {
  lat: number;
  lng: number;
  /** Short text inside the pin — a stop number, or empty for a plain dot. */
  label?: string;
  /** Shown on tap. */
  title?: string;
  color?: string;
  kind?: 'stop' | 'live' | 'start' | 'end';
}

interface LocationMapProps {
  /**
   * Contiguous tracked stretches. Each inner array draws as one solid line;
   * a gap between two segments is drawn as a thin dashed connector instead of
   * a solid one, so a tracking interruption never reads as a journey that
   * was never actually recorded.
   */
  segments?: { lat: number; lng: number }[][];
  markers?: MapMarker[];
  height?: number;
  /** Path colour; defaults to the app blue. */
  pathColor?: string;
  /** Shown instead of the map when there is nothing to draw. */
  emptyLabel?: string;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap';

function buildHtml(pathColor: string): string {
  // Leaflet is pulled from a CDN: bundling it would mean shipping a copy of the
  // library in the JS bundle for a screen most users open rarely.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #eef1f6; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%;
    color: #fff; font: 700 12px/1 -apple-system, Roboto, sans-serif;
    border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35);
  }
  .pin-live { animation: pulse 1.8s ease-out infinite; }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.45); }
    100% { box-shadow: 0 0 0 16px rgba(37,99,235,0); }
  }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer('${TILE_URL}', { maxZoom: 19, attribution: '${ATTRIBUTION}' }).addTo(map);
  map.setView([20.5937, 78.9629], 4);

  var layer = L.layerGroup().addTo(map);
  var hasFitted = false;

  function pin(marker) {
    var color = marker.color || '${pathColor}';
    var cls = 'pin' + (marker.kind === 'live' ? ' pin-live' : '');
    return L.divIcon({
      className: '',
      html: '<div class="' + cls + '" style="background:' + color + '">' + (marker.label || '') + '</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function render(data) {
    layer.clearLayers();
    var bounds = [];
    var segments = data.segments || [];

    segments.forEach(function (seg) {
      if (seg.length < 2) {
        if (seg.length === 1) bounds.push([seg[0].lat, seg[0].lng]);
        return;
      }
      var latlngs = seg.map(function (p) { return [p.lat, p.lng]; });
      L.polyline(latlngs, { color: '${pathColor}', weight: 4, opacity: 0.75, lineJoin: 'round' }).addTo(layer);
      bounds = bounds.concat(latlngs);
    });

    // A dashed, muted line across each gap — visible enough to show something
    // happened there, deliberately unlike the solid tracked line so it never
    // reads as a real, recorded journey.
    for (var i = 1; i < segments.length; i++) {
      var prevSeg = segments[i - 1], currSeg = segments[i];
      if (!prevSeg.length || !currSeg.length) continue;
      var a = prevSeg[prevSeg.length - 1], b = currSeg[0];
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: '#9CA3AF', weight: 3, opacity: 0.7, dashArray: '2, 8'
      }).addTo(layer);
    }

    (data.markers || []).forEach(function (m) {
      var marker = L.marker([m.lat, m.lng], { icon: pin(m) }).addTo(layer);
      if (m.title) marker.bindPopup(m.title);
      bounds.push([m.lat, m.lng]);
    });

    if (bounds.length > 0 && !hasFitted) {
      // Only the first render moves the camera; re-fitting on every live update
      // would yank the map away from whatever the viewer is looking at.
      if (bounds.length === 1) {
        map.setView(bounds[0], 16);
      } else {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
      }
      hasFitted = true;
    }
  }

  window.renderTrail = function (json) {
    try { render(JSON.parse(json)); } catch (e) {}
  };

  // Re-fit on demand, e.g. after the viewer switches to another day.
  window.resetView = function () { hasFitted = false; };

  document.addEventListener('message', function (e) { window.renderTrail(e.data); });
  window.addEventListener('message', function (e) { window.renderTrail(e.data); });
</script>
</body>
</html>`;
}

export function LocationMap({
  segments = [],
  markers = [],
  height = 240,
  pathColor = T.blue,
  emptyLabel = 'No location recorded',
}: LocationMapProps) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildHtml(pathColor), [pathColor]);
  const payload = useMemo(() => JSON.stringify({ segments, markers }), [segments, markers]);

  const isEmpty = segments.every((s) => s.length === 0) && markers.length === 0;

  // A change of day should re-frame the map; a live fix on the same day should
  // not. Keying the reset on the payload's first point tells them apart without
  // threading a "day" prop through every caller.
  const firstPoint = segments.find((s) => s.length > 0)?.[0];
  const firstKey = firstPoint
    ? `${firstPoint.lat},${firstPoint.lng}`
    : markers[0]
      ? `${markers[0].lat},${markers[0].lng}`
      : 'empty';
  const lastFirstKey = useRef(firstKey);

  const render = useMemo(
    () => `window.renderTrail && window.renderTrail(${JSON.stringify(payload)}); true;`,
    [payload]
  );

  useEffect(() => {
    const reset = firstKey !== lastFirstKey.current;
    lastFirstKey.current = firstKey;
    webRef.current?.injectJavaScript(
      `${reset ? 'window.resetView && window.resetView();' : ''}${render}`
    );
  }, [render, firstKey]);

  if (isEmpty) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  // react-native-webview has no web implementation; the owner console on the
  // web build gets the stop list instead of a map.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Maps are available in the mobile app.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        injectedJavaScript={render}
        onLoadEnd={() => webRef.current?.injectJavaScript(render)}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        // The map handles its own gestures; letting the parent ScrollView steal
        // the drag makes panning impossible.
        nestedScrollEnabled
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: T.soft,
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  empty: {
    borderRadius: 18,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
    textAlign: 'center',
  },
});
