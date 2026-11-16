import { router } from "expo-router";
import { useT } from "@/i18n";
import { PROFILE_SECTIONS } from "@/server/profileData";
import { ApiError } from "@/server/api";
import { ProfileLoadState } from "@/profile/ProfileLoadState";
import { useProfile } from "@/profile/useProfile";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Panel, Row } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** PROF-10: what someone outside my crews and friends can see of me, right now. */
export default function PrivacySummaryScreen() {
  const i18n = useT();
  const theme = useTheme();
  const { profile, connected, error, loading, refresh } = useProfile();

  if (!profile?.audiences) {
    return (
      <Screen back title={i18n.t("privacySummary.title")} withToasts onRefresh={connected ? refresh : undefined}>
        <ProfileLoadState connected={connected} loading={loading} error={error ?? (profile ? new ApiError({ kind: "http", status: 502, code: "api_response_incompatible" }) : null)} onRetry={refresh} />
      </Screen>
    );
  }
  const audiences = profile.audiences;
  const open = PROFILE_SECTIONS.filter((s) => audiences[s] === "everyone");
  const closed = PROFILE_SECTIONS.filter((s) => audiences[s] !== "everyone");
  const findable = profile.findable ?? "username";

  return (
    <Screen back title={i18n.t("privacySummary.title")} withToasts onRefresh={refresh}>
      {error ? <ProfileLoadState connected={connected} loading={false} error={error} onRetry={refresh} /> : null}
      <Text>{open.length ? i18n.t("privacySummary.intro") : i18n.t("privacySummary.nothing")}</Text>
      {open.length ? (
        <Panel tint="amber">
          <Text variant="label">{i18n.t("privacySummary.visible")}</Text>
          {open.map((s, index) => (
            <Row key={s} title={i18n.t(`people.section.${s}`)} leading={<Icon name="eye" color={theme.amber} />} last={index === open.length - 1} />
          ))}
        </Panel>
      ) : null}
      <Panel>
        <Text variant="label">{i18n.t("privacySummary.hidden")}</Text>
        {closed.map((s, index) => (
          <Row key={s} title={i18n.t(`people.section.${s}`)} leading={<Icon name="lock" color={theme.textMuted} />} last={index === closed.length - 1} />
        ))}
      </Panel>
      <Text variant="small">
        {findable === "search" ? i18n.t("privacySummary.findSearch") : findable === "username" ? i18n.t("privacySummary.findUsername") : i18n.t("privacySummary.findNobody")}
      </Text>
      <Text variant="small">{i18n.t("people.neverStrangers")}</Text>
      <Button
        label={i18n.t("privacySummary.preview")}
        icon="eye"
        variant="secondary"
        height={52}
        onPress={() => router.push({ pathname: "/profile", params: { id: "me", as: "stranger" } })}
      />
      <Button label={i18n.t("privacySummary.change")} variant="outline" height={48} onPress={() => router.push("/edit-profile")} />
    </Screen>
  );
}
