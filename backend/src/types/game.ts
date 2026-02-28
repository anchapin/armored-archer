export interface PlayerStats {
  level: number;
  xp: number;
  stats: {
    attack: number;
    defense: number;
    dodge: number;
    crit_rate: number;
  };
}

export interface TurnData {
  [key: string]: unknown;
}
