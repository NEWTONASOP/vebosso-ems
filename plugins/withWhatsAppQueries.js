const { withAndroidManifest } = require('expo/config-plugins');

const PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

/**
 * Lets the app see whether WhatsApp / WhatsApp Business is installed
 * (Android 11+ hides other apps unless they're listed under <queries>).
 * Used to send bill PDFs straight to the client's chat.
 */
function withWhatsAppQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package ?? [];
    for (const name of PACKAGES) {
      if (!queries.package.some((p) => p.$?.['android:name'] === name)) {
        queries.package.push({ $: { 'android:name': name } });
      }
    }
    return config;
  });
}

module.exports = withWhatsAppQueries;
