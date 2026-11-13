import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";

it("validates iPad compatibility and rejects empty or tablet-only payloads", () => {
  const result = spawnSync("python3", ["-c", `
import runpy, tempfile, plistlib
from pathlib import Path
inspect = runpy.run_path('tools/ci/check-ios-app.py')['inspect_app']
with tempfile.TemporaryDirectory() as folder:
    app = Path(folder)
    info = {'UIDeviceFamily': [1], 'CFBundleIdentifier': 'app.soireecrew.mobile', 'CFBundleExecutable': 'Crew', 'MinimumOSVersion': '16.4'}
    def save():
        (app / 'Info.plist').write_bytes(plistlib.dumps(info))
    save()
    (app / 'Crew').write_bytes(b'binary')
    (app / 'main.jsbundle').write_bytes(b'bundle')
    assert inspect(app)['deviceFamily'] == [1]
    info['UIDeviceFamily'] = [1, 2]
    save()
    try:
        inspect(app)
        raise AssertionError('Universal apps do not have iPhone zoom mode')
    except ValueError:
        pass
    info['UIDeviceFamily'] = [1]
    save()
    (app / 'main.jsbundle').write_bytes(b'')
    try:
        inspect(app)
        raise AssertionError('Empty JavaScript bundle accepted')
    except ValueError:
        pass
`], { encoding: "utf8" });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});
