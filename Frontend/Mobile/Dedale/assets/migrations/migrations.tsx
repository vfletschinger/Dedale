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
      const oldPoints = db.getAllSync<{
        id: number;
        x: number;
        y: number;
        created_at: string;
        modified_at: string;
      }>("SELECT id, x, y, created_at, modified_at FROM point");

      // Map ancien ID -> nouveau UUID
      const pointIdMap = new Map<number, string>();

      for (const point of oldPoints) {
        const newUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          }
        );
        pointIdMap.set(point.id, newUuid);

        db.runSync(
          "INSERT INTO point_new (id, x, y, created_at, modified_at) VALUES (?, ?, ?, ?, ?)",
          [newUuid, point.x, point.y, point.created_at, point.modified_at]
        );
      }

      // Migrer point_event
      const oldPointEvents = db.getAllSync<{
        point_id: number;
        event_id: number;
      }>("SELECT point_id, event_id FROM point_event");
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
      const oldComments = db.getAllSync<{
        id: number;
        point_id: number;
        value: string;
      }>("SELECT id, point_id, value FROM comment");
      for (const comment of oldComments) {
        const newPointId = pointIdMap.get(comment.point_id);
        if (newPointId) {
          const newUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            }
          );
          db.runSync(
            "INSERT INTO comment_new (id, point_id, value) VALUES (?, ?, ?)",
            [newUuid, newPointId, comment.value]
          );
        }
      }

      // Migrer pictures
      const oldPictures = db.getAllSync<{
        id: number;
        point_id: number;
        image: string;
      }>("SELECT id, point_id, image FROM picture");
      for (const picture of oldPictures) {
        const newPointId = pointIdMap.get(picture.point_id);
        if (newPointId) {
          const newUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            }
          );
          db.runSync(
            "INSERT INTO picture_new (id, point_id, image) VALUES (?, ?, ?)",
            [newUuid, newPointId, picture.image]
          );
        }
      }

      // Migrer obstacles
      const oldObstacles = db.getAllSync<{
        id: number;
        point_id: number;
        type_id: number;
        number: number;
      }>("SELECT id, point_id, type_id, number FROM obstacle");
      for (const obstacle of oldObstacles) {
        const newPointId = pointIdMap.get(obstacle.point_id);
        if (newPointId) {
          const newUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            }
          );
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
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_point_event_event_id ON point_event(event_id)"
      );
    },
  },
  {
    version: 3,
    name: "Complete schema migration to UUID and new structure",
    up: (db: SQLiteDatabase) => {
      // 1. Créer les nouvelles tables avec structure complète

      // Event avec UUID
      db.execSync(`
        CREATE TABLE IF NOT EXISTS event_new (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT,
          description TEXT,
          dateDebut DATE,
          dateFin DATE,
          statut TEXT
        );
      `);

      // Point avec UUID et champ comment intégré
      db.execSync(`
        CREATE TABLE IF NOT EXISTS point_new (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES event_new (id) ON DELETE CASCADE
        );
      `);

      // Renommer obstacle_type en equipement_type
      db.execSync(`
        CREATE TABLE IF NOT EXISTS equipement_type (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(25) NOT NULL,
          description TEXT,
          width REAL,
          length REAL
        );
      `);

      // Equipement (remplace obstacle, number -> quantity)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS equipement (
          id TEXT PRIMARY KEY NOT NULL,
          point_id TEXT NOT NULL,
          type_id INTEGER NOT NULL,
          quantity INTEGER DEFAULT 1,
          description TEXT,
          FOREIGN KEY (point_id) REFERENCES point_new (id) ON DELETE CASCADE,
          FOREIGN KEY (type_id) REFERENCES equipement_type (id)
        );
      `);

      // Picture avec UUID
      db.execSync(`
        CREATE TABLE IF NOT EXISTS picture_new (
          id TEXT PRIMARY KEY NOT NULL,
          point_id TEXT NOT NULL,
          image TEXT NOT NULL,
          FOREIGN KEY (point_id) REFERENCES point_new (id) ON DELETE CASCADE
        );
      `);

      // Parcours (remplace geometry pour les tracés)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS parcours (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          wkt TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES event_new (id) ON DELETE CASCADE
        );
      `);

      // Zone (remplace geometry pour les polygones)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS zone (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          wkt TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES event_new (id) ON DELETE CASCADE
        );
      `);

      // Tables pour les équipes
      db.execSync(`
        CREATE TABLE IF NOT EXISTS team (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          name TEXT NOT NULL,
          FOREIGN KEY (event_id) REFERENCES event_new (id) ON DELETE CASCADE
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS person (
          id TEXT PRIMARY KEY NOT NULL,
          firstname TEXT,
          lastname TEXT,
          email TEXT,
          phone TEXT
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS member (
          id TEXT PRIMARY KEY NOT NULL,
          team_id TEXT NOT NULL,
          person_id TEXT NOT NULL,
          role TEXT,
          FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
          FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE
        );
      `);

      // 2. Migrer les données existantes

      // Générer UUID helper
      const generateUuid = () => {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };

      // Migrer events
      const oldEvents = db.getAllSync<{
        id: number;
        name: string;
        description: string;
        dateDebut: string;
        dateFin: string;
        statut: string;
      }>("SELECT id, name, description, dateDebut, dateFin, statut FROM event");

      const eventIdMap = new Map<number, string>();
      for (const event of oldEvents) {
        const newUuid = generateUuid();
        eventIdMap.set(event.id, newUuid);
        db.runSync(
          "INSERT INTO event_new (id, name, description, dateDebut, dateFin, statut) VALUES (?, ?, ?, ?, ?, ?)",
          [
            newUuid,
            event.name,
            event.description,
            event.dateDebut,
            event.dateFin,
            event.statut,
          ]
        );
      }

      // Migrer obstacle_type vers equipement_type
      const oldObstacleTypes = db.getAllSync<{
        id: number;
        name: string;
        description: string;
        width: number;
        length: number;
      }>("SELECT id, name, description, width, length FROM obstacle_type");
      for (const type of oldObstacleTypes) {
        db.runSync(
          "INSERT INTO equipement_type (id, name, description, width, length) VALUES (?, ?, ?, ?, ?)",
          [type.id, type.name, type.description, type.width, type.length]
        );
      }

      // Migrer points avec leurs comments
      const oldPoints = db.getAllSync<{
        id: string;
        x: number;
        y: number;
        created_at: string;
        modified_at: string;
      }>("SELECT id, x, y, created_at, modified_at FROM point");

      const pointIdMap = new Map<string, string>();

      for (const point of oldPoints) {
        const newUuid = generateUuid();
        pointIdMap.set(point.id, newUuid);

        // Récupérer le premier commentaire associé à ce point (s'il existe)
        const comment = db.getFirstSync<{ value: string }>(
          "SELECT value FROM comment WHERE point_id = ?",
          [point.id]
        );

        // Récupérer l'event_id depuis point_event
        const pointEvent = db.getFirstSync<{ event_id: number }>(
          "SELECT event_id FROM point_event WHERE point_id = ?",
          [point.id]
        );

        const eventUuid = pointEvent
          ? eventIdMap.get(pointEvent.event_id)
          : null;

        if (eventUuid) {
          db.runSync(
            "INSERT INTO point_new (id, event_id, x, y, comment, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              newUuid,
              eventUuid,
              point.x,
              point.y,
              comment?.value || null,
              point.created_at,
              point.modified_at,
            ]
          );
        }
      }

      // Migrer equipements (obstacles)
      const oldObstacles = db.getAllSync<{
        id: string;
        point_id: string;
        type_id: number;
        number: number;
      }>("SELECT id, point_id, type_id, number FROM obstacle");
      for (const obstacle of oldObstacles) {
        const newPointId = pointIdMap.get(obstacle.point_id);
        if (newPointId) {
          const newUuid = generateUuid();
          db.runSync(
            "INSERT INTO equipement (id, point_id, type_id, quantity) VALUES (?, ?, ?, ?)",
            [newUuid, newPointId, obstacle.type_id, obstacle.number]
          );
        }
      }

      // Migrer pictures
      const oldPictures = db.getAllSync<{
        id: string;
        point_id: string;
        image: string;
      }>("SELECT id, point_id, image FROM picture");
      for (const picture of oldPictures) {
        const newPointId = pointIdMap.get(picture.point_id);
        if (newPointId) {
          const newUuid = generateUuid();
          db.runSync(
            "INSERT INTO picture_new (id, point_id, image) VALUES (?, ?, ?)",
            [newUuid, newPointId, picture.image]
          );
        }
      }

      // Migrer geometries vers parcours ou zone
      // Note: Pour l'instant, on va tout mettre en parcours
      // TODO: Distinguer entre LINESTRING (parcours) et POLYGON (zone)
      const oldGeometries = db.getAllSync<{
        id: number;
        event_id: number;
        wkt: string;
        created_at: string;
      }>("SELECT id, event_id, wkt, created_at FROM geometry");
      for (const geom of oldGeometries) {
        const eventUuid = eventIdMap.get(geom.event_id);
        if (eventUuid) {
          const newUuid = generateUuid();
          // Déterminer si c'est un parcours ou une zone basé sur le WKT
          if (geom.wkt.toUpperCase().includes("LINESTRING")) {
            db.runSync(
              "INSERT INTO parcours (id, event_id, wkt, created_at) VALUES (?, ?, ?, ?)",
              [newUuid, eventUuid, geom.wkt, geom.created_at]
            );
          } else if (geom.wkt.toUpperCase().includes("POLYGON")) {
            db.runSync(
              "INSERT INTO zone (id, event_id, wkt, created_at) VALUES (?, ?, ?, ?)",
              [newUuid, eventUuid, geom.wkt, geom.created_at]
            );
          }
        }
      }

      // 3. Supprimer les anciennes tables
      db.execSync("DROP TABLE IF EXISTS geometry");
      db.execSync("DROP TABLE IF EXISTS obstacle");
      db.execSync("DROP TABLE IF EXISTS picture");
      db.execSync("DROP TABLE IF EXISTS comment");
      db.execSync("DROP TABLE IF EXISTS point_event");
      db.execSync("DROP TABLE IF EXISTS point");
      db.execSync("DROP TABLE IF EXISTS obstacle_type");
      db.execSync("DROP TABLE IF EXISTS event");

      // 4. Renommer les nouvelles tables
      db.execSync("ALTER TABLE event_new RENAME TO event");
      db.execSync("ALTER TABLE point_new RENAME TO point");
      db.execSync("ALTER TABLE picture_new RENAME TO picture");

      // 5. Créer les index
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_point_event_id ON point(event_id)"
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_parcours_event_id ON parcours(event_id)"
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_zone_event_id ON zone(event_id)"
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_team_event_id ON team(event_id)"
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_member_team_id ON member(team_id)"
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_member_person_id ON member(person_id)"
      );
    },
  },
  {
    version: 4,
    name: "add_name_type_status_to_point",
    up: (db: SQLiteDatabase) => {
      console.log(
        "🔄 Migration v4: Ajout des colonnes name, type et status à la table point"
      );

      // Vérifier si les colonnes existent déjà
      const tableInfo = db.getAllSync("PRAGMA table_info(point)");
      const columnNames = tableInfo.map((col: any) => col.name);

      // Ajouter la colonne name si elle n'existe pas
      if (!columnNames.includes("name")) {
        db.execSync("ALTER TABLE point ADD COLUMN name TEXT DEFAULT 'Point'");
        console.log("✅ Colonne 'name' ajoutée à la table point");
      }

      // Ajouter la colonne type si elle n'existe pas
      if (!columnNames.includes("type")) {
        db.execSync("ALTER TABLE point ADD COLUMN type TEXT");
        console.log("✅ Colonne 'type' ajoutée à la table point");
      }

      // Ajouter la colonne status si elle n'existe pas
      if (!columnNames.includes("status")) {
        db.execSync("ALTER TABLE point ADD COLUMN status INTEGER DEFAULT 0");
        console.log("✅ Colonne 'status' ajoutée à la table point");
      }

      console.log("✅ Migration v4 terminée");
    },
  },
  {
    version: 5,
    name: "create_action_table",
    up: (db: SQLiteDatabase) => {
      console.log("🔄 Migration v5: Création de la table action");

      db.execSync(`
        CREATE TABLE IF NOT EXISTS action (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL,
          equipement_id TEXT NOT NULL,
          type TEXT,
          scheduled_time DATETIME,
          is_done INTEGER DEFAULT 0,
          FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
          FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON DELETE CASCADE
        )
      `);

      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_action_team_id ON action(team_id)"
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_action_equipement_id ON action(equipement_id)"
      );

      console.log("✅ Migration v5 terminée");
    },
  },
  {
    version: 6,
    name: "update_equipement_for_uuid_type",
    up: (db: SQLiteDatabase) => {
      console.log("🔄 Migration v6: Mise à jour table equipement pour UUID type_id");

      // Vérifier les colonnes existantes de la table equipement
      const tableInfo = db.getAllSync("PRAGMA table_info(equipement)");
      console.log("📋 Colonnes de la table equipement:", JSON.stringify(tableInfo));
      const columnNames = tableInfo.map((col: any) => col.name);
      const hasLengthColumn = columnNames.includes("length");
      console.log("📋 Colonne 'length' existe:", hasLengthColumn);

      // Recréer la table equipement avec type_id en TEXT et point_id nullable
      db.execSync(`
        CREATE TABLE IF NOT EXISTS equipement_new (
          id TEXT PRIMARY KEY NOT NULL,
          point_id TEXT,
          type_id TEXT,
          quantity INTEGER DEFAULT 1,
          length_per_unit REAL DEFAULT 0,
          date_pose DATETIME,
          date_depose DATETIME,
          event_id TEXT,
          FOREIGN KEY (point_id) REFERENCES point (id) ON DELETE SET NULL,
          FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )
      `);

      // Copier les données existantes (avec ou sans colonne length)
      if (hasLengthColumn) {
        db.execSync(`
          INSERT OR IGNORE INTO equipement_new (id, point_id, type_id, quantity, length_per_unit)
          SELECT id, point_id, CAST(type_id AS TEXT), quantity, COALESCE(length, 0)
          FROM equipement
        `);
      } else {
        db.execSync(`
          INSERT OR IGNORE INTO equipement_new (id, point_id, type_id, quantity, length_per_unit)
          SELECT id, point_id, CAST(type_id AS TEXT), quantity, 0
          FROM equipement
        `);
      }

      // Supprimer l'ancienne table et renommer
      db.execSync(`DROP TABLE IF EXISTS equipement`);
      db.execSync(`ALTER TABLE equipement_new RENAME TO equipement`);

      // Table equipement_type avec UUID
      db.execSync(`
        CREATE TABLE IF NOT EXISTS equipement_type_new (
          id TEXT PRIMARY KEY NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          width REAL,
          length REAL
        )
      `);

      // Copier les types existants avec UUID généré
      const existingTypes = db.getAllSync<{ id: number; name: string; description: string; width: number; length: number }>(
        "SELECT * FROM equipement_type"
      );
      for (const type of existingTypes) {
        db.runSync(
          "INSERT OR IGNORE INTO equipement_type_new (id, name, description, width, length) VALUES (?, ?, ?, ?, ?)",
          [String(type.id), type.name, type.description, type.width, type.length]
        );
      }

      db.execSync(`DROP TABLE IF EXISTS equipement_type`);
      db.execSync(`ALTER TABLE equipement_type_new RENAME TO equipement_type`);

      // Table pour stocker les coordonnées des équipements
      db.execSync(`
        CREATE TABLE IF NOT EXISTS equipement_coordinate (
          id TEXT PRIMARY KEY NOT NULL,
          equipement_id TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          order_index INTEGER DEFAULT 0,
          FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON DELETE CASCADE
        )
      `);

      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_equipement_coord_equipement_id ON equipement_coordinate(equipement_id)"
      );

      console.log("✅ Migration v6 terminée");
    },
  },
  {
    version: 7,
    name: "align_with_tauri_schema",
    up: (db: SQLiteDatabase) => {
      console.log("🔄 Migration v7: Alignement avec le schéma Tauri");

      // 1. Recréer la table equipement conforme au schéma Tauri
      db.execSync(`
        CREATE TABLE IF NOT EXISTS equipement_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          type_id TEXT,
          quantity INTEGER DEFAULT 1,
          length_per_unit REAL DEFAULT 0,
          date_pose DATETIME,
          date_depose DATETIME,
          FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
          FOREIGN KEY (type_id) REFERENCES type (id)
        )
      `);

      // Copier les données existantes (gérer les deux cas: length ou length_per_unit)
      try {
        // Essayer d'abord avec length_per_unit (si déjà migré partiellement)
        db.execSync(`
          INSERT OR IGNORE INTO equipement_v7 (id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose)
          SELECT id, COALESCE(event_id, ''), type_id, quantity, COALESCE(length_per_unit, 0), date_pose, date_depose
          FROM equipement
        `);
      } catch (e1) {
        try {
          // Sinon essayer avec length (ancien schéma)
          db.execSync(`
            INSERT OR IGNORE INTO equipement_v7 (id, event_id, type_id, quantity, length_per_unit, date_pose, date_depose)
            SELECT id, COALESCE(event_id, ''), type_id, quantity, COALESCE(length, 0), date_pose, date_depose
            FROM equipement
          `);
        } catch (e2) {
          console.log("Pas de données equipement à migrer:", e2);
        }
      }

      db.execSync(`DROP TABLE IF EXISTS equipement`);
      db.execSync(`ALTER TABLE equipement_v7 RENAME TO equipement`);

      // 2. Créer/recréer la table type (comme dans Tauri)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS type (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT,
          description TEXT
        )
      `);

      // Migrer equipement_type vers type si existe
      try {
        const existingTypes = db.getAllSync<{ id: string; name: string; description: string }>(
          "SELECT id, name, description FROM equipement_type"
        );
        for (const t of existingTypes) {
          db.runSync(
            "INSERT OR IGNORE INTO type (id, name, description) VALUES (?, ?, ?)",
            [t.id, t.name, t.description]
          );
        }
      } catch (e) {
        console.log("Pas de table equipement_type à migrer");
      }

      // 3. Table person (conforme Tauri)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS person (
          id TEXT PRIMARY KEY NOT NULL,
          firstname TEXT,
          lastname TEXT,
          email TEXT,
          phone_number TEXT
        )
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS member (
          id TEXT PRIMARY KEY NOT NULL,
          team_id TEXT NOT NULL,
          person_id TEXT NOT NULL,
          FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
          FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE,
          UNIQUE(team_id, person_id)
        )
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS interest (
          id TEXT PRIMARY KEY NOT NULL,
          event_id TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          description TEXT,
          FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS action_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          team_id TEXT NOT NULL,
          equipement_id TEXT NOT NULL,
          type TEXT,
          scheduled_time DATETIME,
          is_done INTEGER DEFAULT 0,
          FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
          FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON DELETE CASCADE
        )
      `);

      // Copier les actions existantes
      try {
        db.execSync(`
          INSERT OR IGNORE INTO action_v7 (id, team_id, equipement_id, type, scheduled_time, is_done)
          SELECT id, team_id, equipement_id, type, scheduled_time, is_done
          FROM action
        `);
        db.execSync(`DROP TABLE IF EXISTS action`);
      } catch (e) {
        console.log("Pas de table action existante");
      }
      db.execSync(`ALTER TABLE action_v7 RENAME TO action`);

      // Index pour les performances
      db.execSync("CREATE INDEX IF NOT EXISTS idx_equipement_event_id ON equipement(event_id)");
      db.execSync("CREATE INDEX IF NOT EXISTS idx_equipement_type_id ON equipement(type_id)");
      db.execSync("CREATE INDEX IF NOT EXISTS idx_member_team_id ON member(team_id)");
      db.execSync("CREATE INDEX IF NOT EXISTS idx_member_person_id ON member(person_id)");
      db.execSync("CREATE INDEX IF NOT EXISTS idx_action_team_id ON action(team_id)");
      db.execSync("CREATE INDEX IF NOT EXISTS idx_action_equipement_id ON action(equipement_id)");

      console.log("✅ Migration v7 terminée - Schéma aligné avec Tauri");
    },
  },
];
