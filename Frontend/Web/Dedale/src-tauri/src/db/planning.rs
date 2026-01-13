use sqlx::Row;
use std::fs::File;
use std::io::Write;
use tauri::AppHandle;
use tauri::Manager;

use crate::db::get_db_pool;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(crate = "serde")]
pub struct PlanningTeam {
    pub id: String,
    pub name: String,
    pub event_id: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(crate = "serde")]
pub struct PlanningAction {
    pub id: String,
    pub team_id: String,
    pub equipement_id: String,
    #[serde(rename = "type")]
    pub action_type: String,
    pub scheduled_time: String,
    pub is_done: bool,
}

/// Récupère les équipes pour un événement
#[tauri::command]
pub async fn fetch_teams_for_event(
    app: AppHandle,
    event_id: String,
) -> Result<Vec<PlanningTeam>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT DISTINCT t.id, t.name, e.id as event_id
        FROM team t
        JOIN team te ON te.id = t.id
        JOIN event e ON e.id = te.event_id
        WHERE e.id = ?
        ORDER BY t.name ASC
    "#;

    let rows = sqlx::query(query)
        .bind(&event_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let teams = rows
        .into_iter()
        .map(|row| PlanningTeam {
            id: row.get("id"),
            name: row.get("name"),
            event_id: row.get("event_id"),
        })
        .collect();

    Ok(teams)
}

