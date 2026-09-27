package expo.modules.whatsappshare

import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sends a file straight into one WhatsApp chat: a single ACTION_SEND aimed at
 * the WhatsApp app, with the file and the chat's number ("jid"). WhatsApp
 * opens that chat with the file ready to send.
 */
class WhatsappShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WhatsappShare")

    Function("isInstalled") { packageName: String ->
      val context = appContext.reactContext ?: return@Function false
      try {
        context.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    AsyncFunction("sendFile") { packageName: String, phone: String, contentUri: String, mimeType: String, text: String? ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val uri = Uri.parse(contentUri)
      val intent = Intent(Intent.ACTION_SEND).apply {
        setPackage(packageName)
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        if (!text.isNullOrEmpty()) putExtra(Intent.EXTRA_TEXT, text)
        putExtra("jid", "$phone@s.whatsapp.net")
        // So WhatsApp may read the file from our FileProvider.
        clipData = ClipData.newRawUri("", uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(intent)
    }
  }
}
