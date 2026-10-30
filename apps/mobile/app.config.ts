import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config. CI passes BUILD_NUMBER (the workflow run number)
// so every installed build can be replaced by the next one.
export default ({ config }: ConfigContext): ExpoConfig => {
  const build = Number.parseInt(process.env.BUILD_NUMBER ?? "1", 10);
  // O-38: remote push needs the aps-environment entitlement, which a free Apple account cannot
  // sign. app.json keeps it off; CREW_PUSH=1 turns it on for builds signed with a paid account
  // (and, on Android, CREW_GOOGLE_SERVICES points at the google-services.json for FCM).
  const push = process.env.CREW_PUSH === "1";
  const googleServices = process.env.CREW_GOOGLE_SERVICES || null;
  const plugins = push
    ? (config.plugins ?? []).map((plugin) =>
        Array.isArray(plugin) && plugin[0] === "expo-notifications" ? [plugin[0], { ...(plugin[1] as object), enableRemoteNotifications: true }] : plugin,
      )
    : config.plugins;
  return {
    ...(config as ExpoConfig),
    ...(plugins ? { plugins: plugins as ExpoConfig["plugins"] } : {}),
    ios: {
      ...config.ios,
      buildNumber: String(build),
      // Safety alerts (SOS, a friend not feeling well) may break through Focus.
      ...(push ? { entitlements: { ...config.ios?.entitlements, "com.apple.developer.usernotifications.time-sensitive": true } } : {}),
    },
    android: { ...config.android, versionCode: build, ...(push && googleServices ? { googleServicesFile: googleServices } : {}) },
    // O-12: the app compares this with the latest GitHub release to say when a newer one exists.
    // The public server the connect screen suggests; CI passes the repository variable CREW_SERVER_URL.
    extra: {
      ...config.extra,
      buildNumber: build,
      releasesApi: "https://api.github.com/repos/ElProfessorFRidg/soiree-crew/releases/latest",
      defaultServerUrl: process.env.CREW_SERVER_URL || null,
      // Builds made by a server (deploy/android) check that server for updates instead of GitHub.
      updateServer: process.env.CREW_UPDATE_SERVER || null,
      // Other public servers to offer, comma-separated (CREW_PUBLIC_SERVERS).
      publicServers: (process.env.CREW_PUBLIC_SERVERS ?? "").split(",").map((u: string) => u.trim().replace(/\/+$/, "")).filter(Boolean),
      // O-38: the app asks for a push token only when the build can receive pushes.
      remotePush: push ? (googleServices ? "ios,android" : "ios") : "",
    },
  };
};
