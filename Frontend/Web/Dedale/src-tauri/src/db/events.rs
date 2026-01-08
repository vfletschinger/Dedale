use crate::db::get_db_pool;
use crate::types::*;
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;
use uuid::Uuid;

pub async fn fetch_event_ids(app: AppHandle, point_id: &str) -> Result<Vec<String>, String> {
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
pub async fn fetch_events(app: AppHandle) -> Result<Vec<Event>, String> {
    println!("[DB] 🚀 Début de la récupération des événements...");
    let pool = get_db_pool(&app).await?;

    // 1. La requête ne sélectionne QUE ce qui existe dans la table 'event'
    let query = r#"
        SELECT
            id,
            name,
            start_date,
            end_date
        FROM event
    "#;

    let rows = sqlx::query(query).fetch_all(&pool).await.map_err(|e| {
        println!("[DB] ❌ Erreur SQL: {}", e);
        e.to_string()
    })?;

    let mut events: Vec<Event> = Vec::new();

    for row in rows {
        let event_id: String = row.get("id");

        events.push(Event {
            id: event_id,
            name: row.get("name"),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            zone: None,
            parcours: None,
        });
    }

    println!(
        "[DB] ✅ Récupération terminée. {} événements.",
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

    sqlx::query("INSERT INTO event (id, name, start_date, end_date) VALUES (?, ?, ?, ?)")
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
    event_id: String,
) -> Result<(), String> {
    println!("[DB] 🔗 Liaison point {} → event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("INSERT OR IGNORE INTO point_event (point_id, event_id) VALUES (?, ?)")
        .bind(&point_id)
        .bind(&event_id)
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
    event_id: String,
) -> Result<(), String> {
    println!("[DB]  Déliaison point {} ← event {}", point_id, event_id);
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM point_event WHERE point_id = ? AND event_id = ?")
        .bind(&point_id)
        .bind(&event_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to unlink point from event: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_points_for_event(app: AppHandle, event_id: String) -> Result<Vec<String>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT point_id FROM point_event WHERE event_id = ?")
        .bind(event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let point_ids: Vec<String> = rows.into_iter().map(|row| row.get("point_id")).collect();
    Ok(point_ids)
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
