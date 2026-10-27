import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config. CI passes BUILD_NUMBER (the workflow run number)
// so every installed build can be replaced by the next one.
export default ({ config }: ConfigContext): ExpoConfig => {
  const build = Number.parseInt(process.env.BUILD_NUMBER ?? "1", 10);
  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, buildNumber: String(build) },
    android: { ...config.android, versionCode: build },
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
    },
  };
};
