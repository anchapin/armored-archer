import { applyStageCompletion } from '../stage_progression';
import { createMockLogger, createMockNakama } from '../../__mocks__/nakama';

describe('completion-map conflict retry', () => {
  it('re-reads a competing stage and preserves both completions', () => {
    const nk = createMockNakama();
    const logger = createMockLogger();
    const competing = {
      user_id: 'owner',
      completions: {
        '1_2': { stage_id: '1_2', stage_prefix: '1', stars_earned: 3, score: 0 },
      },
    };
    (nk.storageRead as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ version: 'v2', value: competing }]);
    (nk.storageWrite as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('Storage write rejected - version check failed');
      })
      .mockReturnValueOnce([]);
    applyStageCompletion(nk, 'owner', '1_1', '1', 3, 0, logger);
    expect(nk.storageRead).toHaveBeenCalledTimes(2);
    const writes = (nk.storageWrite as jest.Mock).mock.calls;
    expect(writes[0][0][0].version).toBe('*');
    expect(writes[1][0][0].version).toBe('v2');
    const raw = writes[1][0][0].value;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    expect(Object.keys(data.completions).sort()).toEqual(['1_1', '1_2']);
  });

  it('does not retry unrelated storage failures', () => {
    const nk = createMockNakama();
    (nk.storageRead as jest.Mock).mockReturnValue([]);
    (nk.storageWrite as jest.Mock).mockImplementation(() => {
      throw new Error('database offline');
    });
    expect(() => applyStageCompletion(nk, 'owner', '1_1', '1', 3, 0, createMockLogger())).toThrow(
      'database offline'
    );
    expect(nk.storageWrite).toHaveBeenCalledTimes(1);
  });

  it('bounds repeated version conflicts to five attempts', () => {
    const nk = createMockNakama();
    (nk.storageRead as jest.Mock).mockReturnValue([]);
    (nk.storageWrite as jest.Mock).mockImplementation(() => {
      throw new Error('Storage write rejected - version check failed');
    });
    expect(() => applyStageCompletion(nk, 'owner', '1_1', '1', 3, 0, createMockLogger())).toThrow(
      'version check failed'
    );
    expect(nk.storageWrite).toHaveBeenCalledTimes(5);
  });
});
