import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { themes, type Theme } from "@crew/design-tokens";

const ThemeContext = createContext<Theme>(themes.dark);

/**
 * Night first: the app is dark unless a daytime screen asks for the light theme
 * (next-morning mode, DESIGN.md §1). `force` lets a screen pick its theme.
 */
export function ThemeProvider({ force, children }: { force?: "dark" | "light" | "system"; children: ReactNode }) {
  const system = useColorScheme();
  const name = force === "system" ? (system === "light" ? "light" : "dark") : (force ?? "dark");
  return <ThemeContext.Provider value={themes[name]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
