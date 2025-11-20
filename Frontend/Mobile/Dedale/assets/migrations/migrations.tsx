import { SQLiteDatabase } from 'expo-sqlite';
import { version } from 'react';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'Initial schema',
    up: (db: SQLiteDatabase) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacle_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(25) NOT NULL,
          description TEXT,
          width REAL,
          length REAL
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS interest_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          x REAL NOT NULL,
          y REAL NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          value TEXT,
          FOREIGN KEY (point_id) REFERENCES interest_points (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS pictures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          image TEXT NOT NULL,
          FOREIGN KEY (point_id) REFERENCES interest_points (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          type_id INTEGER NOT NULL,
          nombre INTEGER DEFAULT 1,
          FOREIGN KEY (point_id) REFERENCES interest_points (id) ON DELETE CASCADE,
          FOREIGN KEY (type_id) REFERENCES obstacle_types (id)
        );
      `);
    }
  },
  {
    version: 2,
    name: 'change column name',
    up: (db: SQLiteDatabase) => {
      const tables = db.getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      
      const tableNames = tables.map(t => t.name);
      
      if (tableNames.includes('interest_points')) {
        db.execSync(`ALTER TABLE interest_points RENAME TO point;`);
      }
      if (tableNames.includes('obstacles')) {
        db.execSync(`ALTER TABLE obstacles RENAME TO obstacle;`);
      }
      if (tableNames.includes('pictures')) {
        db.execSync(`ALTER TABLE pictures RENAME TO picture;`);
      }
      if (tableNames.includes('comments')) {
        db.execSync(`ALTER TABLE comments RENAME TO comment;`);
      }
      if (tableNames.includes('obstacle_types')) {
        db.execSync(`ALTER TABLE obstacle_types RENAME TO obstacle_type;`);
      }
      
      // Supprimer cette ligne car la colonne s'appelle déjà 'image'
      db.execSync(`ALTER TABLE obstacle RENAME COLUMN nombre TO number;`);
    }
  }
];