package expo.modules.billalarm

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Event alarms for bills (owners' phones): the app hands over the full list
 * of alarms this phone should have; they ring like a clock alarm.
 */
class BillAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BillAlarm")

    /** Replace this phone's event alarms. Each: { key, at (ms), title, body, billId }. Returns how many are set. */
    Function("replaceAll") { alarms: List<Map<String, Any?>> ->
      val ctx = appContext.reactContext ?: return@Function 0
      val list = alarms.mapNotNull { m ->
        val key = m["key"] as? String ?: return@mapNotNull null
        val at = (m["at"] as? Number)?.toLong() ?: return@mapNotNull null
        Alarm(
          key = key,
          at = at,
          title = m["title"] as? String ?: "Event",
          body = m["body"] as? String ?: "",
          billId = m["billId"] as? String,
        )
      }
      AlarmScheduler.replaceAll(ctx, list)
    }

    /** What the phone allows, and what is set. */
    Function("status") {
      val ctx = appContext.reactContext ?: return@Function null
      val upcoming = AlarmStore.load(ctx).filter { !it.key.startsWith("test") && it.at > System.currentTimeMillis() }
      mapOf(
        "exactAlarms" to AlarmScheduler.canScheduleExact(ctx),
        "fullScreen" to AlarmNotifier.canUseFullScreen(ctx),
        "notifications" to AlarmNotifier.notificationsEnabled(ctx),
        "scheduled" to upcoming.size,
        "next" to upcoming.minOfOrNull { it.at }?.toDouble(),
      )
    }

    /** A test alarm in `seconds`. */
    Function("test") { seconds: Int ->
      val ctx = appContext.reactContext ?: return@Function false
      AlarmScheduler.add(
        ctx,
        Alarm(
          key = "test",
          at = System.currentTimeMillis() + seconds * 1000L,
          title = "Test alarm",
          body = "This is how event alarms ring. Tap Stop.",
          billId = null,
        ),
      )
    }

    /** Open the phone's settings page for one permission: "exactAlarms", "fullScreen" or "notifications". */
    Function("openSettings") { which: String ->
      val ctx = appContext.reactContext ?: return@Function false
      val pkg = Uri.parse("package:${ctx.packageName}")
      val intent = when {
        which == "exactAlarms" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg)
        which == "fullScreen" && Build.VERSION.SDK_INT >= 34 ->
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg)
        which == "notifications" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
      }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        (appContext.currentActivity ?: ctx).startActivity(intent)
        true
      } catch (e: Exception) {
        ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        false
      }
    }
  }
}
