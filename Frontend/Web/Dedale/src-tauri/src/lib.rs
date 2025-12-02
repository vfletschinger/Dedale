// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Emitter;
use tauri::Manager;

mod db;
mod excel;
mod map;
mod pdf;
mod seed;
mod socket;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            // At startup: run DB seed (idempotent) and check if this is the first launch (no users in DB).
            tauri::async_runtime::block_on(async {
                // Ensure schema exists (idempotent) and run seed. Keep output minimal: only show errors.
                match db::get_db_pool(handle).await {
                    Ok(pool) => {
                        if let Err(e) = db::ensure_schema(&pool).await {
                            eprintln!("[db] ensure_schema error: {}", e);
                        }

                        if let Err(e) = seed::seed_database(&pool).await {
                            eprintln!("[seed] error during seeding: {}", e);
                        }

                        // Notify all windows that this might be a first launch.
                        match db::is_first_launch(&pool).await {
                            Ok(true) => {
                                if let Some(window) = handle.get_webview_window("main") {
                                    let _ = window.emit("first-launch", true);
                                }
                            }
                            Ok(false) => {}
                            Err(e) => eprintln!("[db] is_first_launch error: {}", e),
                        }
                    }
                    Err(e) => eprintln!("[db] get_db_pool error: {}", e),
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            excel::export_points_excel,
            pdf::create_pdf,
            map::get_points,
            socket::start_server,
            db::fetch_obstacle_types,
            db::insert_obstacles,
            db::delete_point,
            db::insert_point,
            db::is_first_launch_cmd,
            db::create_initial_admin_cmd,
            db::verify_credentials_cmd,
            db::fetch_events,
            db::fetch_teams,
            db::insert_event,
            db::delete_event,
            db::link_point_to_event,
            db::unlink_point_from_event,
            db::get_points_for_event,
            db::fetch_team_members,
            db::fetch_team_events,
            db::create_team,
            db::delete_team,
            db::fetch_people,
            db::create_person,
            db::delete_person,
            db::add_member,
            db::remove_member,
            db::fetch_person_teams,
            db::add_team_event,
            db::remove_team_event,
            db::update_person,
            db::update_team,
            db::fetch_geometries_for_event,
            db::create_geometry,
            db::delete_geometry,
            db::update_geometry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
