// On importe les dépendances nécessaires
use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Sqlite, Transaction};
use sqlx::{Row, SqlitePool};
use std::fs;
use std::str::FromStr;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use tauri::State;

// Réexporter les types depuis le module types
pub use crate::types::*;

pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    // 1. Configuration des chemins
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to find app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("mydatabase.db");
    let db_path_str = db_path
        .to_str()
        .ok_or_else(|| "Failed to convert DB path to string.".to_string())?
        .to_string();

    let db_url = format!("sqlite:{}", db_path_str);

    // 2. Connexion
    let connect_options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Failed to parse DB URL: {}", e))?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .connect_with(connect_options)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // 3. Activation des Foreign Keys (Crucial pour le respect du diagramme)
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    println!("[DB] Création/Mise à jour des tables selon le schéma ERD...");

    // --- GESTION DES ACCÈS ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY,
            username TEXT,
            password_hash TEXT,
            role TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating user: {}", e))?;

    // --- CŒUR DE L'ÉVÉNEMENT ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS event (
            id CHAR(36) PRIMARY KEY,
            name TEXT,
            start_date DATETIME,
            end_date DATETIME
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating event: {}", e))?;

    // --- GÉOMÉTRIE ET ZONES ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS parcours (
            id CHAR(36) PRIMARY KEY,
            event_id CHAR(36) NOT NULL,
            name TEXT,
            color TEXT,
            start_time DATETIME,
            speed_low REAL,
            speed_high REAL,
            geometry_json TEXT,
            FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating parcours: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS zone (
            id CHAR(36) PRIMARY KEY,
            event_id CHAR(36) NOT NULL,
            name TEXT,
            color TEXT,
            geometry_json TEXT,
            FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating zone: {}", e))?;

    // --- POINTS SÉCURITÉ ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS point (
            id CHAR(36) PRIMARY KEY,
            event_id CHAR(36) NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            comment TEXT,
            type TEXT,
            status BOOLEAN,
            FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating point: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS picture (
            id INTEGER PRIMARY KEY,
            point_id CHAR(36) NOT NULL,
            image_data TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating picture: {}", e))?;

    // --- LOGISTIQUE & ÉQUIPEMENTS ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS type (
            id CHAR(36) PRIMARY KEY,
            name TEXT,
            description TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating type: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS equipement (
            id CHAR(36) PRIMARY KEY,
            event_id CHAR(36) NOT NULL,
            type_id CHAR(36) NOT NULL,
            quantity INTEGER,
            length_per_unit INTEGER,
            date_pose DATETIME,
            date_depose DATETIME,
            FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
            FOREIGN KEY (type_id) REFERENCES type (id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating equipement: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS equipement_coordinate (
            id CHAR(36) PRIMARY KEY,
            equipement_id CHAR(36) NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            order_index INTEGER,
            FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating equipement_coordinate: {}", e))?;

    // --- RESSOURCES HUMAINES ---
    // Note: Selon le schéma, Team est lié à Event (1 équipe = 1 événement)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS team (
            id INTEGER PRIMARY KEY,
            event_id CHAR(36) NOT NULL,
            name TEXT,
            FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating team: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS person (
            id INTEGER PRIMARY KEY,
            firstname TEXT,
            lastname TEXT,
            email TEXT,
            phone_number TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating person: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS member (
            id INTEGER PRIMARY KEY,
            team_id INTEGER NOT NULL,
            person_id INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
            FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE,
            UNIQUE(team_id, person_id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating member: {}", e))?;

    // --- PLANNING (ACTIONS) ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS action (
            id INTEGER PRIMARY KEY,
            team_id INTEGER NOT NULL,
            equipement_id CHAR(36) NOT NULL,
            type TEXT,
            scheduled_time DATETIME,
            is_done BOOLEAN,
            FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
            FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating action: {}", e))?;

    println!("[DB] Toutes les tables ont été synchronisées avec le diagramme ER.");

    Ok(pool)
}

#[tauri::command]
pub async fn fetch_pictures(
    pool: State<'_, SqlitePool>,
    point_id: String // 2. CORRECTION: String au lieu de &str
) -> Result<Vec<Picture>, String> {

    // Note:  que le nom de la colonne dans votre DB est bien 'image'
    // (dans votre script de création précédent, vous aviez mis 'image_data' ou 'image', soyez cohérent)
    let rows = sqlx::query("SELECT id, image, point_id FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool.inner()) // 3. CORRECTION: pool.inner() pour récupérer le SqlitePool
        .await
        .map_err(|e| e.to_string())?;

    let pictures = rows
        .into_iter()
        .map(|row| Picture {
            // Assurez-vous que les types ici (i64, String) correspondent à votre struct Picture
            id: row.get("id"),
            image: row.get("image"),
            point_id: row.get("point_id"),
        })
        .collect();

    Ok(pictures)
}

pub async fn fetch_equipement_coordinates(pool: &SqlitePool, equipement_id: &str) -> Result<Vec<EquipementCoordinate>, String> {
    sqlx::query_as::<_, EquipementCoordinate>(
        "SELECT x, y, order_index FROM equipement_coordinate WHERE equipement_id = ? ORDER BY order_index ASC"
    )
    .bind(equipement_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Erreur coordonnées: {}", e))
}

#[tauri::command]
pub async fn fetch_equipement_details(
    pool: State<'_, SqlitePool>, // Utilisation de State au lieu de AppHandle
    equipement_id: String,       // String au lieu de &str
) -> Result<Option<EquipementComplet>, String> {

    let query = r#"
        SELECT
            e.id,
            e.type_id,
            e.length,
            e.date_pose,
            e.hour_pose,
            e.date_depose,
            e.hour_depose,
            t.name AS type_name,
            t.description AS type_description
        FROM equipement e
        LEFT JOIN type t ON e.type_id = t.id
        WHERE e.id = ?
    "#;

    // On récupère une ligne optionnelle (fetch_optional)
    let row_opt = sqlx::query(query)
        .bind(&equipement_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    match row_opt {
        Some(row) => {
            // Si l'équipement existe, on récupère ses coordonnées
            // Note: On passe pool.inner() qui est &SqlitePool
            let coordinates = fetch_equipement_coordinates(pool.inner(), &equipement_id).await?;

            let equipement = EquipementComplet {
                id: row.get("id"),
                type_id: row.get("type_id"),
                type_name: row.get("type_name"),
                type_description: row.get("type_description"),
                length: row.get("length"),
                // Attention aux types de dates:
                // Si stocké en TEXT (ISO 8601), .get::<String, _> fonctionne.
                // Si vous utilisez chrono, utilisez .get::<NaiveDate, _>
                date_pose: row.get("date_pose"),
                hour_pose: row.get("hour_pose"),
                date_depose: row.get("date_depose"),
                hour_depose: row.get("hour_depose"),
                coordinates,
            };

            Ok(Some(equipement))
        }
        None => Ok(None), // L'ID n'existe pas
    }
}
async fn fetch_event_ids(app: AppHandle, point_id: &str) -> Result<Vec<i64>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT event_id FROM point_event WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let event_ids = rows.into_iter().map(|row| row.get("event_id")).collect();

    Ok(event_ids)
}

#[tauri::command]
pub async fn fetch_obstacle_types(app: AppHandle) -> Result<Vec<ObstacleType>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id, name, description, width, length FROM obstacle_type")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows
        .into_iter()
        .map(|row| ObstacleType {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            width: row.get("width"),
            length: row.get("length"),
        })
        .collect();

    Ok(obstacles)
}

#[tauri::command]
pub async fn insert_equipements(
    app: AppHandle,
    equipements: Vec<Equipement>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    for equipement in equipements {
        // Vérifier si l'équipement existe déjà
        let existing = sqlx::query("SELECT id FROM equipement WHERE id = ?")
            .bind(&equipement.id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("Failed to check existing equipement: {}", e))?;

        if existing.is_some() {
            // Mettre à jour l'équipement existant
            sqlx::query(
                "UPDATE equipement SET type_id = ?, length = ?, date_pose = ?, hour_pose = ?, date_depose = ?, hour_depose = ? WHERE id = ?",
            )
            .bind(&equipement.type_id)
            .bind(equipement.length)
            .bind(&equipement.date_pose)
            .bind(&equipement.hour_pose)
            .bind(&equipement.date_depose)
            .bind(&equipement.hour_depose)
            .bind(&equipement.id)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to update equipement: {}", e))?;
        } else {
            // Insérer un nouvel équipement
            sqlx::query(
                "INSERT INTO equipement (id, type_id, length, date_pose, hour_pose, date_depose, hour_depose) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&equipement.id)
            .bind(&equipement.type_id)
            .bind(equipement.length)
            .bind(&equipement.date_pose)
            .bind(&equipement.hour_pose)
            .bind(&equipement.date_depose)
            .bind(&equipement.hour_depose)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to insert equipement: {}", e))?;
        }
    }
    Ok(())
}

// Récupère tous les points avec leurs obstacles
#[allow(dead_code)]
pub async fn retrieve_data(app: &AppHandle) -> Result<Vec<Point>, String> {
    retrieve_data_by_event(app, None).await
}

// Récupère les points filtrés par event_id
pub async fn retrieve_data_by_event(
    app: &AppHandle,
    event_id: Option<i64>,
) -> Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;

    let base_rows = if let Some(eid) = event_id {
        println!("[DB] Récupération des points pour l'event_id: {}", eid);
        sqlx::query(
            r#"
            SELECT DISTINCT p.id, p.x, p.y, p.comment, p.type, p.status, pe.event_id
            FROM point p
            INNER JOIN point_event pe ON p.id = pe.point_id
            WHERE pe.event_id = ?
            ORDER BY p.id
        "#,
        )
        .bind(eid)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        println!("[DB]  Récupération de tous les points");
        sqlx::query(
            r#"
            SELECT p.id, p.x, p.y, p.comment, p.type, p.status, pe.event_id
            FROM point p
            LEFT JOIN point_event pe ON p.id = pe.point_id
            ORDER BY p.id
        "#,
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?
    };

    let mut points: Vec<Point> = Vec::new();

    for row in base_rows {
        let id: String = row.get("id");

        points.push(Point {
            id,
            x: row.get("x"),
            y: row.get("y"),
            comment: row.get("comment"),
            r#type: row.get("type"),
            status: row.get("status"),
            event_id: row.get("event_id"),
        });
    }

    println!("[DB]  {} point(s) récupéré(s)", points.len());
    Ok(points)
}

#[tauri::command]
pub async fn insert_point_details(
    app: &AppHandle,
    details: Vec<PointDetail>,
) -> Result<Vec<String>, String> {
    let pool = get_db_pool(app).await?;
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Erreur au démarrage de la transaction : {}", e))?;

    // ÉTAPE 1: Insérer tous les points d'abord
    // We need to keep track of assigned IDs when frontend sends id=="" or "0" for new points
    let mut assigned_ids: Vec<String> = Vec::with_capacity(details.len());
    for detail in &details {
        let point_id = if detail.point.id.is_empty() || detail.point.id == "0" {
            // Générer un nouvel UUID pour ce point
            Uuid::new_v4().to_string()
        } else {
            // Utiliser l'ID fourni
            detail.point.id.clone()
        };

        // Insérer le point
        sqlx::query(
            r#"INSERT OR REPLACE INTO point (id, x, y, comment, type, status) VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&point_id)
        .bind(detail.point.x)
        .bind(detail.point.y)
        .bind(&detail.point.comment)
        .bind(&detail.point.r#type)
        .bind(&detail.point.status)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Erreur INSERT/REPLACE point ID {} : {}", point_id, e))?;

        assigned_ids.push(point_id);
    }
    // ÉTAPE 2: Insérer les données liées (commentaires)
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id: &String = &assigned_ids[idx];
        for comment in &detail.comment {
            let comment_id = if comment.id.is_empty() || comment.id == "0" {
                Uuid::new_v4().to_string()
            } else {
                comment.id.clone()
            };
            let point_id_to_use = if comment.point_id.is_empty() || comment.point_id == "0" {
                assigned_point_id.clone()
            } else {
                comment.point_id.clone()
            };
            sqlx::query(r#"INSERT OR REPLACE INTO comment (id, point_id, value) VALUES (?, ?, ?)"#)
                .bind(&comment_id)
                .bind(&point_id_to_use)
                .bind(&comment.value)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE comment ID {} : {}", comment.id, e))?;
        }
    }
    // images
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id: &String = &assigned_ids[idx];
        for picture in &detail.picture {
            let picture_id = if picture.id.is_empty() || picture.id == "0" {
                Uuid::new_v4().to_string()
            } else {
                picture.id.clone()
            };
            let point_id_to_use = if picture.point_id.is_empty() || picture.point_id == "0" {
                assigned_point_id.clone()
            } else {
                picture.point_id.clone()
            };
            sqlx::query(r#"INSERT OR REPLACE INTO picture (id, point_id, image) VALUES (?, ?, ?)"#)
                .bind(&picture_id)
                .bind(&point_id_to_use)
                .bind(&picture.image)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE picture ID {} : {}", picture_id, e))?;
        }
    }
    // obstacles and types
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id: &String = &assigned_ids[idx];
        for obstacle in &detail.obstacle {
            let obstacle_id = if obstacle.id.is_empty() || obstacle.id == "0" {
                Uuid::new_v4().to_string()
            } else {
                obstacle.id.clone()
            };
            let point_id_to_use = if obstacle.point_id.is_empty() || obstacle.point_id == "0" {
                assigned_point_id.clone()
            } else {
                obstacle.point_id.clone()
            };

            if obstacle.name.is_some()
                || obstacle.description.is_some()
                || obstacle.width.is_some()
                || obstacle.length.is_some()
            {
                sqlx::query(
                    r#"INSERT OR IGNORE INTO obstacle_type (id, name, description, width, length)
                       VALUES (?, ?, ?, ?, ?)"#,
                )
                .bind(obstacle.type_id)
                .bind(obstacle.name.as_ref().unwrap_or(&"Unknown".to_string()))
                .bind(obstacle.description.as_ref().unwrap_or(&"".to_string()))
                .bind(obstacle.width.unwrap_or(0.0))
                .bind(obstacle.length.unwrap_or(0.0))
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    format!(
                        "Erreur INSERT obstacle_type ID {} : {}",
                        obstacle.type_id, e
                    )
                })?;
            }
            sqlx::query(r#"INSERT OR REPLACE INTO obstacle (id, point_id, type_id, number) VALUES (?, ?, ?, ?)"#)
                .bind(&obstacle_id)
                .bind(&point_id_to_use)
                .bind(obstacle.type_id)
                .bind(obstacle.number)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT/REPLACE obstacle ID {} (point_id: {}, type_id: {}) : {}",
                    obstacle.id, point_id_to_use, obstacle.type_id, e))?;
        }
    }

    // Commit
    tx.commit()
        .await
        .map_err(|e| format!("Erreur à la validation (commit) de la transaction : {}", e))?;

    // transaction committed

    Ok(assigned_ids)
}

#[tauri::command]
pub async fn insert_point(
    app: tauri::AppHandle,
    details: Vec<PointDetail>,
    event_id: Option<i64>,
) -> Result<Vec<String>, String> {
    println!(
        "[DB] 📍 insert_point appelé avec {} point(s), event_id: {:?}",
        details.len(),
        event_id
    );
    for (i, d) in details.iter().enumerate() {
        println!(
            "[DB]   Point {}: id={}, x={}, y={}",
            i, d.point.id, d.point.x, d.point.y
        );
        println!(
            "[DB]   - {} commentaire(s), {} photo(s), {} obstacle(s)",
            d.comment.len(),
            d.picture.len(),
            d.obstacle.len()
        );
    }
    let result = insert_point_details(&app, details).await;
    match &result {
        Ok(ids) => {
            println!("[DB] ✅ Point(s) inséré(s) avec succès, IDs: {:?}", ids);
            // Lier les points à l'événement si event_id est fourni
            if let Some(eid) = event_id {
                let pool = get_db_pool(&app).await?;
                for point_id in ids {
                    println!(
                        "[DB] 🔗 Liaison automatique point {} → event {}",
                        point_id, eid
                    );
                    sqlx::query(
                        "INSERT OR IGNORE INTO point_event (point_id, event_id) VALUES (?, ?)",
                    )
                    .bind(point_id)
                    .bind(eid)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Failed to link point to event: {}", e))?;
                }
                println!(
                    "[DB] ✅ {} point(s) lié(s) à l'événement {}",
                    ids.len(),
                    eid
                );
            }
        }
        Err(e) => println!("[DB]  Erreur insertion: {}", e),
    }
    result
}

#[tauri::command]
pub async fn update_point_dates(
    app: AppHandle,
    point_id: String,
    pose: Option<String>,
    depose: Option<String>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE point SET pose = ?, depose = ? WHERE id = ?")
        .bind(&pose)
        .bind(&depose)
        .bind(&point_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update point dates: {}", e))?;

    println!(
        "[DB] ✅ Dates du point {} mises à jour: pose={:?}, depose={:?}",
        point_id, pose, depose
    );
    Ok(())
}

#[tauri::command]
pub async fn delete_point(app: AppHandle, point_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Start a transaction and remove dependent rows first to keep DB consistent
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    sqlx::query("DELETE FROM comment WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete comments: {}", e))?;

    sqlx::query("DELETE FROM picture WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete pictures: {}", e))?;

    sqlx::query("DELETE FROM obstacle WHERE point_id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete obstacles: {}", e))?;

    sqlx::query("DELETE FROM point WHERE id = ?")
        .bind(&point_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to delete point: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    println!("✅ Successfully deleted point {}", point_id);
    Ok(())
}

#[tauri::command]
pub async fn fetch_team_members(app: AppHandle, team_id: i64) -> Result<Vec<Member>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT m.id, m.team_id, m.person_id
        FROM member m
        WHERE m.team_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(team_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let members = rows
        .into_iter()
        .map(|row| Member {
            id: row.get("id"),
            team_id: row.get("team_id"),
            person_id: row.get("person_id"),
        })
        .collect();

    Ok(members)
}

#[tauri::command]
pub async fn fetch_team_events(app: AppHandle, team_id: i64) -> Result<Vec<Event>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT e.id, e.name, e.start_date, e.end_date
        FROM event e
        INNER JOIN team_event te ON e.id = te.event_id
        WHERE te.team_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(team_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let events = rows
        .into_iter()
        .map(|row| Event {
            id: row.get("id"),
            name: row.get("name"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            zone: row.get("zone"),
            parcours: row.get("parcours"),
        })
        .collect();

    Ok(events)
}

#[tauri::command]
pub async fn fetch_teams(app: AppHandle) -> Result<Vec<Team>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT
            t.id,
            t.name,
            COUNT(DISTINCT m.person_id) as number,
            GROUP_CONCAT(DISTINCT te.event_id) as event_ids_str
        FROM team t
        LEFT JOIN member m ON t.id = m.team_id
        LEFT JOIN team_event te ON t.id = te.team_id
        GROUP BY t.id, t.name
    "#;

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let teams = rows
        .into_iter()
        .map(|row| {
            let event_ids_str: Option<String> = row.get("event_ids_str");
            let event_ids: Vec<i64> = match event_ids_str {
                Some(s) => s
                    .split(',')
                    .filter_map(|id| id.parse::<i64>().ok())
                    .collect(),
                None => Vec::new(),
            };

            Team {
                id: row.get("id"),
                name: row.get("name"),
                event_ids,
            }
        })
        .collect();

    Ok(teams)
}

#[tauri::command]
pub async fn create_team(app: AppHandle, name: String) -> Result<Team, String> {
    let pool = get_db_pool(&app).await?;

    let result = sqlx::query("INSERT INTO team (name) VALUES (?)")
        .bind(&name)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let new_id = result.last_insert_rowid();

    Ok(Team {
        id: new_id,
        name: Some(name),
        event_ids: Vec::new(),
    })
}

#[tauri::command]
pub async fn delete_team(app: AppHandle, team_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM team WHERE id = ?")
        .bind(team_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_team(app: AppHandle, id: i64, name: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE team SET name = ? WHERE id = ?")
        .bind(name)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn add_team_event(app: AppHandle, team_id: i64, event_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    sqlx::query("INSERT OR IGNORE INTO team_event (team_id, event_id) VALUES (?, ?)")
        .bind(team_id)
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_team_event(app: AppHandle, team_id: i64, event_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    sqlx::query("DELETE FROM team_event WHERE team_id = ? AND event_id = ?")
        .bind(team_id)
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn fetch_people(app: AppHandle) -> Result<Vec<Person>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id, firstname, lastname, address, email, phone_number FROM person ORDER BY lastname, firstname")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let people = rows
        .into_iter()
        .map(|row| Person {
            id: row.get("id"),
            firstname: row.get("firstname"),
            lastname: row.get("lastname"),
            address: row.get("address"),
            email: row.get("email"),
            phone_number: row.get("phone_number"),
        })
        .collect();

    Ok(people)
}

#[tauri::command]
pub async fn create_person(
    app: AppHandle,
    firstname: String,
    lastname: String,
    email: String,
    address: String,
    phone_number: String,
) -> Result<Person, String> {
    let pool = get_db_pool(&app).await?;

    let result = sqlx::query(
        "INSERT INTO person (firstname, lastname, email, address, phone_number) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&firstname)
    .bind(&lastname)
    .bind(&email)
    .bind(&address)
    .bind(&phone_number)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let new_id = result.last_insert_rowid();

    Ok(Person {
        id: new_id,
        firstname: Some(firstname),
        lastname: Some(lastname),
        email: Some(email),
        address: Some(address),
        phone_number: Some(phone_number),
    })
}

#[tauri::command]
pub async fn delete_person(app: AppHandle, person_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Grâce au ON DELETE CASCADE dans 'member', ça supprimera aussi le lien avec l'équipe
    sqlx::query("DELETE FROM person WHERE id = ?")
        .bind(person_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_person(
    app: AppHandle,
    id: i64,
    firstname: String,
    lastname: String,
    email: String,
    address: String,
    phone_number: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query(
        "UPDATE person SET firstname=?, lastname=?, email=?, address=?, phone_number=? WHERE id=?",
    )
    .bind(firstname)
    .bind(lastname)
    .bind(email)
    .bind(address)
    .bind(phone_number)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn add_member(app: AppHandle, team_id: i64, person_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    sqlx::query("INSERT OR IGNORE INTO member (team_id, person_id) VALUES (?, ?)")
        .bind(team_id)
        .bind(person_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_member(app: AppHandle, team_id: i64, person_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    sqlx::query("DELETE FROM member WHERE team_id = ? AND person_id = ?")
        .bind(team_id)
        .bind(person_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn fetch_person_teams(app: AppHandle, person_id: i64) -> Result<Vec<Team>, String> {
    let pool = get_db_pool(&app).await?;
    let query = r#"
        SELECT t.id, t.name,
               (SELECT COUNT(*) FROM member m2 WHERE m2.team_id = t.id) as number
        FROM team t
        INNER JOIN member m ON t.id = m.team_id
        WHERE m.person_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(person_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let teams = rows
        .into_iter()
        .map(|row| Team {
            id: row.get("id"),
            name: row.get("name"),
            event_ids: Vec::new(),
        })
        .collect();

    Ok(teams)
}

#[tauri::command]
pub async fn fetch_events(app: AppHandle) -> Result<Vec<Event>, String> {
    println!("[DB] 🚀 Début de la récupération des événements depuis la base de données.");
    let pool = get_db_pool(&app).await?;

    // Vérifier si la table existe
    let table_check =
        sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='event';")
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("Erreur lors de la vérification de table: {}", e))?;

    if table_check.is_none() {
        return Err("La table 'event' n'existe pas. Veuillez redémarrer l'application pour exécuter les migrations.".to_string());
    }

    println!("[DB] ✅ Table 'event' existe.");

    let query = r#"
        SELECT
            id,
            name,
            start_date,
            end_date
        FROM event
    "#;

    let rows = sqlx::query(query).fetch_all(&pool).await.map_err(|e| {
        println!("[DB] ❌ Erreur lors de la requête SQL: {}", e);
        e.to_string()
    })?;

    println!(
        "[DB] 📊 Récupéré {} événements de la base de données.",
        rows.len()
    );

    let mut events: Vec<Event> = Vec::new();

    for row in rows {
        let event_id: String = row.get("id");
        println!("[DB]   → Traitement de l'événement ID: {}", event_id);

        // Récupérer les géométries pour cet événement

        events.push(Event {
            id: event_id,
            name: row.get("name"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            zone: row.get("zone"),
            parcours: row.get("parcours"),
        });
    }

    println!(
        "[DB] ✅ Récupération terminée avec succès. {} événements traités.",
        events.len()
    );
    Ok(events)
}

#[tauri::command]
pub async fn insert_event(event: Event, app: AppHandle) -> Result<(), String> {
    println!("Insertion d'un événement: {:?}", event);

    let pool = get_db_pool(&app).await?;

    // Générer un UUID pour l'id de l'événement
    let event_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO event (id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&event_id)
    .bind(&event.name)
    .bind(&event.start_date)
    .bind(&event.end_date)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to insert event: {}", e))?;

    println!(
        "[DB] ✅ Événement '{:?}' créé avec succès (id: {})!",
        event.name, event_id
    );

    Ok(())
}

#[tauri::command]
pub async fn link_point_to_event(
    app: AppHandle,
    point_id: String,
    event_id: i64,
) -> Result<(), String> {
    println!("[DB] 🔗 Liaison point {} → event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("INSERT OR IGNORE INTO point_event (point_id, event_id) VALUES (?, ?)")
        .bind(&point_id)
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to link point to event: {}", e))?;

    println!("[DB] ✅ Point {} lié à l'événement {}", point_id, event_id);
    Ok(())
}

#[tauri::command]
pub async fn unlink_point_from_event(
    app: AppHandle,
    point_id: String,
    event_id: i64,
) -> Result<(), String> {
    println!("[DB]  Déliaison point {} ← event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM point_event WHERE point_id = ? AND event_id = ?")
        .bind(&point_id)
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to unlink point from event: {}", e))?;

    println!(
        "[DB] ✅ Point {} délié de l'événement {}",
        point_id, event_id
    );
    Ok(())
}

#[tauri::command]
pub async fn get_points_for_event(app: AppHandle, event_id: i64) -> Result<Vec<i64>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT point_id FROM point_event WHERE event_id = ?")
        .bind(event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let point_ids: Vec<i64> = rows.into_iter().map(|row| row.get("point_id")).collect();
    Ok(point_ids)
}

#[tauri::command]
pub async fn fetch_geometries_for_event(
    app: AppHandle,
    event_id: i64,
) -> Result<Vec<Geometry>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id, event_id, geom FROM geometry WHERE event_id = ?")
        .bind(event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let geometries: Vec<Geometry> = rows
        .into_iter()
        .map(|row| Geometry {
            id: row.get("id"),
            event_id: row.get("event_id"),
            geom: row.get("geom"),
        })
        .collect();

    println!(
        "[DB] 📐 {} géométrie(s) récupérée(s) pour l'événement {}",
        geometries.len(),
        event_id
    );
    Ok(geometries)
}

#[tauri::command]
pub async fn create_geometry(
    app: AppHandle,
    event_id: i64,
    geom: String,
) -> Result<Geometry, String> {
    let pool = get_db_pool(&app).await?;

    let result = sqlx::query("INSERT INTO geometry (event_id, geom) VALUES (?, ?)")
        .bind(event_id)
        .bind(&geom)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let id = result.last_insert_rowid();
    println!(
        "[DB]  Géométrie créée avec id={} pour l'événement {}",
        id, event_id
    );

    Ok(Geometry { id, event_id, geom })
}

#[tauri::command]
pub async fn delete_geometry(app: AppHandle, geometry_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM geometry WHERE id = ?")
        .bind(geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] 🗑️ Géométrie {} supprimée", geometry_id);
    Ok(())
}

#[tauri::command]
pub async fn update_geometry(
    app: AppHandle,
    geometry_id: i64,
    geom: String,
) -> Result<Geometry, String> {
    let pool = get_db_pool(&app).await?;

    // Récupérer l'event_id avant la mise à jour
    let row = sqlx::query("SELECT event_id FROM geometry WHERE id = ?")
        .bind(geometry_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Géométrie non trouvée: {}", e))?;

    let event_id: i64 = row.get("event_id");

    sqlx::query("UPDATE geometry SET geom = ? WHERE id = ?")
        .bind(&geom)
        .bind(geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] Géométrie {} mise à jour", geometry_id);

    Ok(Geometry {
        id: geometry_id,
        event_id,
        geom,
    })
}

#[tauri::command]
pub async fn delete_event(app: AppHandle, event_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Les liaisons point_event seront supprimées automatiquement grâce à ON DELETE CASCADE
    sqlx::query("DELETE FROM event WHERE id = ?")
        .bind(&event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB]  Événement {} supprimé", event_id);
    Ok(())
}

pub async fn is_first_launch(pool: &SqlitePool) -> sqlx::Result<bool> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user")
        .fetch_one(pool)
        .await?;
    Ok(count == 0)
}

pub async fn create_initial_admin(
    pool: &SqlitePool,
    username: &str,
    password: &str,
) -> sqlx::Result<()> {
    let password_hash = hash(password, DEFAULT_COST).expect("Erreur hash mot de passe");

    sqlx::query(
        "
        INSERT INTO user (username, password_hash, role)
        VALUES (?, ?, ?)
    ",
    )
    .bind(username)
    .bind(password_hash)
    .bind("admin")
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_user_by_username(pool: &SqlitePool, username: &str) -> sqlx::Result<Option<User>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM user WHERE username = ?")
        .bind(username)
        .fetch_optional(pool)
        .await?;

    Ok(user)
}

// --- Tauri command wrappers for frontend ---
#[tauri::command]
pub async fn is_first_launch_cmd(app: AppHandle) -> Result<bool, String> {
    let pool = get_db_pool(&app).await?;
    is_first_launch(&pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_initial_admin_cmd(
    app: AppHandle,
    username: String,
    password: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;
    create_initial_admin(&pool, &username, &password)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_credentials_cmd(
    app: AppHandle,
    username: String,
    password: String,
) -> Result<bool, String> {
    let pool = get_db_pool(&app).await?;
    match get_user_by_username(&pool, &username)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(user) => match &user.password_hash {
            Some(hash) => Ok(verify(&password, hash).unwrap_or(false)),
            None => Ok(false),
        },
        None => Ok(false),
    }
}
