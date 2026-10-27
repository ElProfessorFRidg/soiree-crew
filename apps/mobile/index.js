// App entry: Expo Router, plus the Android home-screen widget's headless task (O-33).
import "expo-router/entry";
import { Platform } from "react-native";

if (Platform.OS === "android") {
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  const { widgetTaskHandler } = require("./src/widgets/handler");
  registerWidgetTaskHandler(widgetTaskHandler);
}
