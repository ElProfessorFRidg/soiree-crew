"""Turns the device build of the app into one the iOS simulator accepts, so CI launches the exact
IPA it releases instead of compiling a second time.

Apple Silicon simulators run arm64 code, the same as an iPhone. What stops a device build is
the platform each Mach-O declares (LC_BUILD_VERSION: iOS) and the Info.plist platform keys. This
rewrites both; the caller re-signs ad hoc afterwards.

Usage: python3 ios-device-to-simulator.py Payload/App.app
"""

import os
import plistlib
import struct
import sys

MH_MAGIC_64 = 0xFEEDFACF
FAT_MAGIC = 0xCAFEBABE
LC_BUILD_VERSION = 0x32
LC_VERSION_MIN_IPHONEOS = 0x25
PLATFORM_IOS = 2
PLATFORM_IOS_SIMULATOR = 7


def patch_macho(path: str) -> str:
    with open(path, "rb") as f:
        data = bytearray(f.read())
    if len(data) < 32:
        return "skip"
    magic = struct.unpack_from("<I", data, 0)[0]
    if struct.unpack_from(">I", data, 0)[0] == FAT_MAGIC:
        return "fat (not handled)"
    if magic != MH_MAGIC_64:
        return "skip"
    ncmds = struct.unpack_from("<I", data, 16)[0]
    offset = 32
    patched = False
    for _ in range(ncmds):
        cmd, size = struct.unpack_from("<II", data, offset)
        if cmd == LC_BUILD_VERSION and struct.unpack_from("<I", data, offset + 8)[0] == PLATFORM_IOS:
            struct.pack_into("<I", data, offset + 8, PLATFORM_IOS_SIMULATOR)
            patched = True
        if cmd == LC_VERSION_MIN_IPHONEOS:
            return "old load command (not handled)"
        offset += size
    if not patched:
        return "no iOS platform"
    with open(path, "wb") as f:
        f.write(data)
    return "patched"


def patch_plist(path: str) -> None:
    with open(path, "rb") as f:
        info = plistlib.load(f)
    info["CFBundleSupportedPlatforms"] = ["iPhoneSimulator"]
    if "DTPlatformName" in info:
        info["DTPlatformName"] = "iphonesimulator"
    if "DTSDKName" in info:
        info["DTSDKName"] = info["DTSDKName"].replace("iphoneos", "iphonesimulator")
    with open(path, "wb") as f:
        plistlib.dump(info, f, fmt=plistlib.FMT_BINARY)


def main(app: str) -> int:
    problems = []
    for root, _, files in os.walk(app):
        for name in files:
            path = os.path.join(root, name)
            if name == "Info.plist" and (root == app or root.endswith(".framework")):
                patch_plist(path)
                continue
            result = patch_macho(path)
            if result in ("patched", "skip"):
                if result == "patched":
                    print("patched", os.path.relpath(path, app))
                continue
            if result != "no iOS platform":
                problems.append(f"{os.path.relpath(path, app)}: {result}")
    for problem in problems:
        print("::warning::" + problem)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
