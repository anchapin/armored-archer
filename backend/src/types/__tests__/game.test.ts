import {
  PlayerStats,
  TurnData,
} from '../game';

describe('PlayerStats interface', () => {
  test('should accept valid player stats object', () => {
    const stats: PlayerStats = {
      level: 5,
      xp: 1200,
      stats: {
        attack: 50,
        defense: 30,
        dodge: 15,
        crit_rate: 0.25,
      },
    };

    expect(stats.level).toBe(5);
    expect(stats.xp).toBe(1200);
    expect(stats.stats.attack).toBe(50);
    expect(stats.stats.defense).toBe(30);
    expect(stats.stats.dodge).toBe(15);
    expect(stats.stats.crit_rate).toBe(0.25);
  });

  test('should handle zero values', () => {
    const stats: PlayerStats = {
      level: 0,
      xp: 0,
      stats: {
        attack: 0,
        defense: 0,
        dodge: 0,
        crit_rate: 0,
      },
    };

    expect(stats.level).toBe(0);
    expect(stats.stats.crit_rate).toBe(0);
  });

  test('should handle decimal values', () => {
    const stats: PlayerStats = {
      level: 1,
      xp: 99.5,
      stats: {
        attack: 12.5,
        defense: 8.3,
        dodge: 5.7,
        crit_rate: 0.125,
      },
    };

    expect(stats.xp).toBe(99.5);
    expect(stats.stats.crit_rate).toBe(0.125);
  });

  test('should handle high level player stats', () => {
    const stats: PlayerStats = {
      level: 100,
      xp: 999999,
      stats: {
        attack: 999,
        defense: 999,
        dodge: 100,
        crit_rate: 1.0,
      },
    };

    expect(stats.level).toBe(100);
    expect(stats.stats.attack).toBe(999);
    expect(stats.stats.crit_rate).toBe(1.0);
  });
});

describe('TurnData interface', () => {
  test('should accept dynamic properties', () => {
    const turnData: TurnData = {
      currentPlayer: 'player1',
      turnNumber: 5,
      actions: ['attack', 'move'],
    };

    expect(turnData.currentPlayer).toBe('player1');
    expect(turnData.turnNumber).toBe(5);
    expect(turnData.actions).toEqual(['attack', 'move']);
  });

  test('should handle empty object', () => {
    const turnData: TurnData = {};
    expect(Object.keys(turnData)).toHaveLength(0);
  });

  test('should handle nested objects', () => {
    const turnData: TurnData = {
      state: {
        board: [[1, 2], [3, 4]],
        activePlayer: 'player2',
      },
      history: [
        { action: 'move', from: [0, 0], to: [1, 1] },
      ],
    };

    expect((turnData.state as any).activePlayer).toBe('player2');
    expect((turnData.history as any[]).length).toBe(1);
  });
});
