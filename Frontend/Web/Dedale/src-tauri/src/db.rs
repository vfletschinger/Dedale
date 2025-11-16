// On importe les dépendances nécessaires
use sqlx::{SqlitePool, Row};
use sqlx::sqlite::{SqlitePoolOptions, SqliteConnectOptions};
use tauri_plugin_sql::{Builder, Migration, MigrationKind};
use tauri::{AppHandle, Manager};
use std::fs;
use std::str::FromStr;


// Elle renvoie le plugin SQL entièrement configuré
pub fn init_db() -> impl tauri::plugin::Plugin<tauri::Wry> {
    let migrations = vec![
        Migration {
            version: 1,
            description: "enable_foreign_keys",
            sql: "PRAGMA foreign_keys = ON;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_all_tables",
            sql: "
                CREATE TABLE point (
                    id INTEGER PRIMARY KEY,
                    x REAL,
                    y REAL
                );
                
                CREATE TABLE obstacle_type (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    description TEXT,
                    width REAL,
                    length REAL
                );

                CREATE TABLE comment (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    value TEXT,
                    FOREIGN KEY (point_id) REFERENCES point (id)
                );

                CREATE TABLE picture (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    path TEXT,
                    FOREIGN KEY (point_id) REFERENCES point (id)
                );

                CREATE TABLE obstacles (
                    id INTEGER PRIMARY KEY,
                    point_id INTEGER,
                    type_id INTEGER,
                    nombre INTEGER,
                    FOREIGN KEY (point_id) REFERENCES point (id),
                    FOREIGN KEY (type_id) REFERENCES obstacle_type (id)
                );
            ",
            kind: MigrationKind::Up,
        },
    ];

    // On construit et renvoie le plugin
    Builder::default()
        .add_migrations("sqlite:mydatabase.db", migrations)
        .build()
}


//Méthodes utiles pour la génération du pdf


#[derive(Debug)]
pub struct Point {
    pub id: i64,
    pub x: f64,
    pub y: f64,
}

pub async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to find app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("mydatabase.db");

    let db_url = format!("sqlite:{}", db_path.to_str()
        .ok_or_else(|| "Failed to convert DB path to string.".to_string())?);

    let connect_options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Failed to parse DB URL: {}", e))?
        .create_if_missing(true);

    SqlitePoolOptions::new()
        .connect_with(connect_options)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))
}

pub async fn insert_test_data(app: &AppHandle) -> std::result::Result<(), String> {
    let pool = get_db_pool(app).await?;
    let query = "INSERT INTO point (x, y) VALUES (?, ?)";

    sqlx::query(query)
        .bind(5.0)
        .bind(2.0)
        .execute(&pool)
        .await
        .map_err(|e| format!("Database insertion failed: {}", e))?;
    
    Ok(())
}

pub async fn retrieve_all_points_data(app: &AppHandle) -> std::result::Result<Vec<Point>, String> {
    let pool = get_db_pool(app).await?;
    let query = "SELECT id, x, y FROM point";

    let rows = sqlx::query(query)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Database retrieval failed: {}", e))?;

    let points: Vec<Point> = rows.iter().map(|row| {
        Point {
            id: row.get("id"),
            x: row.get("x"),
            y: row.get("y"),
        }
    }).collect();
    
    Ok(points)
}