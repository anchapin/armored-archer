#!/usr/bin/env python3
"""Read local capture inputs without following symlinks.

Paths are selected explicitly by the local caller. This is not a sandbox against
another process running as the same user, but each opened component is pinned by
an fd and O_NOFOLLOW prevents replacement with a symlink during traversal.
"""

import os
import stat
from pathlib import Path

MAX_INPUT_BYTES = 64 * 1024 * 1024


def absolute_parts(path):
    """Reject parent traversal before producing a lexical absolute path."""
    selected = Path(path)
    if ".." in selected.parts:
        raise ValueError("parent traversal is not allowed in capture paths")
    return Path(os.path.abspath(selected))


def open_directory(path, *, create=False):
    """Open each directory from / without following a symlink component."""
    selected = absolute_parts(path)
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in selected.parts[1:]:
            if create:
                try:
                    os.mkdir(part, mode=0o700, dir_fd=fd)
                except FileExistsError:
                    pass
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_regular(path, *, within=None):
    """Read a bounded regular file through a no-follow descriptor chain."""
    selected = absolute_parts(path)
    if within is not None:
        selected.relative_to(absolute_parts(within))
    parent_fd = open_directory(selected.parent)
    try:
        fd = os.open(selected.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent_fd)
    finally:
        os.close(parent_fd)
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise ValueError("capture input must be a regular file")
    with os.fdopen(fd, "rb") as handle:
        data = handle.read(MAX_INPUT_BYTES + 1)
        if len(data) > MAX_INPUT_BYTES:
            raise ValueError("capture input exceeds 64 MiB limit")
        return data
