/**
 * Covers loadEnvironment()'s .env file parsing in src/config/index.ts.
 *
 * jest.setup.js sets SKIP_ENV_LOADING (#1429) so the real backend/.env never
 * leaks into tests. That left the parser itself untested, so this suite points
 * process.cwd() at a throwaway directory holding a known .env file and
 * re-imports the config module with SKIP_ENV_LOADING cleared.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('config loadEnvironment() .env parsing', () => {
  const savedEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-envfile-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    delete process.env.SKIP_ENV_LOADING;
    delete process.env.NAKAMA_RUNNER;
    delete process.env.RUNTIME_PROVIDER;
    for (const k of ['AA_ENV_PLAIN', 'AA_ENV_DQ', 'AA_ENV_SQ', 'AA_ENV_PRESET', 'AA_ENV_LOCAL']) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...savedEnv };
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function loadConfig(): void {
    jest.isolateModules(() => {
      require('../index');
    });
  }

  it('reads plain, double-quoted and single-quoted values and skips comments/blank/malformed lines', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      [
        '# a comment',
        '',
        'AA_ENV_PLAIN=plain-value',
        'AA_ENV_DQ="double quoted"',
        "AA_ENV_SQ='single quoted'",
        '=no-key',
        'NO_EQUALS_SIGN',
      ].join('\n')
    );

    loadConfig();

    expect(process.env.AA_ENV_PLAIN).toBe('plain-value');
    expect(process.env.AA_ENV_DQ).toBe('double quoted');
    expect(process.env.AA_ENV_SQ).toBe('single quoted');
    expect(process.env.NO_EQUALS_SIGN).toBeUndefined();
  });

  it('never overrides a variable that is already set', () => {
    process.env.AA_ENV_PRESET = 'from-process';
    fs.writeFileSync(path.join(tmpDir, '.env'), 'AA_ENV_PRESET=from-file\n');

    loadConfig();

    expect(process.env.AA_ENV_PRESET).toBe('from-process');
  });

  it('reads the NODE_ENV-specific .local file too', () => {
    process.env.NODE_ENV = 'test';
    fs.writeFileSync(path.join(tmpDir, '.env.test.local'), 'AA_ENV_LOCAL=local\n');

    loadConfig();

    expect(process.env.AA_ENV_LOCAL).toBe('local');
  });

  it('is inert under the Nakama runtime', () => {
    process.env.RUNTIME_PROVIDER = 'nakama';
    fs.writeFileSync(path.join(tmpDir, '.env'), 'AA_ENV_PLAIN=should-not-load\n');

    loadConfig();

    expect(process.env.AA_ENV_PLAIN).toBeUndefined();
  });

  it('is inert when SKIP_ENV_LOADING is set', () => {
    process.env.SKIP_ENV_LOADING = 'true';
    fs.writeFileSync(path.join(tmpDir, '.env'), 'AA_ENV_PLAIN=should-not-load\n');

    loadConfig();

    expect(process.env.AA_ENV_PLAIN).toBeUndefined();
  });
});
