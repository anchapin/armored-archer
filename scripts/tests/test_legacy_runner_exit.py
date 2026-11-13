#!/usr/bin/env python3
"""Exercise the real legacy runner's process exits in a disposable Godot project.

Usage: python3 scripts/tests/test_legacy_runner_exit.py --godot /path/to/godot4
Only the manifest in a temporary copy is replaced. Production runner execution,
result collection and quit handling stay intact; no repository fixtures linger.
"""
import argparse
import pathlib
import re
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--godot', required=True)
    parser.add_argument('--runner', type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parents[2] / 'test/run_all_tests.gd')
    args = parser.parse_args()
    source = args.runner.read_text()
    cases = [
        ('missing', None, 1, 0, 1),
        ('noninstantiable', 'extends Node\n@abstract\nfunc required_method() -> void\n', 1, 0, 1),
        ('not_node', 'extends RefCounted\n', 1, 0, 1),
        ('passing', 'extends Node\nfunc get_results():\n\treturn {"passed": 1, "failed": 0}\n', 0, 1, 0),
        ('failing', 'extends Node\nfunc get_results():\n\treturn {"passed": 0, "failed": 1}\n', 1, 0, 1),
        ('self_free_pass', 'extends Node\nsignal test_completed(name, passed)\nfunc _ready():\n\ttest_completed.emit("done", true)\n\tqueue_free()\n', 0, 1, 0),
        ('self_free_fail', 'extends Node\nsignal test_completed(name, passed)\nfunc _ready():\n\ttest_completed.emit("done", false)\n\tqueue_free()\n', 1, 0, 1),
    ]
    failures = 0
    with tempfile.TemporaryDirectory(prefix='legacy-runner-exit-') as temp:
        root = pathlib.Path(temp)
        (root / 'project.godot').write_text('config_version=5\n[application]\nconfig/name="Legacy runner exit regression"\n')
        for name, fixture, exit_code, passed, failed in cases:
            path = root / (name + '.gd')
            if fixture is not None:
                path.write_text(fixture)
            modified, count = re.subn(r'var test_files = \[.*?\n\t\]',
                                      'var test_files = ["res://' + path.name + '"]',
                                      source, count=1, flags=re.S)
            if count != 1:
                raise RuntimeError('Expected exactly one legacy test manifest')
            runner = root / 'runner.gd'
            runner.write_text(modified)
            run = subprocess.run([args.godot, '--headless', '--path', str(root),
                                  '--script', str(runner)], capture_output=True, text=True,
                                 timeout=30)
            output = run.stdout + run.stderr
            ok = (run.returncode == exit_code and
                  f'Total passed: {passed}\n' in output and
                  f'Total failed: {failed}\n' in output)
            print(f'{name}: {"PASS" if ok else "FAIL"} exit={run.returncode} expected={exit_code}')
            if not ok:
                failures += 1
                print(output)
    print(f'{len(cases) - failures}/{len(cases)} legacy runner exit cases passed')
    return int(failures > 0)


if __name__ == '__main__':
    raise SystemExit(main())
