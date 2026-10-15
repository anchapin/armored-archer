/** insertGearItem grant-ID (insert-once) behavior against the real module. */
import { createMockNakama } from '../../__mocks__/nakama';
import { insertGearItem, getGearItemByGrantId } from '../gear_db';
import { GearItem } from '../gear_system';

const gear: GearItem = {
  id: '',
  type: 'bow',
  name: 'Grant Bow',
  rarity: 'rare',
  level: 1,
  stats: [],
  modifiers: [],
  timestamp: 1,
};

describe('insertGearItem grant IDs', () => {
  it('inserts with the grant ID and returns the new row ID', () => {
    const nk = createMockNakama();
    const queries: string[] = [];
    (nk as any).sqlQuery = jest.fn((q: string) => {
      queries.push(q);
      if (q.includes('INSERT')) return [{ item_id: 'new-1' }];
      return [];
    });
    const result = insertGearItem(nk, 'u1', gear, undefined, 'u1:s:att:gear:0');
    expect(result).toEqual({ item_id: 'new-1', success: true });
    expect(queries[0]).toContain('ON CONFLICT (grant_id)');
  });

  it('recovers the existing row on a grant conflict instead of duplicating', () => {
    const nk = createMockNakama();
    (nk as any).sqlQuery = jest.fn((q: string) => {
      if (q.includes('INSERT')) return []; // ON CONFLICT DO NOTHING: no row returned
      if (q.includes('grant_id = $2')) {
        return [
          {
            item_id: 'prior-1',
            gear_type: 'bow',
            name: 'Prior Bow',
            rarity: 'rare',
            level: 1,
            stats: '[]',
            modifiers: '[]',
            created_at: '2026-01-01T00:00:00Z',
          },
        ];
      }
      return [];
    });
    const result = insertGearItem(nk, 'u1', gear, undefined, 'u1:s:att:gear:0');
    expect(result.success).toBe(true);
    expect(result.alreadyGranted).toBe(true);
    expect(result.item_id).toBe('prior-1');
    expect(result.gear?.name).toBe('Prior Bow');
  });

  it('keeps the legacy insert shape when no grant ID is supplied', () => {
    const nk = createMockNakama();
    const queries: string[] = [];
    (nk as any).sqlQuery = jest.fn((q: string) => {
      queries.push(q);
      if (q.includes('INSERT')) return [{ item_id: 'plain-1' }];
      return [];
    });
    const result = insertGearItem(nk, 'u1', gear);
    expect(result).toEqual({ item_id: 'plain-1', success: true });
    expect(queries[0]).not.toContain('ON CONFLICT');
  });

  it('reads a gear row by grant ID', () => {
    const nk = createMockNakama();
    (nk as any).sqlQuery = jest.fn(() => [
      {
        item_id: 'x1',
        gear_type: 'helm',
        name: 'H',
        rarity: 'common',
        level: 1,
        stats: '[]',
        modifiers: '[]',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const found = getGearItemByGrantId(nk, 'u1', 'g');
    expect(found?.id).toBe('x1');
    (nk as any).sqlQuery = jest.fn(() => []);
    expect(getGearItemByGrantId(nk, 'u1', 'missing')).toBeNull();
  });
});
