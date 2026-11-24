import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { transforms } = require("../../apps/mobile/plugins/withStartupDiagnostics.js");
const app = `internal import Expo
import React
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  func application() {
    let delegate = ReactNativeDelegate()
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {}
`;
const scene = "internal import Expo\n@objc(SceneDelegate)\nclass SceneDelegate: ExpoAppSceneDelegate {\n}\n";

describe("native startup plugin", () => {
  it("registers a concrete scene type and installs diagnostics before native factory setup", () => {
    const output = transforms.appDelegate(app, "// monitor one");
    expect(output.indexOf("shared.begin()")).toBeLessThan(output.indexOf("let delegate"));
    expect(output).toContain("configuration.delegateClass = SceneDelegate.self");
    expect(transforms.appDelegate(output, "// monitor one")).toBe(output);
    const updated = transforms.appDelegate(output, "// monitor two");
    expect(updated).toContain("// monitor two");
    expect(updated).not.toContain("// monitor one");
    expect(updated.match(/configurationForConnecting/g)).toHaveLength(1);
  });
  it("logs native milestones before React and preserves the superclass cold-start URL handling", () => {
    const output = transforms.sceneDelegate(scene);
    expect(output.indexOf("shared.connect(windowScene)")).toBeLessThan(output.indexOf("shared.startingReact()"));
    expect(output).toContain("super.scene(scene, willConnectTo: session, options: options)");
    expect(output).not.toContain("asyncAfter");
    expect(output).toContain('arguments.contains("-crewStartupTestNoJS")');
    expect(transforms.sceneDelegate(output)).toBe(output);
  });
  it("fails visibly when an SDK changes the template instead of silently removing the guard", () => {
    expect(() => transforms.appDelegate("class NewDelegate {}", "")).toThrow("native template changed");
    expect(() => transforms.sceneDelegate("class NewScene {} ")).toThrow("native template changed");
  });
});
