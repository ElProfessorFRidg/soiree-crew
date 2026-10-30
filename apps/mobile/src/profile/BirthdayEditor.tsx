import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { space } from "@crew/design-tokens";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { showFailure } from "@/server/errors";
import { saveProfile } from "@/server/profileData";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

type Birthday = { month: number; day: number; year?: number };

const daysIn = (month: number, year?: number) => new Date(year ?? 2000, month, 0).getDate();

/**
 * QOL-21: day and month for the crew's reminders; the year is optional and never shown to
 * anyone else. Who sees the birthday is the "birthday" audience below, crew mates by default.
 */
export function BirthdayEditor({ initial, onSaved }: { initial: Birthday | undefined; onSaved: (b: Birthday | null) => void }) {
  const i18n = useT();
  const [month, setMonth] = useState(initial?.month ?? 1);
  const [day, setDay] = useState(initial?.day ?? 1);
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [busy, setBusy] = useState(false);
  const failed = showFailure(i18n);
  const yearNumber = /^\d{4}$/.test(year) ? Number(year) : undefined;
  const yearBad = year !== "" && (yearNumber === undefined || yearNumber < 1900 || yearNumber > new Date().getFullYear());
  const maxDay = daysIn(month, yearNumber);
  const shownDay = Math.min(day, maxDay);
  const monthName = (m: number) => new Intl.DateTimeFormat(i18n.locale, { month: "short" }).format(new Date(2000, m - 1, 1));

  const save = (next: Birthday | null) => {
    setBusy(true);
    void saveProfile({ birthday: next })
      .then(() => {
        haptic.confirmed();
        onSaved(next);
        showToast({ message: i18n.t("common.saved") });
      })
      .catch(failed)
      .finally(() => setBusy(false));
  };

  return (
    <Panel>
      <Text variant="label">{i18n.t("people.birthday")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthRow} contentContainerStyle={styles.months} accessibilityLabel={i18n.t("people.birthdayMonth")}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <Chip key={m} label={monthName(m)} selected={m === month} onPress={() => setMonth(m)} />
        ))}
      </ScrollView>
      <Stepper
        value={shownDay}
        min={1}
        max={maxDay}
        onChange={setDay}
        format={(d) => new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "long" }).format(new Date(2000, month - 1, d))}
        decreaseLabel={i18n.t("people.birthdayEarlier")}
        increaseLabel={i18n.t("people.birthdayLater")}
      />
      <Field
        label={i18n.t("people.birthdayYear")}
        hint={i18n.t("people.birthdayYearHint")}
        error={yearBad ? i18n.t("people.birthdayYearInvalid") : null}
        value={year}
        onChangeText={(text) => setYear(text.replace(/\D/g, "").slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
      />
      <View style={styles.actions}>
        {initial ? <Button label={i18n.t("people.birthdayRemove")} variant="outline" height={44} style={styles.flex} disabled={busy} onPress={() => save(null)} /> : null}
        <Button
          label={i18n.t("common.save")}
          variant="secondary"
          height={44}
          style={styles.flex}
          loading={busy}
          disabled={yearBad}
          onPress={() => save({ month, day: shownDay, ...(yearNumber ? { year: yearNumber } : {}) })}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  monthRow: { marginHorizontal: -space.cardPadding },
  months: { gap: 8, paddingHorizontal: space.cardPadding, paddingVertical: 4 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
