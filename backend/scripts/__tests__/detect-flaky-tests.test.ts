import { analyzeSamples, readAssertions, sampleSuite, main, JestResult } from '../detect-flaky-tests';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
jest.mock('child_process', () => ({ spawnSync: jest.fn() }));
const spawn = spawnSync as jest.Mock;
const root = '/repo/backend';
const suite = (status = 'passed', file = 'a.test.ts'): JestResult => ({ testResults: [{ name: `${root}/${file}`, assertionResults: [{ fullName: 'group same name', status, duration: 4 }] }] });
const sample = (status: string) => readAssertions(suite(status), root);

describe('bounded full-suite flake detection', () => {
  test('uses file and full name, not source describe labels', () => {
    const data = suite();
    data.testResults.push(suite('failed', 'b.test.ts').testResults[0]);
    expect([...readAssertions(data, root).keys()]).toEqual(['a.test.ts :: group same name #1', 'b.test.ts :: group same name #1']);
  });
  test('reports intermittent and consistent failures separately', () => {
    const result = analyzeSamples([sample('passed'), sample('failed')], 0.5);
    expect(result.flakyTests[0].failures).toBe(1);
    expect(result.consistentlyFailingTests).toEqual([]);
    const consistent = analyzeSamples([sample('failed'), sample('failed')], 0.5);
    expect(consistent.flakyTests).toEqual([]);
    expect(consistent.consistentlyFailingTests[0].failures).toBe(2);
  });
  test('does not call skipped tests passes', () => {
    const result = analyzeSamples([sample('pending'), sample('pending')], 0.5);
    expect(result.summary).toMatchObject({ totalTests: 0, skippedTests: 1 });
    expect(() => analyzeSamples([sample('pending'), sample('passed')], 0.5)).toThrow('incomplete');
  });
  test('rejects empty suites, suite execution errors, unknown statuses and duplicate identities', () => {
    expect(() => readAssertions({ testResults: [] }, root)).toThrow('incomplete');
    const data = suite();
    data.testResults[0].testExecError = {};
    expect(() => readAssertions(data, root)).toThrow('incomplete');
    expect(() => sample('unknown')).toThrow('Unknown');
    const duplicate = suite();
    duplicate.testResults.push(duplicate.testResults[0]);
    expect(() => readAssertions(duplicate, root)).toThrow('Duplicate suite');
  });
  test('rejects changed identities instead of inferring success', () => {
    expect(() => analyzeSamples([sample('passed'), readAssertions(suite('passed', 'b.test.ts'), root)], 0.5)).toThrow('incomplete');
  });
  test('keeps threshold behavior for intermittent failures', () => {
    expect(analyzeSamples([sample('passed'), sample('failed'), sample('passed')], 0.5).flakyTests).toEqual([]);
  });
  test('rejects excessive or invalid runs before launching', async () => {
    for (const arg of ['--runs=0', '--runs=4', '--runs=2.5', '--threshold=NaN', '--threshold=1.1', `--test-pattern=${'a'.repeat(501)}`]) {
      await expect(main([arg])).rejects.toThrow();
    }
    expect(spawn).not.toHaveBeenCalled();
  });
  test('launches one Jest process per sample with safe argv and a timeout', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flake-test-'));
    const output = path.join(dir, 'sample.json');
    try {
      fs.writeFileSync(output, JSON.stringify(suite()));
      spawn.mockReturnValue({ status: 0 });
      expect(sampleSuite(root, output, 'a"; echo bad')).toHaveProperty('size', 1);
      expect(spawn).toHaveBeenCalledWith(process.execPath, expect.arrayContaining(['--runInBand', '--no-coverage', '--passWithNoTests=false', '--testNamePattern', 'a"; echo bad']), expect.objectContaining({ timeout: 300000 }));
      spawn.mockReturnValue({ status: 1 });
      expect(() => sampleSuite(root, output)).toThrow('incomplete');
      fs.writeFileSync(output, JSON.stringify(suite('failed')));
      expect(sampleSuite(root, output).size).toBe(1);
      spawn.mockReturnValue({ status: null, signal: 'SIGTERM' });
      expect(() => sampleSuite(root, output)).toThrow('budget');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
