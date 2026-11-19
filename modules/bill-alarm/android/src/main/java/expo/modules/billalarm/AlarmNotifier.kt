package expo.modules.billalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * The ringing: a notification on the alarm sound, repeating (FLAG_INSISTENT)
 * until it is stopped or a minute has passed, with the alarm page as its
 * full-screen intent — shown over the lock screen, or as a big banner when the
 * phone is in use. A quiet notification with the same details stays behind
 * either way, so a missed alarm can still be seen; tapping it opens the bill.
 */
object AlarmNotifier {
  const val CHANNEL = "bill_event_alarms"
  /** The quiet one that stays after the ringing. */
  const val QUIET_CHANNEL = "bill_event_reminders"
  /** How long one alarm rings when nobody stops it. */
  const val RING_MS = 60_000L
  const val EXTRA_TITLE = "title"
  const val EXTRA_BODY = "body"
  const val EXTRA_BILL = "billId"
  const val EXTRA_NOTIFICATION = "notificationId"

  private val VIBRATION = longArrayOf(0, 800, 600, 800)

  fun alarmSound(): Uri =
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      ?: Settings.System.DEFAULT_NOTIFICATION_URI

  private fun manager(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun notificationsEnabled(ctx: Context): Boolean = manager(ctx).areNotificationsEnabled()

  fun canUseFullScreen(ctx: Context): Boolean =
    if (Build.VERSION.SDK_INT >= 34) manager(ctx).canUseFullScreenIntent() else true

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = manager(ctx)
    if (nm.getNotificationChannel(CHANNEL) != null && nm.getNotificationChannel(QUIET_CHANNEL) != null) return
    val channel = NotificationChannel(CHANNEL, "Event alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Rings 2 days and 1 day before a client's event"
      setSound(
        alarmSound(),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableVibration(true)
      vibrationPattern = VIBRATION
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
    nm.createNotificationChannel(
      NotificationChannel(QUIET_CHANNEL, "Event reminders", NotificationManager.IMPORTANCE_LOW).apply {
        description = "What an event alarm was about, after it stops ringing"
        setSound(null, null)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
  }

  private fun smallIcon(ctx: Context): Int {
    val own = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (own != 0) own else ctx.applicationInfo.icon
  }

  /** Opens the bill in the app (or just the app). */
  private fun openBillIntent(ctx: Context, a: Alarm): PendingIntent? {
    val intent =
      if (a.billId != null) {
        Intent(Intent.ACTION_VIEW, Uri.parse("vebossoems://bills/${a.billId}")).setPackage(ctx.packageName)
      } else {
        ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      } ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(ctx, a.code + 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** The quiet notification that stays: same title and details, no sound. */
  private fun postQuiet(ctx: Context, a: Alarm) {
    @Suppress("DEPRECATION")
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, QUIET_CHANNEL)
      else Notification.Builder(ctx).setPriority(Notification.PRIORITY_LOW)
    builder
      .setSmallIcon(smallIcon(ctx))
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setStyle(Notification.BigTextStyle().bigText(a.body))
      .setCategory(Notification.CATEGORY_REMINDER)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setShowWhen(true)
    openBillIntent(ctx, a)?.let { builder.setContentIntent(it) }
    manager(ctx).notify(a.code + 1, builder.build())
  }

  fun ring(ctx: Context, a: Alarm) {
    ensureChannel(ctx)
    postQuiet(ctx, a)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    val page = Intent(ctx, AlarmActivity::class.java).apply {
      putExtra(EXTRA_TITLE, a.title)
      putExtra(EXTRA_BODY, a.body)
      putExtra(EXTRA_BILL, a.billId)
      putExtra(EXTRA_NOTIFICATION, a.code)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
    }
    val pageIntent = PendingIntent.getActivity(ctx, a.code, page, flags)
    val stopIntent = PendingIntent.getBroadcast(
      ctx,
      a.code,
      Intent(ctx, StopReceiver::class.java).putExtra(EXTRA_NOTIFICATION, a.code),
      flags,
    )

    @Suppress("DEPRECATION")
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(ctx, CHANNEL)
      } else {
        Notification.Builder(ctx)
          .setPriority(Notification.PRIORITY_MAX)
          .setSound(alarmSound(), AudioManager.STREAM_ALARM)
          .setVibrate(VIBRATION)
      }
    builder
      .setSmallIcon(smallIcon(ctx))
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setStyle(Notification.BigTextStyle().bigText(a.body))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setFullScreenIntent(pageIntent, true)
      .setContentIntent(pageIntent)
      .setOngoing(true)
      .setAutoCancel(false)
    // Stops ringing by itself after a minute (Android 8+; older phones ring until Stop).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setTimeoutAfter(RING_MS)
    builder
      .addAction(Notification.Action.Builder(null as Icon?, "Stop", stopIntent).build())

    val notification = builder.build()
    // Keep sounding until it is stopped (or the minute above is up).
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    manager(ctx).notify(a.code, notification)
  }

  fun stop(ctx: Context, notificationId: Int) = manager(ctx).cancel(notificationId)
}

/** An alarm's time has come: ring it, and forget it (it rings once). */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val key = intent.getStringExtra(AlarmScheduler.EXTRA_KEY) ?: return
    val alarm = AlarmStore.load(ctx).firstOrNull { it.key == key } ?: return
    AlarmStore.remove(ctx, key)
    AlarmNotifier.ring(ctx, alarm)
  }
}

/** "Stop" on the notification. */
class StopReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getIntExtra(AlarmNotifier.EXTRA_NOTIFICATION, 0)
    if (id != 0) AlarmNotifier.stop(ctx, id)
  }
}

/** Restart, app update, clock or time-zone change, or exact alarms just allowed: set them again. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    AlarmScheduler.restoreAll(ctx)
  }
}
