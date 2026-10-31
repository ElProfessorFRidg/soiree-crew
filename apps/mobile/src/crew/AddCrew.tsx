import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { CREW_CATEGORIES, CREW_KINDS, type CrewCategory, type CrewKind } from "@/server/crewData";
import { useDraft } from "@/state/drafts";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { Field } from "./Field";
import { inviteCodeFrom, parseInviteQr } from "./invite";
import { QrScanner } from "./LinkScanner";

/** A code typed or pasted, alone or inside a share link (https://server/i/CODE) or the app link. */
export function readInvite(text: string): { code: string; server: string | null } | null {
  const parsed = parseInviteQr(text);
  if (parsed) return parsed;
  const code = inviteCodeFrom(text);
  return code ? { code, server: null } : null;
}

/** "J'ai un code": the code or the link, a QR scan, or what the clipboard holds. */
export function JoinByCode({
  initialCode = "",
  busy,
  disabled,
  onSubmit,
}: {
  initialCode?: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (code: string, server: string | null) => void;
}) {
  const i18n = useT();
  const [text, setText] = useState(initialCode);
  const [problem, setProblem] = useState<string | null>(null);
  const found = readInvite(text);
  return (
    <Panel>
      <Field
        label={i18n.t("arrival.codeLabel")}
        placeholder={i18n.t("arrival.codePlaceholder")}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setProblem(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={300}
        returnKeyType="go"
        onSubmitEditing={() => (found ? onSubmit(found.code, found.server) : setProblem(i18n.t("arrival.codeInvalid")))}
        error={problem}
      />
      <QrScanner label={i18n.t("crew.scanQr")} hint={i18n.t("crew.scanQrHint")} parse={parseInviteQr} onScan={(scanned) => onSubmit(scanned.code, scanned.server)} />
      <Button
        label={i18n.t("crew.pasteInvite")}
        variant="outline"
        icon="link"
        height={44}
        onPress={() =>
          void Clipboard.getStringAsync().then((pasted) => {
            // QOL-29: a friend who installed from a link pastes it here; the code is taken from the link or as typed.
            if (readInvite(pasted)) {
              setText(pasted.trim());
              setProblem(null);
            } else setProblem(i18n.t("crew.pasteNothing"));
          })
        }
      />
      <Button
        label={i18n.t("arrival.codeCta")}
        height={52}
        disabled={!found || disabled}
        loading={busy}
        onPress={() => (found ? onSubmit(found.code, found.server) : undefined)}
      />
    </Panel>
  );
}

/** Public or private, each with what it means in one line. Radio cards: the choice reads before it is made. */
export function VisibilityChoice({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  const i18n = useT();
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={i18n.t("arrival.visibility")} style={styles.choices}>
      {([false, true] as const).map((value) => {
        const on = value === open;
        const title = value ? i18n.t("arrival.public") : i18n.t("arrival.private");
        const hint = value ? i18n.t("arrival.publicHint") : i18n.t("arrival.privateHint");
        return (
          <Pressable
            key={String(value)}
            accessibilityRole="radio"
            accessibilityLabel={`${title}. ${hint}`}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(value);
            }}
            style={[styles.choice, { borderColor: on ? theme.amber : theme.line, backgroundColor: theme.surfaceRaised }]}
          >
            <View style={[styles.radio, { borderColor: on ? theme.amber : theme.lineStrong }]}>{on ? <View style={[styles.dot, { backgroundColor: theme.amber }]} /> : null}</View>
            <View style={styles.flex}>
              <Text variant="h3">{title}</Text>
              <Text variant="small">{hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface CrewDraft {
  name: string;
  kind: CrewKind;
  open: boolean;
  category?: CrewCategory;
}

/**
 * "Créer": a name, then public or private. A public crew may say what it is, for the listing.
 * Signed in, the kind of crew (friends, school...) is asked too, as before.
 */
export function CreateCrewForm({
  withKind,
  busy,
  disabled,
  onSubmit,
}: {
  withKind?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Resolves true once the crew exists (or the account sheet took over), so the draft name clears. */
  onSubmit: (draft: CrewDraft) => Promise<boolean> | boolean;
}) {
  const i18n = useT();
  const [name, setName, clearName] = useDraft("crew:name");
  const [kind, setKind] = useState<CrewKind>("friends");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CrewCategory | undefined>(undefined);
  const submit = async () => {
    const done = await onSubmit({ name: name.trim(), kind, open, ...(open && category ? { category } : {}) });
    if (done) clearName();
  };
  return (
    <Panel>
      <Field label={i18n.t("crew.crewName")} value={name} onChangeText={setName} maxLength={40} returnKeyType="done" />
      {withKind ? (
        <View style={styles.chips}>
          {CREW_KINDS.map((k) => (
            <Chip key={k} label={i18n.t(`crew.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      ) : null}
      <VisibilityChoice open={open} onChange={setOpen} />
      {open ? (
        <View style={styles.group}>
          <Text variant="label">{i18n.t("arrival.categoryLabel")}</Text>
          <View style={styles.chips}>
            {CREW_CATEGORIES.map((c) => (
              <Chip key={c} label={i18n.t(`arrival.categories.${c}`)} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
            ))}
          </View>
        </View>
      ) : null}
      <Button label={i18n.t("arrival.createCta")} height={52} disabled={!name.trim() || disabled} loading={busy} onPress={() => void submit()} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: { gap: 8 },
  choices: { gap: 10 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.input, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
