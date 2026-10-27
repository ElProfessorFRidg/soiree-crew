import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { refreshConversations } from "@/chat/engine";
import { useT } from "@/i18n";
import { api } from "@/server/api";
import { fetchFriends, type FriendsList } from "@/server/profileData";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Row } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/** MSG-01: a direct chat starts with a friend; someone new becomes one once their request is accepted (COM-05). */
export default function NewDirectScreen() {
  const i18n = useT();
  const [list, setList] = useState<FriendsList | null>(null);
  useFocusEffect(
    useCallback(() => {
      void fetchFriends()
        .then(setList)
        .catch(() => setList({ muted: [], friends: [], incoming: [], outgoing: [], blocked: [] }));
    }, []),
  );
  const open = async (userId: string) => {
    try {
      const { id } = await api<{ id: string }>("/v1/conversations/direct", { method: "POST", body: { userId } });
      await refreshConversations().catch(() => undefined);
      router.replace({ pathname: "/chat/[id]", params: { id } });
    } catch {
      showToast({ tone: "danger", message: i18n.t("chat.cannotOpen") });
    }
  };
  return (
    <Screen back title={i18n.t("chat.newDirect")} withToasts>
      {!list ? <SkeletonRows /> : null}
      {list && !list.friends.length ? (
        <>
          <Text>{i18n.t("chat.noFriends")}</Text>
          <Button label={i18n.t("chat.findFriends")} variant="secondary" height={48} onPress={() => router.push("/friends")} />
        </>
      ) : null}
      <View>
        {list?.friends.map((f, index) => (
          <Row
            key={f.userId}
            title={f.name}
            leading={<Avatar personId={f.userId} name={f.name} />}
            onPress={() => void open(f.userId)}
            last={index === list.friends.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}
