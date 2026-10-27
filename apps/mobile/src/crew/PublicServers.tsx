import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { Chip } from "@/ui/controls";
import { Text } from "@/ui/Text";

interface ServerInfo {
  url: string;
  name: string;
  description: string;
  openCrews: number;
}

/** Public servers this build knows (CREW_SERVER_URL and CREW_PUBLIC_SERVERS at build time). */
function knownServers(): string[] {
  const extra = (Constants.expoConfig?.extra ?? {}) as { defaultServerUrl?: string | null; publicServers?: string[] };
  return [...new Set([extra.defaultServerUrl, ...(extra.publicServers ?? [])].filter((u): u is string => Boolean(u)))];
}

/** Each known server says who it is (GET /v1/info); only the ones that answer and call themselves public are offered. */
export function PublicServers({ selected, onPick }: { selected: string; onPick: (url: string) => void }) {
  const i18n = useT();
  const [servers, setServers] = useState<ServerInfo[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all(
      knownServers().map(async (url) => {
        try {
          const res = await fetch(`${url}/v1/info`);
          const info = (await res.json()) as { name: string; description: string; public: boolean; openCrews: number };
          return info.public ? { url, name: info.name, description: info.description, openCrews: info.openCrews } : null;
        } catch {
          return null;
        }
      }),
    ).then((list) => live && setServers(list.filter((s): s is ServerInfo => s !== null)));
    return () => {
      live = false;
    };
  }, []);
  if (!servers.length) return null;
  const picked = servers.find((s) => s.url === selected);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{i18n.t("crew.publicServers")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {servers.map((s) => (
          <Chip key={s.url} label={s.name} selected={s.url === selected} onPress={() => onPick(s.url)} />
        ))}
      </View>
      {picked ? <Text variant="small">{[picked.description, picked.openCrews ? i18n.plural("crew.openCrewsCount", picked.openCrews) : ""].filter(Boolean).join(" ")}</Text> : null}
    </View>
  );
}
