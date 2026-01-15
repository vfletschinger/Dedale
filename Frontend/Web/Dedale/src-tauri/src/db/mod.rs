use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use std::str::FromStr;
use tauri::{AppHandle, Manager};

pub mod equipements;
pub mod events;
pub mod geos;
pub mod persons;
pub mod planning;
pub mod points;
pub mod teams;
pub use equipements::*;
pub use events::*;
pub use geos::*;
pub use persons::*;
pub use planning::*;
pub use points::*;
pub use teams::*;
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
            description TEXT,
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
            name TEXT DEFAULT 'Nouveau point',
            comment TEXT,
            type TEXT,
            status BOOLEAN,
            FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
        )",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating point: {}", e))?;

    // --- POINTS D'INTÉRÊT ---
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS interest (
            id CHAR(36) PRIMARY KEY,
            event_id CHAR(36) NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            description TEXT,
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
            description TEXT,
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
            id CHAR(36) PRIMARY KEY,
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
            id CHAR(36) PRIMARY KEY,
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
            id CHAR(36) PRIMARY KEY,
            team_id CHAR(36) NOT NULL,
            person_id CHAR(36) NOT NULL,
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
            id CHAR(36) PRIMARY KEY,
            team_id CHAR(36) NOT NULL,
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

    // --- MIGRATIONS: Ajouter les colonnes description si elles n'existent pas ---
    // Pour les bases de données existantes créées avant l'ajout de ces colonnes
    let _ = sqlx::query("ALTER TABLE zone ADD COLUMN description TEXT")
        .execute(&pool)
        .await; // Ignore l'erreur si la colonne existe déjà

    let _ = sqlx::query("ALTER TABLE equipement ADD COLUMN description TEXT")
        .execute(&pool)
        .await; // Ignore l'erreur si la colonne existe déjà
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_action_per_equipement 
         ON action (equipement_id, type);",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Error creating unique action index: {}", e))?;

    println!("[DB] Toutes les tables ont été synchronisées avec le diagramme ER.");

    Ok(pool)
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
pub async fn is_first_launch(pool: &SqlitePool) -> sqlx::Result<bool> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user")
        .fetch_one(pool)
        .await?;
    Ok(count == 0)
}
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
