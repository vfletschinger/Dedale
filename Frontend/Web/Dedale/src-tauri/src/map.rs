#[tauri::command]
pub async fn get_points(
    app: tauri::AppHandle,
    event_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    println!("[MAP] 📍 get_points appelé avec event_id: {:?}", event_id);
    let pts = crate::db::retrieve_data_by_event(&app, event_id).await?;
    serde_json::to_value(pts).map_err(|e| e.to_string())
}
