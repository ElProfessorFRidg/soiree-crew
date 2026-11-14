import { useMemo, useState, type ReactNode } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { fitRegion, MAP_TILE_SIZE as TILE, MAX_MAP_ZOOM as MAX_ZOOM, MIN_MAP_ZOOM as MIN_ZOOM, project, unproject, type LatLng } from "@/motion/math/map";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";

export { fitRegion, type LatLng } from "@/motion/math/map";

// Raster tile map with no native map SDK and no key: Esri World Dark Gray at night, OpenStreetMap by day
// (docs/adr/0003-maps.md). Both need their attribution on screen.
// Gestures move a transformed layer on the UI thread; tiles are recomputed only when a gesture ends.

export interface MapMarker extends LatLng {
  id: string;
  render: () => ReactNode;
}

interface Props {
  center: LatLng;
  zoom: number;
  markers: MapMarker[];
  onRegionChange: (center: LatLng, zoom: number) => void;
  height: number;
  accessibilityLabel: string;
}

export function TileMap({ center, zoom, markers, onRegionChange, height, accessibilityLabel }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const z = Math.round(zoom);
  const origin = project(center, z);

  const commit = (dx: number, dy: number, s: number) => {
    // New centre: the point that the gesture moved under the middle of the map.
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + Math.log2(s)));
    const roundedZoom = Math.round(nextZoom);
    const factor = 2 ** (roundedZoom - z);
    const cx = (origin.x - dx / s) * factor;
    const cy = (origin.y - dy / s) * factor;
    tx.value = 0;
    ty.value = 0;
    scale.value = 1;
    onRegionChange(unproject(cx, cy, roundedZoom), roundedZoom);
  };

  const pan = usePanGesture({
    onUpdate: (event) => {
      "worklet";
      tx.value = event.translationX;
      ty.value = event.translationY;
    },
    onDeactivate: () => {
      "worklet";
      runOnJS(commit)(tx.value, ty.value, scale.value);
    },
  });
  const pinch = usePinchGesture({
    onUpdate: (event) => {
      "worklet";
      scale.value = Math.max(0.25, Math.min(4, event.scale));
    },
    onDeactivate: () => {
      "worklet";
      runOnJS(commit)(tx.value, ty.value, scale.value);
    },
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const layer = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const tiles = useMemo(() => {
    if (!width) return [];
    const left = origin.x - width / 2;
    const top = origin.y - height / 2;
    const max = 2 ** z;
    const list: { key: string; uri: string; x: number; y: number }[] = [];
    // One extra ring of tiles so a pan never shows blank edges before it settles.
    for (let tileX = Math.floor(left / TILE) - 1; tileX <= Math.floor((left + width) / TILE) + 1; tileX++) {
      for (let tileY = Math.floor(top / TILE) - 1; tileY <= Math.floor((top + height) / TILE) + 1; tileY++) {
        if (tileY < 0 || tileY >= max) continue;
        const wrapped = ((tileX % max) + max) % max;
        list.push({
          key: `${z}/${tileX}/${tileY}`,
          uri:
            theme.name === "dark"
              ? `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${tileY}/${wrapped}`
              : `https://tile.openstreetmap.org/${z}/${wrapped}/${tileY}.png`,
          x: tileX * TILE - left,
          y: tileY * TILE - top,
        });
      }
    }
    return list;
  }, [width, height, origin.x, origin.y, z, theme.name]);

  return (
    <View
      style={[styles.box, { height, backgroundColor: theme.surface2 }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, layer]}>
          {tiles.map((tile) => (
            <Image key={tile.key} source={{ uri: tile.uri }} style={[styles.tile, { left: tile.x, top: tile.y }]} />
          ))}
          {width
            ? markers.map((marker) => {
                const point = project(marker, z);
                const world = TILE * 2 ** z;
                let offsetX = point.x - origin.x;
                // A pin just across the antimeridian is nearby, not one whole world away.
                if (offsetX > world / 2) offsetX -= world;
                if (offsetX < -world / 2) offsetX += world;
                return (
                  <View
                    key={marker.id}
                    style={[styles.marker, { left: offsetX + width / 2, top: point.y - origin.y + height / 2 }]}
                    pointerEvents="box-none"
                  >
                    {marker.render()}
                  </View>
                );
              })
            : null}
        </Animated.View>
      </GestureDetector>
      <View style={styles.attribution} pointerEvents="none">
        <Text variant="tab" color={theme.textMuted}>
          {theme.name === "dark" ? "Esri, HERE, Garmin, © OpenStreetMap" : "© OpenStreetMap"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", borderRadius: 18 },
  tile: { position: "absolute", width: TILE, height: TILE },
  marker: { position: "absolute", width: 0, height: 0, alignItems: "center", justifyContent: "center", overflow: "visible" },
  attribution: { position: "absolute", right: 8, bottom: 6 },
});
