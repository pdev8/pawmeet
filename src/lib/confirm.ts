import { Alert } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

/** A destructive confirm dialog (Cancel + a red confirm). Centralized so the
 * button wiring — including running onCancel — is consistent everywhere. */
export function confirmDestructive({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
