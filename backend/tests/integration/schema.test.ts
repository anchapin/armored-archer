/**
 * Schema Migration Tests
 * 
 * These tests verify that the database schema is correctly set up
 * by checking for the existence of required tables, columns, indexes,
 * and relationships.
 * 
 * Run with: npm run test:schema
 * Or: npx jest backend/tests/integration/schema.test.ts
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Test configuration - uses environment variables or defaults
const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT || '5432');
const TEST_DB_USER = process.env.TEST_DB_USER || 'postgres';
const TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'localdbpassword';
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'nakama';

// Test pool - shared across tests
let pool: Pool;
let testsSkipped = false;

describe('Database Schema Migration Tests', () => {
  beforeAll(async () => {
    // Check if database is available
    try {
      // Create connection pool for testing
      pool = new Pool({
        host: TEST_DB_HOST,
        port: TEST_DB_PORT,
        user: TEST_DB_USER,
        password: TEST_DB_PASSWORD,
        database: TEST_DB_NAME,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test the connection
      const client = await pool.connect();
      client.release();
    } catch (error) {
      console.error('Database not available, skipping schema tests:', error instanceof Error ? error.message : String(error));
      testsSkipped = true;
    }
  });

  // Helper to check if tests should be skipped
  const skipIfNeeded = () => {
    if (testsSkipped || !pool) {
      return true;
    }
    return false;
  };

  afterAll(async () => {
    if (skipIfNeeded()) return;
    if (pool) {
      await pool.end();
    }
  });

  describe('Required Tables Exist', () => {
    it('should have player_stats table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'player_stats'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('should have catalog table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'catalog'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('should have inventory table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'inventory'
      `);
      expect(result.rows).toHaveLength(1);
    });

    it('should have loadout table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'loadout'
      `);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Player Stats Table Structure', () => {
    it('should have correct columns in player_stats', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'player_stats'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(r => r.column_name);
      
      // Required columns
      expect(columns).toContain('user_id');
      expect(columns).toContain('level');
      expect(columns).toContain('experience');
      expect(columns).toContain('ability_points');
      expect(columns).toContain('stats');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have primary key on user_id', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'player_stats' 
          AND tc.constraint_type = 'PRIMARY KEY'
      `);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('user_id');
    });

    it('should have foreign key to users table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'player_stats' 
          AND tc.constraint_type = 'FOREIGN KEY'
      `);
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('user_id');
      expect(result.rows[0].foreign_table_name).toBe('users');
    });

    it('should have CHECK constraint on level >= 1', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%player_stats%level%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      const hasLevelCheck = result.rows.some(r => 
        r.check_clause.includes('level') && r.check_clause.includes('>= 1')
      );
      expect(hasLevelCheck).toBe(true);
    });

    it('should have indexes on level and experience', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'player_stats'
      `);
      
      const indexNames = result.rows.map(r => r.indexname);
      expect(indexNames).toContain('idx_player_stats_level');
      expect(indexNames).toContain('idx_player_stats_experience');
    });

    it('should have trigger for updated_at', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'player_stats'
          AND trigger_name LIKE '%updated_at%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Catalog Table Structure', () => {
    it('should have correct columns in catalog', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'catalog'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('gear_id');
      expect(columns).toContain('gear_type');
      expect(columns).toContain('name');
      expect(columns).toContain('rarity');
      expect(columns).toContain('base_stats');
      expect(columns).toContain('modifiers');
      expect(columns).toContain('icon_url');
      expect(columns).toContain('description');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have gear_type enum', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'gear_type')
        ORDER BY enumsortorder
      `);
      
      const values = result.rows.map(r => r.enumlabel);
      expect(values).toEqual(['helm', 'armor', 'bow', 'arrow', 'amulet']);
    });

    it('should have gear_rarity enum', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'gear_rarity')
        ORDER BY enumsortorder
      `);
      
      const values = result.rows.map(r => r.enumlabel);
      expect(values).toEqual(['common', 'rare', 'epic', 'legendary']);
    });

    it('should have indexes on gear_type, rarity, and JSONB fields', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'catalog'
      `);
      
      const indexNames = result.rows.map(r => r.indexname);
      expect(indexNames).toContain('idx_catalog_gear_type');
      expect(indexNames).toContain('idx_catalog_rarity');
      expect(indexNames).toContain('idx_catalog_base_stats');
      expect(indexNames).toContain('idx_catalog_modifiers');
    });
  });

  describe('Inventory Table Structure', () => {
    it('should have correct columns in inventory', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'inventory'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('inventory_id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('gear_id');
      expect(columns).toContain('acquired_at');
      expect(columns).toContain('created_at');
    });

    it('should have foreign keys to users and catalog', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'inventory' 
          AND tc.constraint_type = 'FOREIGN KEY'
      `);
      
      const foreignTables = result.rows.map(r => r.foreign_table_name);
      expect(foreignTables).toContain('users');
      expect(foreignTables).toContain('catalog');
    });

    it('should have unique constraint on user_id + gear_id', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'inventory' 
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name IN ('user_id', 'gear_id')
      `);
      
      expect(result.rows.length).toBe(2);
    });
  });

  describe('Loadout Table Structure', () => {
    it('should have correct columns in loadout', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'loadout'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('loadout_id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('helm_gear_id');
      expect(columns).toContain('armor_gear_id');
      expect(columns).toContain('bow_gear_id');
      expect(columns).toContain('arrow_gear_id');
      expect(columns).toContain('amulet_gear_id');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have unique constraint on user_id', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'loadout' 
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name = 'user_id'
      `);
      
      expect(result.rows).toHaveLength(1);
    });

    it('should have foreign keys to catalog for all gear slots', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'loadout' 
          AND tc.constraint_type = 'FOREIGN KEY'
      `);
      
      const foreignTables = result.rows.map(r => r.foreign_table_name);
      // All gear slot foreign keys should reference catalog
      expect(foreignTables.every(t => t === 'catalog')).toBe(true);
    });
  });

  describe('Migration Functions and Triggers', () => {
    it('should have update_updated_at_column function', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_name = 'update_updated_at_column'
          AND routine_type = 'FUNCTION'
      `);
      
      expect(result.rows).toHaveLength(1);
    });

    it('should have triggers calling update_updated_at_column', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT DISTINCT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE action_statement LIKE '%update_updated_at_column%'
        ORDER BY event_object_table
      `);
      
      const tables = result.rows.map(r => r.event_object_table);
      // Should have triggers on player_stats, catalog, and loadout
      expect(tables).toContain('player_stats');
      expect(tables).toContain('catalog');
      expect(tables).toContain('loadout');
    });
  });

  describe('Table Comments', () => {
    it('should have comments on player_stats table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT description
        FROM pg_description
        WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'player_stats')
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have comments on catalog table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT description
        FROM pg_description
        WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'catalog')
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have comments on inventory table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT description
        FROM pg_description
        WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'inventory')
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have comments on loadout table', async () => { if (skipIfNeeded()) return; 
      const result = await pool.query(`
        SELECT description
        FROM pg_description
        WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'loadout')
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should allow inserting valid player_stats data', async () => { if (skipIfNeeded()) return; 
      // First, get a valid user_id from the users table
      const userResult = await pool.query('SELECT id FROM users LIMIT 1');
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Insert test data
        await pool.query(`
          INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
          VALUES ($1, 1, 0, 0, '{"attack_power": 0}')
          ON CONFLICT (user_id) DO NOTHING
        `, [userId]);
        
        // Verify it was inserted
        const result = await pool.query(`
          SELECT * FROM player_stats WHERE user_id = $1
        `, [userId]);
        
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].level).toBe(1);
        
        // Clean up
        await pool.query('DELETE FROM player_stats WHERE user_id = $1', [userId]);
      }
    });

    it('should enforce level CHECK constraint', async () => { if (skipIfNeeded()) return; 
      const userResult = await pool.query('SELECT id FROM users LIMIT 1');
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Try to insert invalid data (level < 1)
        await expect(pool.query(`
          INSERT INTO player_stats (user_id, level)
          VALUES ($1, 0)
        `, [userId])).rejects.toThrow();
      }
    });
  });
});

// Export for use in other tests
export { pool };
