// ============================================================================
// VEBOSSO EMS — Cross-Platform Alert Polyfill (Mobile & Web)
// ============================================================================
import { Alert as RNAlert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
}

export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ) => {
    if (Platform.OS === 'web') {
      const formattedMessage = message ? `${title}\n\n${message}` : title;

      if (buttons && buttons.length > 0) {
        // Single button alert (typically "OK")
        if (buttons.length === 1) {
          window.alert(formattedMessage);
          buttons[0].onPress?.();
          return;
        }

        // Multiple buttons (cancel / action)
        const choice = window.confirm(formattedMessage);
        if (choice) {
          // Call the action button (first button that is not style: 'cancel')
          const confirmBtn = buttons.find((btn) => btn.style !== 'cancel') || buttons[0];
          confirmBtn.onPress?.();
        } else {
          // Call the cancel button (if present)
          const cancelBtn = buttons.find((btn) => btn.style === 'cancel');
          cancelBtn?.onPress?.();
        }
      } else {
        // Standard alert
        window.alert(formattedMessage);
      }
    } else {
      RNAlert.alert(title, message, buttons, options);
    }
  },
};
