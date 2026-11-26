"""Compare the resolved mobile graph, not the whole pnpm lockfile (v9)."""
import json
import posixpath
import re
import subprocess
import sys
import yaml

# Deliberately small reviewed set. A new or unknown transitive package is native-risk.
PURE = {"zustand", "double-metaphone", "@noble/ciphers", "@noble/curves", "@noble/hashes", "ts-mls"}
TEST_ONLY = {"vitest"}

def read(ref, path):
    return subprocess.check_output(["git", "show", f"{ref}:{path}"], text=True)

def graph(lock):
    if str(lock.get("lockfileVersion")) != "9.0":
        raise ValueError("unsupported lockfile")
    imports, snapshots, packages = (lock[k] for k in ("importers", "snapshots", "packages"))
    result, seen = {}, set()
    def visit_import(name):
        marker = ("workspace", name)
        if marker in seen:
            return
        seen.add(marker)
        entry = imports[name]
        for kind in ("dependencies", "optionalDependencies", "devDependencies"):
            for dep, info in entry.get(kind, {}).items():
                version = info["version"]
                if version.startswith("link:"):
                    visit_import(posixpath.normpath(posixpath.join(name, version[5:])))
                else:
                    visit(dep, version)
    def visit(name, version):
        if version.startswith(("link:", "file:", "workspace:", "npm:")):
            raise ValueError("unsupported dependency reference")
        key = f"{name}@{version}"
        if key in seen:
            return
        seen.add(key)
        snapshot = snapshots[key]
        pkg_key = key.split("(", 1)[0]
        package = packages[pkg_key]
        result[key] = [package, snapshot]
        for kind in ("dependencies", "optionalDependencies"):
            for dep, child in snapshot.get(kind, {}).items():
                visit(dep, child)
    visit_import("apps/mobile")
    return result

def classify(before, after):
    # Global settings, overrides, patches etc. are potentially native build inputs.
    exclude = {"importers", "packages", "snapshots"}
    if {k:v for k,v in before.items() if k not in exclude} != {k:v for k,v in after.items() if k not in exclude}:
        return "ipa"
    a, b = graph(before), graph(after)
    changed = {k for k in a.keys() | b.keys() if a.get(k) != b.get(k)}
    if not changed:
        return "checks"
    names = {re.match(r"^((?:@[^/]+/)?[^@]+)@", k).group(1) for k in changed}
    return "ota" if names <= PURE else "ipa"

def root_test_only(before, after):
    a, b = json.loads(before), json.loads(after)
    da, db = a.pop("devDependencies", {}), b.pop("devDependencies", {})
    return a == b and all(k in TEST_ONLY or da.get(k) == db.get(k) for k in da.keys() | db.keys())

if __name__ == "__main__":
    try:
        base, head, path = sys.argv[1:]
        a, b = read(base, path), read(head, path)
        if path == "package.json":
            print("checks" if root_test_only(a,b) else "ipa")
        elif path == "pnpm-lock.yaml":
            print(classify(yaml.safe_load(a), yaml.safe_load(b)))
        else:
            # Manifest changes are safe only for dependency declarations; scripts,
            # Expo config, codegen and every other field stay native-risk.
            x, y = json.loads(a), json.loads(b)
            for k in ("dependencies", "optionalDependencies", "devDependencies"):
                x.pop(k, None)
                y.pop(k, None)
            lock_a = yaml.safe_load(read(base,"pnpm-lock.yaml"))
            lock_b = yaml.safe_load(read(head,"pnpm-lock.yaml"))
            print(classify(lock_a,lock_b) if x == y and lock_a != lock_b else "ipa")
    except Exception as exc:
        print(f"Dependency analysis conservative fallback: {exc}", file=sys.stderr)
        print("ipa")
