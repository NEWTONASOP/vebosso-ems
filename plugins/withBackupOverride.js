const { withAndroidManifest } = require('expo/config-plugins');

/**
 * The app turns Android backup off (android.allowBackup = false in app.json), but
 * some libraries it pulls in (e.g. TAndroidLame, used by the video compressor)
 * say allowBackup="true" in their own manifests. Android's manifest merger fails
 * the build on that clash unless the app says its value wins — this does.
 */
function withBackupOverride(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ ?? {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = manifest.application?.[0];
    if (app) {
      app.$ = app.$ ?? {};
      const replace = new Set(
        String(app.$['tools:replace'] ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      replace.add('android:allowBackup');
      app.$['tools:replace'] = [...replace].join(',');
    }
    return config;
  });
}

module.exports = withBackupOverride;
