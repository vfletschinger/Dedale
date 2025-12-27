use sqlx::{Row};
use tauri::{AppHandle};
use uuid::Uuid;
use crate::types::*;
use crate::db::get_db_pool;

#[tauri::command]
pub async fn fetch_geometries_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<Geometry>, String> {
    let pool = get_db_pool(&app).await?;
    let rows = sqlx::query("SELECT id, event_id, geom FROM geometry WHERE event_id = ?")
        .bind(&event_id)
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
    event_id: String,
    geom: String,
) -> Result<Geometry, String> {
    let pool = get_db_pool(&app).await?;
    let uuid = Uuid::new_v4().to_string();
    let _result = sqlx::query("INSERT INTO geometry (id, event_id, geom) VALUES (?, ?, ?)")
        .bind(&uuid)
        .bind(&event_id)
        .bind(&geom)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Geometry { id: uuid, event_id, geom })
}

#[tauri::command]
pub async fn delete_geometry(app: AppHandle, geometry_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM geometry WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] 🗑️ Géométrie {} supprimée", geometry_id);
    Ok(())
}

#[tauri::command]
pub async fn update_geometry(
    app: AppHandle,
    geometry_id: String,
    geom: String,
) -> Result<Geometry, String> {
    let pool = get_db_pool(&app).await?;

    let row = sqlx::query("SELECT event_id FROM geometry WHERE id = ?")
        .bind(&geometry_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Géométrie non trouvée: {}", e))?;

    let event_id: String = row.get("event_id");

    sqlx::query("UPDATE geometry SET geom = ? WHERE id = ?")
        .bind(&geom)
        .bind(&geometry_id)
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