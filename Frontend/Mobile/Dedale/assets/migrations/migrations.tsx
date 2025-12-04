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
        CREATE INDEX IF NOT EXISTS idx_point_event_event_id ON point_event(event_id);
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

      db.execSync(`
        CREATE TABLE IF NOT EXISTS geometry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          wkt TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE INDEX IF NOT EXISTS idx_geometry_event_id ON geometry(event_id);
      `);
    },
  },
  {
    version: 2,
    name: "Migrate to UUID for points and related tables",
    up: (db: SQLiteDatabase) => {
      // Créer les nouvelles tables avec UUID
      db.execSync(`
        CREATE TABLE IF NOT EXISTS point_new (
          id TEXT PRIMARY KEY NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS point_event_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point_id TEXT NOT NULL,
          event_id INTEGER NOT NULL,
          FOREIGN KEY (point_id) REFERENCES point_new (id) ON DELETE CASCADE,
          FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
          UNIQUE(point_id, event_id)
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS comment_new (
          id TEXT PRIMARY KEY NOT NULL,
          point_id TEXT NOT NULL,
          value TEXT,
          FOREIGN KEY (point_id) REFERENCES point_new (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS picture_new (
          id TEXT PRIMARY KEY NOT NULL,
          point_id TEXT NOT NULL,
          image TEXT NOT NULL,
          FOREIGN KEY (point_id) REFERENCES point_new (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS obstacle_new (
          id TEXT PRIMARY KEY NOT NULL,
          point_id TEXT NOT NULL,
          type_id INTEGER NOT NULL,
          number INTEGER DEFAULT 1,
          FOREIGN KEY (point_id) REFERENCES point_new (id) ON DELETE CASCADE,
          FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
        );
      `);

      // Migrer les données existantes avec des UUIDs générés
      // Récupérer tous les points existants
      const oldPoints = db.getAllSync<{id: number, x: number, y: number, created_at: string, modified_at: string}>(
        "SELECT id, x, y, created_at, modified_at FROM point"
      );

      // Map ancien ID -> nouveau UUID
      const pointIdMap = new Map<number, string>();

      for (const point of oldPoints) {
        const newUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        pointIdMap.set(point.id, newUuid);
        
        db.runSync(
          "INSERT INTO point_new (id, x, y, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
          [newUuid, point.x, point.y, point.created_at, point.modified_at]
        );
      }

      // Migrer point_event
      const oldPointEvents = db.getAllSync<{point_id: number, event_id: number}>(
        "SELECT point_id, event_id FROM point_event"
      );
      for (const pe of oldPointEvents) {
        const newPointId = pointIdMap.get(pe.point_id);
        if (newPointId) {
          db.runSync(
            "INSERT INTO point_event_new (point_id, event_id) VALUES (?, ?)",
            [newPointId, pe.event_id]
          );
        }
      }

      // Migrer comments
      const oldComments = db.getAllSync<{id: number, point_id: number, value: string}>(
        "SELECT id, point_id, value FROM comment"
      );
      for (const comment of oldComments) {
        const newPointId = pointIdMap.get(comment.point_id);
        if (newPointId) {
          const newUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          db.runSync(
            "INSERT INTO comment_new (id, point_id, value) VALUES (?, ?, ?)",
            [newUuid, newPointId, comment.value]
          );
        }
      }

      // Migrer pictures
      const oldPictures = db.getAllSync<{id: number, point_id: number, image: string}>(
        "SELECT id, point_id, image FROM picture"
      );
      for (const picture of oldPictures) {
        const newPointId = pointIdMap.get(picture.point_id);
        if (newPointId) {
          const newUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          db.runSync(
            "INSERT INTO picture_new (id, point_id, image) VALUES (?, ?, ?)",
            [newUuid, newPointId, picture.image]
          );
        }
      }

      // Migrer obstacles
      const oldObstacles = db.getAllSync<{id: number, point_id: number, type_id: number, number: number}>(
        "SELECT id, point_id, type_id, number FROM obstacle"
      );
      for (const obstacle of oldObstacles) {
        const newPointId = pointIdMap.get(obstacle.point_id);
        if (newPointId) {
          const newUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          db.runSync(
            "INSERT INTO obstacle_new (id, point_id, type_id, number) VALUES (?, ?, ?, ?)",
            [newUuid, newPointId, obstacle.type_id, obstacle.number]
          );
        }
      }

      // Supprimer les anciennes tables et renommer les nouvelles
      db.execSync("DROP TABLE IF EXISTS obstacle");
      db.execSync("DROP TABLE IF EXISTS picture");
      db.execSync("DROP TABLE IF EXISTS comment");
      db.execSync("DROP TABLE IF EXISTS point_event");
      db.execSync("DROP TABLE IF EXISTS point");

      db.execSync("ALTER TABLE point_new RENAME TO point");
      db.execSync("ALTER TABLE point_event_new RENAME TO point_event");
      db.execSync("ALTER TABLE comment_new RENAME TO comment");
      db.execSync("ALTER TABLE picture_new RENAME TO picture");
      db.execSync("ALTER TABLE obstacle_new RENAME TO obstacle");

      // Recréer les index
      db.execSync("CREATE INDEX IF NOT EXISTS idx_point_event_event_id ON point_event(event_id)");
    },
  },
];
