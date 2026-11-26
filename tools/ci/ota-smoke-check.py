"""Verify app-level persisted evidence, not merely a downloaded Expo manifest."""
import re
import sys
from pathlib import Path

root, expected = Path(sys.argv[1]), sys.argv[2]
pattern = re.compile(rb'"seenOtaUpdateId"\s*:\s*"' + re.escape(expected.encode()) + rb'"', re.I)
for file in root.rglob("*"):
    # AsyncStorage can use a SQLite database, WAL or individual files.
    # The app writes this field only after the update has actually launched.
    if not file.is_file() or file.is_symlink():
        continue
    try:
        if file.stat().st_size <= 64 * 1024 * 1024 and pattern.search(file.read_bytes()):
            print("Active OTA observed in app persistence:", file.relative_to(root))
            sys.exit(0)
    except OSError:
        continue
sys.exit(1)
