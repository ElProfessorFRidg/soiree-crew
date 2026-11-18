// Keep this before Router and its imports: a native UIKit watchdog can then locate a startup hang.
const { reportStartup } = require("./src/system/startupReport");
reportStartup("entry", "ready");
try {
  require("expo-router/entry");
  reportStartup("router", "ready");
  // The background task must be defined even in a headless launch.
  require("./src/location/outing");
} catch (error) {
  reportStartup("entry", "failed");
  throw error;
}

const { Platform } = require("react-native");

if (Platform.OS === "android") {
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  const { widgetTaskHandler } = require("./src/widgets/handler");
  registerWidgetTaskHandler(widgetTaskHandler);
}
