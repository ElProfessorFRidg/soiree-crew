const fs = require("node:fs");
const path = require("node:path");
const { withInfoPlist, withFinalizedMod, IOSConfig } = require("expo/config-plugins");

const MARKER = "// Crew startup diagnostics v1";

function replaceOnce(source, anchor, replacement) {
  if (!source.includes(anchor) || source.indexOf(anchor) !== source.lastIndexOf(anchor)) {
    throw new Error(`withStartupDiagnostics: native template changed near ${anchor.slice(0, 70)}`);
  }
  return source.replace(anchor, replacement);
}

function appDelegate(source, monitor) {
  if (source.includes(MARKER)) return `${source.slice(0, source.indexOf(MARKER))}${MARKER}\n${monitor}\n`;
  source = replaceOnce(source, "    let delegate = ReactNativeDelegate()", `    CrewStartupDiagnostics.shared.begin()\n    let delegate = ReactNativeDelegate()`);
  source = replaceOnce(source, "\n}\n\nclass ReactNativeDelegate", `
  // Use the actual type, rather than relying on module-qualified Objective-C class lookup.
  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
}

class ReactNativeDelegate`);
  return `${source}\n${MARKER}\n${monitor}\n`;
}

function sceneDelegate(source) {
  if (source.includes(MARKER)) return source;
  return "import UIKit\n" + replaceOnce(source, "class SceneDelegate: ExpoAppSceneDelegate {", `class SceneDelegate: ExpoAppSceneDelegate {
  ${MARKER}
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    if let windowScene = scene as? UIWindowScene { CrewStartupDiagnostics.shared.connect(windowScene) }
    // A launch argument only, used by CI to check the startup log without JavaScript.
    if ProcessInfo.processInfo.arguments.contains("-crewStartupTestNoJS") {
      CrewStartupDiagnostics.shared.testingWithoutJavaScript()
      return
    }
    CrewStartupDiagnostics.shared.startingReact()
    super.scene(scene, willConnectTo: session, options: options)
  }
`);
}

module.exports = function withStartupDiagnostics(config) {
  config = withInfoPlist(config, (config) => {
    const manifest = config.modResults.UIApplicationSceneManifest;
    const scenes = manifest?.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
    if (!Array.isArray(scenes) || !scenes.length) throw new Error("withStartupDiagnostics: missing Expo scene configuration");
    // The generated class has @objc(SceneDelegate): this is its Objective-C runtime name.
    for (const scene of scenes) scene.UISceneDelegateClassName = "SceneDelegate";
    config.modResults.CrewStartupDiagnosticsVersion = 1;
    return config;
  });
  return withFinalizedMod(config, ["ios", (config) => {
    const delegatePath = IOSConfig.Paths.getAppDelegateFilePath(config.modRequest.projectRoot);
    const folder = path.dirname(delegatePath);
    const monitor = fs.readFileSync(path.join(config.modRequest.projectRoot, "native/startup/CrewStartupDiagnostics.swift"), "utf8");
    fs.writeFileSync(delegatePath, appDelegate(fs.readFileSync(delegatePath, "utf8"), monitor));
    const scene = path.join(folder, "SceneDelegate.swift");
    fs.writeFileSync(scene, sceneDelegate(fs.readFileSync(scene, "utf8")));
    return config;
  }]);
};

// Test the transformations without generating or building an Xcode project.
module.exports.transforms = { appDelegate, sceneDelegate };
