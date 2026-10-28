import { Alert, Platform } from "react-native";

interface ConfirmSpec {
  title: string;
  body?: string;
  /** Names the action, never "OK" (QOL-13). */
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

/**
 * QOL-13: the one confirmation for destructive actions. react-native-web's Alert does nothing, so
 * the web asks through the browser's own dialog instead.
 */
export function confirmAction({ title, body, confirmLabel, cancelLabel, destructive = true }: ConfirmSpec): Promise<boolean> {
  if (Platform.OS === "web") {
    const ask = (globalThis as { confirm?: (message: string) => boolean }).confirm;
    return Promise.resolve(ask ? ask(body ? `${title}\n\n${body}` : title) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      body,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
