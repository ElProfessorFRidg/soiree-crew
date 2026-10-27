import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { palette } from "@crew/design-tokens";
import type { Recipe } from "./recipes";

// O-66: a drawn picture for every recipe, the glass it is served in, its colour, ice and garnish.
// Real photos of 470 drinks are not something we can shoot; a consistent drawing reads better than
// a stock photo that does not match the measures.

export type Glass = "shot" | "pint" | "flute" | "wine" | "coupe" | "tumbler" | "highball" | "mug";

/** Picked from what the recipe is: no glass field to keep in step with the ingredient list. */
export function glassOf(recipe: Recipe): Glass {
  const ids = new Set(recipe.ingredients.map((i) => i.id));
  const volume = recipe.ingredients.reduce((s, i) => s + (i.cl ?? 0), 0);
  const topped = recipe.ingredients.some((i) => i.top);
  if (recipe.category === "shot" || volume <= 6) return "shot";
  if (recipe.category === "beer" || ids.has("beer")) return "pint";
  if ((ids.has("champagne") || ids.has("prosecco")) && !ids.has("aperol")) return "flute";
  if (ids.has("aperol") || ids.has("whiteWine")) return "wine";
  if (ids.has("espresso") || ids.has("cream") || recipe.category === "dessert") return recipe.ingredients.some((i) => i.id === "ice") ? "tumbler" : "mug";
  if (!ids.has("ice") && !topped) return "coupe";
  if (topped || volume >= 15) return "highball";
  return "tumbler";
}

/** Outline and liquid area of each glass on a 64 x 64 grid. */
const SHAPES: Record<Glass, { outline: string; liquid: string; top: number; bottom: number; stem?: string }> = {
  shot: { outline: "M22 26h20l-2.5 26h-15z", liquid: "M22.6 32h18.8l-2 20h-14.8z", top: 32, bottom: 52 },
  pint: { outline: "M19 10h26l-3 44h-20z", liquid: "M19.5 18h25l-2.5 36h-20z", top: 18, bottom: 54 },
  flute: { outline: "M26 6h12c0 10-1 22-6 26c-5-4-6-16-6-26z", liquid: "M26.3 12h11.4c-.3 8-1.6 16-5.7 19.5c-4.1-3.5-5.4-11.5-5.7-19.5z", top: 12, bottom: 31, stem: "M32 32v20M24 56h16" },
  wine: { outline: "M20 8h24c0 12-4 22-12 23c-8-1-12-11-12-23z", liquid: "M20.5 15h23c-1 8-5 14-11.5 14.5c-6.5-.5-10.5-6.5-11.5-14.5z", top: 15, bottom: 30, stem: "M32 31v21M23 56h18" },
  coupe: { outline: "M14 18h36c-1 8-8 13-18 13s-17-5-18-13z", liquid: "M15 20h34c-1.5 6-8 9.5-17 9.5s-15.5-3.5-17-9.5z", top: 20, bottom: 30, stem: "M32 31v21M23 56h18" },
  tumbler: { outline: "M17 22h30l-2 32h-26z", liquid: "M17.4 28h29.2l-1.6 26h-26z", top: 28, bottom: 54 },
  highball: { outline: "M21 8h22l-1.5 48h-19z", liquid: "M21.3 16h21.4l-1.3 40h-18.8z", top: 16, bottom: 56 },
  mug: { outline: "M16 20h28v26a8 8 0 0 1-8 8h-12a8 8 0 0 1-8-8zM44 26h4a6 6 0 0 1 0 12h-4", liquid: "M16.5 26h27v20a7.5 7.5 0 0 1-7.5 7.5h-12a7.5 7.5 0 0 1-7.5-7.5z", top: 26, bottom: 54 },
};

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join("")}`;
}

export function RecipeArt({ recipe, size = 64, background = true }: { recipe: Recipe; size?: number; background?: boolean }) {
  const glass = glassOf(recipe);
  const shape = SHAPES[glass];
  const ids = new Set(recipe.ingredients.map((i) => i.id));
  const id = `r-${recipe.id}`;
  const foam = glass === "pint" || ids.has("cream") || ids.has("irishCream") || ids.has("espresso");
  const ice = ids.has("ice") && glass !== "shot" && glass !== "flute";
  const citrus = ids.has("lime") || ids.has("limeJuice") || ids.has("lemonJuice") || ids.has("orange");
  const mint = ids.has("mint");
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(recipe.colour, 0.12)} />
          <Stop offset="1" stopColor={shade(recipe.colour, -0.18)} />
        </LinearGradient>
        <ClipPath id={`${id}-c`}>
          <Path d={shape.liquid} />
        </ClipPath>
      </Defs>
      {background ? <Rect x="0" y="0" width="64" height="64" rx="14" fill={palette.dark.surfaceRaised} /> : null}
      <Path d={shape.liquid} fill={`url(#${id}-g)`} />
      <G clipPath={`url(#${id}-c)`}>
        {ice ? (
          <>
            <Rect x="24" y={shape.top + 4} width="8" height="8" rx="1.5" fill="#FFFFFF" opacity={0.35} transform={`rotate(-12 28 ${shape.top + 8})`} />
            <Rect x="33" y={shape.top + 9} width="8" height="8" rx="1.5" fill="#FFFFFF" opacity={0.3} transform={`rotate(10 37 ${shape.top + 13})`} />
          </>
        ) : null}
        {foam ? <Rect x="0" y={shape.top - 1} width="64" height="5" fill={palette.dark.text} opacity={0.9} /> : null}
        <Circle cx="38" cy={shape.bottom - 6} r="1.2" fill="#FFFFFF" opacity={0.5} />
        <Circle cx="35" cy={shape.bottom - 12} r="0.9" fill="#FFFFFF" opacity={0.45} />
      </G>
      <Path d={shape.outline} fill="none" stroke={palette.dark.text} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {shape.stem ? <Path d={shape.stem} fill="none" stroke={palette.dark.text} strokeWidth={2} strokeLinecap="round" /> : null}
      {citrus ? <Path d={`M40 ${shape.top - 2}a6 6 0 0 1 10 -6`} fill="none" stroke={ids.has("orange") ? "#F4A23D" : "#9BD8A8"} strokeWidth={3} strokeLinecap="round" /> : null}
      {mint ? <Path d={`M24 ${shape.top - 1}c-3-5 1-8 4-6c0 3-1 5-4 6z`} fill="#5FA873" /> : null}
    </Svg>
  );
}
