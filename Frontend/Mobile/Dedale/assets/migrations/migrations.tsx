import { SQLiteDatabase } from "expo-sqlite";
import { version } from "react";

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "Initial schema",
    up: (db: SQLiteDatabase) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacle_type (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(25) NOT NULL,
          description TEXT,
          width REAL,
          length REAL
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS event (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          description TEXT,
          dateDebut DATE,
          dateFin DATE,
          statut TEXT,
          geometry TEXT
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS point (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          x REAL NOT NULL,
          y REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS point_event (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          event_id INTEGER NOT NULL,
          FOREIGN KEY (point_id) REFERENCES point (id) ON DELETE CASCADE,
          FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
          UNIQUE(point_id, event_id)
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS comment (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          value TEXT,
          FOREIGN KEY (point_id) REFERENCES point (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS picture (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          image TEXT NOT NULL,
          FOREIGN KEY (point_id) REFERENCES point (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacle (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id INTEGER NOT NULL,
          type_id INTEGER NOT NULL,
          number INTEGER DEFAULT 1,
          FOREIGN KEY (point_id) REFERENCES point (id) ON DELETE CASCADE,
          FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS session (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
];
