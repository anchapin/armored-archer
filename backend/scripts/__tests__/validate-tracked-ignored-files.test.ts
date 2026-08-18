/**
 * Unit tests for scripts/validate-tracked-ignored-files.ts — issue #1032.
 *
 * The validator exports its core functions with an injectable GitRunner, so
 * these tests stub the git subprocess (no fixture repositories needed) and
 * verify: clean repos pass, tracked-but-ignored files fail with the file
 * paths listed, git failures surface as errors, output is normalized, and a
 * live run against the real repository index is clean (defense in depth —
 * the same invariant the CI guard enforces).
 *
 * Per the issue's security scope: these tests only ever deal with FILE PATHS
 * returned by `git ls-files`; no .env* file content is read or inspected.
 */

import type { GitRunner, ValidationResult } from '../validate-tracked-ignored-files';
import {
  getTrackedIgnoredFiles,
  validateTrackedIgnoredFiles,
} from '../validate-tracked-ignored-files';

const FAKE_ROOT = '/fake/repo-root';

describe('validate-tracked-ignored-files (issue #1032 CI guard)', () => {
  describe('getTrackedIgnoredFiles', () => {
    it('returns an empty list when git reports no tracked-but-ignored files', () => {
      const runGit: GitRunner = jest.fn().mockReturnValue('');
      expect(getTrackedIgnoredFiles(FAKE_ROOT, runGit)).toEqual([]);
      expect(runGit).toHaveBeenCalledWith('git ls-files -i -c --exclude-standard', FAKE_ROOT);
    });

    it('parses, trims, de-duplicates, and sorts git output lines', () => {
      const runGit: GitRunner = jest
        .fn()
        .mockReturnValue(
          'backend/.env.staging\nbackend/.env.alpha\n\nbackend/.env.staging\n  backend/.env.beta  \n',
        );
      expect(getTrackedIgnoredFiles(FAKE_ROOT, runGit)).toEqual([
        'backend/.env.alpha',
        'backend/.env.beta',
        'backend/.env.staging',
      ]);
    });
  });

  describe('validateTrackedIgnoredFiles', () => {
    it('passes on a clean repository', () => {
      const runGit: GitRunner = jest.fn().mockReturnValue('');
      const result = validateTrackedIgnoredFiles(FAKE_ROOT, runGit);

      expect(result.valid).toBe(true);
      expect(result.trackedIgnoredFiles).toEqual([]);
      expect(result.issues).toEqual([]);
      expect(result.repoRoot).toBe(FAKE_ROOT);
      expect(result.command).toBe('git ls-files -i -c --exclude-standard');
    });

    it('fails and lists every tracked-but-ignored file (the issue #1032 scenario)', () => {
      const runGit: GitRunner = jest
        .fn()
        .mockReturnValue(
          'backend/.env.alpha\nbackend/.env.beta\nbackend/.env.development\nbackend/.env.staging\n',
        );
      const result = validateTrackedIgnoredFiles(FAKE_ROOT, runGit);

      expect(result.valid).toBe(false);
      expect(result.trackedIgnoredFiles).toEqual([
        'backend/.env.alpha',
        'backend/.env.beta',
        'backend/.env.development',
        'backend/.env.staging',
      ]);
      // One issue per file plus the remediation summary.
      expect(result.issues).toHaveLength(5);
      expect(result.issues.every((issue) => issue.type === 'error')).toBe(true);
      expect(result.issues[0].message).toContain('backend/.env.alpha');
      expect(
        result.issues.some((issue) => issue.message.includes('git rm --cached')),
      ).toBe(true);
    });

    it('reports a validation error (not a crash) when git itself fails', () => {
      const runGit: GitRunner = jest.fn().mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });
      const result: ValidationResult = validateTrackedIgnoredFiles(FAKE_ROOT, runGit);

      expect(result.valid).toBe(false);
      expect(result.trackedIgnoredFiles).toEqual([]);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe('git');
      expect(result.issues[0].message).toContain('fatal: not a git repository');
    });
  });

  describe('real repository invariant (defense in depth)', () => {
    it('has no tracked-but-ignored files in the actual repo index', () => {
      // Uses the real git subprocess against the checkout running the tests.
      // This is the exact invariant the CI guard enforces, so a regression
      // (e.g. re-adding backend/.env.staging) fails CI twice over.
      const result = validateTrackedIgnoredFiles();
      expect(result.issues.filter((issue) => issue.category === 'git')).toEqual([]);
      expect(result.trackedIgnoredFiles).toEqual([]);
      expect(result.valid).toBe(true);
    });
  });
});
