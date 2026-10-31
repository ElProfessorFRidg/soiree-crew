import { useEffect, useState } from "react";
import { api } from "@/server/api";
import { normaliseServerUrl } from "@/server/session";
import { extraString, extraStrings } from "@/system/extra";

export interface ServerInfo {
  url: string;
  name: string;
  description: string;
  /** The server lists its public crews to people without an account (PUBLIC_SERVER). */
  public: boolean;
  openCrews: number;
}

/** The official server this build was made for (CREW_SERVER_URL), if any. */
export function officialServer(): string | null {
  const url = extraString("defaultServerUrl");
  return url ? normaliseServerUrl(url) : null;
}

/** The other public servers this build knows (CREW_PUBLIC_SERVERS), the official one left out. */
export function otherPublicServers(): string[] {
  const official = officialServer();
  const others = extraStrings("publicServers")
    .map((url) => normaliseServerUrl(url))
    .filter((url): url is string => url !== null && url !== official);
  return [...new Set(others)];
}

const cache = new Map<string, Promise<ServerInfo | null>>();

/** What a server says about itself (GET /v1/info), asked once per address. Null when it does not answer. */
export function serverInfo(url: string): Promise<ServerInfo | null> {
  let found = cache.get(url);
  if (!found) {
    found = api<Omit<ServerInfo, "url">>("/v1/info", { baseUrl: url, token: null })
      .then((info) => ({ url, name: info.name, description: info.description, public: info.public, openCrews: info.openCrews }))
      .catch(() => {
        // A server that was down may come back: the next screen asks again.
        cache.delete(url);
        return null;
      });
    cache.set(url, found);
  }
  return found;
}

export function useServerInfo(url: string | null): ServerInfo | null {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    if (!url) return;
    let live = true;
    void serverInfo(url).then((found) => live && setInfo(found));
    return () => {
      live = false;
    };
  }, [url]);
  return info;
}

/** The host alone ("crew.example.fr"), for a server that has not told its name yet. */
export function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
