use crate::types::*;
use sqlx::Row;
use tauri::AppHandle;
use uuid::Uuid;

use crate::db::get_db_pool;

#[tauri::command]
pub async fn fetch_people(app: AppHandle) -> Result<Vec<Person>, String> {
    let pool = get_db_pool(&app).await?;

    let rows = sqlx::query("SELECT id, firstname, lastname, email, phone_number FROM person ORDER BY lastname, firstname")
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
pub async fn create_person(
    app: AppHandle,
    firstname: String,
    lastname: String,
    email: String,
    phone_number: Option<String>,
) -> Result<Person, String> {
    let pool = get_db_pool(&app).await?;
    let id = Uuid::new_v4().to_string();
    let _result = sqlx::query(
        "INSERT INTO person (id, firstname, lastname, email, phone_number) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&firstname)
    .bind(&lastname)
    .bind(&email)
    .bind(&phone_number)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(Person {
        id,
        firstname: Some(firstname),
        lastname: Some(lastname),
        email: Some(email),
        phone_number,
    })
}

#[tauri::command]
pub async fn delete_person(app: AppHandle, person_id: String) -> Result<(), String> {
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
    id: String,
    firstname: String,
    lastname: String,
    email: String,
    phone_number: String,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    sqlx::query("UPDATE person SET firstname=?, lastname=?, email=?, phone_number=? WHERE id=?")
        .bind(firstname)
        .bind(lastname)
        .bind(email)
        .bind(phone_number)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
