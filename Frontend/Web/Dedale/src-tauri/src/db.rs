// On importe les dépendances nécessaires
use tauri_plugin_sql::{Builder, Migration, MigrationKind};


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
        }
    ];

    // On construit et renvoie le plugin
    Builder::default()
        .add_migrations("sqlite:mydatabase.db", migrations)
        .build()
}