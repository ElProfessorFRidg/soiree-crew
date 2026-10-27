import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config. CI passes BUILD_NUMBER (the workflow run number)
// so every installed build can be replaced by the next one.
export default ({ config }: ConfigContext): ExpoConfig => {
  const build = Number.parseInt(process.env.BUILD_NUMBER ?? "1", 10);
  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, buildNumber: String(build) },
    android: { ...config.android, versionCode: build },
  };
};
