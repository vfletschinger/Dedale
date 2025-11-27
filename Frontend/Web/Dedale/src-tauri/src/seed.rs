use crate::db::ObstacleType;
use sqlx::SqlitePool;
// Assuming this function is accessible (defined in db.rs or similar)
// pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> { ... }

// --- Helper Structs for Seeding Data ---
struct PointSeed {
    x: f64,
    y: f64,
}
struct CommentSeed {
    point_idx: usize,
    value: &'static str,
}
struct PictureSeed {
    point_idx: usize,
    image: &'static str,
}
struct ObstacleSeed {
    point_idx: usize,
    type_idx: usize,
    number: i32,
    description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PersonSeed {
    pub id: i64,
    pub firstname: String,
    pub lastname: String,
}

#[derive(Debug, Clone)]
pub struct TeamSeed {
    pub id: i64,
    pub name: String,
    pub number: i32,
}

#[derive(Debug, Clone)]
pub struct MemberSeed {
    pub team_id: i64,
    pub person_id: i64,
}

/// Seeds the database with sample data if it's currently empty.
#[tauri::command]
pub async fn seed_database(pool: &SqlitePool) -> Result<(), String> {
    println!("🌱 Début du seeding...");

    let query = r#"
        SELECT
        count(*)
        FROM point
    "#;

    let (existing_points,): (i64,) = sqlx::query_as(query)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    if existing_points > 0 {
        println!("⚠️ Des données existent déjà, seeding annulé.");
        return Ok(());
    }

    // --- Data Definitions ---
    let obstacle_types = [
        ObstacleType { id: 1, name: "Glissière 2m".to_string(), description: "Glissière béton armé (GBA) 2m".to_string(), width: 0.6, length: 2.0 },
        ObstacleType { id: 2, name: "Glissière 1m".to_string(), description: "Glissière béton armé (GBA) 1m".to_string(), width: 0.6, length: 1.0 },
        ObstacleType { id: 3, name: "Bloc 2.5m".to_string(), description: "Bloc de béton 2.5m".to_string(), width: 0.6, length: 2.5 },
        ObstacleType { id: 4, name: "Bloc 1m".to_string(), description: "Bloc de béton 1m".to_string(), width: 0.6, length: 1.0 },
        ObstacleType { id: 5, name: "Barrière Vauban".to_string(), description: "Barrière de 2 mètres".to_string(), width: 0.4, length: 2.0 },
        ObstacleType { id: 6, name: "Barrière Héras".to_string(), description: "Barrière Héras (délimitation de surface d’accueil de personnes)".to_string(), width: 0.1, length: 3.5 },
        ObstacleType { id: 7, name: "Barrière Héras avec voile d’occultation".to_string(), description: "Barrière Héras avec voile d’occultation (délimitation de surface d’accueil de personnes)".to_string(), width: 0.1, length: 3.5 },
        ObstacleType { id: 8, name: "Obstacle".to_string(), description: "Obstacle pour voitures".to_string(), width: 0.95, length: 1.05 },
        ObstacleType { id: 9, name: "Engins de blocage 8m".to_string(), description: "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.".to_string(), width: 2.0, length: 8.0 },
        ObstacleType { id: 10, name: "Engins de blocage 9.35m".to_string(), description: "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.".to_string(), width: 2.0, length: 9.35 },
        ObstacleType { id: 11, name: "Engins de blocage 9.5m".to_string(), description: "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.".to_string(), width: 2.0, length: 9.5 },
        ObstacleType { id: 12, name: "Engins de blocage 11m".to_string(), description: "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.".to_string(), width: 2.0, length: 11.0 },
        ObstacleType { id: 13, name: "Engins de blocage 16m".to_string(), description: "Engins routiers et matériels, ensembles mobiles pour permettre le passage des secours, utilisés pour bloquer les rues.".to_string(), width: 2.0, length: 16.0 },
    ];
    let points = [
        PointSeed {
            y: 48.5734,
            x: 7.7521,
        },
        PointSeed {
            y: 48.5850,
            x: 7.7350,
        },
        PointSeed {
            y: 48.5920,
            x: 7.7580,
        },
        PointSeed {
            y: 48.5680,
            x: 7.7420,
        },
        PointSeed {
            y: 48.5790,
            x: 7.7650,
        },
    ];
    let comments_data = [
        CommentSeed {
            point_idx: 0,
            value: "Zone très fréquentée, attention aux piétons",
        },
        CommentSeed {
            point_idx: 0,
            value: "Passage étroit, ralentir",
        },
        CommentSeed {
            point_idx: 1,
            value: "Belle vue sur la cathédrale",
        },
        CommentSeed {
            point_idx: 2,
            value: "Travaux en cours, détour possible",
        },
        CommentSeed {
            point_idx: 3,
            value: "Point de repos avec bancs",
        },
        CommentSeed {
            point_idx: 4,
            value: "Attention au verglas en hiver",
        },
    ];
    let pictures_data = [
        PictureSeed { point_idx: 0, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 0, image: "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR4nGP8z4APMOGVHbHSAEEsAROxCnMTAAAAAElFTkSuQmCC" },
        PictureSeed { point_idx: 1, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 2, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
        PictureSeed { point_idx: 4, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NkYGD4DwABBAEAgr5ZhgAAAABJRU5ErkJggg==" },
    ];
    let obstacles_data = [
        ObstacleSeed {
            point_idx: 0,
            type_idx: 0,
            number: 2,
            description: Some("Deux grands arbres".to_string()),
        }, // Point 1: 2 Arbre
        ObstacleSeed {
            point_idx: 0,
            type_idx: 4,
            number: 1,
            description: Some("Une poubelle métallique".to_string()),
        }, // Point 1: 1 Poubelle
        ObstacleSeed {
            point_idx: 1,
            type_idx: 2,
            number: 1,
            description: Some("Une barrière en bois".to_string()),
        }, // Point 2: 1 Barrière
        ObstacleSeed {
            point_idx: 2,
            type_idx: 1,
            number: 3,
            description: Some("Trois rochers de taille moyenne".to_string()),
        }, // Point 3: 3 Rocher
        ObstacleSeed {
            point_idx: 3,
            type_idx: 3,
            number: 2,
            description: Some("Deux panneaux de signalisation".to_string()),
        }, // Point 4: 2 Panneau
        ObstacleSeed {
            point_idx: 4,
            type_idx: 0,
            number: 5,
            description: Some("Cinq petits arbres".to_string()),
        }, // Point 5: 5 Arbre
    ];

    let persons = vec![
        PersonSeed {
            id: 1,
            firstname: "Jean".to_string(),
            lastname: "Dupont".to_string(),
        },
        PersonSeed {
            id: 2,
            firstname: "Marie".to_string(),
            lastname: "Martin".to_string(),
        },
        PersonSeed {
            id: 3,
            firstname: "Pierre".to_string(),
            lastname: "Bernard".to_string(),
        },
        PersonSeed {
            id: 4,
            firstname: "Sophie".to_string(),
            lastname: "Lefevre".to_string(),
        },
        PersonSeed {
            id: 5,
            firstname: "Luc".to_string(),
            lastname: "Moreau".to_string(),
        },
        PersonSeed {
            id: 6,
            firstname: "Anne".to_string(),
            lastname: "Laurent".to_string(),
        },
    ];

    let teams = vec![
        TeamSeed {
            id: 1,
            name: "Équipe Alpha".to_string(),
            number: 1,
        },
        TeamSeed {
            id: 2,
            name: "Équipe Beta".to_string(),
            number: 2,
        },
        TeamSeed {
            id: 3,
            name: "Équipe Gamma".to_string(),
            number: 3,
        },
    ];

    let members = vec![
        MemberSeed {
            team_id: 1,
            person_id: 1,
        },
        MemberSeed {
            team_id: 1,
            person_id: 2,
        },
        MemberSeed {
            team_id: 1,
            person_id: 3,
        },
        MemberSeed {
            team_id: 2,
            person_id: 4,
        },
        MemberSeed {
            team_id: 2,
            person_id: 5,
        },
        MemberSeed {
            team_id: 3,
            person_id: 6,
        },
    ];

    let mut point_ids: Vec<i64> = Vec::new();
    let mut type_ids: Vec<i64> = Vec::new();

    // 2. Seed obstacle_type
    println!("📦 Insertion des types d'obstacles...");
    for t in obstacle_types.iter() {
        let result = sqlx::query(
            "INSERT INTO obstacle_type (name, description, width, length) VALUES (?, ?, ?, ?)",
        )
        .bind(t.name.clone())
        .bind(t.description.clone())
        .bind(t.width)
        .bind(t.length)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle type: {}", e))?;
        type_ids.push(result.last_insert_rowid());
    }

    // 3. Seed point
    println!("📍 Insertion des points d'intérêt...");
    for p in points.iter() {
        let result = sqlx::query("INSERT INTO point (x, y) VALUES (?, ?)")
            .bind(p.x)
            .bind(p.y)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to insert point: {}", e))?;
        point_ids.push(result.last_insert_rowid());
    }

    // 4. Seed comment
    println!("💬 Insertion des commentaires...");
    for c in comments_data.iter() {
        let point_id = *point_ids
            .get(c.point_idx)
            .ok_or("Invalid point index for comment")?;
        sqlx::query("INSERT INTO comment (point_id, value) VALUES (?, ?)")
            .bind(point_id)
            .bind(c.value)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to insert comment: {}", e))?;
    }

    // 5. Seed picture
    println!("📸 Insertion des photos...");
    for i in pictures_data.iter() {
        let point_id = *point_ids
            .get(i.point_idx)
            .ok_or("Invalid point index for picture")?;
        sqlx::query("INSERT INTO picture (point_id, image) VALUES (?, ?)")
            .bind(point_id)
            .bind(i.image)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to insert picture: {}", e))?;
    }

    // 6. Seed obstacle
    println!("🚧 Insertion des obstacles...");
    for o in obstacles_data.iter() {
        let point_id = *point_ids
            .get(o.point_idx)
            .ok_or("Invalid point index for obstacle (point)")?;
        let type_id = *type_ids
            .get(o.type_idx)
            .ok_or("Invalid type index for obstacle (type)")?;

        // Note: The column is assumed to be 'number' based on previous context.
        sqlx::query(
            "INSERT INTO obstacle (point_id, type_id, number, description) VALUES (?, ?, ?, ?)",
        )
        .bind(point_id)
        .bind(type_id)
        .bind(o.number)
        .bind(o.description.clone())
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to insert obstacle: {}", e))?;
    }

    println!("👥 Insertion des personnes...");
    for person in &persons {
        sqlx::query(
            r#"INSERT INTO person (id, firstname, lastname) 
               VALUES (?, ?, ?)"#,
        )
        .bind(person.id)
        .bind(&person.firstname)
        .bind(&person.lastname)
        .execute(pool)
        .await
        .map_err(|e| {
            format!(
                "Erreur lors de l'insertion de la personne {} : {}",
                person.id, e
            )
        })?;
    }

    // Insérer les équipes
    println!("👨‍💼 Insertion des équipes...");
    for team in &teams {
        sqlx::query(
            r#"INSERT INTO team (id, name, number) 
               VALUES (?, ?, ?)"#,
        )
        .bind(team.id)
        .bind(&team.name)
        .bind(team.number)
        .execute(pool)
        .await
        .map_err(|e| format!("Erreur lors de l'insertion de l'équipe {} : {}", team.id, e))?;
    }

    // Insérer les membres (relations team-person)
    println!("🔗 Insertion des membres (relations team-person)...");
    for member in &members {
        sqlx::query(
            r#"INSERT INTO member (team_id, person_id) 
               VALUES (?, ?)"#,
        )
        .bind(member.team_id)
        .bind(member.person_id)
        .execute(pool)
        .await
        .map_err(|e| {
            format!(
                "Erreur lors de l'insertion du membre team_id={}, person_id={} : {}",
                member.team_id, member.person_id, e
            )
        })?;
    }

    println!("✅ Seeding terminé avec succès !");
    println!("   - {} types d'obstacles", obstacle_types.len());
    println!("   - {} points d'intérêt", points.len());
    println!("   - {} commentaires", comments_data.len());
    println!("   - {} photos", pictures_data.len());
    println!("   - {} obstacles", obstacles_data.len());
    println!("   - {} personnes", persons.len());
    println!("   - {} equipes", teams.len());
    println!("   - {} membres", members.len());

    Ok(())
}
