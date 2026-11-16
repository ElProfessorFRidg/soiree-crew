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
    // A launch argument only, used by CI to prove the watchdog works without JavaScript.
    if ProcessInfo.processInfo.arguments.contains("-crewStartupTestNoJS") {
      CrewStartupDiagnostics.shared.testingWithoutJavaScript()
      return
    }
    // Let UIKit draw the native status before potentially slow React/native module initialization.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
      self?.connectReact(scene, session: session, options: connectionOptions)
    }
  }

  private func connectReact(_ scene: UIScene, session: UISceneSession, options: UIScene.ConnectionOptions) {
    CrewStartupDiagnostics.shared.startingReact()
    super.scene(scene, willConnectTo: session, options: options)
  }
`);
}

function splashStoryboard(source) {
  if (source.includes('id="CrewStartupLabel"')) return source;
  source = replaceOnce(source, "                        </subviews>", `                            <label id="CrewStartupLabel" text="SC00 · Ouverture de Soirée Crew…" textAlignment="center" numberOfLines="2" translatesAutoresizingMaskIntoConstraints="NO">
                                <rect key="frame" x="24" y="510" width="345" height="40"/>
                                <fontDescription key="fontDescription" type="system" pointSize="14"/>
                                <color key="textColor" white="0.85" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>
                            </label>
                        </subviews>`);
  return replaceOnce(source, "                        </constraints>", `                            <constraint firstItem="CrewStartupLabel" firstAttribute="top" secondItem="EXPO-SplashScreen" secondAttribute="bottom" constant="24" id="CrewStartupTop"/>
                            <constraint firstItem="CrewStartupLabel" firstAttribute="leading" secondItem="EXPO-ContainerView" secondAttribute="leading" constant="24" id="CrewStartupLeading"/>
                            <constraint firstItem="EXPO-ContainerView" firstAttribute="trailing" secondItem="CrewStartupLabel" secondAttribute="trailing" constant="24" id="CrewStartupTrailing"/>
                        </constraints>`);
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
    const splash = path.join(folder, "SplashScreen.storyboard");
    fs.writeFileSync(splash, splashStoryboard(fs.readFileSync(splash, "utf8")));
    return config;
  }]);
};

// Test the transformations without generating or building an Xcode project.
module.exports.transforms = { appDelegate, sceneDelegate, splashStoryboard };
