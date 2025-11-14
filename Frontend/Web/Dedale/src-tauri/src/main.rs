// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Builder;

// 1. On déclare que le fichier "db.rs" existe
mod db;

fn main() {
    Builder::default()
        // 2. On appelle notre nouvelle fonction pour initialiser le plugin
        .plugin(db::init_db())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
