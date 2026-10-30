import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { Image, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { radius, space } from "@crew/design-tokens";
import {
  breathRatio,
  countryRules,
  drivingLimit,
  formatBacValue,
} from "@crew/units";
import { useT, type Translator } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { moodColour } from "@/party/mood";
import { RollingNumber } from "@/party/RollingNumber";
import { Confetti, DropIn, Podium, type PodiumEntry } from "@/recap/Podium";
import { Narration } from "@/recap/Narration";
import { nightFacts } from "@/recap/nightStory";
import { RecapCurves } from "@/recap/RecapCurves";
import {
  fetchRecap,
  react,
  RECAP_EMOJIS,
  type Recap,
  type RecapEmoji,
} from "@/server/recapData";
import { useSession } from "@/server/session";
import { fetchLeaderboard } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button, IconButton } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { ScalePressable } from "@/ui/Pressable";
import { Text } from "@/ui/Text";
import { isGameId } from "@crew/games";
import { useGameT, type GamePluralKey } from "@/games/i18n";
import { showToast, ToastHost } from "@/ui/Toast";
import { Quotes } from "@/recap/Quotes";
import { failureMessage } from "@/server/errors";
import { showPermissionDenied } from "@/system/permissions";
import { canShareImages } from "@/system/share";

const SLIDES = 5;

function CountUp({
  value,
  replay,
  format,
  size,
  color,
}: {
  value: number;
  replay: number;
  format: (v: number) => string;
  size: number;
  color: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const timer = setTimeout(() => setShown(value), 60);
    return () => clearTimeout(timer);
  }, [value, replay]);
  return (
    <RollingNumber
      value={shown}
      format={format}
      size={size}
      color={color}
      accessibilityLabel={format(value)}
    />
  );
}

function partyDate(at: number, i18n: Translator): string {
  return new Intl.DateTimeFormat(i18n.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(at));
}

