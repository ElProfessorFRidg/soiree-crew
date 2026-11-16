"""Validate each native device target before packing its IPA."""
import json
import plistlib
import sys
from pathlib import Path


def inspect_app(path, target="iphone", channel=None):
    app = Path(path)
    with (app / "Info.plist").open("rb") as source:
        info = plistlib.load(source)
    if channel is not None:
        expected = "app.soireecrew.mobile" + (".preview" if channel == "preview" else "")
        if channel not in ("public", "preview") or info.get("CFBundleIdentifier") != expected:
            raise ValueError(f"Wrong bundle identifier for {channel}")
    families = {"iphone": [1], "ipad": [2], "universal": [1, 2]}
    if target not in families or info.get("UIDeviceFamily") != families[target]:
        raise ValueError(f"Wrong device family for {target}: {info.get('UIDeviceFamily')}")
    orientations = info.get("UISupportedInterfaceOrientations~ipad", info.get("UISupportedInterfaceOrientations", []))
    if target in ("ipad", "universal") and not any("Landscape" in value for value in orientations):
        raise ValueError("Native iPad target must support landscape")
    for name in ("main.jsbundle", info.get("CFBundleExecutable", "")):
        file = app / name
        if not name or not file.is_file() or not file.stat().st_size:
            raise ValueError(f"Missing or empty app payload: {name}")
    if not info.get("MinimumOSVersion"):
        raise ValueError("Missing minimum iOS version")
    scenes = info.get("UIApplicationSceneManifest", {}).get("UISceneConfigurations", {}).get("UIWindowSceneSessionRoleApplication", [])
    if not scenes or any(scene.get("UISceneDelegateClassName") != "SceneDelegate" for scene in scenes):
        raise ValueError("Missing or incorrect Objective-C scene delegate name")
    if info.get("CrewStartupDiagnosticsVersion") != 1:
        raise ValueError("Missing native startup diagnostics")
    return {"bundleIdentifier": info["CFBundleIdentifier"], "minimumOSVersion": info["MinimumOSVersion"],
            "deviceFamily": info["UIDeviceFamily"], "target": target, "channel": channel,
            "ipadMode": "native tablet" if 2 in info["UIDeviceFamily"] else "iPhone",
            "orientations": orientations, "sceneDelegate": "SceneDelegate", "startupDiagnostics": 1}


if __name__ == "__main__":
    print(json.dumps(inspect_app(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "iphone", sys.argv[3] if len(sys.argv) > 3 else None), indent=2))
