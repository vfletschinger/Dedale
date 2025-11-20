#[tauri::command]
pub async fn get_points(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let pts = crate::db::retrieve_data(&app).await?;
    serde_json::to_value(pts).map_err(|e| e.to_string())
}
