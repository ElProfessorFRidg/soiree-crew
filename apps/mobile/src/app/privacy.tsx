import { useT } from "@/i18n";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const SECTIONS = [
  ["privacy.what", "privacy.whatBody"],
  ["privacy.health", "privacy.healthBody"],
  ["privacy.who", "privacy.whoBody"],
  ["privacy.where", "privacy.whereBody"],
  ["privacy.never", "privacy.neverBody"],
  ["privacy.rights", "privacy.rightsBody"],
] as const;

/** O-08: readable before any account exists; the full register is docs/PRIVACY.md. */
export default function PrivacyScreen() {
  const i18n = useT();
  return (
    <Screen back title={i18n.t("privacy.title")}>
      {SECTIONS.map(([title, body]) => (
        <Panel key={title}>
          <Text variant="h3">{i18n.t(title)}</Text>
          <Text>{i18n.t(body)}</Text>
        </Panel>
      ))}
    </Screen>
  );
}
