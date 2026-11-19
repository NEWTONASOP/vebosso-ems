package expo.modules.billalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/** One alarm: when it rings and what it says. `key` is unique ("<bill id>:<days before>"). */
data class Alarm(
  val key: String,
  val at: Long,
  val title: String,
  val body: String,
  val billId: String?,
) {
  /** Request code / notification id for this alarm. */
  val code: Int get() = key.hashCode()

  fun toJson(): JSONObject =
    JSONObject()
      .put("key", key)
      .put("at", at)
      .put("title", title)
      .put("body", body)
      .put("billId", billId ?: JSONObject.NULL)

  companion object {
    fun fromJson(o: JSONObject) = Alarm(
      key = o.getString("key"),
      at = o.getLong("at"),
      title = o.optString("title", "Event"),
      body = o.optString("body", ""),
      billId = if (o.isNull("billId")) null else o.optString("billId"),
    )
  }
}

/** The alarms set on this phone, kept so they can be set again after a restart. */
object AlarmStore {
  private const val PREFS = "vebosso_bill_alarms"
  private const val KEY = "alarms"

  fun load(ctx: Context): List<Alarm> {
    val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { Alarm.fromJson(arr.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun save(ctx: Context, list: List<Alarm>) {
    val arr = JSONArray()
    list.forEach { arr.put(it.toJson()) }
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
  }

  fun remove(ctx: Context, key: String) = save(ctx, load(ctx).filter { it.key != key })
}

/**
 * Sets alarms with AlarmManager.setAlarmClock — the call clock apps use: it
 * goes off at the exact minute even in battery saving, and shows the alarm
 * icon in the status bar.
 */
object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.billalarm.FIRE"
  const val EXTRA_KEY = "key"

  private fun fireIntent(ctx: Context, a: Alarm): PendingIntent {
    val intent = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      // Keeps every alarm's PendingIntent separate.
      data = Uri.parse("vebosso-alarm://${Uri.encode(a.key)}")
      putExtra(EXTRA_KEY, a.key)
    }
    return PendingIntent.getBroadcast(ctx, a.code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun manager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canScheduleExact(ctx: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) manager(ctx).canScheduleExactAlarms() else true

  private fun schedule(ctx: Context, a: Alarm): Boolean {
    // Tapping the alarm icon in the status bar opens the app.
    val show = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
      PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    return try {
      manager(ctx).setAlarmClock(AlarmManager.AlarmClockInfo(a.at, show), fireIntent(ctx, a))
      true
    } catch (e: SecurityException) {
      // Exact alarms not allowed: kept in the store, set once they are.
      false
    }
  }

  private fun cancel(ctx: Context, a: Alarm) = manager(ctx).cancel(fireIntent(ctx, a))

  /**
   * Replace this phone's event alarms with `list` (past ones dropped). A test
   * alarm, if one is waiting, is kept. Returns how many are set.
   */
  fun replaceAll(ctx: Context, list: List<Alarm>): Int {
    val old = AlarmStore.load(ctx)
    old.filter { !it.key.startsWith("test") }.forEach { cancel(ctx, it) }
    val now = System.currentTimeMillis()
    val keep = old.filter { it.key.startsWith("test") && it.at > now }
    val future = list.filter { it.at > now }.distinctBy { it.key }
    AlarmStore.save(ctx, keep + future)
    return future.count { schedule(ctx, it) }
  }

  /** One extra alarm (the test one), without touching the others. */
  fun add(ctx: Context, a: Alarm): Boolean {
    AlarmStore.save(ctx, AlarmStore.load(ctx).filter { it.key != a.key } + a)
    return schedule(ctx, a)
  }

  /** After a restart / update / time change: set everything still ahead again. */
  fun restoreAll(ctx: Context) {
    val now = System.currentTimeMillis()
    val future = AlarmStore.load(ctx).filter { it.at > now }
    AlarmStore.save(ctx, future)
    future.forEach { schedule(ctx, it) }
  }
}
