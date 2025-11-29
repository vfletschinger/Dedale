import { SQLiteDatabase } from "expo-sqlite";

export async function seedDatabase(db: SQLiteDatabase) {
  console.log("Début du seeding...");

  try {
    // Vérifier si des données existent déjà
    const existingPoints = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM point"
    );

    if (existingPoints && existingPoints.count > 0) {
      console.log("Des données existent déjà, seeding annulé");
      return;
    }

    // 1. Seed events
    console.log("Insertion des événements...");
    const events = [
      {
        id: 1,
        name: "Marché de Noël 2025",
        description: "Marché de Noël de Strasbourg",
        dateDebut: "2025-11-22",
        dateFin: "2025-12-30",
        statut: "actif",
        geometry: null,
      },
      {
        id: 2,
        name: "Festival d'été Illkirch 2025",
        description: "Festival d'été à Illkirch-Graffenstaden",
        dateDebut: "2025-07-01",
        dateFin: "2025-07-15",
        statut: "passé",
        geometry: null,
      },
      {
        id: 3,
        name: "Fête de la Musique 2026",
        description: "Grande fête de la musique à Strasbourg",
        dateDebut: "2026-06-21",
        dateFin: "2026-06-21",
        statut: "planifié",
        geometry: null,
      },
    ];

    const eventIds: number[] = [];
    events.forEach((event) => {
      const result = db.runSync(
        "INSERT INTO event (id, name, description, dateDebut, dateFin, statut, geometry) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          event.id,
          event.name,
          event.description,
          event.dateDebut,
          event.dateFin,
          event.statut,
          event.geometry,
        ]
      );
      eventIds.push(result.lastInsertRowId);
    });

    // 2. Seed obstacle_types
    console.log("Insertion des types d'obstacles...");
    const obstacleTypes = [
      {
        id: 1,
        name: "Glissière 2m",
        description: "Glissière béton armé (GBA) 2m",
        width: 0.6,
        length: 2,
      },
      {
        id: 2,
        name: "Glissière 1m",
        description: "Glissière béton armé (GBA) 1m",
        width: 0.6,
        length: 1,
      },
      {
        id: 3,
        name: "Bloc 2.5m",
        description: "Bloc de béton 2.5m",
        width: 0.6,
        length: 2.5,
      },
      {
        id: 4,
        name: "Bloc 1m",
        description: "Bloc de béton 1m",
        width: 0.6,
        length: 1,
      },
      {
        id: 5,
        name: "Barrière Vauban",
        description: "Barrière de 2 mètres",
        width: 0.4,
        length: 2,
      },
      {
        id: 6,
        name: "Barrière Héras",
        description:
          "Barrière Héras (délimitation de surface d’accueil de personnes)",
        width: 0.1,
        length: 3.5,
      },
      {
        id: 7,
        name: "Barrière Héras avec voile d’occultation",
        description:
          "Barrière Héras avec voile d’occultation (délimitation de surface d’accueil de personnes)",
        width: 0.1,
        length: 3.5,
      },
      {
        id: 8,
        name: "Obstacle",
        description: "Obstacle pour voitures",
        width: 0.95,
        length: 1.05,
      },
      {
        id: 9,
        name: "Engins de blocage 8m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 8,
      },
      {
        id: 10,
        name: "Engins de blocage 9.35m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 9.35,
      },
      {
        id: 11,
        name: "Engins de blocage 9.5m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 9.5,
      },
      {
        id: 12,
        name: "Engins de blocage 11m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 11,
      },
      {
        id: 13,
        name: "Engins de blocage 16m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 16,
      },
    ];

    const typeIds: number[] = [];
    obstacleTypes.forEach((type) => {
      const result = db.runSync(
        "INSERT INTO obstacle_type (id, name, description, width, length) VALUES (?, ?, ?, ?, ?)",
        [type.id, type.name, type.description, type.width, type.length]
      );
      typeIds.push(result.lastInsertRowId);
    });

    // 3. Seed points (coordinates without event association yet)
    console.log("Insertion des points d'intérêt...");
    const pointsData = [
      // Strasbourg points
      { x: 7.7521, y: 48.5734 }, // Centre-ville Strasbourg
      { x: 7.7475, y: 48.5708 }, // Quartier de la cathédrale
      { x: 7.7601, y: 48.5745 }, // Place Kléber
      { x: 7.755, y: 48.58 }, // Petite France
      // Illkirch points
      { x: 7.7189, y: 48.5297 }, // Centre Illkirch
      { x: 7.7245, y: 48.532 }, // Parc de l'Ill
      { x: 7.715, y: 48.528 }, // Zone commerciale
      { x: 7.721, y: 48.5305 }, // Mairie Illkirch
      { x: 7.7175, y: 48.5265 }, // Stade municipal
      // Fête de la Musique 2026 points
      { x: 7.75, y: 48.58 }, // Place de la République
      { x: 7.755, y: 48.582 }, // Parc de l'Orangerie
      { x: 7.748, y: 48.579 }, // Place Gutenberg
    ];

    const pointIds: number[] = [];
    pointsData.forEach((point) => {
      const result = db.runSync("INSERT INTO point (x, y) VALUES (?, ?)", [
        point.x,
        point.y,
      ]);
      pointIds.push(result.lastInsertRowId);
    });

    // 4. Create point-event associations (many-to-many)
    console.log("Création des associations points-événements...");
    const pointEventAssociations = [
      // Strasbourg Marché de Noël (points 0-3)
      { point_id: pointIds[0], event_id: eventIds[0] },
      { point_id: pointIds[1], event_id: eventIds[0] },
      { point_id: pointIds[2], event_id: eventIds[0] },
      { point_id: pointIds[3], event_id: eventIds[0] },
      // Illkirch Festival (points 4-8)
      { point_id: pointIds[4], event_id: eventIds[1] },
      { point_id: pointIds[5], event_id: eventIds[1] },
      { point_id: pointIds[6], event_id: eventIds[1] },
      { point_id: pointIds[7], event_id: eventIds[1] },
      { point_id: pointIds[8], event_id: eventIds[1] },
      // Fête de la Musique 2026 (points 9-11)
      { point_id: pointIds[9], event_id: eventIds[2] },
      { point_id: pointIds[10], event_id: eventIds[2] },
      { point_id: pointIds[11], event_id: eventIds[2] },
      // Exemple: un point peut être associé à plusieurs événements
      // Point 2 (Place Kléber) est aussi utilisé pour la Fête de la Musique
      { point_id: pointIds[2], event_id: eventIds[2] },
    ];

    pointEventAssociations.forEach((assoc) => {
      db.runSync("INSERT INTO point_event (point_id, event_id) VALUES (?, ?)", [
        assoc.point_id,
        assoc.event_id,
      ]);
    });

    // 6. Seed comments (for Strasbourg points)
    console.log("Insertion des commentaires...");
    const comments = [
      {
        point_id: pointIds[0],
        value: "Zone très fréquentée, attention aux piétons",
      },
      { point_id: pointIds[0], value: "Passage étroit" },
      { point_id: pointIds[1], value: "Belle vue sur la cathédrale" },
      { point_id: pointIds[2], value: "Place principale du marché" },
      { point_id: pointIds[3], value: "Quartier pittoresque" },
      // Comments for Illkirch points
      { point_id: pointIds[4], value: "Scène principale du festival" },
      { point_id: pointIds[5], value: "Zone de restauration" },
      { point_id: pointIds[6], value: "Parking disponible" },
      // Comments for Fête de la Musique 2026 points
      {
        point_id: pointIds[9],
        value: "Scène principale de la Fête de la Musique",
      },
      { point_id: pointIds[10], value: "Concerts en plein air" },
      { point_id: pointIds[11], value: "Podium pour groupes locaux" },
    ];

    comments.forEach((comment) => {
      db.runSync("INSERT INTO comment (point_id, value) VALUES (?, ?)", [
        comment.point_id,
        comment.value,
      ]);
    });

    // 6. Seed pictures
    console.log("Insertion des photos...");
    const pictures = [
      {
        point_id: pointIds[0],
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      },
      {
        point_id: pointIds[1],
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      },
      {
        point_id: pointIds[2],
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      },
      {
        point_id: pointIds[4],
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      },
      {
        point_id: pointIds[6],
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      },
    ];
    pictures.forEach((picture) => {
      db.runSync("INSERT INTO picture (point_id, image) VALUES (?, ?)", [
        picture.point_id,
        picture.image,
      ]);
    });

    // 7. Seed obstacles
    console.log("Insertion des obstacles...");
    const obstacles = [
      // Strasbourg obstacles
      { point_id: pointIds[0], type_id: typeIds[0], nombre: 2 },
      { point_id: pointIds[0], type_id: typeIds[4], nombre: 1 },
      { point_id: pointIds[1], type_id: typeIds[2], nombre: 1 },
      { point_id: pointIds[2], type_id: typeIds[1], nombre: 3 },
      { point_id: pointIds[3], type_id: typeIds[3], nombre: 2 },
      // Illkirch obstacles
      { point_id: pointIds[4], type_id: typeIds[5], nombre: 10 },
      { point_id: pointIds[5], type_id: typeIds[6], nombre: 8 },
      { point_id: pointIds[6], type_id: typeIds[0], nombre: 5 },
      { point_id: pointIds[7], type_id: typeIds[4], nombre: 3 },
      { point_id: pointIds[8], type_id: typeIds[7], nombre: 4 },
      // Fête de la Musique 2026 obstacles
      { point_id: pointIds[9], type_id: typeIds[5], nombre: 15 },
      { point_id: pointIds[10], type_id: typeIds[6], nombre: 12 },
      { point_id: pointIds[11], type_id: typeIds[4], nombre: 6 },
    ];

    obstacles.forEach((obstacle) => {
      db.runSync(
        "INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)",
        [obstacle.point_id, obstacle.type_id, obstacle.nombre]
      );
    });

    console.log("Seeding terminé avec succès !");
    console.log(`   - ${events.length} événements`);
    console.log(`   - ${obstacleTypes.length} types d'obstacles`);
    console.log(`   - ${pointsData.length} points d'intérêt`);
    console.log(
      `   - ${pointEventAssociations.length} associations point-événement`
    );
    console.log(`   - ${comments.length} commentaires`);
    console.log(`   - ${pictures.length} photos`);
    console.log(`   - ${obstacles.length} obstacles`);
  } catch (error) {
    console.error("Erreur lors du seeding:", error);
    throw error;
  }
}

// Fonction pour nettoyer toutes les données
export function clearDatabase(db: SQLiteDatabase): void {
  console.log("Suppression de toutes les données...");

  try {
    // Delete in order of dependencies (foreign keys)
    db.execSync("DELETE FROM obstacle");
    db.execSync("DELETE FROM picture");
    db.execSync("DELETE FROM comment");
    db.execSync("DELETE FROM point_event");
    db.execSync("DELETE FROM point");
    db.execSync("DELETE FROM obstacle_type");

    // Check if event and session tables exist before deleting
    const eventTableExists = db.getFirstSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='event'"
    );

    if (eventTableExists) {
      db.execSync("DELETE FROM session");
      db.execSync("DELETE FROM event");
    }

    console.log("Base de données nettoyée");
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error);
    throw error;
  }
}

// Fonction pour réinitialiser et reseed
export function resetAndSeed(db: SQLiteDatabase): void {
  clearDatabase(db);
  seedDatabase(db);
}
