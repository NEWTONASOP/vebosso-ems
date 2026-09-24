// ============================================================================
// VEBOSSO EMS — Location map (WEB)
// ============================================================================
// Metro picks this file over LocationMap.tsx on web builds. Uses a plain
// <iframe srcdoc> to host the same Leaflet HTML that the native version runs
// inside a WebView. postMessage() is the update channel on both platforms,
// so the Leaflet JS side is byte-for-byte identical.
// ============================================================================

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';

// ─── Public types (identical to LocationMap.tsx — kept in sync manually) ─────
// Defining them here rather than importing avoids a circular dependency when
// Metro resolves ./LocationMap on web to this very file.

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  title?: string;
  color?: string;
  kind?: 'stop' | 'live' | 'start' | 'end';
  /** Accuracy radius in metres — drawn as a light circle around the live marker. */
  accuracyM?: number;
}

export interface MapGap {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** Popup text shown when the gap connector is tapped / clicked. */
  label: string;
}

// ─── Leaflet HTML (identical to the native build) ─────────────────────────────
// OpenStreetMap tiles, annotated gap connectors, START/END endpoint markers,
// accuracy ring on the live marker. Paste-duplicated so the web file has zero
// build-time dependency on WebView.

// Standard OpenStreetMap tiles: free, no API key. (CARTO's basemaps now
// stamp "API KEY REQUIRED" on every tile, so they can't be used keyless.)
// OSM's tile policy needs a visible credit and a Referer that identifies the
// app — the browser sends the site's on web; native sets it via baseUrl.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function buildHtml(pathColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-geometryutil@0.10.3/src/leaflet.geometryutil.js"></script>
<script src="https://cdn.jsdelivr.net/npm/leaflet-arrowheads@1.4.0/src/leaflet-arrowheads.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f5f6fa; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 50%;
    color: #fff; font: 700 12px/1 -apple-system, Roboto, sans-serif;
    border: 2.5px solid rgba(255,255,255,0.9);
    box-shadow: 0 2px 8px rgba(0,0,0,0.28), 0 1px 3px rgba(0,0,0,0.18);
  }
  .pin-live { animation: pulse 1.8s ease-out infinite; }
  @keyframes pulse {
    0%   { box-shadow: 0 2px 8px rgba(0,0,0,0.28), 0 0 0 0 rgba(34,197,94,0.5); }
    100% { box-shadow: 0 2px 8px rgba(0,0,0,0.28), 0 0 0 18px rgba(34,197,94,0); }
  }
  .pin-endpoint {
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px; letter-spacing: 0.4px;
    color: #fff; font: 700 10px/1 -apple-system, Roboto, sans-serif;
    border: 2.5px solid rgba(255,255,255,0.9);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .leaflet-control-attribution { font-size: 9px; }
  .leaflet-popup-content-wrapper { border-radius: 10px; font: 13px/1.4 -apple-system, Roboto, sans-serif; }
  .leaflet-popup-content { margin: 10px 14px; }
  .gap-popup-title { font-weight: 700; font-size: 12px; color: #92400e; margin-bottom: 4px; }
  .gap-popup-body { font-size: 11px; color: #555; line-height: 1.5; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer('${TILE_URL}', {
    maxZoom: 19,
    attribution: '${ATTRIBUTION}'
  }).addTo(map);
  map.setView([20.5937, 78.9629], 4);

  var layer = L.layerGroup().addTo(map);
  var hasFitted = false;

  function stopPin(marker) {
    var color = marker.color || '${pathColor}';
    var cls = 'pin' + (marker.kind === 'live' ? ' pin-live' : '');
    return L.divIcon({
      className: '',
      html: '<div class="' + cls + '" style="background:' + color + '">' + (marker.label || '') + '</div>',
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
  }

  // START / END badges. When the two land within a badge-width of each other
  // on screen they sit side by side (START on the left) instead of stacking,
  // re-checked on every zoom — so neither hides the other at any zoom level.
  function endpointPin(label, color, side) {
    var w = label === 'START' ? 50 : 38, h = 26;
    var ax = side === 'left' ? w + 3 : side === 'right' ? -3 : w / 2;
    return L.divIcon({
      className: '',
      html: '<div class="pin-endpoint" style="width:' + w + 'px;height:' + h + 'px;background:' + color + '">' + label + '</div>',
      iconSize: [w, h],
      iconAnchor: [ax, h / 2]
    });
  }

  var startMarker = null, endMarker = null;
  function placeEndpoints() {
    if (!startMarker || !endMarker) {
      if (startMarker) startMarker.setIcon(endpointPin('START', '#16A34A'));
      if (endMarker) endMarker.setIcon(endpointPin('END', '#DC2626'));
      return;
    }
    var a = map.latLngToLayerPoint(startMarker.getLatLng());
    var b = map.latLngToLayerPoint(endMarker.getLatLng());
    var close = a.distanceTo(b) < 60;
    var startOnLeft = a.x <= b.x;
    startMarker.setIcon(endpointPin('START', '#16A34A', close ? (startOnLeft ? 'left' : 'right') : null));
    endMarker.setIcon(endpointPin('END', '#DC2626', close ? (startOnLeft ? 'right' : 'left') : null));
  }
  map.on('zoomend', placeEndpoints);

  function render(data) {
    layer.clearLayers();
    startMarker = null;
    endMarker = null;
    var bounds = [];
    var segments = data.segments || [];
    var gaps = data.gaps || [];

    segments.forEach(function (seg) {
      if (seg.length < 2) { if (seg.length === 1) bounds.push([seg[0].lat, seg[0].lng]); return; }
      var latlngs = seg.map(function (p) { return [p.lat, p.lng]; });
      L.polyline(latlngs, { color: '${pathColor}', weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }).arrowheads({ size: '12px', frequency: '80px', fill: true }).addTo(layer);
      bounds = bounds.concat(latlngs);
    });

    if (gaps.length > 0) {
      gaps.forEach(function (gap) {
        var line = L.polyline(
          [[gap.from.lat, gap.from.lng], [gap.to.lat, gap.to.lng]],
          { color: '#D97706', weight: 2.5, opacity: 0.7, dashArray: '4, 9' }
        ).addTo(layer);
        if (gap.label) {
          line.bindPopup(
            '<div class="gap-popup-title">&#9888; Tracking gap</div>' +
            '<div class="gap-popup-body">' + gap.label + '</div>'
          );
        }
        bounds.push([gap.from.lat, gap.from.lng]);
        bounds.push([gap.to.lat, gap.to.lng]);
      });
    } else {
      for (var i = 1; i < segments.length; i++) {
        var prevSeg = segments[i - 1], currSeg = segments[i];
        if (!prevSeg.length || !currSeg.length) continue;
        var a = prevSeg[prevSeg.length - 1], b = currSeg[0];
        L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#D97706', weight: 2.5, opacity: 0.7, dashArray: '4, 9' }).addTo(layer);
      }
    }

    (data.markers || []).forEach(function (m) {
      if (m.kind === 'start' || m.kind === 'end') return;
      var marker = L.marker([m.lat, m.lng], { icon: stopPin(m), zIndexOffset: 200 }).addTo(layer);
      if (m.title) marker.bindPopup(m.title);
      if (m.kind === 'live' && m.accuracyM && m.accuracyM > 0 && m.accuracyM < 300) {
        L.circle([m.lat, m.lng], { radius: m.accuracyM, color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.08, weight: 1, opacity: 0.35 }).addTo(layer);
      }
      bounds.push([m.lat, m.lng]);
    });

    (data.markers || []).forEach(function (m) {
      if (m.kind === 'start') {
        var sm = L.marker([m.lat, m.lng], { icon: endpointPin('START', '#16A34A'), zIndexOffset: 500 }).addTo(layer);
        if (m.title) sm.bindPopup(m.title);
        startMarker = sm;
        bounds.push([m.lat, m.lng]);
      } else if (m.kind === 'end') {
        var em = L.marker([m.lat, m.lng], { icon: endpointPin('END', '#DC2626'), zIndexOffset: 510 }).addTo(layer);
        if (m.title) em.bindPopup(m.title);
        endMarker = em;
        bounds.push([m.lat, m.lng]);
      }
    });

    if (bounds.length > 0 && !hasFitted) {
      if (bounds.length === 1) { map.setView(bounds[0], 16); }
      else { map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 }); }
      hasFitted = true;
    }
    placeEndpoints();
  }

  window.renderTrail = function (json) { try { render(JSON.parse(json)); } catch (e) {} };
  window.resetView   = function ()     { hasFitted = false; };

  // Receive postMessage from the React host.
  // '__resetView__' is a sentinel sent before a new-day payload to re-frame.
  window.addEventListener('message', function (e) {
    if (typeof e.data !== 'string') return;
    if (e.data === '__resetView__') { window.resetView(); }
    else { window.renderTrail(e.data); }
  });
</script>
</body>
</html>`;
}

// ─── Props (identical interface to LocationMap.tsx) ────────────────────────────

interface LocationMapProps {
  segments?: { lat: number; lng: number }[][];
  gaps?: MapGap[];
  markers?: MapMarker[];
  height?: number;
  pathColor?: string;
  emptyLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationMap({
  segments = [],
  gaps = [],
  markers = [],
  height = 280,
  pathColor = T.blue,
  emptyLabel = 'No location recorded',
}: LocationMapProps) {
  // @ts-ignore — HTMLIFrameElement is only available in web context; native
  // Metro never loads this file so there is no type mismatch at runtime.
  const iframeRef = useRef<any>(null);

  const html    = useMemo(() => buildHtml(pathColor), [pathColor]);
  const payload = useMemo(
    () => JSON.stringify({ segments, gaps, markers }),
    [segments, gaps, markers]
  );

  const isEmpty = segments.every((s) => s.length === 0) && markers.length === 0;

  // Track first point to detect day changes (same logic as native).
  const firstPoint = segments.find((s) => s.length > 0)?.[0];
  const firstKey   = firstPoint ? `${firstPoint.lat},${firstPoint.lng}` : 'empty';
  const lastFirstKey = useRef(firstKey);

  // Push data into the iframe via postMessage whenever the payload changes.
  useEffect(() => {
    const iframe = iframeRef.current as HTMLIFrameElement | null;
    if (!iframe) return;

    const isNewDay = firstKey !== lastFirstKey.current;
    lastFirstKey.current = firstKey;

    const send = () => {
      try {
        if (isNewDay) {
          iframe.contentWindow?.postMessage('__resetView__', '*');
        }
        iframe.contentWindow?.postMessage(payload, '*');
      } catch (_) {}
    };

    // If the document is already loaded, send immediately; otherwise wait.
    const doc = iframe.contentDocument;
    if (doc && doc.readyState === 'complete') {
      send();
    } else {
      iframe.addEventListener('load', send, { once: true });
    }
  }, [payload, firstKey]);

  if (isEmpty) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      {/* @ts-ignore — standard iframe; valid in React DOM / RN Web context */}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Location Map"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: T.soft,
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
