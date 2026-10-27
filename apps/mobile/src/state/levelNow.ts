import { create } from "zustand";
import type { UiLevel } from "@crew/bac";

/** The party screen's current UI level, for what lives outside it (the toast host sizes its undo button on it). */
export const useLevelNow = create<{ level: UiLevel }>(() => ({ level: 0 }));
