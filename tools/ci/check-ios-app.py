"""Validate each native device target before packing its IPA."""
import hashlib
import json
import os
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
    updates = None
    project_id = os.environ.get("CREW_EXPO_PROJECT_ID", "").strip()
    if project_id:
        version, build = info["CFBundleShortVersionString"], info["CFBundleVersion"]
        runtime = f"crew-{channel}-{target}-{build}"
        stream = f"{channel}-{target}"
        url = f"https://u.expo.dev/{project_id}"
        with (app / "Expo.plist").open("rb") as source:
            config = plistlib.load(source)
        if (config.get("EXUpdatesEnabled") is not True
                or config.get("EXUpdatesURL") != url
                or config.get("EXUpdatesRequestHeaders", {}).get("expo-channel-name") != stream
                or config.get("EXUpdatesRuntimeVersion") != runtime
                or config.get("EXUpdatesCheckOnLaunch") != "ALWAYS"
                or config.get("EXUpdatesLaunchWaitMs") != 0
                or config.get("EXUpdatesHasEmbeddedUpdate", True) is not True):
            raise ValueError(f"Wrong Expo Updates configuration for {stream}")
        extras = "\0".join(os.environ.get(key, "") for key in ("CREW_SERVER_URL", "CREW_PUBLIC_SERVERS"))
        updates = {"projectId": project_id, "runtime": runtime, "stream": stream, "version": version,
                   "build": build, "serverConfig": hashlib.sha256(extras.encode()).hexdigest()}
    return {"bundleIdentifier": info["CFBundleIdentifier"], "minimumOSVersion": info["MinimumOSVersion"],
            "deviceFamily": info["UIDeviceFamily"], "target": target, "channel": channel,
            "ipadMode": "native tablet" if 2 in info["UIDeviceFamily"] else "iPhone",
            "orientations": orientations, "sceneDelegate": "SceneDelegate", "startupDiagnostics": 1, "updates": updates}


if __name__ == "__main__":
    print(json.dumps(inspect_app(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "iphone", sys.argv[3] if len(sys.argv) > 3 else None), indent=2))
