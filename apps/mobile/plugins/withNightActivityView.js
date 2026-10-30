// HUB-02: expo-live-activity copies its own widget into ios/LiveActivity while it edits the Xcode
// project. This runs after every other mod and puts our SwiftUI view (native/live-activity) in
// its place, under the same file name, so the target and the module stay as the package made them.
const fs = require("fs");
const path = require("path");
const { withFinalizedMod } = require("expo/config-plugins");

const FILES = ["LiveActivityWidget.swift"];

module.exports = function withNightActivityView(config) {
  return withFinalizedMod(config, [
    "ios",
    (config) => {
      const target = path.join(config.modRequest.platformProjectRoot, "LiveActivity");
      if (!fs.existsSync(target)) throw new Error("withNightActivityView: ios/LiveActivity is missing; expo-live-activity must come first");
      for (const file of FILES) {
        fs.copyFileSync(path.join(config.modRequest.projectRoot, "native", "live-activity", file), path.join(target, file));
      }
      return config;
    },
  ]);
};
