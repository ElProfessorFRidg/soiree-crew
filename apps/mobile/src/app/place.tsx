import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatMoney } from "@crew/money";
import { Field } from "@/crew/Field";
import { OwnerSection, ReviewReply } from "@/place/OwnerSection";
import { drinkLabel } from "@/drinks/display";
import type { DrinkKind } from "@/drinks/presets";
import { useT } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { haptic } from "@/motion/haptics";
import { befriend } from "@/server/profileData";
import { useCrewData } from "@/server/crewData";
import {
  addEvent,
  CRITERIA,
  fetchPlace,
  fetchWantToGo,
  markUseful,
  rsvp,
  saveReview,
  saveTags,
  setWantToGo,
  VIBE_TAGS,
  type Criterion,
  type EventKind,
  type PlacePage,
  type ReviewAudience,
  type VibeTag,
} from "@/server/placeData";
import { useSession } from "@/server/session";
import { newId, useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Bars } from "@/ui/Bars";
import { Button, IconButton } from "@/ui/Button";
import { OpenPartiesSection } from "@/crew/OpenParty";
import { Chip, Panel, Row, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { serverMessage, showFailure } from "@/server/errors";
import { ApiError } from "@/server/api";
import { ReportPanel } from "@/moderation/ReportPanel";
import { DoorPanel } from "@/place/DoorPanel";
import { ReviewPhotos } from "@/place/ReviewPhotos";
import { StaffRequests } from "@/place/StaffRequests";
import { Copyable } from "@/ui/Copyable";
import { DirectionsButton } from "@/venues/DirectionsButton";
import { HoursPanel } from "@/venues/HoursPanel";
import { useDraft } from "@/state/drafts";

const EVENT_KINDS: EventKind[] = ["dj", "student", "match", "concert", "quiz", "other"];

/** COM-01 to COM-10: a place as all app users see it, whichever crew pinned it. */
export default function PlaceScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const crew = useCrewData((state) => state.crews[0]);
  const [page, setPage] = useState<PlacePage | null>(null);
  const [wanted, setWanted] = useState(false);
  const [writing, setWriting] = useState(false);
  const [ratings, setRatings] = useState<Partial<Record<Criterion, number>>>({});
  // QOL-07: a review being written survives the app being killed.
  const [text, setText] = useDraft(`review:${venueId}`);
  const [audience, setAudience] = useState<ReviewAudience>("public");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventKind, setEventKind] = useState<EventKind>("dj");
  const [eventDay, setEventDay] = useState(0);
  const offline = showFailure(i18n);

  const load = useCallback(() => {
    void fetchPlace(venueId)
      .then((data) => {
        setPage(data);
        const mine = data.reviews.find((r) => r.mine);
        if (mine) {
          setRatings(mine.ratings);
          setText(mine.text);
          setAudience(mine.audience);
        } else if (data.reviewAudience) {
          // PROF-04: a first review starts with my profile's reviews section audience.
          setAudience(data.reviewAudience);
        }
      })
      .catch(offline);
    if (crew) void fetchWantToGo(crew.id).then((res) => setWanted(res.places.some((p) => p.venueId === venueId))).catch(() => undefined);
    // offline only shows a toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, crew]);
  useEffect(load, [load]);

  if (!page) {
    return (
      <Screen back title={i18n.t("place.title")}>
        <SkeletonRows />
      </Screen>
    );
  }
  const money = (amount: number, currency: string) => formatMoney(amount, currency, i18n.locale);
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.locale, { weekday: "narrow" }).format(new Date(2026, 10, 2 + i)));
  const toggleTag = (tag: VibeTag) => {
    const next = page.myTags.includes(tag) ? page.myTags.filter((t) => t !== tag) : [...page.myTags, tag];
    haptic.select();
    void saveTags(venueId, next).then(load).catch(offline);
  };

  return (
    <Screen back title={page.place.name} withToasts onRefresh={async () => load()}>
      {page.place.address ? <Copyable value={page.place.address} /> : null}
      <DirectionsButton lat={page.place.lat} lng={page.place.lng} label={page.place.address || page.place.name} />
      {/* COM-01: the owner's hours, else the ones users entered, said as such. The owner edits theirs below. */}
      {page.facts && !page.isOwner ? <HoursPanel facts={page.facts} /> : null}
      <OwnerSection page={page} onChanged={load} />
      {page.isOwner ? <StaffRequests venueId={venueId} /> : null}
      <View style={styles.figures}>
        <View style={styles.figure}>
          <Numeral size={32} color={theme.amber}>
            {page.ratingCount ? i18n.number(average(page.ratings) ?? 0, 1) : "?"}
          </Numeral>
          <Text variant="small">{i18n.plural("place.ratings", page.ratingCount)}</Text>
        </View>
        <View style={styles.figure}>
          <Numeral size={32}>{i18n.number(page.usersThisMonth)}</Numeral>
          <Text variant="small">{i18n.t("place.usersThisMonth")}</Text>
        </View>
      </View>
      {crew ? (
        <Button
          label={wanted ? i18n.t("place.wanted") : i18n.t("place.want")}
          icon="star"
          variant={wanted ? "outline" : "secondary"}
          height={48}
          onPress={() => void setWantToGo(crew.id, venueId, !wanted).then(() => setWanted(!wanted)).catch(offline)}
        />
      ) : null}

      {page.prices.length ? (
        <Panel>
          <Text variant="label">{i18n.t("place.prices")}</Text>
          {page.prices.map((p) => (
            <View key={`${p.kind}-${p.currency}`} style={styles.line}>
              <Text style={styles.flex}>{drinkLabel({ kind: p.kind as DrinkKind }, i18n)}</Text>
              <Text variant="h3">{money(p.amount, p.currency)}</Text>
            </View>
          ))}
        </Panel>
      ) : null}

      <Text variant="label">{i18n.t("place.vibe")}</Text>
      <View style={styles.chips}>
        {(page.canReview ? VIBE_TAGS : page.tags.map((t) => t.tag)).map((tag) => {
          const votes = page.tags.find((t) => t.tag === tag)?.votes ?? 0;
          return (
            <Chip
              key={tag}
              label={votes ? `${i18n.t(`place.tags.${tag}`)} ${votes}` : i18n.t(`place.tags.${tag}`)}
              selected={page.myTags.includes(tag)}
              onPress={page.canReview ? () => toggleTag(tag) : undefined}
            />
          );
        })}
      </View>
      {!page.tags.length && !page.canReview ? <Text variant="small">{i18n.t("place.noTags")}</Text> : null}

      {page.weekdays.some((n) => n > 0) ? (
        <>
          <Text variant="label">{i18n.t("place.busyDays")}</Text>
          <Bars values={page.weekdays} labels={weekdayLabels} />
        </>
      ) : null}

      <DoorPanel venueId={venueId} page={page} onChanged={load} />

      <Text variant="label">{i18n.t("place.events")}</Text>
      {page.events.length === 0 ? <Text variant="small">{i18n.t("place.noEvents")}</Text> : null}
      {page.events.map((e) => (
        <Row
          key={e.id}
          title={e.official ? i18n.t("place.officialEvent", { title: e.title }) : e.title}
          subtitle={`${new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(e.startsAt))}, ${formatClock(e.startsAt, i18n.language, hourCycle)} · ${i18n.plural("place.going", e.going)}${e.friendsGoing ? `, ${i18n.plural("place.friendsGoing", e.friendsGoing)}` : ""}`}
          trailing={<Button label={e.mine ? i18n.t("place.imGoing") : i18n.t("place.join")} variant={e.mine ? "outline" : "secondary"} height={40} onPress={() => void rsvp(e.id, !e.mine).then(load).catch(offline)} />}
        />
      ))}
      <Panel>
        <Field label={i18n.t("place.newEvent")} placeholder={i18n.t("place.newEventPlaceholder")} value={eventTitle} onChangeText={setEventTitle} maxLength={60} />
        <View style={styles.chips}>
          {EVENT_KINDS.map((k) => (
            <Chip key={k} label={i18n.t(`place.kinds.${k}`)} selected={k === eventKind} onPress={() => setEventKind(k)} />
          ))}
        </View>
        <Segmented<number>
          accessibilityLabel={i18n.t("place.eventDay")}
          value={eventDay}
          items={[0, 1, 2, 7].map((d) => ({ value: d, label: d === 0 ? i18n.t("place.tonight") : d === 1 ? i18n.t("place.tomorrow") : i18n.plural("place.inDays", d) }))}
          onChange={setEventDay}
        />
        <Button
          label={i18n.t("place.addEvent")}
          variant="secondary"
          height={48}
          disabled={eventTitle.trim().length < 3}
          onPress={() => {
            const day = new Date();
            day.setDate(day.getDate() + eventDay);
            day.setHours(21, 0, 0, 0);
            void addEvent(venueId, { id: newId(), title: eventTitle.trim(), kind: eventKind, startsAt: day.getTime() })
              .then(() => {
                haptic.confirmed();
                setEventTitle("");
                load();
              })
              .catch(offline);
          }}
        />
      </Panel>

      {/* COM-05: parties opened here by their hosts, with a join request in one tap. */}
      <OpenPartiesSection venueId={page.place.venueId} />

      {page.regulars.length ? (
        <Panel>
          <Text variant="label">{i18n.t("place.regulars")}</Text>
          {page.regulars.map((r, index) => (
            <Row
              key={r.userId}
              title={r.name}
              subtitle={r.legend ? i18n.t("place.legend", { place: page.place.name }) : i18n.plural("place.nights", r.nights)}
              leading={<Avatar personId={r.userId} name={r.name} size={32} />}
              trailing={
                r.userId !== me ? (
                  <View style={styles.regularActions}>
                    {r.openToMeet && !r.friend ? (
                      <Button
                        label={i18n.t("people.addFriend")}
                        variant="secondary"
                        height={40}
                        onPress={() => void befriend(r.userId).then(() => showToast({ message: i18n.t("people.requestSent", { name: r.name }) })).catch(offline)}
                      />
                    ) : null}
                    {/* COM-05: invite this regular, and their crew, to one of my crew's parties. */}
                    <IconButton
                      icon="glass"
                      accessibilityLabel={i18n.t("people.inviteTitle", { name: r.name })}
                      onPress={() => router.push({ pathname: "/invite-to-party", params: { userId: r.userId, name: r.name } })}
                    />
                  </View>
                ) : undefined
              }
              onPress={() => router.push({ pathname: "/profile", params: { id: r.userId } })}
              last={index === page.regulars.length - 1}
            />
          ))}
        </Panel>
      ) : null}

      <Text variant="label">{i18n.t("place.reviews")}</Text>
      {page.reviews.length === 0 ? <Text variant="small">{i18n.t("place.noReviews")}</Text> : null}
      {page.reviews.map((r) => (
        <Panel key={r.id}>
          <Text variant="h3">{r.author ? r.author.name : i18n.t("place.aRegular")}</Text>
          <Text variant="small">
            {i18n.t("place.visited", { date: new Intl.DateTimeFormat(i18n.locale, { month: "long", year: "numeric" }).format(new Date(r.visitedAt)) })}
            {r.mine ? `, ${i18n.t(`place.audience.${r.audience}`)}` : ""}
          </Text>
          <Text variant="small">
            {CRITERIA.filter((c) => r.ratings[c])
              .map((c) => `${i18n.t(`place.criteria.${c}`)} ${r.ratings[c]}/5`)
              .join(", ")}
          </Text>
          {r.text ? <Text>{r.text}</Text> : null}
          <ReviewPhotos venueId={venueId} photos={r.photos ?? []} mine={r.mine} onChanged={load} />
          <ReviewReply review={r} isOwner={Boolean(page.isOwner)} onChanged={load} />
          {!r.mine ? (
            <Button
              label={r.markedUseful ? i18n.plural("place.usefulMarked", r.useful) : i18n.plural("place.useful", r.useful)}
              variant="outline"
              height={40}
              onPress={() => void markUseful(r.id, !r.markedUseful).then(load).catch(offline)}
            />
          ) : null}
          {/* COM-08, O-77: any review can be reported; public content goes to the server's moderators. */}
          {!r.mine ? <ReportPanel targetKind="review" targetId={r.id} compact /> : null}
        </Panel>
      ))}

      {page.canReview ? (
        writing ? (
          <Panel>
            <Text variant="label">{i18n.t("place.writeReview")}</Text>
            {CRITERIA.map((c) => (
              <View key={c} style={styles.criterion}>
                <Text variant="small">{i18n.t(`place.criteria.${c}`)}</Text>
                <Segmented<number>
                  accessibilityLabel={i18n.t(`place.criteria.${c}`)}
                  height={44}
                  value={ratings[c] ?? 0}
                  items={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
                  onChange={(n) => setRatings((old) => ({ ...old, [c]: n }))}
                />
              </View>
            ))}
            <Field
              label={i18n.t("place.reviewText")}
              hint={i18n.t("place.reviewRule")}
              error={reviewError}
              value={text}
              onChangeText={(next) => {
                setText(next);
                setReviewError(null);
              }}
              maxLength={280}
              multiline
            />
            <Segmented<ReviewAudience>
              accessibilityLabel={i18n.t("place.reviewAudience")}
              value={audience}
              items={(["public", "anonymous", "friends", "me"] as const).map((a) => ({ value: a, label: i18n.t(`place.audience.${a}`) }))}
              onChange={setAudience}
            />
            <Button
              label={i18n.t("place.publish")}
              height={52}
              disabled={Object.keys(ratings).length === 0}
              onPress={() =>
                void saveReview(venueId, { ratings, text: text.trim(), audience })
                  .then(() => {
                    haptic.confirmed();
                    setWriting(false);
                    load();
                  })
                  .catch((error: unknown) => {
                    // COM-02, COM-08: a filter refusal is explained under the text, where it can be fixed.
                    if (error instanceof ApiError && error.failure.kind === "http" && error.failure.code.startsWith("text_")) {
                      haptic.error();
                      setReviewError(serverMessage(error.failure.code, i18n));
                    } else offline(error);
                  })
              }
            />
          </Panel>
        ) : (
          <Button label={page.reviews.some((r) => r.mine) ? i18n.t("place.editReview") : i18n.t("place.writeReview")} icon="edit" height={52} onPress={() => setWriting(true)} />
        )
      ) : (
        <Text variant="small">{i18n.t("place.reviewAfterVisit")}</Text>
      )}
    </Screen>
  );
}

function average(ratings: Record<string, number | null>): number | null {
  const values = Object.values(ratings).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

const styles = StyleSheet.create({
  regularActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  figures: { flexDirection: "row", gap: 12 },
  figure: { flex: 1, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  line: { flexDirection: "row", alignItems: "center", minHeight: 40, gap: 10 },
  criterion: { gap: 4 },
  flex: { flex: 1 },
});
