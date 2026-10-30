import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { flyHero, HeroSource } from "@/motion/hero";
import { haptic } from "@/motion/haptics";
import { onLiveHint } from "@/server/liveHints";
import { useConsumePendingReferral } from "@/server/pendingReferral";
import { befriend, fetchFriends, fetchReferral, searchPeople, unblock, unfriend, unmute, type FriendsList, type PersonFound } from "@/server/profileData";
import { Field } from "@/crew/Field";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

/** O-39: friends, requests to answer, and people I blocked. */
export default function FriendsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const [list, setList] = useState<FriendsList | null>(null);
  const offline = showFailure(i18n);
  const load = useCallback(() => {
    void fetchFriends().then(setList).catch(() => undefined);
  }, []);
  useFocusEffect(load);
  // O-43: requests, answers and removals arrive live; a reconnect refetches what was missed.
  useEffect(() => onLiveHint((hint) => (hint === "friends.changed" || hint === "open" ? load() : undefined)), [load]);
  useConsumePendingReferral(i18n);
  const [sharing, setSharing] = useState(false);
  /** O-43: my personal link through the system share sheet. */
  const shareReferral = () => {
    setSharing(true);
    void fetchReferral()
      .then(({ url }) => Share.share({ message: i18n.t("people.referralMessage", { url }) }))
      .catch(offline)
      .finally(() => setSharing(false));
  };

  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PersonFound[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    // Wait for a pause in typing before asking the server.
    const id = setTimeout(() => {
      void searchPeople(q)
        .then((res) => setFound(res.people))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);
  const add = (person: PersonFound) => {
    haptic.confirmed();
    void befriend(person.userId)
      .then((res) => {
        showToast({ message: res.friendship === "friends" ? i18n.t("people.nowFriends", { name: person.name }) : i18n.t("people.requestSent", { name: person.name }) });
        setFound((list) => list?.map((p) => (p.userId === person.userId ? { ...p, friendship: res.friendship } : p)) ?? null);
        load();
      })
      .catch(offline);
  };

  const open = (userId: string) => {
    flyHero(`avatar:${userId}`);
    router.push({ pathname: "/profile", params: { id: userId } });
  };
  const section = (title: string, people: { userId: string; name: string }[], trailing: (userId: string) => React.ReactNode) =>
    people.length ? (
      <>
        <Text variant="label">{title}</Text>
        <View>
          {people.map((p, index) => (
            <Row
              key={p.userId}
              title={p.name}
              leading={
                <HeroSource heroKey={`avatar:${p.userId}`} node={<Avatar personId={p.userId} name={p.name} size={36} />}>
                  <Avatar personId={p.userId} name={p.name} size={36} />
                </HeroSource>
              }
              trailing={trailing(p.userId)}
              onPress={() => open(p.userId)}
              last={index === people.length - 1}
            />
          ))}
        </View>
      </>
    ) : null;

  return (
    <Screen back title={i18n.t("people.myFriends")} withToasts onRefresh={async () => load()}>
      <Button label={i18n.t("people.referral")} icon="share" variant="secondary" height={48} loading={sharing} onPress={shareReferral} />
      <Text variant="small">{i18n.t("people.referralHint")}</Text>
      <Field
        label={i18n.t("people.search")}
        placeholder={i18n.t("people.searchPlaceholder")}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        maxLength={40}
      />
      {found ? (
        found.length ? (
          <View>
            {found.map((p, index) => (
              <Row
                key={p.userId}
                title={p.name}
                subtitle={`@${p.username}`}
                leading={<Avatar personId={p.userId} name={p.name} size={36} />}
                onPress={() => open(p.userId)}
                trailing={
                  p.friendship === "friends" ? (
                    <Icon name="chev" color={theme.textMuted} />
                  ) : p.friendship === "requested" ? (
                    <Text variant="small">{i18n.t("people.requested")}</Text>
                  ) : (
                    <Button
                      label={p.friendship === "incoming" ? i18n.t("people.accept") : i18n.t("people.addFriend")}
                      accessibilityLabel={`${p.friendship === "incoming" ? i18n.t("people.accept") : i18n.t("people.addFriend")}, ${p.name}`}
                      variant="secondary"
                      height={44}
                      onPress={() => add(p)}
                    />
                  )
                }
                last={index === found.length - 1}
              />
            ))}
          </View>
        ) : (
          <Text variant="small">{i18n.t("people.searchEmpty")}</Text>
        )
      ) : null}
      {list && !list.friends.length && !list.incoming.length ? <Text>{i18n.t("people.noFriends")}</Text> : null}
      {/* Profil board: accepting moves the request into the list, refusing just removes it. */}
      {section(i18n.t("people.incoming"), list?.incoming ?? [], (userId) => (
        <View style={styles.requestActions}>
          <Button label={i18n.t("people.refuse")} variant="outline" height={36} onPress={() => void unfriend(userId).then(load).catch(offline)} />
          <Button
            label={i18n.t("people.accept")}
            variant="secondary"
            height={36}
            onPress={() => {
              haptic.confirmed();
              void befriend(userId).then(load).catch(offline);
            }}
          />
        </View>
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

const styles = StyleSheet.create({
  requestActions: { flexDirection: "row", gap: 8 },
});
