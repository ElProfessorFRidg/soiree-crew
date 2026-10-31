import { useEffect, useState } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { duration, radius, type GlassIconName } from "@crew/design-tokens";
import { easings } from "@/motion/easing";
import { useTheme } from "@/theme";
import { Icon } from "@/ui/Icon";
import { useDrinkPhoto } from "./drinkPhotos";

interface Props {
  icon: GlassIconName;
  /** The saved drink, whose photo replaces the glass when this phone has one. */
  drinkId?: string | null;
  size: number;
  color: string;
  /** Side of the photo; a photo needs more room than the glass outline to be read. */
  photoSize?: number;
}

/** O-21: my drink's own photo where it has one, its glass icon otherwise (or once the file is gone). */
export function DrinkThumb({ icon, drinkId, size, color, photoSize = size + 16 }: Props) {
  const theme = useTheme();
  const uri = useDrinkPhoto(drinkId);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [uri]);
  if (!uri || broken) return <Icon name={`glass:${icon}`} size={size} color={color} />;
  return (
    <Animated.View entering={FadeIn.duration(duration.enter).easing(easings.out)}>
      <Image
        source={{ uri }}
        onError={() => setBroken(true)}
        accessibilityIgnoresInvertColors
        style={[styles.photo, { width: photoSize, height: photoSize, backgroundColor: theme.surfaceRaised }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  photo: { borderRadius: radius.tile - 4 },
});
