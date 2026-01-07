use crate::types::*;
use sqlx::Row;
use tauri::AppHandle;

use crate::db::get_db_pool;

#[tauri::command]
pub async fn fetch_team_members(app: AppHandle, team_id: String) -> Result<Vec<Member>, String> {
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
pub async fn fetch_team_events(app: AppHandle, team_id: String) -> Result<Vec<Event>, String> {
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
            let event_ids: Vec<String> = match event_ids_str {
                Some(s) => s.split(',').map(|id| id.to_string()).collect(),
                None => Vec::new(),
            };

            Team {
                id: row.get("id"),
                name: row.get("name"),
                event_ids: event_ids,
            }
        })
        .collect();

    Ok(teams)
}

#[tauri::command]
pub async fn create_team(app: AppHandle, name: String) -> Result<Team, String> {
    let pool = get_db_pool(&app).await?;
    let new_id = uuid::Uuid::new_v4().to_string();

    let _result = sqlx::query("INSERT INTO team (id, name) VALUES (?, ?)")
        .bind(&new_id)
        .bind(&name)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Team {
        id: new_id,
        name: Some(name),
        event_ids: Vec::new(),
    })
}

#[tauri::command]
pub async fn delete_team(app: AppHandle, team_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("DELETE FROM team WHERE id = ?")
        .bind(team_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_team(app: AppHandle, id: String, name: String) -> Result<(), String> {
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
pub async fn add_team_event(
    app: AppHandle,
    team_id: String,
    event_id: String,
) -> Result<(), String> {
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
pub async fn remove_team_event(
    app: AppHandle,
    team_id: String,
    event_id: String,
) -> Result<(), String> {
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
pub async fn add_member(app: AppHandle, team_id: String, person_id: String) -> Result<(), String> {
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
pub async fn remove_member(
    app: AppHandle,
    team_id: String,
    person_id: String,
) -> Result<(), String> {
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
pub async fn fetch_person_teams(app: AppHandle, person_id: String) -> Result<Vec<Team>, String> {
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
