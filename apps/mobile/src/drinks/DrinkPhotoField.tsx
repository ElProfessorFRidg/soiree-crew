import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, radius, type GlassIconName } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { easings } from "@/motion/easing";
import { showFailure } from "@/server/errors";
import { showPermissionDenied } from "@/system/permissions";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { pickDrinkPhoto } from "./drinkPhotos";

interface Props {
  /** What is shown now: the saved photo, the one just picked, or null. */
  uri: string | null;
  icon: GlassIconName;
  name: string;
  onPick: (uri: string) => void;
  onRemove: () => void;
}

const SIDE = 96;

/** O-21: the photo of the glass in the editor; taken or chosen, kept on this phone only. */
export function DrinkPhotoField({ uri, icon, name, onPick, onRemove }: Props) {
  const i18n = useT();
  const theme = useTheme();
  const [busy, setBusy] = useState<"camera" | "library" | null>(null);

  const pick = (source: "camera" | "library") => {
    setBusy(source);
    void pickDrinkPhoto(source)
      .then((result) => {
        if (typeof result === "string") onPick(result);
        else if (result !== null) showPermissionDenied(i18n, i18n.t("myGlass.photoDenied"), result === -1);
      })
      .catch(showFailure(i18n))
      .finally(() => setBusy(null));
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label">{i18n.t("myGlass.photo")}</Text>
      <View style={styles.row}>
        <View style={[styles.frame, { backgroundColor: theme.surface2, borderColor: theme.line }]}>
          {uri ? (
            <Animated.View key={uri} entering={FadeIn.duration(duration.enter).easing(easings.out)}>
              <Image source={{ uri }} accessibilityLabel={i18n.t("myGlass.photoOf", { name: name.trim() || i18n.t("drinks.custom") })} accessibilityIgnoresInvertColors style={styles.image} />
            </Animated.View>
          ) : (
            <View accessible accessibilityLabel={i18n.t("myGlass.noPhoto")}>
              <Icon name={`glass:${icon}`} size={36} color={theme.amber} />
            </View>
          )}
        </View>
        <View style={styles.buttons}>
          <Button label={i18n.t("myGlass.takePhoto")} icon="camera" variant="outline" height={44} loading={busy === "camera"} disabled={busy !== null} onPress={() => pick("camera")} />
          <Button label={i18n.t("myGlass.pickPhoto")} icon="image" variant="outline" height={44} loading={busy === "library"} disabled={busy !== null} onPress={() => pick("library")} />
        </View>
      </View>
      {uri ? (
        <Animated.View entering={FadeIn.duration(duration.enter)}>
          <Button label={i18n.t("myGlass.removePhoto")} icon="trash" variant="secondary" height={44} onPress={onRemove} />
        </Animated.View>
      ) : null}
      <Text variant="small">{i18n.t("myGlass.photoHint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  frame: { width: SIDE, height: SIDE, borderRadius: radius.tile, borderWidth: 1.5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: SIDE, height: SIDE },
  buttons: { flex: 1, gap: 8 },
});
