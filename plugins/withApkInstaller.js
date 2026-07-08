const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Ensures Android can prompt the user to install APK updates from within the app.
 */
function withApkInstaller(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Permissions.ensurePermissions(config.modResults, [
      'android.permission.REQUEST_INSTALL_PACKAGES',
    ]);
    return config;
  });
}

module.exports = withApkInstaller;
