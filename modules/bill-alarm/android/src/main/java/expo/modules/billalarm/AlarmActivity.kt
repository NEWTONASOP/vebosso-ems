package expo.modules.billalarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The alarm page: over the lock screen, screen on. The sound comes from the
 * alarm's notification; Stop (or back) takes it away. "Open bill" opens the
 * bill in the app.
 */
class AlarmActivity : Activity() {
  private var notificationId = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    show(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    show(intent)
  }

  private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  private fun show(intent: Intent) {
    notificationId = intent.getIntExtra(AlarmNotifier.EXTRA_NOTIFICATION, 0)
    val title = intent.getStringExtra(AlarmNotifier.EXTRA_TITLE) ?: "Event"
    val body = intent.getStringExtra(AlarmNotifier.EXTRA_BODY) ?: ""
    val billId = intent.getStringExtra(AlarmNotifier.EXTRA_BILL)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#1B1E24"))
      setPadding(dp(28), dp(48), dp(28), dp(48))
    }

    fun text(value: String, size: Float, color: String, bold: Boolean, topMargin: Int) =
      TextView(this).apply {
        this.text = value
        textSize = size
        setTextColor(Color.parseColor(color))
        gravity = Gravity.CENTER
        if (bold) typeface = Typeface.DEFAULT_BOLD
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { this.topMargin = topMargin }
      }

    root.addView(text("⏰", 56f, "#FFFFFF", false, 0))
    root.addView(text(title, 30f, "#FFFFFF", true, dp(16)))
    if (body.isNotEmpty()) root.addView(text(body, 18f, "#C9CCD3", false, dp(12)))

    fun button(label: String, filled: Boolean, onTap: () -> Unit) =
      Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 18f
        setTextColor(Color.parseColor(if (filled) "#1B1E24" else "#FFFFFF"))
        background = GradientDrawable().apply {
          cornerRadius = dp(28).toFloat()
          if (filled) setColor(Color.WHITE) else {
            setColor(Color.TRANSPARENT)
            setStroke(dp(2), Color.parseColor("#5B606B"))
          }
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply {
          topMargin = dp(14)
        }
        setOnClickListener { onTap() }
      }

    val spacer = android.view.View(this).apply {
      layoutParams = LinearLayout.LayoutParams(1, dp(36))
    }
    root.addView(spacer)
    root.addView(button("Stop", true) { stopAndClose() })
    if (!billId.isNullOrEmpty()) {
      root.addView(button("Open bill", false) {
        stopRinging()
        try {
          startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse("vebossoems://bills/$billId"))
              .setPackage(packageName)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
          )
        } catch (e: Exception) {
          packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
        }
        finish()
      })
    }
    setContentView(root)
  }

  private fun stopRinging() {
    if (notificationId != 0) AlarmNotifier.stop(this, notificationId)
  }

  private fun stopAndClose() {
    stopRinging()
    finish()
  }

  @Deprecated("Back stops the alarm too")
  override fun onBackPressed() {
    stopAndClose()
  }
}
