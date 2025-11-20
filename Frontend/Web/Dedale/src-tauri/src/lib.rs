// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod db;
mod excel;
mod pdf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(db::init_db())
        .invoke_handler(tauri::generate_handler![
            excel::export_points_excel,
            pdf::create_pdf,
            get_points
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn get_points(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let pts = crate::db::retrieve_data(&app).await?;
    serde_json::to_value(pts).map_err(|e| e.to_string())
}
