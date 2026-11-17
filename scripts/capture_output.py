"""Descriptor-relative output for local capture evidence on Linux.

Directory descriptors pin the selected root even if its pathname is replaced.
This protects path boundaries, not integrity against another same-user process.
"""

import os
import secrets
from contextlib import contextmanager

from capture_input import open_directory

FILES = ("validation.json", "run.log", "note.md")


class OutputStage:
    """A private staging directory anchored to a retained root descriptor."""

    def __init__(self, root_fd):
        self.root_fd = root_fd
        self.name = ".capture-" + secrets.token_hex(12)
        self.installed = False
        os.mkdir(self.name, mode=0o700, dir_fd=root_fd)
        self.fd = os.open(self.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root_fd)
        self.frames_fd = None

    def make_frames(self):
        os.mkdir("frames", mode=0o700, dir_fd=self.fd)
        self.frames_fd = os.open(
            "frames", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=self.fd
        )

    def write(self, name, data, *, frame=False):
        if not name or "/" in name or name in (".", ".."):
            raise ValueError("output filename must be a single segment")
        parent = self.frames_fd if frame else self.fd
        fd = os.open(
            name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent
        )
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)

    def install(self, slug):
        if not slug or "/" in slug or slug in (".", ".."):
            raise ValueError("output slug must be a single segment")
        # Exclusive reservation refuses existing evidence, including empty dirs.
        os.mkdir(slug, mode=0o700, dir_fd=self.root_fd)
        reservation = os.stat(slug, dir_fd=self.root_fd, follow_symlinks=False)
        try:
            os.rename(self.name, slug, src_dir_fd=self.root_fd, dst_dir_fd=self.root_fd)
        except OSError:
            self._remove_reservation(slug, reservation)
            raise
        self.installed = True

    def _remove_reservation(self, slug, reservation):
        try:
            current = os.stat(slug, dir_fd=self.root_fd, follow_symlinks=False)
            if (current.st_dev, current.st_ino) == (reservation.st_dev, reservation.st_ino):
                os.rmdir(slug, dir_fd=self.root_fd)
        except OSError:
            pass

    def close(self):
        try:
            if not self.installed:
                self._clean_files()
                os.rmdir(self.name, dir_fd=self.root_fd)
        finally:
            if self.frames_fd is not None:
                os.close(self.frames_fd)
            os.close(self.fd)

    def _clean_files(self):
        if self.frames_fd is not None:
            for name in os.listdir(self.frames_fd):
                os.unlink(name, dir_fd=self.frames_fd)
            os.rmdir("frames", dir_fd=self.fd)
        for name in FILES:
            try:
                os.unlink(name, dir_fd=self.fd)
            except FileNotFoundError:
                pass


@contextmanager
def output_stage(root):
    """Keep root, staging and frame descriptors alive through install/cleanup."""
    root_fd = open_directory(root, create=True)
    try:
        stage = OutputStage(root_fd)
        try:
            stage.make_frames()
            yield stage
        finally:
            stage.close()
    finally:
        os.close(root_fd)