/// Récupère les actions pour une équipe
#[tauri::command]
pub async fn fetch_actions_for_team(
    app: AppHandle,
    team_id: String,
) -> Result<Vec<PlanningAction>, String> {
    let pool = get_db_pool(&app).await?;

    let query = r#"
        SELECT 
            a.id,
            a.team_id,
            a.equipement_id,
            a.type,
            a.scheduled_time,
            a.is_done
        FROM action a
        WHERE a.team_id = ?
        ORDER BY a.scheduled_time ASC
    "#;

    let rows = sqlx::query(query)
        .bind(&team_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let actions = rows
        .into_iter()
        .map(|row| PlanningAction {
            id: row.get("id"),
            team_id: row.get("team_id"),
            equipement_id: row.get("equipement_id"),
            action_type: row.get("type"),
            scheduled_time: row.get("scheduled_time"),
            is_done: row.get("is_done"),
        })
        .collect();

    Ok(actions)
}

/// Met à jour le statut d'une action
#[tauri::command]
pub async fn update_action_status(app: AppHandle, action_id: String) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Basculer le statut is_done
    let query = r#"
        UPDATE action
        SET is_done = NOT is_done
        WHERE id = ?
    "#;

    sqlx::query(query)
        .bind(&action_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Exporte le planning en Excel (CSV)
#[tauri::command]
pub async fn export_planning_excel(
    app: AppHandle,
    _db_url: String,
    excel_path_str: String,
    event_id: Option<String>,
) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Récupérer les équipes et actions
    let teams_query = if let Some(ref eid) = event_id {
        format!(
            r#"
            SELECT DISTINCT t.id, t.name
            FROM team t
            JOIN team te ON te.team_id = t.id
            WHERE te.event_id = '{}'
            ORDER BY t.name ASC
        "#,
            eid
        )
    } else {
        r#"
            SELECT DISTINCT t.id, t.name
            FROM team t
            ORDER BY t.name ASC
        "#
        .to_string()
    };

    let team_rows = sqlx::query_as::<_, (String, String)>(&teams_query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // Créer un fichier CSV
    let mut file = File::create(&excel_path_str).map_err(|e| e.to_string())?;

    // En-tête
    writeln!(file, "Team,Action Type,Equipment ID,Scheduled Time,Status")
        .map_err(|e| e.to_string())?;

    for (_team_id, team_name) in team_rows {
        let actions_query = r#"
            SELECT 
                type,
                equipement_id,
                scheduled_time,
                is_done
            FROM action
            WHERE team_id = ?
            ORDER BY scheduled_time ASC
        "#;

        let action_rows = sqlx::query_as::<_, (String, String, String, bool)>(actions_query)
            .bind(&_team_id)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

        for (action_type, equipement_id, scheduled_time, is_done) in action_rows {
            let status = if is_done { "Done" } else { "Pending" };
            writeln!(
                file,
                "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"",
                team_name, action_type, equipement_id, scheduled_time, status
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Crée un PDF du planning
#[tauri::command]
pub async fn create_planning_pdf(app: AppHandle, event_id: Option<String>) -> Result<(), String> {
    let pool = get_db_pool(&app).await?;

    // Récupérer les équipes et actions
    let teams_query = if let Some(ref eid) = event_id {
        format!(
            r#"
            SELECT DISTINCT t.id, t.name
            FROM team t
            JOIN team te ON te.id = t.id
            WHERE te.event_id = '{}'
            ORDER BY t.name ASC
        "#,
            eid
        )
    } else {
        r#"
            SELECT DISTINCT t.id, t.name
            FROM team t
            ORDER BY t.name ASC
        "#
        .to_string()
    };

    let team_rows = sqlx::query_as::<_, (String, String)>(&teams_query)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let pdf_path = app_data.join("planning.pdf");

    // Créer un document PDF simple
    let mut content = String::new();
    content.push_str("%PDF-1.4\n");
    content.push_str("1 0 obj\n");
    content.push_str("<<\n");
    content.push_str("/Type /Catalog\n");
    content.push_str("/Pages 2 0 R\n");
    content.push_str(">>\n");
    content.push_str("endobj\n");
    content.push_str("2 0 obj\n");
    content.push_str("<<\n");
    content.push_str("/Type /Pages\n");
    content.push_str("/Kids [3 0 R]\n");
    content.push_str("/Count 1\n");
    content.push_str(">>\n");
    content.push_str("endobj\n");
    content.push_str("3 0 obj\n");
    content.push_str("<<\n");
    content.push_str("/Type /Page\n");
    content.push_str("/Parent 2 0 R\n");
    content.push_str("/MediaBox [0 0 612 792]\n");
    content.push_str("/Contents 4 0 R\n");
    content.push_str(">>\n");
    content.push_str("endobj\n");
    content.push_str("4 0 obj\n");
    content.push_str("<<\n");
    content.push_str("/Length 500\n");
    content.push_str(">>\n");
    content.push_str("stream\n");
    content.push_str("BT\n");
    content.push_str("/F1 24 Tf\n");
    content.push_str("50 750 Td\n");
    content.push_str("(Planning) Tj\n");
    content.push_str("0 -30 Td\n");

    #[allow(unused_variables)]
    let mut y_offset = 30;
    for (_team_id, team_name) in team_rows {
        content.push_str(&format!("({}) Tj\n", team_name));
        content.push_str("0 -15 Td\n");
        y_offset += 15;
        let actions_query = r#"
            SELECT 
                type,
                equipement_id,
                scheduled_time,
                is_done
            FROM action
            WHERE team_id = ?
            ORDER BY scheduled_time ASC
        "#;

        let action_rows = sqlx::query_as::<_, (String, String, String, bool)>(actions_query)
            .bind(&_team_id)
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

        for (action_type, _equipement_id, _scheduled_time, is_done) in action_rows {
            let status = if is_done { "[Done]" } else { "[Pending]" };
            content.push_str(&format!("  - {} {}) Tj\n", action_type, status));
            content.push_str("0 -10 Td\n");
            y_offset += 10;
        }

        content.push_str("0 -10 Td\n");
        y_offset += 10;
    }

    content.push_str("ET\n");
    content.push_str("endstream\n");
    content.push_str("endobj\n");
    content.push_str("xref\n");
    content.push_str("0 5\n");
    content.push_str("0000000000 65535 f\n");
    content.push_str("0000000009 00000 n\n");
    content.push_str("0000000058 00000 n\n");
    content.push_str("0000000115 00000 n\n");
    content.push_str("0000000203 00000 n\n");
    content.push_str("trailer\n");
    content.push_str("<<\n");
    content.push_str("/Size 5\n");
    content.push_str("/Root 1 0 R\n");
    content.push_str(">>\n");
    content.push_str("startxref\n");
    content.push_str("850\n");
    content.push_str("%%EOF\n");

    let mut file = File::create(&pdf_path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(())
}
