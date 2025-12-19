// On importe les dépendances nécessaires
#![allow(dead_code)]

use bcrypt::{hash, verify, DEFAULT_COST};
use rand::Rng;
use serde::Deserialize;
use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Sqlite;
use sqlx::Transaction;
use sqlx::{Row, SqlitePool};
use std::fs;
use std::str::FromStr;
use tauri::{AppHandle, Manager};

/// Génère un UUID v4
pub fn generate_uuid() -> String {
    let mut rng = rand::rng();
    let bytes: [u8; 16] = rng.random();
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-4{:01x}{:02x}-{:01x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6] & 0x0f, bytes[7],
        (bytes[8] & 0x3f) | 0x80 >> 4, bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

/// Valide le format d'un UUID
pub fn is_valid_uuid(uuid: &str) -> bool {
    let parts: Vec<&str> = uuid.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let expected_lengths = [8, 4, 4, 4, 12];
    for (part, expected_len) in parts.iter().zip(expected_lengths.iter()) {
        if part.len() != *expected_len {
            return false;
        }
        if !part.chars().all(|c| c.is_ascii_hexdigit()) {
            return false;
        }
    }
    true
}

/// Valide un nom d'utilisateur
pub fn is_valid_username(username: &str) -> bool {
    !username.is_empty()
        && username.len() >= 3
        && username.len() <= 50
        && username
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
}

/// Valide un rôle utilisateur
pub fn is_valid_role(role: &str) -> bool {
    matches!(role, "admin" | "user" | "guest" | "moderator")
}

/// Formate un statut d'événement
pub fn format_event_status(statut: &str) -> &'static str {
    match statut.to_lowercase().as_str() {
        "actif" | "active" | "en_cours" => "En cours",
        "termine" | "finished" | "completed" => "Terminé",
        "annule" | "cancelled" | "canceled" => "Annulé",
        "planifie" | "planned" | "scheduled" => "Planifié",
        _ => "Inconnu",
    }
}

/// Valide une coordonnée de point
pub fn is_valid_point_coordinate(x: f64, y: f64) -> bool {
    x.is_finite() && y.is_finite() && (-180.0..=180.0).contains(&x) && (-90.0..=90.0).contains(&y)
}

/// Valide une date au format ISO
pub fn is_valid_date_format(date: &str) -> bool {
    // Format attendu: YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS
    if date.len() < 10 {
        return false;
    }
    let date_part = &date[..10];
    let parts: Vec<&str> = date_part.split('-').collect();
    if parts.len() != 3 {
        return false;
    }
    let year: Result<i32, _> = parts[0].parse();
    let month: Result<u32, _> = parts[1].parse();
    let day: Result<u32, _> = parts[2].parse();

    match (year, month, day) {
        (Ok(y), Ok(m), Ok(d)) => {
            (1900..=2100).contains(&y) && (1..=12).contains(&m) && (1..=31).contains(&d)
        }
        _ => false,
    }
}

/// Génère un hash de mot de passe sécurisé
pub fn hash_password(password: &str) -> Result<String, String> {
    hash(password, DEFAULT_COST).map_err(|e| format!("Hash error: {}", e))
}

/// Vérifie un mot de passe contre son hash
pub fn verify_password(password: &str, hash: &str) -> bool {
    verify(password, hash).unwrap_or(false)
}

/// Valide la longueur d'un mot de passe
pub fn is_valid_password_length(password: &str) -> bool {
    password.len() >= 8 && password.len() <= 128
}

/// Construit une requête SQL pour les placeholders
pub fn build_sql_placeholders(count: usize) -> String {
    if count == 0 {
        return String::new();
    }
    vec!["?"; count].join(", ")
}

/// Construit une clause WHERE IN
pub fn build_where_in_clause(field: &str, count: usize) -> String {
    if count == 0 {
        return format!("{} IN ()", field);
    }
    format!("{} IN ({})", field, build_sql_placeholders(count))
}

/// Valide un email basique
pub fn is_valid_email(email: &str) -> bool {
    let at_count = email.chars().filter(|c| *c == '@').count();
    if at_count != 1 {
        return false;
    }
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let local = parts[0];
    let domain = parts[1];
    !local.is_empty() && !domain.is_empty() && domain.contains('.')
}

