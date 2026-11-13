"""Validate the device app before packing either iPhone or iPad compatibility IPA."""
import json
import plistlib
import sys
from pathlib import Path


def inspect_app(path):
    app = Path(path)
    with (app / "Info.plist").open("rb") as source:
        info = plistlib.load(source)
    if info.get("UIDeviceFamily") != [1]:
        raise ValueError("Expected an iPhone app ([1]) for iPad compatibility/zoom mode")
    for name in ("main.jsbundle", info.get("CFBundleExecutable", "")):
        file = app / name
        if not name or not file.is_file() or not file.stat().st_size:
            raise ValueError(f"Missing or empty app payload: {name}")
    if not info.get("MinimumOSVersion"):
        raise ValueError("Missing minimum iOS version")
    return {"bundleIdentifier": info["CFBundleIdentifier"], "minimumOSVersion": info["MinimumOSVersion"],
            "deviceFamily": info["UIDeviceFamily"], "ipadMode": "iPhone compatibility (system zoom)"}


if __name__ == "__main__":
    print(json.dumps(inspect_app(sys.argv[1]), indent=2))
