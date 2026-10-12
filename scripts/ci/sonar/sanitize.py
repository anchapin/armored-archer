#!/usr/bin/env python3
"""Prepare passive Sonar input. Never import or execute checkout content."""
import argparse
import os
import re
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath

SOURCE_ROOTS = ('backend/src', 'backend/tests', 'autoloads', 'scenes', 'scripts')
COVERAGE_FILES = {'backend-lcov.info', 'coverage-python.xml'}
MAX_SOURCE_BYTES = 150 * 1024 * 1024
MAX_ARTIFACT_BYTES = 25 * 1024 * 1024


def safe_relative(name):
    path = PurePosixPath(name)
    if not name or '\\' in name or path.is_absolute() or any(
        part in ('', '.', '..') for part in name.split('/')
    ):
        raise ValueError('Unsafe input path')
    if any(ord(char) < 32 for char in name):
        raise ValueError('Control character in input path')
    return path


def copy_sources(checkout, destination):
    checkout, destination = Path(checkout), Path(destination)
    if destination.exists():
        raise ValueError('Scan destination must be new')
    destination.mkdir(parents=True)
    total = 0
    for root_name in SOURCE_ROOTS:
        root = checkout / root_name
        # Check every parent as well as descendants, including root symlinks.
        for parent in [root, *root.parents]:
            if parent == checkout.parent:
                break
            if parent.is_symlink():
                raise ValueError('Symlink in source root')
        if not root.is_dir():
            raise ValueError('Required source root missing')
        for current, directories, files in os.walk(root, followlinks=False):
            for name in directories + files:
                source = Path(current) / name
                mode = source.lstat().st_mode
                if stat.S_ISLNK(mode) or not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
                    raise ValueError('Only regular source files/directories allowed')
            for name in files:
                source = Path(current) / name
                relative = source.relative_to(checkout)
                safe_relative(relative.as_posix())
                # Do not import any scanner configuration from the PR.
                if name == 'sonar-project.properties':
                    continue
                total += source.stat().st_size
                if total > MAX_SOURCE_BYTES:
                    raise ValueError('Source size limit exceeded')
                target = destination / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
    # A fixed empty properties file overrides discovery of PR configuration.
    for folder in (destination, destination / 'backend'):
        folder.mkdir(parents=True, exist_ok=True)
        (folder / 'trusted-sonar.properties').write_text('# Trusted scanner configuration\n')


def extract_coverage(archive, destination):
    destination = Path(destination)
    seen, total = set(), 0
    with zipfile.ZipFile(archive) as bundle:
        for entry in bundle.infolist():
            safe_relative(entry.filename)
            if entry.filename not in COVERAGE_FILES or entry.filename in seen:
                raise ValueError('Unexpected/duplicate artifact member')
            mode = entry.external_attr >> 16
            if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
                raise ValueError('Artifact member is not a regular file')
            seen.add(entry.filename)
            total += entry.file_size
            if total > MAX_ARTIFACT_BYTES or entry.flag_bits & 1:
                raise ValueError('Oversize/encrypted artifact')
            data = bundle.read(entry)
            if entry.filename == 'backend-lcov.info':
                validate_lcov(data)
                target = destination / 'backend/coverage/lcov.info'
            else:
                data = validate_xml(data)
                target = destination / 'coverage-python.xml'
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    if seen != COVERAGE_FILES:
        raise ValueError('Required coverage files missing')


def validate_lcov(data):
    text = data.decode('utf-8')
    sources = 0
    for line in text.splitlines():
        if line.startswith('SF:'):
            path = safe_relative(line[3:])
            if path.parts[0] != 'src':
                raise ValueError('LCOV source outside backend/src')
            sources += 1
        elif line and not re.fullmatch(r'(TN:.*|DA:\d+,\d+(?:,[A-Za-z0-9+/=]+)?|LF:\d+|LH:\d+|FN:\d+,[^\r\n]+|FNDA:\d+,[^\r\n]+|FNF:\d+|FNH:\d+|BRDA:\d+,\d+,\d+,(?:\d+|-)|BRF:\d+|BRH:\d+|end_of_record)', line):
            raise ValueError('Unexpected LCOV record')
    if not sources:
        raise ValueError('Empty LCOV')


def validate_xml(data):
    # Reject DTD/entity processing before using stdlib's non-executing parser.
    from xml.etree import ElementTree
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('XML declarations/entities are forbidden')
    root = ElementTree.fromstring(data)
    if root.tag != 'coverage':
        raise ValueError('Not a coverage XML report')
    for source in root.findall('.//source'):
        # Coverage.py absolute source paths are data, but never used as paths.
        source.text = '.'
    classes = root.findall('.//class')
    if not classes:
        raise ValueError('Empty Python coverage')
    for item in classes:
        path = safe_relative(item.attrib.get('filename', ''))
        if path.parts[0] != 'scripts' or path.suffix != '.py':
            raise ValueError('Python coverage outside scripts')
    return ElementTree.tostring(root, encoding='utf-8', xml_declaration=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--destination', required=True)
    args = parser.parse_args()
    copy_sources(args.checkout, args.destination)
    extract_coverage(args.archive, args.destination)


if __name__ == '__main__':
    main()
