import * as Location from "expo-location";
import { Platform } from "react-native";
import { create } from "zustand";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";

/**
 * N-07: sharing my position with the crew during one party. Off by default, asked
 * for only when turned on, foreground only, and it stops by itself when the party ends.
 */
interface ShareState {
  partyId: string | null;
  lastSentAt: number | null;
  error: "denied" | "unavailable" | null;
}

export const useLiveShare = create<ShareState>(() => ({ partyId: null, lastSentAt: null, error: null }));

let watcher: Location.LocationSubscription | null = null;
const WATCH_INTERVAL_MS = 60_000;

function partyIsLive(partyId: string): boolean {
  const now = Date.now();
  const party = useCrewData.getState().parties.find((p) => p.id === partyId);
  return !!party && party.closedAt === null && party.startsAt <= now && party.endsAt >= now;
}

async function send(partyId: string, coords: Location.LocationObjectCoords): Promise<void> {
  if (!partyIsLive(partyId)) {
    await stopSharing();
    return;
  }
  await api(`/v1/parties/${partyId}/location`, {
    method: "PUT",
    body: { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy ?? 999 },
  });
  useLiveShare.setState({ lastSentAt: Date.now() });
}

export async function startSharing(partyId: string): Promise<boolean> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    useLiveShare.setState({ error: "denied" });
    return false;
  }
  await stopSharing();
  useLiveShare.setState({ partyId, error: null });
  try {
    const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await send(partyId, first.coords);
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: WATCH_INTERVAL_MS, distanceInterval: 40 },
      (position) => {
        // A browser ignores timeInterval and may fire every second: the same pace by hand.
        const last = useLiveShare.getState().lastSentAt;
        if (Platform.OS === "web" && last !== null && Date.now() - last < WATCH_INTERVAL_MS) return;
        void send(partyId, position.coords).catch(() => undefined);
      },
    );
    return true;
  } catch {
    useLiveShare.setState({ partyId: null, error: "unavailable" });
    return false;
  }
}

/** Ghost mode: stops the watch and removes my position from the server. */
export async function stopSharing(): Promise<void> {
  watcher?.remove();
  watcher = null;
  const { partyId } = useLiveShare.getState();
  useLiveShare.setState({ partyId: null, lastSentAt: null });
  if (partyId) await api(`/v1/parties/${partyId}/location`, { method: "DELETE" }).catch(() => undefined);
}

export interface FriendLocation {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export async function fetchFriendLocations(partyId: string): Promise<FriendLocation[]> {
  const data = await api<{ locations: FriendLocation[] }>(`/v1/parties/${partyId}/locations`);
  return data.locations;
}
