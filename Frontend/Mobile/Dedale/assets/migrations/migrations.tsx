import { SQLiteDatabase } from 'expo-sqlite';

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
          y REAL NOT NULL
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
          path TEXT NOT NULL,
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
  // Ajoutez ici les futures migrations
  // {
  //   version: 2,
  //   name: 'Add status column',
  //   up: (db: SQLiteDatabase) => {
  //     db.execSync(`ALTER TABLE interest_points ADD COLUMN status TEXT DEFAULT 'active';`);
  //   }
  // }
];