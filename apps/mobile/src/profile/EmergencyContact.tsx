import { useState } from "react";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";

/** Digits, spaces and the usual separators, with an optional leading +. */
const PHONE = /^\+?[0-9 ().-]{3,24}$/;

/**
 * N-28: one person to call or text from the SOS screen. Stays on this phone: the server never
 * sees it, and another account signing in here wipes it (O-13).
 */
export function EmergencyContact() {
  const i18n = useT();
  const stored = useAppStore((state) => state.emergencyContact);
  const [name, setName] = useState(stored?.name ?? "");
  const [phone, setPhone] = useState(stored?.phone ?? "");
  const validPhone = PHONE.test(phone.trim());

  const save = (nextName: string, nextPhone: string) => {
    const n = nextName.trim();
    const p = nextPhone.trim();
    if (!n && !p) useAppStore.setState({ emergencyContact: null });
    else if (n && PHONE.test(p)) useAppStore.setState({ emergencyContact: { name: n.slice(0, 40), phone: p } });
  };

  return (
    <Panel>
      <Text variant="label">{i18n.t("profile.emergencyTitle")}</Text>
      <Text variant="small">{i18n.t("profile.emergencyHint")}</Text>
      <Field
        label={i18n.t("profile.emergencyName")}
        value={name}
        onChangeText={setName}
        onEndEditing={() => save(name, phone)}
        maxLength={40}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
      <Field
        label={i18n.t("profile.emergencyPhone")}
        value={phone}
        onChangeText={setPhone}
        onEndEditing={() => save(name, phone)}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={24}
        error={phone.trim() && !validPhone ? i18n.t("profile.emergencyPhoneInvalid") : null}
      />
    </Panel>
  );
}
