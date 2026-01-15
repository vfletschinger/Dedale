import { SQLiteDatabase } from "expo-sqlite";

export async function seedDatabase(db: SQLiteDatabase) {
  console.log("Début du seeding...");

  try {
    // Helper to generate UUID
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    // Vérifier si des données existent déjà
    const existingPoints = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM point"
    );

    // Si des points existent, faire un seeding partiel (équipes/actions seulement)
    if (existingPoints && existingPoints.count > 0) {
      console.log(
        "Des points existent déjà, seeding partiel (équipes/actions)..."
      );

      // Vérifier si des équipes existent
      const existingTeams = db.getFirstSync<{ count: number }>(
        "SELECT COUNT(*) as count FROM team"
      );

      if (!existingTeams || existingTeams.count === 0) {
        // Récupérer les events existants
        const existingEvents = db.getAllSync<{ id: string }>(
          "SELECT id FROM event LIMIT 3"
        );

        if (existingEvents.length > 0) {
          console.log("Insertion des équipes...");
          const teams = [
            {
              id: generateUUID(),
              event_id: existingEvents[0].id,
              name: "Équipe Alpha",
            },
            {
              id: generateUUID(),
              event_id: existingEvents[0].id,
              name: "Équipe Bravo",
            },
            existingEvents[1]
              ? {
                  id: generateUUID(),
                  event_id: existingEvents[1].id,
                  name: "Équipe Illkirch",
                }
              : null,
          ].filter(Boolean) as { id: string; event_id: string; name: string }[];

          teams.forEach((team) => {
            db.runSync(
              "INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)",
              [team.id, team.event_id, team.name]
            );
          });
        }
      }

      // Vérifier si des actions existent
      const existingActions = db.getFirstSync<{ count: number }>(
        "SELECT COUNT(*) as count FROM action"
      );

      if (!existingActions || existingActions.count === 0) {
        const teamIds = db.getAllSync<{ id: string }>(
          "SELECT id FROM team LIMIT 5"
        );
        const equipementIds = db.getAllSync<{ id: string }>(
          "SELECT id FROM equipement LIMIT 5"
        );

        if (teamIds.length > 0 && equipementIds.length > 0) {
          console.log("Insertion des actions...");
          const actions = [
            {
              id: generateUUID(),
              team_id: teamIds[0].id,
              equipement_id: equipementIds[0].id,
              type: "déploiement",
              scheduled_time: new Date().toISOString(),
              is_done: 0,
            },
            teamIds[1] && equipementIds[1]
              ? {
                  id: generateUUID(),
                  team_id: teamIds[1].id,
                  equipement_id: equipementIds[1].id,
                  type: "retrait",
                  scheduled_time: new Date(
                    Date.now() + 3600 * 1000
                  ).toISOString(),
                  is_done: 0,
                }
              : null,
            teamIds[2] && equipementIds[2]
              ? {
                  id: generateUUID(),
                  team_id: teamIds[2].id,
                  equipement_id: equipementIds[2].id,
                  type: "inspection",
                  scheduled_time: new Date(
                    Date.now() + 2 * 3600 * 1000
                  ).toISOString(),
                  is_done: 1,
                }
              : null,
          ].filter(Boolean) as {
            id: string;
            team_id: string;
            equipement_id: string;
            type: string;
            scheduled_time: string;
            is_done: number;
          }[];

          actions.forEach((action) => {
            db.runSync(
              "INSERT INTO action (id, team_id, equipement_id, type, scheduled_time, is_done) VALUES (?, ?, ?, ?, ?, ?)",
              [
                action.id,
                action.team_id,
                action.equipement_id,
                action.type,
                action.scheduled_time,
                action.is_done,
              ]
            );
          });
        }
      }

      console.log("Seeding partiel terminé.");
      return;
    }

    // 1. Seed events (avec UUIDs)
    console.log("Insertion des événements...");
    const events = [
      {
        id: generateUUID(),
        name: "Marché de Noël 2025",
        description: "Marché de Noël de Strasbourg",
        dateDebut: "2025-11-22",
        dateFin: "2025-12-30",
        statut: "actif",
      },
      {
        id: generateUUID(),
        name: "Festival d'été Illkirch 2025",
        description: "Festival d'été à Illkirch-Graffenstaden",
        dateDebut: "2025-07-01",
        dateFin: "2025-07-15",
        statut: "passé",
      },
      {
        id: generateUUID(),
        name: "Fête de la Musique 2026",
        description: "Grande fête de la musique à Strasbourg",
        dateDebut: "2026-06-21",
        dateFin: "2026-06-21",
        statut: "planifié",
      },
      {
        id: generateUUID(),
        name: "!Marathon de Strasbourg 2025",
        description: "Course à pied à travers la ville",
        dateDebut: "2025-10-15",
        dateFin: "2025-10-15",
        statut: "passé",
      },
      {
        id: generateUUID(),
        name: "!Carnaval de Printemps 2026",
        description: "Défilé et festivités printanières",
        dateDebut: "2026-03-20",
        dateFin: "2026-03-22",
        statut: "planifié",
      },
      {
        id: generateUUID(),
        name: "!Festival du Film 2026",
        description: "Projections en plein air et avant-premières",
        dateDebut: "2026-08-10",
        dateFin: "2026-08-20",
        statut: "planifié",
      },
    ];

    const eventIds: string[] = [];
    events.forEach((event) => {
      db.runSync(
        "INSERT INTO event (id, name, description, dateDebut, dateFin, statut) VALUES (?, ?, ?, ?, ?, ?)",
        [
          event.id,
          event.name,
          event.description,
          event.dateDebut,
          event.dateFin,
          event.statut,
        ]
      );
      eventIds.push(event.id);
    });

    // 2. Seed equipement_types (anciennement obstacle_types)
    console.log("Insertion des types d'équipements...");
    const equipementTypes = [
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
      {
        id: 14,
        name: "Véhicule",
        description: "Véhicule de blocage ou de sécurisation",
        width: 2,
        length: 5,
      },
    ];

    const typeIds: string[] = [];
    equipementTypes.forEach((type) => {
      const typeId = generateUUID();
      db.runSync("INSERT INTO type (id, name, description) VALUES (?, ?, ?)", [
        typeId,
        type.name,
        type.description,
      ]);
      typeIds.push(typeId);
    });

    // 3. Seed points avec event_id direct et UUIDs
    console.log("Insertion des points d'intérêt...");
    const pointsData = [
      // Strasbourg points pour Marché de Noël
      {
        x: 7.7521,
        y: 48.5734,
        event_id: eventIds[0],
        comment: "Stand central",
      },
      {
        x: 7.7475,
        y: 48.5708,
        event_id: eventIds[0],
        comment: "Zone cathédrale",
      },
      { x: 7.7601, y: 48.5745, event_id: eventIds[0], comment: "Place Kléber" },
      { x: 7.755, y: 48.58, event_id: eventIds[0], comment: "Petite France" },
      // Illkirch points pour Festival d'été
      {
        x: 7.7189,
        y: 48.5297,
        event_id: eventIds[1],
        comment: "Scène principale",
      },
      { x: 7.7245, y: 48.532, event_id: eventIds[1], comment: "Parc de l'Ill" },
      {
        x: 7.715,
        y: 48.528,
        event_id: eventIds[1],
        comment: "Zone food trucks",
      },
      {
        x: 7.721,
        y: 48.5305,
        event_id: eventIds[1],
        comment: "Accueil Mairie",
      },
      {
        x: 7.7175,
        y: 48.5265,
        event_id: eventIds[1],
        comment: "Parking stade",
      },
      // Fête de la Musique 2026 points
      { x: 7.75, y: 48.58, event_id: eventIds[2], comment: "Scène République" },
      { x: 7.755, y: 48.582, event_id: eventIds[2], comment: "Orangerie" },
      { x: 7.748, y: 48.579, event_id: eventIds[2], comment: "Gutenberg" },
    ];

    const pointIds: string[] = [];
    pointsData.forEach((point) => {
      const pointId = generateUUID();
      db.runSync(
        "INSERT INTO point (id, event_id, x, y, comment) VALUES (?, ?, ?, ?, ?)",
        [pointId, point.event_id, point.x, point.y, point.comment]
      );
      pointIds.push(pointId);
    });

    // 4. Seed parcours et zones pour les events (plus de table point_event ni geometry unique)
    console.log("Insertion des parcours et zones...");

    // Parcours pour Marché de Noël 2025
    db.runSync("INSERT INTO parcours (id, event_id, wkt) VALUES (?, ?, ?)", [
      generateUUID(),
      eventIds[0],
      "LINESTRING(7.7405 48.5795, 7.7445 48.5815, 7.7475 48.5830, 7.7510 48.5845, 7.7545 48.5855, 7.7580 48.5840, 7.7605 48.5820, 7.7590 48.5785, 7.7565 48.5760, 7.7530 48.5745, 7.7495 48.5735, 7.7460 48.5750, 7.7430 48.5770)",
    ]);

    // Zones pour Marché de Noël 2025
    const marcheZones = [
      "POLYGON((7.765 48.5775, 7.7641 48.5818, 7.7615 48.5855, 7.7576 48.5882, 7.7529 48.5895, 7.7479 48.5895, 7.7432 48.5882, 7.7393 48.5855, 7.7367 48.5818, 7.7358 48.5775, 7.7367 48.5732, 7.7393 48.5695, 7.7432 48.5668, 7.7479 48.5655, 7.7529 48.5655, 7.7576 48.5668, 7.7615 48.5695, 7.7641 48.5732, 7.765 48.5775))",
      "POLYGON((7.746 48.5805, 7.7505 48.5805, 7.7505 48.583, 7.746 48.583, 7.746 48.5805))",
      "POLYGON((7.7435 48.5835, 7.7485 48.5835, 7.7485 48.586, 7.7435 48.586, 7.7435 48.5835))",
      "POLYGON((7.7375 48.579, 7.7425 48.579, 7.74 48.582, 7.7375 48.579))",
    ];

    marcheZones.forEach((wkt) => {
      db.runSync("INSERT INTO zone (id, event_id, wkt) VALUES (?, ?, ?)", [
        generateUUID(),
        eventIds[0],
        wkt,
      ]);
    });

    // Zones et parcours pour Festival Illkirch
    db.runSync("INSERT INTO zone (id, event_id, wkt) VALUES (?, ?, ?)", [
      generateUUID(),
      eventIds[1],
      "POLYGON((7.715 48.528, 7.7245 48.532, 7.721 48.5305, 7.7175 48.5265, 7.715 48.528))",
    ]);

    // Zones pour Fête de la Musique
    db.runSync("INSERT INTO zone (id, event_id, wkt) VALUES (?, ?, ?)", [
      generateUUID(),
      eventIds[2],
      "POLYGON((7.748 48.579, 7.755 48.582, 7.75 48.58, 7.748 48.579))",
    ]);

    db.runSync("INSERT INTO parcours (id, event_id, wkt) VALUES (?, ?, ?)", [
      generateUUID(),
      eventIds[2],
      "LINESTRING(7.748 48.579, 7.75 48.58, 7.755 48.582)",
    ]);

    // 5. Seed equipements (quelques exemples)
    console.log("Insertion des équipements...");
    const equipements = [
      { event_id: eventIds[0], type_id: typeIds[0], quantity: 2 },
      { event_id: eventIds[0], type_id: typeIds[4], quantity: 1 },
      { event_id: eventIds[0], type_id: typeIds[2], quantity: 1 },
      { event_id: eventIds[1], type_id: typeIds[1], quantity: 3 },
      { event_id: eventIds[1], type_id: typeIds[5], quantity: 10 },
      { event_id: eventIds[1], type_id: typeIds[6], quantity: 8 },
    ];

    const equipementIds: string[] = [];
    equipements.forEach((equipement, index) => {
      const equipementId = generateUUID();
      db.runSync(
        "INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)",
        [
          equipementId,
          equipement.event_id,
          equipement.type_id,
          equipement.quantity,
          0,
        ]
      );
      // Ajouter une coordonnée pour chaque équipement
      const coordId = generateUUID();
      const pointIndex = index % pointIds.length;
      db.runSync(
        "INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)",
        [coordId, equipementId, 7.75 + index * 0.01, 48.57 + index * 0.01, 0]
      );
      equipementIds.push(equipementId);
    });

    // 6. Seed teams
    console.log("Insertion des équipes...");
    const teams = [
      { id: generateUUID(), event_id: eventIds[0], name: "Équipe Alpha" },
      { id: generateUUID(), event_id: eventIds[0], name: "Équipe Bravo" },
      { id: generateUUID(), event_id: eventIds[1], name: "Équipe Illkirch" },
    ];

    teams.forEach((team) => {
      db.runSync("INSERT INTO team (id, event_id, name) VALUES (?, ?, ?)", [
        team.id,
        team.event_id,
        team.name,
      ]);
    });

    // 7. Seed actions (liées à des équipes et des équipements)
    console.log("Insertion des actions...");
    const actions = [
      {
        id: generateUUID(),
        team_id: teams[0].id,
        equipement_id: equipementIds[0],
        type: "déploiement",
        scheduled_time: new Date().toISOString(),
        is_done: 0,
      },
      {
        id: generateUUID(),
        team_id: teams[1].id,
        equipement_id: equipementIds[2],
        type: "retrait",
        scheduled_time: new Date(Date.now() + 3600 * 1000).toISOString(),
        is_done: 0,
      },
      {
        id: generateUUID(),
        team_id: teams[2].id,
        equipement_id: equipementIds[4],
        type: "inspection",
        scheduled_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        is_done: 1,
      },
    ];

    actions.forEach((action) => {
      db.runSync(
        "INSERT INTO action (id, team_id, equipement_id, type, scheduled_time, is_done) VALUES (?, ?, ?, ?, ?, ?)",
        [
          action.id,
          action.team_id,
          action.equipement_id,
          action.type,
          action.scheduled_time,
          action.is_done,
        ]
      );
    });

    console.log("Seeding terminé avec succès !");
    console.log(`   - ${events.length} événements`);
    console.log(`   - ${equipementTypes.length} types d'équipements`);
    console.log(`   - ${pointsData.length} points d'intérêt`);
    console.log(`   - ${equipements.length} équipements`);
    console.log(`   - ${teams.length} équipes`);
    console.log(`   - ${actions.length} actions`);
  } catch (error) {
    console.error("Erreur lors du seeding:", error);
    throw error;
  }
}

