/**
 * Shared types and helpers for the tech-debt reporting scripts.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TechDebtIssue {
  file: string;
  line: number;
  type: string;
  severity: string;
  description: string;
  code: string;
  details?: string;
  dateAdded?: string;
  age?: number;
}

export interface TechDebtReport {
  timestamp: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<string, number>;
  };
  issues: TechDebtIssue[];
}

// Configuration
export const BACKEND_DIR = path.join(__dirname, '..');
export const PROJECT_ROOT = path.join(BACKEND_DIR, '..');
export const REPORT_PATH = path.join(BACKEND_DIR, 'tech-debt-report.json');

export function loadReport(): TechDebtReport | null {
  try {
    if (!fs.existsSync(REPORT_PATH)) {
      console.log('⚠️  No tech-debt-report.json found. Run detect-tech-debt.ts first.');
      return null;
    }
    const content = fs.readFileSync(REPORT_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error loading report:', error);
    return null;
  }
}
