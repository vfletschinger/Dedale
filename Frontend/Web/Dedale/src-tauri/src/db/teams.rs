use crate::types::*;
use sqlx::QueryBuilder;
use sqlx::Row;
use sqlx::Sqlite;
use tauri::AppHandle;

use crate::db::get_db_pool;

#[tauri::command]
pub async fn fetch_team_members(app: AppHandle, team_id: String) -> Result<Vec<Person>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT p.id, p.firstname, p.lastname, p.email, p.phone_number
        FROM person p
        JOIN member m on m.person_id = p.id
        WHERE m.team_id = ?
    "#;

    let rows = sqlx::query(query)
        .bind(team_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let people = rows
        .into_iter()
        .map(|row| Person {
            id: row.get("id"),
            firstname: row.get("firstname"),
            lastname: row.get("lastname"),
            email: row.get("email"),
            phone_number: row.get("phone_number"),
        })
        .collect();

    Ok(people)
}

#[tauri::command]
pub async fn fetch_teams(app: AppHandle, event_id: Option<String>) -> Result<Vec<Team>, String> {
    let pool = get_db_pool(&app).await?;

    let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
        r#"
        SELECT
            t.id,
            t.name,
            COUNT(DISTINCT m.person_id) as number,
            t.event_id
        FROM team t
        LEFT JOIN member m ON t.id = m.team_id
        WHERE 1=1
    "#,
    );
    if event_id.is_some() {
        query_builder.push(" AND t.event_id = ");
        query_builder.push_bind(event_id);
    }

    query_builder.push("GROUP BY t.id, t.name, t.event_id");

    let rows = query_builder
        .build()
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let teams = rows
        .into_iter()
        .map(|row| Team {
            id: row.get("id"),
            name: row.get("name"),
            number: row.get("number"),
            event_id: row.get("event_id"),
        })
        .collect();

    Ok(teams)
}

#[tauri::command]
pub async fn create_team(app: AppHandle, name: String, event_id: String) -> Result<Team, String> {
    let pool = get_db_pool(&app).await?;
    let new_id = uuid::Uuid::new_v4().to_string();

    let _result = sqlx::query("INSERT INTO team (id, name, event_id) VALUES (?, ?, ?)")
        .bind(&new_id)
        .bind(&name)
        .bind(&event_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Team {
        id: new_id,
        name: Some(name),
        number: 0,
        event_id: event_id,
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
pub async fn fetch_team_events(app: AppHandle, team_id: String) -> Result<Vec<Event>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT e.id, e.name, e.start_date, e.end_date
        FROM event e
        INNER JOIN team te ON e.id = te.event_id
        WHERE te.id = ?
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
            parcours: None,
            zone: None,
        })
        .collect();

    Ok(events)
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
pub async fn fetch_person_teams(
    app: AppHandle,
    person_id: String,
    event_id: Option<String>,
) -> Result<Vec<Team>, String> {
    let pool = get_db_pool(&app).await?;
    let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
        r#"
        SELECT t.id, t.name, (SELECT COUNT(*) FROM member m2 WHERE m2.team_id = t.id) as number, t.event_id
        FROM team t
        INNER JOIN member m ON t.id = m.team_id
        WHERE m.person_id = 
    "#,
    );
    query_builder.push_bind(person_id);

    if event_id.is_some() {
        query_builder.push(" AND t.event_id = ");
        query_builder.push_bind(event_id);
    }

    let rows = query_builder
        .build()
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let teams = rows
        .into_iter()
        .map(|row| Team {
            id: row.get("id"),
            name: row.get("name"),
            number: row.get("number"),
            event_id: row.get("event_id"),
        })
        .collect();

    Ok(teams)
}