/// Valide un numéro de téléphone
pub fn is_valid_phone_number(phone: &str) -> bool {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.len() >= 10 && digits.len() <= 15
}

/// Sanitize une chaîne pour éviter les injections SQL basiques
pub fn sanitize_string(input: &str) -> String {
    input
        .replace('"', "\\\"")
        .replace('\'', "''")
        .replace('\\', "\\\\")
}

/// Tronque une chaîne à une longueur maximale
pub fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

/// Calcule le nombre total d'obstacles pour une liste de points
pub fn count_total_obstacles(points: &[Point]) -> usize {
    points.iter().map(|p| p.obstacles.len()).sum()
}

/// Calcule le nombre total de commentaires pour une liste de points
pub fn count_total_comments(points: &[Point]) -> usize {
    points.iter().map(|p| p.comments.len()).sum()
}

/// Calcule le nombre total de photos pour une liste de points
pub fn count_total_pictures(points: &[Point]) -> usize {
    points.iter().map(|p| p.pictures.len()).sum()
}

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Point {
    pub id: String, // UUID
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub pose: Option<String>,
    #[serde(default)]
    pub depose: Option<String>,
    #[serde(default)]
    pub event_ids: Vec<i64>,
    pub obstacles: Vec<Obstacle>,
    pub comments: Vec<Comment>,
    pub pictures: Vec<Picture>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObstacleType {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub width: f64,
    pub length: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Obstacle {
    pub id: String, // UUID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub number: Option<i32>,
    pub point_id: String, // UUID reference
    pub type_id: i64,
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PointSimple {
    pub id: String, // UUID
    pub x: f64,     // Coordonnée X (ou latitude)
    pub y: f64,     // Coordonnée Y (ou longitude)
    #[serde(default)]
    pub pose: Option<String>,
    #[serde(default)]
    pub depose: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Comment {
    pub id: String,       // UUID
    pub point_id: String, // UUID reference
    pub value: String,    // Le texte du commentaire
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Picture {
    pub id: String,       // UUID
    pub point_id: String, // UUID reference
    pub image: String,    // Le chemin ou le contenu encodé de l'image (ex: base64, URL)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PointDetail {
    pub point: PointSimple, // Changed from Vec<PointSimple> to PointSimple
    #[serde(rename = "comments")]
    pub comment: Vec<Comment>,
    #[serde(rename = "pictures")]
    pub picture: Vec<Picture>,
    #[serde(rename = "obstacles")]
    pub obstacle: Vec<Obstacle>,
}

#[derive(Debug, Deserialize)]
pub struct ObstacleInput {
    pub type_id: i64,
    pub number: i32,
    pub obstacle_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Event {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub description: String,
    #[serde(rename = "dateDebut", alias = "dateDebut")]
    pub date_debut: String,
    #[serde(rename = "dateFin", alias = "dateFin")]
    pub date_fin: String,
    pub statut: String,
    pub geometry: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Team {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub number: i64,
    #[serde(default)]
    pub event_ids: Vec<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Geometry {
    pub id: i64,
    pub event_id: i64,
    pub geom: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Person {
    pub id: i64,
    pub firstname: String,
    pub lastname: String,
    pub address: String,
    pub email: String,
    pub phone_number: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Member {
    pub id: i64,
    pub firstname: String,
    pub lastname: String,
    pub email: String,
}

pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
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

    let connect_options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Failed to parse DB URL: {}", e))?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .connect_with(connect_options)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Activer les foreign keys
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    // Créer toutes les tables si elles n'existent pas
    println!("[DB] 🔧 Création des tables...");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS point (
            id INTEGER PRIMARY KEY,
            x REAL,
            y REAL,
            pose TEXT,
            depose TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create point table: {}", e))?;

    // Migration: ajouter les colonnes pose et depose si elles n'existent pas
    let _ = sqlx::query("ALTER TABLE point ADD COLUMN pose TEXT")
        .execute(&pool)
        .await;
    let _ = sqlx::query("ALTER TABLE point ADD COLUMN depose TEXT")
        .execute(&pool)
        .await;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS obstacle_type (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            width REAL,
            length REAL
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create obstacle_type table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS comment (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            value TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create comment table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS picture (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            image TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create picture table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS obstacle (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            type_id INTEGER,
            number INTEGER,
            description TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id),
            FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create obstacle table: {}", e))?;

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
    .map_err(|e| format!("Failed to create user table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS event (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            date_debut TEXT,
            date_fin TEXT,
            statut TEXT,
            geometry TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create event table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS point_event (
            id INTEGER PRIMARY KEY,
            point_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            FOREIGN KEY (point_id) REFERENCES point(id) ON DELETE CASCADE,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
            UNIQUE(point_id, event_id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create point_event table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS geometry (
            id INTEGER PRIMARY KEY,
            event_id INTEGER NOT NULL,
            geom TEXT,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create geometry table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS team (
            id INTEGER PRIMARY KEY ,
            name TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create team table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS person (
            id INTEGER PRIMARY KEY,
            firstname TEXT,
            lastname TEXT,
            address TEXT,
            email TEXT,
            phone_number TEXT
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create person table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS member (
            id INTEGER PRIMARY KEY,
            team_id INTEGER,
            person_id INTEGER,
            FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
            FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE,
            UNIQUE(team_id, person_id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create member table: {}", e))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS team_event (
            id INTEGER PRIMARY KEY,
            team_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
            UNIQUE(team_id, event_id)
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to create member table: {}", e))?;

    // Migration: Convertir les tables point, comment, picture, obstacle pour accepter des UUIDs (TEXT)
    // Vérifier si la migration est nécessaire en regardant le type de la colonne id dans point
    let needs_uuid_migration = sqlx::query("SELECT typeof(id) as id_type FROM point LIMIT 1")
        .fetch_optional(&pool)
        .await
        .map(|row| {
            if let Some(r) = row {
                let id_type: String = r.get("id_type");
                id_type == "integer"
            } else {
                false // Table vide, pas besoin de migration
            }
        })
        .unwrap_or(false);

    if needs_uuid_migration {
        println!("[DB] 🔄 Migration UUID détectée comme nécessaire, exécution...");

        // Recréer la table point avec id TEXT
        let _ = sqlx::query("ALTER TABLE point RENAME TO point_old")
            .execute(&pool)
            .await;
        sqlx::query(
            "CREATE TABLE point (
                id TEXT PRIMARY KEY,
                x REAL,
                y REAL,
                pose TEXT,
                depose TEXT
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| format!("Migration point: {}", e))?;
        let _ = sqlx::query(
            "INSERT INTO point SELECT CAST(id AS TEXT), x, y, pose, depose FROM point_old",
        )
        .execute(&pool)
        .await;
        let _ = sqlx::query("DROP TABLE point_old").execute(&pool).await;

        // Recréer la table comment avec id TEXT et point_id TEXT
        let _ = sqlx::query("ALTER TABLE comment RENAME TO comment_old")
            .execute(&pool)
            .await;
        sqlx::query(
            "CREATE TABLE comment (
                id TEXT PRIMARY KEY,
                point_id TEXT,
                value TEXT,
                FOREIGN KEY (point_id) REFERENCES point (id)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| format!("Migration comment: {}", e))?;
        let _ = sqlx::query("INSERT INTO comment SELECT CAST(id AS TEXT), CAST(point_id AS TEXT), value FROM comment_old").execute(&pool).await;
        let _ = sqlx::query("DROP TABLE comment_old").execute(&pool).await;

        // Recréer la table picture avec id TEXT et point_id TEXT
        let _ = sqlx::query("ALTER TABLE picture RENAME TO picture_old")
            .execute(&pool)
            .await;
        sqlx::query(
            "CREATE TABLE picture (
                id TEXT PRIMARY KEY,
                point_id TEXT,
                image TEXT,
                FOREIGN KEY (point_id) REFERENCES point (id)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| format!("Migration picture: {}", e))?;
        let _ = sqlx::query("INSERT INTO picture SELECT CAST(id AS TEXT), CAST(point_id AS TEXT), image FROM picture_old").execute(&pool).await;
        let _ = sqlx::query("DROP TABLE picture_old").execute(&pool).await;

        // Recréer la table obstacle avec id TEXT et point_id TEXT
        let _ = sqlx::query("ALTER TABLE obstacle RENAME TO obstacle_old")
            .execute(&pool)
            .await;
        sqlx::query(
            "CREATE TABLE obstacle (
                id TEXT PRIMARY KEY,
                point_id TEXT,
                type_id INTEGER,
                number INTEGER,
                description TEXT,
                FOREIGN KEY (point_id) REFERENCES point (id),
                FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| format!("Migration obstacle: {}", e))?;
        let _ = sqlx::query("INSERT INTO obstacle SELECT CAST(id AS TEXT), CAST(point_id AS TEXT), type_id, number, description FROM obstacle_old").execute(&pool).await;
        let _ = sqlx::query("DROP TABLE obstacle_old").execute(&pool).await;

        // Recréer la table point_event avec point_id TEXT
        let _ = sqlx::query("ALTER TABLE point_event RENAME TO point_event_old")
            .execute(&pool)
            .await;
        sqlx::query(
            "CREATE TABLE point_event (
                id INTEGER PRIMARY KEY,
                point_id TEXT NOT NULL,
                event_id INTEGER NOT NULL,
                FOREIGN KEY (point_id) REFERENCES point(id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
                UNIQUE(point_id, event_id)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| format!("Migration point_event: {}", e))?;
        let _ = sqlx::query("INSERT INTO point_event SELECT id, CAST(point_id AS TEXT), event_id FROM point_event_old").execute(&pool).await;
        let _ = sqlx::query("DROP TABLE point_event_old")
            .execute(&pool)
            .await;

        println!("[DB] ✅ Migration UUID terminée");
    }

    println!("[DB] ✅ Toutes les tables sont prêtes");

    Ok(pool)
}

async fn fetch_comments(pool: &SqlitePool, point_id: &str) -> Result<Vec<Comment>, String> {
    let rows = sqlx::query("SELECT id, value, point_id FROM comment WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let comments = rows
        .into_iter()
        .map(|row| Comment {
            id: row.get("id"),
            point_id: row.get("point_id"),
            value: row.get("value"),
        })
        .collect();

    Ok(comments)
}

async fn fetch_pictures(pool: &SqlitePool, point_id: &str) -> Result<Vec<Picture>, String> {
    let rows = sqlx::query("SELECT id, image, point_id FROM picture WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pictures = rows
        .into_iter()
        .map(|row| Picture {
            id: row.get("id"),
            image: row.get("image"),
            point_id: row.get("point_id"),
        })
        .collect();

    Ok(pictures)
}

async fn fetch_obstacles(pool: &SqlitePool, point_id: &str) -> Result<Vec<Obstacle>, String> {
    let query = r#"
        SELECT 
            o.id, 
            o.point_id,
            o.type_id,
            o.number, 
            ot.name AS name,
            ot.description AS description,
            ot.width AS width,
            ot.length AS length
        FROM obstacle o
        JOIN obstacle_type ot ON o.type_id = ot.id
        WHERE o.point_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(point_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let obstacles = rows
        .into_iter()
        .map(|row| Obstacle {
            id: row.get("id"),
            point_id: row.get("point_id"),
            type_id: row.get("type_id"),
            number: row.get("number"),
            name: row.get("name"),
            description: row.get("description"),
            width: row.get("width"),
            length: row.get("length"),
        })
        .collect();

    Ok(obstacles)
}

async fn fetch_event_ids(pool: &SqlitePool, point_id: &str) -> Result<Vec<i64>, String> {
    let rows = sqlx::query("SELECT event_id FROM point_event WHERE point_id = ?")
        .bind(point_id)
        .fetch_all(pool)
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
pub async fn insert_obstacles(
    app: AppHandle,
    point_id: String,
    obstacles: Vec<ObstacleInput>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    for obstacle in obstacles {
        if let Some(id) = obstacle.obstacle_id {
            if obstacle.number == 0 {
                // Supprimer l'obstacle si le nombre est 0
                sqlx::query("DELETE FROM obstacle WHERE id = ?")
                    .bind(id)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Failed to delete obstacle: {}", e))?;
            } else {
                // Mettre à jour le nombre
                sqlx::query("UPDATE obstacle SET number = ? WHERE id = ?")
                    .bind(obstacle.number)
                    .bind(id)
                    .execute(&pool)
                    .await
                    .map_err(|e| format!("Failed to update obstacle: {}", e))?;
            }
        } else if obstacle.number > 0 {
            // Insérer seulement si le nombre est > 0
            sqlx::query("INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)")
                .bind(&point_id)
                .bind(obstacle.type_id)
                .bind(obstacle.number)
                .execute(&pool)
                .await
                .map_err(|e| format!("Failed to insert obstacle: {}", e))?;
        }
    }
    Ok(())
}

// Récupère tous les points avec leurs obstacles
pub async fn retrieve_data(app: &AppHandle) -> Result<Vec<Point>, String> {
    retrieve_data_by_event(app, None).await
}

// Récupère les points filtrés par event_id (None = tous les points)
pub async fn retrieve_data_by_event(
    app: &AppHandle,
    event_id: Option<i64>,
) -> Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;

    let base_rows = if let Some(eid) = event_id {
        println!("[DB] 🔍 Récupération des points pour l'event_id: {}", eid);
        sqlx::query(
            r#"
            SELECT DISTINCT p.id, p.x, p.y, p.pose, p.depose
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
        println!("[DB] 🔍 Récupération de tous les points");
        sqlx::query(
            r#"
            SELECT p.id, p.x, p.y, p.pose, p.depose
            FROM point p
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

        let comments = fetch_comments(&pool, &id).await?;
        let pictures = fetch_pictures(&pool, &id).await?;
        let obstacles = fetch_obstacles(&pool, &id).await?;
        let event_ids = fetch_event_ids(&pool, &id).await?;

        points.push(Point {
            id,
            x: row.get("x"),
            y: row.get("y"),
            pose: row.get("pose"),
            depose: row.get("depose"),
            event_ids,
            obstacles,
            comments,
            pictures,
        });
    }

    println!("[DB] ✅ {} point(s) récupéré(s)", points.len());
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
            generate_uuid()
        } else {
            // Utiliser l'ID fourni
            detail.point.id.clone()
        };

        // Insérer le point
        sqlx::query(
            r#"INSERT OR REPLACE INTO point (id, x, y, pose, depose) VALUES (?, ?, ?, ?, ?)"#,
        )
        .bind(&point_id)
        .bind(detail.point.x)
        .bind(detail.point.y)
        .bind(&detail.point.pose)
        .bind(&detail.point.depose)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Erreur INSERT/REPLACE point ID {} : {}", point_id, e))?;

        assigned_ids.push(point_id);
    }
    // ÉTAPE 2: Insérer les données liées (commentaires)
    for (idx, detail) in details.iter().enumerate() {
        let assigned_point_id = &assigned_ids[idx];
        for comment in &detail.comment {
            let comment_id = if comment.id.is_empty() || comment.id == "0" {
                generate_uuid()
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
        let assigned_point_id = &assigned_ids[idx];
        for picture in &detail.picture {
            let picture_id = if picture.id.is_empty() || picture.id == "0" {
                generate_uuid()
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
        let assigned_point_id = &assigned_ids[idx];
        for obstacle in &detail.obstacle {
            let obstacle_id = if obstacle.id.is_empty() || obstacle.id == "0" {
                generate_uuid()
            } else {
                obstacle.id.clone()
            };
            let point_id_to_use = if obstacle.point_id.is_empty() || obstacle.point_id == "0" {
                assigned_point_id.clone()
            } else {
                obstacle.point_id.clone()
            };

            // Si l'obstacle a des données de type (name, description, width, length),
            // on l'insère dans obstacle_type
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
            // Insérer l'obstacle lui-même
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
        Err(e) => println!("[DB] ❌ Erreur insertion: {}", e),
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
        SELECT p.id, p.firstname, p.lastname, p.email
        FROM person p
        INNER JOIN member m ON p.id = m.person_id
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
            firstname: row.get("firstname"),
            lastname: row.get("lastname"),
            email: row.get("email"),
        })
        .collect();

    Ok(members)
}

#[tauri::command]
pub async fn fetch_team_events(app: AppHandle, team_id: i64) -> Result<Vec<Event>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT e.*
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
            description: row.get("description"),
            date_debut: row.get("date_debut"),
            date_fin: row.get("date_fin"),
            statut: row.get("statut"),
            geometry: row.get("geometry"),
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
                number: row.get("number"),
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
        name,
        number: 0,
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
        firstname,
        lastname,
        email,
        address,
        phone_number,
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
            number: row.get("number"),
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
            description,
            date_debut,
            date_fin,
            statut,
            geometry
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
        let event_id: i64 = row.get("id");
        println!("[DB]   → Traitement de l'événement ID: {}", event_id);

        // Récupérer les géométries pour cet événement

        events.push(Event {
            id: event_id,
            name: row.get("name"),
            description: row.get("description"),
            date_debut: row.get("date_debut"),
            date_fin: row.get("date_fin"),
            statut: row.get("statut"),
            geometry: row.get("geometry"),
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
    println!("[DB] 🎉 Insertion d'un événement: {:?}", event);

    let pool = get_db_pool(&app).await?;

    sqlx::query(
            "INSERT INTO event (name, description, date_debut, date_fin, statut, geometry) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&event.name)
        .bind(&event.description)
        .bind(&event.date_debut)
        .bind(&event.date_fin)
        .bind(&event.statut)
        .bind(&event.geometry)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert event: {}", e))?;

    println!("[DB] ✅ Événement '{}' créé avec succès !", event.name);

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
    println!("[DB] 🔓 Déliaison point {} ← event {}", point_id, event_id);
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
        "[DB] 📐 Géométrie créée avec id={} pour l'événement {}",
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

    println!("[DB] ✏️ Géométrie {} mise à jour", geometry_id);

    Ok(Geometry {
        id: geometry_id,
        event_id,
        geom,
    })
}

#[tauri::command]
pub async fn delete_event(app: AppHandle, event_id: i64) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Les liaisons point_event seront supprimées automatiquement grâce à ON DELETE CASCADE
    sqlx::query("DELETE FROM event WHERE id = ?")
        .bind(event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] ✅ Événement {} supprimé", event_id);
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

/// Ensure the core database schema exists (idempotent).
pub async fn ensure_schema(pool: &SqlitePool) -> Result<(), String> {
    // CREATE TABLE IF NOT EXISTS for all required tables
    let stmts = vec![
        r#"CREATE TABLE IF NOT EXISTS point (
            id INTEGER PRIMARY KEY,
            x REAL,
            y REAL,
            pose TEXT,
            depose TEXT
        );"#,
        r#"CREATE TABLE IF NOT EXISTS obstacle_type (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            width REAL,
            length REAL
        );"#,
        r#"CREATE TABLE IF NOT EXISTS comment (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            value TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS picture (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            image TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS obstacle (
            id INTEGER PRIMARY KEY,
            point_id INTEGER,
            type_id INTEGER,
            number INTEGER,
            description TEXT,
            FOREIGN KEY (point_id) REFERENCES point (id),
            FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY,
            username TEXT,
            password_hash TEXT,
            role TEXT
        );"#,
        r#"CREATE TABLE IF NOT EXISTS event (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            date_debut TEXT,
            date_fin TEXT,
            statut TEXT,
            geometry TEXT
        );"#,
        r#"CREATE TABLE IF NOT EXISTS point_event (
            id INTEGER PRIMARY KEY,
            point_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            FOREIGN KEY (point_id) REFERENCES point(id) ON DELETE CASCADE,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
            UNIQUE(point_id, event_id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS team (
            id INTEGER PRIMARY KEY ,
            name TEXT,
            number INTEGER
        );"#,
        r#"CREATE TABLE IF NOT EXISTS person (
            id INTEGER PRIMARY KEY,
            firstname TEXT,
            lastname TEXT,
            address TEXT,
            email TEXT,
            phone_number TEXT
        );"#,
        r#"CREATE TABLE IF NOT EXISTS member (
            id INTEGER PRIMARY KEY,
            team_id INTEGER,
            person_id INTEGER,
            FOREIGN KEY (team_id) REFERENCES team (id) ON DELETE CASCADE,
            FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE,
            UNIQUE(team_id, person_id)
        );"#,
        r#"
        CREATE TABLE IF NOT EXISTS team_event (
            id INTEGER PRIMARY KEY,
            team_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
            UNIQUE(team_id, event_id)
        );"#,
        r#"CREATE TABLE IF NOT EXISTS geometry (
            id INTEGER PRIMARY KEY,
            event_id INTEGER NOT NULL,
            geom TEXT,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );"#,
    ];

    for s in stmts {
        sqlx::query(s)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to ensure schema: {}", e))?;
    }

    Ok(())
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
        Some(user) => Ok(verify(&password, &user.password_hash).unwrap_or(false)),
        None => Ok(false),
    }
}
