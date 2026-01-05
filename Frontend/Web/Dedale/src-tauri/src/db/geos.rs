use std::iter::Zip;

use rust_xlsxwriter::XlsxError;
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
pub async fn fetch_zones_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<Zone>, String> {
    let pool = get_db_pool(&app).await?;
    let rows = sqlx::query("SELECT id, event_id, name, color, geometry_json FROM zone WHERE event_id = ?")
        .bind(&event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let geometries: Vec<Zone> = rows
        .into_iter()
        .map(|row| Zone {
            id: row.get("id"),
            event_id: row.get("event_id"),
            name: row.get("name"),
            color: row.get("color"),
            geometry_json: row.get("geometry_json"),
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
pub async fn fetch_parcours_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<Parcours>, String> {
    let pool = get_db_pool(&app).await?;
    let rows = sqlx::query("SELECT id, event_id, name, color, start_time, speed_low, speed_high, geometry_json FROM parcours WHERE event_id = ?")
        .bind(&event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let geometries: Vec<Parcours> = rows
        .into_iter()
        .map(|row| Parcours {
            id: row.get("id"),
            event_id: row.get("event_id"),
            name: row.get("name"),
            color: row.get("color"),
            start_time: row.get("start_time"),
            speed_low: row.get("speed_low"),
            speed_high: row.get("speed_high"),
            geometry_json: row.get("geometry_json"),
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
pub async fn create_zone(
    app: AppHandle,
    event_id: String,
    geom: String,
    name: String,
    color: String,
) -> Result<Zone, String> {
    let pool = get_db_pool(&app).await?;
    let uuid = Uuid::new_v4().to_string();
    let _result = sqlx::query("INSERT INTO zone (id, event_id, geometry_json,name,color) VALUES (?, ?, ?, ?, ?)")
        .bind(&uuid)
        .bind(&event_id)
        .bind(&geom)
        .bind(&name)
        .bind(&color)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Zone { id: uuid, event_id, name: Some(name), color: Some(color), geometry_json: Some(geom) })
}
#[tauri::command]
pub async fn create_parcours(
    app: AppHandle,
    event_id: String,
    geom: String,
    name: String,
    color: String,
    start_time: Option<i64>,
    speed_low: Option<f64>,
    speed_high: Option<f64>,
) -> Result<Parcours, String> {
    let pool = get_db_pool(&app).await?;
    let uuid = Uuid::new_v4().to_string();
    
    sqlx::query("INSERT INTO parcours (id, event_id, geometry_json, name, color, start_time, speed_low, speed_high) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&uuid)
        .bind(&event_id)
        .bind(&geom)
        .bind(&name)
        .bind(&color)
        .bind(&start_time)
        .bind(&speed_low)
        .bind(&speed_high)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] ✅ Parcours {} créé avec succès", name);
    
    Ok(Parcours { 
        id: uuid, 
        event_id, 
        name: Some(name), 
        color: Some(color), 
        start_time, 
        speed_low, 
        speed_high, 
        geometry_json: Some(geom) 
    })
}

#[tauri::command]
pub async fn delete_zone(app: AppHandle, geometry_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM zone WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] 🗑️ Géométrie {} supprimée", geometry_id);
    Ok(())
}

#[tauri::command]
pub async fn delete_parcours(app: AppHandle, geometry_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM parcours WHERE id = ?")
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    println!("[DB] 🗑️ Géométrie {} supprimée", geometry_id);
    Ok(())
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

#[tauri::command]
pub async fn update_zone(
    app: AppHandle,
    geometry_id: String,
    geom: String,
    name: String,
    color: String,
) -> Result<Zone, String> {
    let pool = get_db_pool(&app).await?;

    let row = sqlx::query("SELECT event_id FROM zone WHERE id = ?")
        .bind(&geometry_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Géométrie non trouvée: {}", e))?;

    let event_id: String = row.get("event_id");

    sqlx::query("UPDATE zone SET geometry_json = ?, name = ?, color = ? WHERE id = ?")
        .bind(&geom)
        .bind(&name)
        .bind(&color)
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] Géométrie {} mise à jour", geometry_id);

    Ok(Zone {
        id: geometry_id,
        event_id,
        name: Some(name),
        color: Some(color),
        geometry_json: Some(geom),
    })
}

#[tauri::command]
pub async fn update_parcours(
    app: AppHandle,
    geometry_id: String,
    geom: String,
    name: String,
    color: String,
    start_time: Option<i64>,
    speed_low: Option<f64>,
    speed_high: Option<f64>,
) -> Result<Parcours, String> {
    let pool = get_db_pool(&app).await?;

    let row = sqlx::query("SELECT event_id FROM parcours WHERE id = ?")
        .bind(&geometry_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Parcours non trouvé: {}", e))?;

    let event_id: String = row.get("event_id");

    sqlx::query(
        "UPDATE parcours SET geometry_json = ?, name = ?, color = ?, start_time = ?, speed_low = ?, speed_high = ? WHERE id = ?"
    )
        .bind(&geom)
        .bind(&name)
        .bind(&color)
        .bind(&start_time)
        .bind(&speed_low)
        .bind(&speed_high)
        .bind(&geometry_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[DB] Parcours {} mis à jour", geometry_id);

    Ok(Parcours {
        id: geometry_id,
        event_id,
        name: Some(name),
        color: Some(color),
        start_time,
        speed_low,
        speed_high,
        geometry_json: Some(geom),
    })
}