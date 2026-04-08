import { Runtime } from '../types/nakama';
import { PlayerInventory } from './gear_system';
import { PlayerStats } from './rpg_system';
export interface ValidationResult {
    is_valid: boolean;
    issues: ValidationIssue[];
}
export interface ValidationIssue {
    severity: 'critical' | 'warning';
    category: string;
    message: string;
    details: Record<string, any>;
}
export declare function validatePlayerStats(playerStats: PlayerStats, previousStats?: PlayerStats): ValidationResult;
export declare function validateGearInventory(inventory: PlayerInventory): ValidationResult;
export declare function recordStatMutation(nk: Runtime.Nakama, userId: string, ipAddress: string | undefined | null, before: Record<string, number>, after: Record<string, number>, source: string): void;
export declare function validateFullProgression(nk: Runtime.Nakama, userId: string, logger: Runtime.Logger, playerStats: PlayerStats, inventory: PlayerInventory, ipAddress?: string): ValidationResult;
export declare const ProgressionValidation: {
    validatePlayerStats: typeof validatePlayerStats;
    validateGearInventory: typeof validateGearInventory;
    validateFullProgression: typeof validateFullProgression;
    recordStatMutation: typeof recordStatMutation;
};
