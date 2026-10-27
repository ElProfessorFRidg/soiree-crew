import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { befriend, fetchFriends, unblock, unmute, type FriendsList } from "@/server/profileData";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** O-39: friends, requests to answer, and people I blocked. */
export default function FriendsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const [list, setList] = useState<FriendsList | null>(null);
  const offline = () => showToast({ tone: "danger", message: i18n.t("crew.offline") });
  const load = useCallback(() => {
    void fetchFriends().then(setList).catch(() => undefined);
  }, []);
  useFocusEffect(load);

  const open = (userId: string) => router.push({ pathname: "/profile", params: { id: userId } });
  const section = (title: string, people: { userId: string; name: string }[], trailing: (userId: string) => React.ReactNode) =>
    people.length ? (
      <>
        <Text variant="label">{title}</Text>
        <View>
          {people.map((p, index) => (
            <Row
              key={p.userId}
              title={p.name}
              leading={<Avatar personId={p.userId} name={p.name} size={36} />}
              trailing={trailing(p.userId)}
              onPress={() => open(p.userId)}
              last={index === people.length - 1}
            />
          ))}
        </View>
      </>
    ) : null;

  return (
    <Screen back title={i18n.t("people.myFriends")} withToasts>
      {list && !list.friends.length && !list.incoming.length ? <Text>{i18n.t("people.noFriends")}</Text> : null}
      {section(i18n.t("people.incoming"), list?.incoming ?? [], (userId) => (
        <Button
          label={i18n.t("people.accept")}
          variant="secondary"
          height={36}
          onPress={() => {
            haptic.confirmed();
            void befriend(userId).then(load).catch(offline);
          }}
        />
      ))}
      {section(i18n.t("people.friends"), list?.friends ?? [], () => <Icon name="chev" color={theme.textMuted} />)}
      {section(i18n.t("people.outgoing"), list?.outgoing ?? [], () => <Text variant="small">{i18n.t("people.requested")}</Text>)}
      {section(i18n.t("people.mutedList"), list?.muted ?? [], (userId) => (
        <Button label={i18n.t("people.unmute")} variant="outline" height={36} onPress={() => void unmute(userId).then(load).catch(offline)} />
      ))}
      {section(i18n.t("people.blockedList"), list?.blocked ?? [], (userId) => (
        <Button label={i18n.t("people.unblock")} variant="outline" height={36} onPress={() => void unblock(userId).then(load).catch(offline)} />
      ))}
    </Screen>
  );
}
