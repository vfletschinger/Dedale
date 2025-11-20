// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod db;
mod excel;
mod pdf;
mod map;

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
            map::get_points
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
