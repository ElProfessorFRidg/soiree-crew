import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { PROFILE_BOUNDS } from "@crew/bac";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { ApiError } from "@/server/api";
import { saveBirthDate } from "@/server/profileData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { openAppSettings } from "@/system/permissions";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { DateWheel, type DateParts } from "@/ui/native/DateWheel";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { ProfileFields, type ProfileDraft } from "@/profile/ProfileFields";
import { ageFromBirthDate, birthDateText, legalAge } from "./flow";
import { pickProfilePhoto } from "./profilePhoto";

// O-02, O-04: the date of birth, the photo and the body profile of the arrival flow.

const YEAR = () => new Date().getFullYear();

function partsOf(birthDate: string | null): DateParts {
  const match = birthDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate) : null;
  if (match)
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  return { year: YEAR() - 25, month: 6, day: 15 };
}

/**
 * O-02: the date of birth on a wheel. The date is kept, the screen shows the age only. Under the
 * age of the country (21 in the US, 18 elsewhere) the answer is one plain line.
 */
export function BirthStep({ birthDate, onChange, country, tooYoung }: { birthDate: string | null; onChange: (birthDate: string) => void; country: string; tooYoung: boolean }) {
  const i18n = useT();
  const theme = useTheme();
  const parts = partsOf(birthDate);
  const age = birthDate ? ageFromBirthDate(birthDate, Date.now()) : null;
  const need = legalAge(country);
  const monthLabel = (m: number) => new Intl.DateTimeFormat(i18n.locale, { month: "long" }).format(new Date(2000, m - 1, 1));
  return (
    <>
      <Text variant="h1">{i18n.t("journey.birthTitle")}</Text>
      <Text muted>{i18n.t("journey.birthWhy")}</Text>
      <DateWheel
        value={parts}
        minYear={YEAR() - PROFILE_BOUNDS.ageYears.max}
        maxYear={YEAR()}
        monthLabel={monthLabel}
        labels={{
          day: i18n.t("journey.birthDay"),
          month: i18n.t("journey.birthMonth"),
          year: i18n.t("journey.birthYear"),
        }}
        onChange={(next) => onChange(birthDateText(next.year, next.month, next.day))}
      />
      {tooYoung ? (
        <Text color={theme.danger} accessibilityLiveRegion="polite">
          {i18n.t("journey.birthUnder", { age: need })}
        </Text>
      ) : age !== null && birthDate ? (
        <Text variant="h3" align="center">
          {i18n.t("journey.birthAge", { age })}
        </Text>
      ) : null}
    </>
  );
}

/**
 * Checks the date and, with an account, has the server check it too. In the arrival flow the date
 * is asked before any account exists, so a minor never gets one; an account is never deleted from here.
 */
export async function commitBirthDate(birthDate: string, country: string): Promise<"ok" | "under" | "offline"> {
  const age = ageFromBirthDate(birthDate, Date.now());
  if (age === null || age < legalAge(country)) return "under";
  if (useSession.getState().session) {
    try {
      await saveBirthDate(birthDate);
    } catch (error) {
      if (error instanceof ApiError && error.failure.kind === "http" && error.failure.code === "under_age") return "under";
      // The date is set once: an account that has one already keeps it.
      if (error instanceof ApiError && error.failure.kind === "http" && error.failure.code === "birth_date_set") return "ok";
      return "offline";
    }
  }
  useAppStore.setState((state) => ({
    ageConfirmedAt: state.ageConfirmedAt ?? Date.now(),
  }));
  return "ok";
}

/** O-04: the photo, optional. Kept on this phone; the camera or the library asks after its own explanation. */
export function PhotoStep({ photo, onChange, personId, name }: { photo: string | null; onChange: (photo: string | null) => void; personId: string; name: string }) {
  const i18n = useT();
  const theme = useTheme();
  const [busy, setBusy] = useState<"camera" | "library" | null>(null);
  const pick = async (source: "camera" | "library") => {
    setBusy(source);
    try {
      const result = await pickProfilePhoto(source);
      if ("photo" in result) {
        haptic.confirmed();
        onChange(result.photo);
      } else if ("refused" in result) {
        showToast({
          message: i18n.t("journey.photoDenied"),
          durationMs: 8_000,
          ...(result.refused === "settings"
            ? {
                action: {
                  label: i18n.t("common.openSettings"),
                  onPress: openAppSettings,
                },
              }
            : {}),
        });
      }
    } catch {
      showToast({ tone: "danger", message: i18n.t("journey.photoDenied") });
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Text variant="h1">{i18n.t("journey.photoTitle")}</Text>
      <Text muted>{i18n.t("journey.photoWhy")}</Text>
      <View style={styles.photo}>
        {photo ? (
          <Image source={{ uri: photo }} style={[styles.image, { borderColor: theme.amber }]} accessibilityIgnoresInvertColors />
        ) : (
          <Avatar personId={personId} name={name || "?"} size={132} />
        )}
      </View>
      <Button label={i18n.t("journey.photoTake")} variant="secondary" icon="camera" height={52} loading={busy === "camera"} disabled={busy !== null} onPress={() => void pick("camera")} />
      <Button label={i18n.t("journey.photoPick")} variant="secondary" icon="image" height={52} loading={busy === "library"} disabled={busy !== null} onPress={() => void pick("library")} />
      {photo ? <Button label={i18n.t("journey.photoRemove")} variant="outline" height={44} onPress={() => onChange(null)} /> : null}
    </>
  );
}

/**
 * O-04: weight, body model and optional height, each with one line on why it is asked. The age
 * comes from the date of birth given earlier, so it is not asked a second time.
 */
export function BacStep({ draft, onChange, birthDate }: { draft: ProfileDraft; onChange: (next: ProfileDraft) => void; birthDate: string | null }) {
  const i18n = useT();
  const age = birthDate ? ageFromBirthDate(birthDate, Date.now()) : null;
  return (
    <>
      <Text variant="h1">{i18n.t("journey.bacTitle")}</Text>
      <ProfileFields
        draft={draft}
        onChange={onChange}
        reasons={{ weight: i18n.t("journey.bacWeight"), body: i18n.t("journey.bacSex"), height: i18n.t("journey.bacHeight") }}
      />
      {age !== null ? (
        <Panel>
          <Text variant="small">{i18n.t("journey.bacAge", { age })}</Text>
        </Panel>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: "center", paddingVertical: 8 },
  image: { width: 132, height: 132, borderRadius: radius.pill, borderWidth: 2 },
});
