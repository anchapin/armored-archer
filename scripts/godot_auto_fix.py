#!/usr/bin/env python3
"""
Automated Godot project fixer - Resolves common issues without Editor intervention

Fixes:
1. Invalid UID references in scene files
2. Missing .uid files causing autoload issues
3. Syntax errors in GDScript files
"""

import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCENES_DIR = PROJECT_ROOT / "scenes"
AUTOLOADS_DIR = PROJECT_ROOT / "autoloads"


class GodotAutoFixer:
    """Automated fixer for common Godot project issues"""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.fixes_applied = 0
        self.errors_found = 0

    def log(self, message: str, level: str = "INFO"):
        """Log a message with level indicator"""
        prefix = {"INFO": "  ✓", "WARN": "  ⚠", "ERROR": "  ✗", "FIX": "  🔧"}
        print(f"{prefix.get(level, '  •')} {message}")

    def scan_scene_uids(self) -> list[tuple[str, str, str, str]]:
        """
        Scan for invalid UID references in scene files
        Returns: List of (scene_file, invalid_uid, path, correct_uid)
        """
        issues = []

        for scene_file in SCENES_DIR.rglob("*.tscn"):
            content = scene_file.read_text()
            lines = content.split("\n")

            for line in lines:
                # Find ext_resource lines with UIDs
                if "ext_resource" in line and "uid=" in line and "path=" in line:
                    # Extract UID and path
                    uid_match = re.search(r'uid="([^"]*)"', line)
                    path_match = re.search(r'path="([^"]*)"', line)

                    if uid_match and path_match:
                        uid = uid_match.group(1)
                        path = path_match.group(1)

                        # Check if UID looks like a human-readable identifier (invalid)
                        if uid.startswith("uid://") and re.match(r"uid://[a-z_]+$", uid):
                            # Try to get actual UID from the referenced file
                            ref_file = PROJECT_ROOT / path.lstrip("res://")
                            if ref_file.exists():
                                actual_uid = self._get_file_uid(ref_file)
                                if actual_uid and actual_uid != uid:
                                    issues.append((str(scene_file), uid, path, actual_uid))

        return issues

    def _get_file_uid(self, file_path: Path) -> str | None:
        """Extract the UID from a .tscn or .gd file"""
        try:
            first_line = file_path.read_text().split("\n")[0]
            uid_match = re.search(r'uid="([^"]*)"', first_line)
            return uid_match.group(1) if uid_match else None
        except Exception:
            return None

    def fix_uid_reference(self, scene_file: str, old_uid: str, new_uid: str) -> bool:
        """Replace invalid UID with correct one in scene file"""
        try:
            content = Path(scene_file).read_text()
            updated = content.replace(f'uid="{old_uid}"', f'uid="{new_uid}"')

            if self.dry_run:
                self.log(f"Would fix: {scene_file} - {old_uid} -> {new_uid}", "FIX")
                return True

            Path(scene_file).write_text(updated)
            self.fixes_applied += 1
            self.log(f"Fixed: {scene_file} - {old_uid} -> {new_uid}", "FIX")
            return True
        except Exception as e:
            self.log(f"Failed to fix {scene_file}: {e}", "ERROR")
            return False

    def check_missing_uid_files(self) -> list[Path]:
        """Find .gd/.tscn files that have .uid files missing or outdated"""
        missing = []

        for gd_file in PROJECT_ROOT.rglob("*.gd"):
            uid_file = gd_file.with_suffix(".gd.uid")
            if not uid_file.exists():
                missing.append(gd_file)

        for tscn_file in PROJECT_ROOT.rglob("*.tscn"):
            uid_file = tscn_file.with_suffix(".tscn.uid")
            if not uid_file.exists():
                missing.append(tscn_file)

        return missing

    def generate_uid_file(self, file_path: Path) -> bool:
        """Generate or update a .uid file"""
        uid = self._get_file_uid(file_path)
        if not uid:
            return False

        uid_file = file_path.with_suffix(f"{file_path.suffix}.uid")

        if self.dry_run:
            self.log(f"Would generate UID file: {uid_file}", "FIX")
            return True

        uid_file.write_text(f"{{\"uid\":\"{uid}\"}}\n")
        self.fixes_applied += 1
        self.log(f"Generated UID file: {uid_file}", "FIX")
        return True

    def validate_gdscript_syntax(self) -> list[Path]:
        """Check for syntax errors in GDScript files"""
        errors = []

        for gd_file in PROJECT_ROOT.rglob("*.gd"):
            try:
                content = gd_file.read_text()

                # Basic syntax checks
                if content.count("{") != content.count("}"):
                    errors.append(gd_file)
                if content.count("(") != content.count(")"):
                    errors.append(gd_file)
                if content.count("[") != content.count("]"):
                    errors.append(gd_file)

                # Check for invalid patterns
                if re.search(r'^\s*\{', content, re.MULTILINE):
                    errors.append(gd_file)
            except Exception:
                pass

        return errors

    def run(self):
        """Run all auto-fixes"""
        print("=" * 50)
        print("Godot Auto-Fixer")
        print("=" * 50)

        if self.dry_run:
            print("DRY RUN MODE - No changes will be made\n")

        # Fix UID references
        print("\n[1] Checking UID references...")
        uid_issues = self.scan_scene_uids()
        if uid_issues:
            self.log(f"Found {len(uid_issues)} invalid UID references", "WARN")
            for scene_file, old_uid, path, new_uid in uid_issues:
                self.fix_uid_reference(scene_file, old_uid, new_uid)
        else:
            self.log("No invalid UID references found")

        # Check missing UID files
        print("\n[2] Checking for missing .uid files...")
        missing_uids = self.check_missing_uid_files()
        if missing_uids:
            self.log(f"Found {len(missing_uids)} missing .uid files", "WARN")
            for file_path in missing_uids[:10]:  # Limit to 10 for dry run
                self.generate_uid_file(file_path)
        else:
            self.log("All UID files present")

        # Check syntax errors
        print("\n[3] Checking GDScript syntax...")
        syntax_errors = self.validate_gdscript_syntax()
        if syntax_errors:
            self.log(f"Found {len(syntax_errors)} files with potential syntax errors", "ERROR")
            for error_file in syntax_errors:
                self.log(f"  {error_file.relative_to(PROJECT_ROOT)}", "ERROR")
        else:
            self.log("No syntax errors found")

        # Summary
        print("\n" + "=" * 50)
        print("Summary")
        print("=" * 50)
        print(f"Fixes applied: {self.fixes_applied}")
        print(f"Errors found: {len(syntax_errors)}")

        if not self.dry_run and self.fixes_applied > 0:
            print("\nNext steps:")
            print("  1. Open Godot Editor")
            print("  2. Run 'Project > Tools > Rescan Files' or press Ctrl+Shift+R")
            print("  3. Check the Output panel for any remaining issues")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Auto-fix common Godot project issues")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fixed without making changes")
    args = parser.parse_args()

    fixer = GodotAutoFixer(dry_run=args.dry_run)
    fixer.run()

    return 0 if len(fixer.validate_gdscript_syntax()) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
