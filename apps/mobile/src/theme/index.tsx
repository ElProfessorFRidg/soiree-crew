import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState, useColorScheme } from "react-native";
import { themes, type Theme } from "@crew/design-tokens";
import { useAppStore } from "@/state/store";
import { isDaytime, themeFor } from "./choice";

const ThemeContext = createContext<Theme>(themes.dark);

/** Whether it is daytime now, checked each minute and whenever the app comes back. */
function useDaytime(watch: boolean): boolean {
  const [day, setDay] = useState(() => isDaytime(new Date().getHours()));
  useEffect(() => {
    if (!watch) return;
    const check = () => setDay(isDaytime(new Date().getHours()));
    check();
    const timer = setInterval(check, 60_000);
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [watch]);
  return day;
}

/**
 * Night first: dark unless the person picked the light theme, or "Auto" with a phone in light
 * appearance by day (QOL-24, theme/choice.ts). `force` lets a screen pick its theme.
 */
export function ThemeProvider({ force, children }: { force?: "dark" | "light" | "system"; children: ReactNode }) {
  const system = useColorScheme();
  const choice = useAppStore((state) => state.themeChoice);
  const day = useDaytime(!force && choice === "auto" && system === "light");
  const name = force === "system" ? (system === "light" ? "light" : "dark") : (force ?? themeFor(choice, system, day));
  return <ThemeContext.Provider value={themes[name]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