function Reactions({
  recap,
  toId,
  me,
  onChange,
  i18n,
}: {
  recap: Recap;
  toId: string;
  me: string | undefined;
  onChange: () => void;
  i18n: Translator;
}) {
  const theme = useTheme();
  const crewName = useCrewNames(recap.party.crewId);
  const [open, setOpen] = useState(false);
  const mine = recap.reactions.find(
    (r) => r.fromId === me && r.toId === toId,
  )?.emoji;
  const counts = new Map<RecapEmoji, number>();
  for (const r of recap.reactions)
    if (r.toId === toId) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const name = crewName(toId, recap.participants.find((p) => p.userId === toId)?.name ?? "");
  const choose = (emoji: RecapEmoji) => {
    haptic.select();
    setOpen(false);
    void react(recap.party.id, toId, mine === emoji ? null : emoji)
      .then(onChange)
      .catch((error: unknown) =>
        showToast({ tone: "danger", message: failureMessage(error, i18n) }),
      );
  };
  return (
    <View style={styles.reactions}>
      {[...counts].map(([emoji, count]) => (
        <Text
          key={emoji}
          variant="small"
          color={emoji === mine ? theme.amber : undefined}
        >
          {emoji} {count}
        </Text>
      ))}
      {open ? (
        RECAP_EMOJIS.map((emoji) => (
          <ScalePressable
            key={emoji}
            onPress={() => choose(emoji)}
            accessibilityRole="button"
            accessibilityLabel={emoji}
            style={[
              styles.emoji,
              emoji === mine && { backgroundColor: theme.surfaceRaised },
            ]}
          >
            <Text>{emoji}</Text>
          </ScalePressable>
        ))
      ) : (
        <ScalePressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t("recap.react", { name })}
          style={[styles.emoji, { backgroundColor: theme.surfaceRaised }]}
        >
          <Text>{mine ?? "+"}</Text>
        </ScalePressable>
      )}
    </View>
  );
}

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useT();
  const g = useGameT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useSession((state) => state.session?.userId);
  const preferences = useAppStore((state) => state.preferences);
  const [recap, setRecap] = useState<Recap | null>(null);
  const crewName = useCrewNames(recap?.party.crewId);
  const [podium, setPodium] = useState<{
    disabled: boolean;
    entries: PodiumEntry[];
  } | null>(null);
  const [slide, setSlide] = useState(0);
  const [replay, setReplay] = useState(0);
  const [egg, setEgg] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const card = useRef<ComponentRef<typeof View>>(null);

  const rules = countryRules(preferences.legalCountry);
  const ratio = breathRatio(rules);
  const legalLimit = drivingLimit(rules, preferences.driverCategory);
  const bac = (gPerL: number) =>
    `${formatBacValue(gPerL, preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${preferences.bacUnit}`)}`;
  const clock = (at: number) =>
    formatClock(at, i18n.language, preferences.hourCycle);

  const load = useCallback(() => {
    void fetchRecap(id)
      .then((data) => {
        setRecap(data);
        return fetchLeaderboard(
          data.party.crewId,
          "party",
          "drinks",
          data.party.id,
        ).then((board) =>
          setPodium({
            disabled: board.disabled,
            entries: board.rows.filter((r) => r.value > 0).slice(0, 3),
          }),
        );
      })
      .catch((error: unknown) =>
        showToast({ tone: "danger", message: failureMessage(error, i18n) }),
      );
  }, [id, i18n]);
  useEffect(load, [load]);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES - 1, next));
    if (clamped !== slide) haptic.select();
    setSlide(clamped);
    setReplay((r) => r + 1);
  };

  /** O-30: a photo for the top of the story, taken now; it stays on the phone and in the shared image. */
  const takeSelfie = async (camera: "front" | "back") => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showPermissionDenied(i18n, i18n.t("album.denied"), permission.canAskAgain);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      exif: false,
      cameraType: camera === "front" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    if (!result.canceled && result.assets[0]) {
      haptic.select();
      setSelfie(result.assets[0].uri);
    }
  };

  const share = async () => {
    if (!card.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(card, {
        format: "png",
        quality: 1,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
      });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync()))
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: i18n.t("recap.share"),
        });
      else throw new Error("unavailable");
    } catch {
      showToast({ tone: "danger", message: i18n.t("recap.shareFailed") });
    } finally {
      setSharing(false);
    }
  };

  const nameOf = (userId: string | undefined) =>
    crewName(userId, recap?.participants.find((p) => p.userId === userId)?.name ?? "");

  if (!recap) {
    return <View style={[styles.screen, { backgroundColor: theme.bg }]} />;
  }

  const figures = (
    <View style={styles.figures}>
      <View style={styles.figure}>
        <CountUp
          value={recap.figures.participants}
          replay={replay}
          format={(v) => i18n.number(Math.round(v))}
          size={54}
          color={theme.text}
        />
        <Text variant="small">
          {i18n.plural("recap.present", recap.figures.participants)}
        </Text>
      </View>
      <View style={styles.figure}>
        <CountUp
          value={recap.figures.drinks}
          replay={replay}
          format={(v) => i18n.number(Math.round(v))}
          size={54}
          color={theme.amber}
        />
        <Text variant="small">
          {i18n.plural("recap.drinks", recap.figures.drinks)}
        </Text>
      </View>
      {recap.figures.averagePeak !== null ? (
        <View style={styles.figure}>
          <CountUp
            value={recap.figures.averagePeak}
            replay={replay}
            format={(v) =>
              formatBacValue(v, preferences.bacUnit, ratio, i18n.locale)
            }
            size={54}
            color={theme.text}
          />
          <Text variant="small">
            {i18n.t("recap.averagePeak")} (
            {i18n.t(`units.${preferences.bacUnit}`)})
          </Text>
        </View>
      ) : null}
    </View>
  );

  const badgeTitle = (kind: Recap["badges"][number]["kind"]) =>
    i18n.t(`recap.badge.${kind}`);
  const badgeDetail = (badge: Recap["badges"][number]) =>
    badge.kind === "camel"
      ? i18n.plural("recap.badge.camelDetail", badge.value ?? 0)
      : badge.kind === "goldenDriver"
        ? i18n.t("recap.badge.goldenDriverDetail")
        : (badge.venueName ?? "");

  const timelineText = (event: Recap["timeline"][number]) => {
    const name = nameOf(event.userId);
    switch (event.kind) {
      case "start":
        return i18n.t("recap.event.start");
      case "end":
        return i18n.t("recap.event.end");
      case "arrival":
        return i18n.t("recap.event.arrival", { name });
      case "checkIn":
        return i18n.t("recap.event.checkIn", {
          name,
          venue: event.venueName ?? "",
        });
      case "takeover":
        return i18n.t("recap.event.takeover", {
          name,
          venue: event.venueName ?? "",
        });
      case "round":
        return i18n.plural("recap.event.round", event.count ?? 1, { name });
      case "homeSafe":
        return i18n.t("recap.event.homeSafe", { name });
      case "game": {
        const game = event.gameId && isGameId(event.gameId) ? g.t(`games.${event.gameId}.name`) : "";
        return event.userId ? i18n.t("recap.event.game", { game, name }) : i18n.t("recap.event.gameTie", { game });
      }
      case "photos":
        return i18n.plural("recap.event.photos", event.count ?? 1);
      case "allHere":
        return i18n.plural("recap.event.allHere", event.count ?? 0);
      case "cheers":
        return i18n.plural("recap.event.cheers", event.count ?? 1, { name, other: nameOf(event.otherId) });
    }
  };
  /** N-22: the record set in a game, under its line. */
  const recordText = (event: Recap["timeline"][number]) =>
    event.record ? g.plural(event.record.key as GamePluralKey, event.record.count, { name: nameOf(event.record.userId) }) : null;

  const slides = [
    <View key="figures" style={styles.slide}>
      <Text variant="label">{partyDate(recap.party.startsAt, i18n)}</Text>
      {/* JOY-07: a long press on the party's name throws the confetti again (EASTER_EGGS.md). */}
      <Text
        variant="h1"
        onLongPress={() => {
          haptic.heavy();
          setEgg((n) => n + 1);
        }}
      >
        {recap.party.name}
      </Text>
      {egg > 0 ? <Confetti replay={egg} /> : null}
      {figures}
      <Text variant="label">{i18n.t("recap.whoWasThere")}</Text>
      <View>
        {recap.participants.map((p) => (
          <View
            key={p.userId}
            style={[styles.person, { borderBottomColor: theme.line }]}
          >
            <Avatar personId={p.userId} name={crewName(p.userId, p.name)} />
            <View style={styles.flex}>
              <Text variant="h3">
                {p.userId === me ? i18n.t("common.you") : crewName(p.userId, p.name)}
              </Text>
              <Text variant="small">
                {i18n.plural("recap.drinksOf", p.drinks)}
              </Text>
            </View>
            <Reactions
              recap={recap}
              toId={p.userId}
              me={me}
              onChange={load}
              i18n={i18n}
            />
          </View>
        ))}
      </View>
      <Text variant="small">{i18n.t("recap.onlyPresent")}</Text>
    </View>,
    <View key="curves" style={styles.slide}>
      <Text variant="h1">{i18n.t("recap.curves")}</Text>
      {recap.participants.some((p) => p.curve.length > 1) ? (
        <RecapCurves
          participants={recap.participants}
          from={recap.window.from}
          legalLimit={legalLimit}
          replay={replay}
          meId={me}
          formatX={clock}
          labels={{
            range: (from, to) => i18n.t("recap.curvesRange", { from, to }),
            hint: i18n.t("recap.curvesHint"),
            legal: i18n.t("recap.legalLine"),
            rangeEnd: i18n.t("recap.rangeEnd"),
            you: i18n.t("common.you"),
          }}
        />
      ) : (
        <Text>{i18n.t("recap.noCurve")}</Text>
      )}
    </View>,
    <View key="podium" style={styles.slide}>
      <Text variant="h1">{i18n.t("recap.podium")}</Text>
      {podium?.disabled ? (
        <Text>{i18n.t("recap.podiumOff")}</Text>
      ) : podium && podium.entries.length ? (
        <>
          <Podium
            entries={podium.entries}
            replay={replay}
            valueLabel={(entry) => i18n.plural("recap.drinksOf", entry.value)}
          />
          <Text variant="small">{i18n.t("recap.podiumHint")}</Text>
        </>
      ) : (
        <Text>{i18n.t("recap.podiumEmpty")}</Text>
      )}
      <Text variant="label">{i18n.t("recap.badges")}</Text>
      {recap.badges.length === 0 ? (
        <Text>{i18n.t("recap.noBadge")}</Text>
      ) : null}
      {recap.badges.map((badge, index) => (
        <DropIn
          key={`${badge.kind}-${badge.userId}-${index}`}
          delay={600 + index * 140}
          replay={replay}
        >
          <Panel>
            <View style={styles.badge}>
              <Avatar
                personId={badge.userId}
                name={nameOf(badge.userId)}
                size={34}
              />
              <View style={styles.flex}>
                <Text variant="h3">{badgeTitle(badge.kind)}</Text>
                <Text variant="small">
                  {[nameOf(badge.userId), badgeDetail(badge)]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            </View>
          </Panel>
        </DropIn>
      ))}
      {recap.badges.length ? <Confetti replay={replay} /> : null}
    </View>,
    <View key="timeline" style={styles.slide}>
      <Text variant="h1">{i18n.t("recap.timeline")}</Text>
      {recap.timeline.map((event, index) => (
        <DropIn
          key={`${event.kind}-${event.at}-${index}`}
          delay={Math.min(index, 12) * 70}
          replay={replay}
          distance={8}
        >
          <View style={styles.event}>
            <Text variant="small" style={styles.time}>
              {clock(event.at)}
            </Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    event.kind === "takeover" ? theme.amber : theme.line,
                },
              ]}
            />
            <View style={styles.flex}>
              <Text color={event.kind === "takeover" ? theme.amber : undefined}>
                {timelineText(event)}
              </Text>
              {recordText(event) ? <Text variant="small">{recordText(event)}</Text> : null}
              {event.photos?.length ? (
                <View style={styles.eventPhotos}>
                  {event.photos.map((photo) => (
                    <Image key={photo.id} source={{ uri: photo.url }} style={[styles.eventPhoto, { backgroundColor: theme.surface2 }]} accessibilityIgnoresInvertColors />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </DropIn>
      ))}
      <Quotes recap={recap} me={me} onChange={load} />
      <Narration recap={recap} facts={nightFacts(recap, nameOf, partyDate(recap.party.startsAt, i18n), clock)} onPublished={load} />
    </View>,
    <View key="share" style={styles.slide}>
      <View
        ref={card}
        collapsable={false}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.line, borderTopWidth: 6, borderTopColor: moodColour(recap.party.mood) },
        ]}
      >
        {selfie ? <Image source={{ uri: selfie }} style={styles.selfie} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        <Text variant="label">{partyDate(recap.party.startsAt, i18n)}</Text>
        <Text variant="h1">{recap.party.name}</Text>
        {figures}
        {/* O-30, N-37: only my own curve travels with the story; the others stay in the crew. */}
        {recap.participants.some((p) => p.userId === me && p.curve.length > 1) ? (
          <RecapCurves
            participants={recap.participants.filter((p) => p.userId === me)}
            from={recap.window.from}
            legalLimit={legalLimit}
            replay={0}
            meId={me}
            formatX={clock}
            labels={{
              range: (from, to) => i18n.t("recap.curvesRange", { from, to }),
              hint: "",
              legal: i18n.t("recap.legalLine"),
              rangeEnd: i18n.t("recap.rangeEnd"),
              you: i18n.t("common.you"),
            }}
          />
        ) : null}
        {podium && !podium.disabled && podium.entries.length ? (
          <View style={styles.cardPodium}>
            {podium.entries.filter((entry) => !recap.participants.find((p) => p.userId === entry.userId)?.storyOptOut).map((entry) => (
              <View key={entry.userId} style={styles.cardRank}>
                <Text
                  variant="h2"
                  color={entry.rank === 1 ? theme.amber : undefined}
                >
                  {entry.rank}
                </Text>
                <Avatar personId={entry.userId} name={crewName(entry.userId, entry.name)} size={30} />
                <Text variant="h3" style={styles.flex}>
                  {crewName(entry.userId, entry.name)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text variant="small">
          {recap.badges.map((b) => badgeTitle(b.kind)).join(", ")}
        </Text>
        <Text variant="label" align="center">
          {i18n.t("recap.storyFooter")}
        </Text>
      </View>
      <View style={styles.selfieRow}>
        <Button
          label={selfie ? i18n.t("recap.selfieAgain") : i18n.t("recap.selfie")}
          icon="camera"
          variant="secondary"
          height={48}
          style={styles.flex}
          onPress={() => void takeSelfie("front")}
        />
        <Button label={i18n.t("recap.photoBack")} icon="image" variant="secondary" height={48} style={styles.flex} onPress={() => void takeSelfie("back")} />
      </View>
      {selfie ? <Button label={i18n.t("recap.selfieRemove")} variant="outline" height={40} onPress={() => setSelfie(null)} /> : null}
      {canShareImages ? <Button label={i18n.t("recap.share")} icon="share" height={56} loading={sharing} onPress={() => void share()} /> : null}
      <Button
        label={i18n.t("album.open")}
        icon="image"
        variant="outline"
        height={48}
        onPress={() => router.push({ pathname: "/album", params: { partyId: recap.party.id } })}
      />
      {/* JOY-09: the photo strip, offered with the recap. */}
      <Button
        label={i18n.t("strip.open")}
        icon="x:film"
        variant="outline"
        height={48}
        onPress={() => router.push({ pathname: "/photo-strip", params: { partyId: recap.party.id } })}
      />
    </View>,
  ];

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.bg, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.progress}>
        {Array.from({ length: SLIDES }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                // JOY-04: the party's mood colours the progress of the story.
                backgroundColor: i <= slide ? moodColour(recap.party.mood) : theme.surfaceRaised,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.top}>
        <IconButton
          icon="x"
          accessibilityLabel={i18n.t("common.close")}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        />
        <Button
          label={i18n.t("recap.replay")}
          icon="undo"
          variant="outline"
          height={40}
          onPress={() => setReplay((r) => r + 1)}
        />
      </View>
      {!recap.ready ? (
        <Panel>
          <Text>{i18n.t("recap.notReady")}</Text>
        </Panel>
      ) : null}
      <ScrollView
        key={slide}
        contentContainerStyle={styles.content}
        style={styles.flex}
      >
        {slides[slide]}
      </ScrollView>
      <View style={[styles.nav, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          label={i18n.t("recap.previous")}
          variant="outline"
          height={52}
          style={styles.flex}
          disabled={slide === 0}
          onPress={() => go(slide - 1)}
        />
        <Button
          label={i18n.t("recap.next")}
          variant="secondary"
          height={52}
          style={styles.flex}
          disabled={slide === SLIDES - 1}
          onPress={() => go(slide + 1)}
        />
      </View>
      <ToastHost bottomOffset={insets.bottom + 90} />
    </View>
  );
}

const styles = StyleSheet.create({
  selfie: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.tile },
  selfieRow: { flexDirection: "row", gap: 12 },
  screen: { flex: 1 },
  flex: { flex: 1 },
  progress: { flexDirection: "row", gap: 4, paddingHorizontal: space.screenX },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.screenX,
    paddingVertical: 8,
  },
  content: { paddingHorizontal: space.screenX, paddingBottom: 24 },
  slide: { gap: space.blockGap },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  figure: { minWidth: 90 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  reactions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    maxWidth: 170,
    justifyContent: "flex-end",
  },
  emoji: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { flexDirection: "row", alignItems: "center", gap: 12 },
  event: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  time: { width: 56 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  eventPhotos: { flexDirection: "row", gap: 6, marginTop: 6, marginBottom: 4 },
  eventPhoto: { width: 64, height: 64, borderRadius: radius.tile },
  card: {
    aspectRatio: 9 / 16,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 22,
    gap: 16,
    justifyContent: "space-between",
  },
  cardPodium: { gap: 10 },
  cardRank: { flexDirection: "row", alignItems: "center", gap: 10 },
  nav: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: space.screenX,
    paddingTop: 10,
  },
});