// Fonction pour nettoyer toutes les données
export function clearDatabase(db: SQLiteDatabase): void {
  console.log("Suppression de toutes les données...");

  try {
    // Helper function to check if table exists
    const tableExists = (tableName: string): boolean => {
      const result = db.getFirstSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      return !!result;
    };

    // Delete in order of dependencies (foreign keys)
    // Handle both old and new schema
    if (tableExists("equipement")) {
      db.execSync("DELETE FROM equipement");
    }
    if (tableExists("obstacle")) {
      db.execSync("DELETE FROM obstacle");
    }

    if (tableExists("picture")) {
      db.execSync("DELETE FROM picture");
    }

    if (tableExists("comment")) {
      db.execSync("DELETE FROM comment");
    }

    if (tableExists("point_event")) {
      db.execSync("DELETE FROM point_event");
    }

    if (tableExists("point")) {
      db.execSync("DELETE FROM point");
    }

    if (tableExists("equipement_type")) {
      db.execSync("DELETE FROM equipement_type");
    }
    if (tableExists("type")) {
      db.execSync("DELETE FROM type");
    }
    if (tableExists("obstacle_type")) {
      db.execSync("DELETE FROM obstacle_type");
    }
    if (tableExists("equipement_coordinate")) {
      db.execSync("DELETE FROM equipement_coordinate");
    }

    // New schema: parcours and zone
    if (tableExists("parcours")) {
      db.execSync("DELETE FROM parcours");
    }
    if (tableExists("zone")) {
      db.execSync("DELETE FROM zone");
    }

    // Old schema: geometry
    if (tableExists("geometry")) {
      db.execSync("DELETE FROM geometry");
    }

    // Team system
    if (tableExists("member")) {
      db.execSync("DELETE FROM member");
    }
    if (tableExists("person")) {
      db.execSync("DELETE FROM person");
    }
    if (tableExists("team")) {
      db.execSync("DELETE FROM team");
    }

    if (tableExists("session")) {
      db.execSync("DELETE FROM session");
    }

    if (tableExists("event")) {
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
