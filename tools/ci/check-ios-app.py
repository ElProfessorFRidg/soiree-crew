"""Validate each native device target before packing its IPA."""
import json
import plistlib
import sys
from pathlib import Path


def inspect_app(path, target="iphone"):
    app = Path(path)
    with (app / "Info.plist").open("rb") as source:
        info = plistlib.load(source)
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
    return {"bundleIdentifier": info["CFBundleIdentifier"], "minimumOSVersion": info["MinimumOSVersion"],
            "deviceFamily": info["UIDeviceFamily"], "target": target,
            "ipadMode": "native tablet" if 2 in info["UIDeviceFamily"] else "iPhone",
            "orientations": orientations}


if __name__ == "__main__":
    print(json.dumps(inspect_app(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "iphone"), indent=2))
