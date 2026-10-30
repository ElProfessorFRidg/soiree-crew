import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { IconButton } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useInbox } from "./inbox";

/** N-35: the bell on the Party header and the Me tab, with the unread count. Hidden without a server. */
export function NotificationBell() {
  const i18n = useT();
  const theme = useTheme();
  const unread = useInbox((state) => state.unread);
  const signedIn = useSession((state) => state.session !== null);
  if (!signedIn) return null;
  return (
    <View>
      <IconButton
        icon="bell"
        accessibilityLabel={unread > 0 ? i18n.plural("notify.bellUnread", unread) : i18n.t("notify.bell")}
        onPress={() => router.push("/notifications")}
      />
      {unread > 0 ? (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: theme.amber, borderColor: theme.bg }]}>
          <Text variant="tag" color={theme.onAccent}>
            {unread > 99 ? "99+" : i18n.number(unread)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
