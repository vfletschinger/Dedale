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

    // 1. Seed obstacle_types
    console.log("Insertion des types d'obstacles...");
    const obstacleTypes = [
      {
        name: "Glissière 2m",
        description: "Glissière béton armé (GBA) 2m",
        width: 0.6,
        length: 2,
      },
      {
        name: "Glissière 1m",
        description: "Glissière béton armé (GBA) 1m",
        width: 0.6,
        length: 1,
      },
      {
        name: "Bloc 2.5m",
        description: "Bloc de béton 2.5m",
        width: 0.6,
        length: 2.5,
      },
      {
        name: "Bloc 1m",
        description: "Bloc de béton 1m",
        width: 0.6,
        length: 1,
      },
      {
        name: "Barrière Vauban",
        description: "Barrière de 2 mètres",
        width: 0.4,
        length: 2,
      },
      {
        name: "Barrière Héras",
        description:
          "Barrière Héras (délimitation de surface d’accueil de personnes)",
        width: 0.1,
        length: 3.5,
      },
      {
        name: "Barrière Héras avec voile d’occultation",
        description:
          "Barrière Héras avec voile d’occultation (délimitation de surface d’accueil de personnes)",
        width: 0.1,
        length: 3.5,
      },
      {
        name: "Obstacle",
        description: "Obstacle pour voitures",
        width: 0.95,
        length: 1.05,
      },
      {
        name: "Engins de blocage 8m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 8,
      },
      {
        name: "Engins de blocage 9.35m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 9.35,
      },
      {
        name: "Engins de blocage 9.5m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 9.5,
      },
      {
        name: "Engins de blocage 11m",
        description:
          "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.",
        width: 2,
        length: 11,
      },
      {
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
        "INSERT INTO obstacle_type (name, description, width, length) VALUES (?, ?, ?, ?)",
        [type.name, type.description, type.width, type.length]
      );
      typeIds.push(result.lastInsertRowId);
    });

    // 2. Seed interest_points
    console.log("Insertion des points d'intérêt...");
    const points = [
      { x: 7.7521, y: 48.5734 },
      { x: 7.735, y: 48.585 },
      { x: 7.758, y: 48.592 },
      { x: 7.742, y: 48.568 },
      { x: 7.765, y: 48.579 },
      { x: 7.749, y: 48.576 },
      { x: 7.7475, y: 48.5708 },
      { x: 7.7601, y: 48.5745 },
      { x: 7.755, y: 48.58 },
      { x: 7.77, y: 48.5855 },
      { x: 7.73, y: 48.57 },
      { x: 7.7405, y: 48.5855 },
      { x: 7.7488, y: 48.5902 },
      { x: 7.7623, y: 48.5689 },
      { x: 7.7722, y: 48.5721 },
      { x: 7.7366, y: 48.5777 },
      { x: 7.7599, y: 48.5812 },
      { x: 7.7433, y: 48.5744 },
      { x: 7.7512, y: 48.5888 },
      { x: 7.7689, y: 48.5877 },
    ];

    const pointIds: number[] = [];
    points.forEach((point) => {
      const result = db.runSync("INSERT INTO point (x, y) VALUES (?, ?)", [
        point.x,
        point.y,
      ]);
      pointIds.push(result.lastInsertRowId);
    });

    // 3. Seed comments
    console.log("Insertion des commentaires...");
    const comments = [
      {
        point_id: pointIds[0],
        value: "Zone très fréquentée, attention aux piétons",
      },
      { point_id: pointIds[0], value: "Passage étroit" },
      { point_id: pointIds[1], value: "Belle vue sur la cathédrale" },
      { point_id: pointIds[2], value: "Travaux en cours" },
      { point_id: pointIds[3], value: "Pont" },
      { point_id: pointIds[4], value: "Attention au verglas en hiver" },
    ];

    comments.forEach((comment) => {
      db.runSync("INSERT INTO comment (point_id, value) VALUES (?, ?)", [
        comment.point_id,
        comment.value,
      ]);
    });

    // 4. Seed pictures
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
        point_id: pointIds[3],
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      },
      {
        point_id: pointIds[4],
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

    // 5. Seed obstacles
    console.log("Insertion des obstacles...");
    const obstacles = [
      { point_id: pointIds[0], type_id: typeIds[0], nombre: 2 },
      { point_id: pointIds[0], type_id: typeIds[4], nombre: 1 },
      { point_id: pointIds[1], type_id: typeIds[2], nombre: 1 },
      { point_id: pointIds[2], type_id: typeIds[1], nombre: 3 },
      { point_id: pointIds[3], type_id: typeIds[3], nombre: 2 },
      { point_id: pointIds[4], type_id: typeIds[0], nombre: 5 },
    ];

    obstacles.forEach((obstacle) => {
      db.runSync(
        "INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)",
        [obstacle.point_id, obstacle.type_id, obstacle.nombre]
      );
    });

    console.log("Seeding terminé avec succès !");
    console.log(`   - ${obstacleTypes.length} types d'obstacles`);
    console.log(`   - ${points.length} points d'intérêt`);
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
    db.execSync("DELETE FROM obstacle");
    db.execSync("DELETE FROM picture");
    db.execSync("DELETE FROM comment");
    db.execSync("DELETE FROM point");
    db.execSync("DELETE FROM obstacle_type");

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
