// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{Emitter, Manager};

mod db;
mod excel;
mod geocoding;
mod map;
mod map_pdf;
mod pdf;
mod pmtiles;
mod seed;
mod socket;
mod types;
mod utils;

#[cfg(test)]
mod tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            // Exécution asynchrone pour ne pas bloquer le thread principal au démarrage
            tauri::async_runtime::spawn(async move {
                // 1. Initialisation de la base de données
                match db::get_db_pool(&handle).await {
                    Ok(pool) => {
                        // 2. Seeding (idempotent)

                        // 3. Vérification du premier lancement
                        match db::is_first_launch(&pool).await {
                            Ok(true) => {
                                if let Some(window) = handle.get_webview_window("main") {
                                    let _ = window.emit("first-launch", true);
                                }
                            }
                            Ok(false) => (),
                            Err(e) => eprintln!("[db] Erreur is_first_launch : {}", e),
                        }
                    }
                    Err(e) => eprintln!("[db] Erreur get_db_pool : {}", e),
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
            pdf::create_team_mission_pdf,
            map::get_points,
            socket::start_server,
            socket::send_event_to_mobile,
            socket::terminate_server,
            socket::start_receive_server,
            socket::start_server_planning,
            db::fetch_obstacle_types,
            db::delete_point,
            db::insert_point,
            db::is_first_launch_cmd,
            db::create_initial_admin_cmd,
            db::verify_credentials_cmd,
            db::fetch_events,
            db::fetch_teams,
            db::insert_event,
            db::delete_event,
            db::update_event,
            db::duplicate_event,
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
            db::delete_geometry,
            db::update_geometry,
            db::update_point_dates,
            db::update_parcours,
            db::update_zone,
            db::create_zone,
            db::create_parcours,
            db::delete_zone,
            db::delete_parcours,
            db::fetch_points,
            db::update_point,
            db::fetch_zones_for_event,
            db::fetch_parcours_for_event,
            db::create_interest_point,
            db::update_interest_point,
            db::delete_interest_point,
            db::fetch_interest_points,
            // Équipements
            db::fetch_equipment_types,
            db::create_equipment_type,
            db::seed_default_equipment_types,
            db::create_equipement,
            db::fetch_equipements_for_event,
            db::delete_equipement,
            db::update_equipement,
            db::add_action,
            db::fetch_actions,
            db::delete_action,
            db::fetch_team_actions,
            geocoding::search_address,
            db::fetch_teams_for_event,
            db::fetch_teams_with_actions_for_event,
            db::fetch_actions_for_team,
            db::fetch_actions_for_equipement,
            db::update_action_status,
            db::export_planning_excel,
            db::create_planning_pdf,
            db::send_equipements_to_mobile,
            db::send_planning,
            pmtiles::get_pmtiles_file_path,
            geocoding::reverse_geocode,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors de l'exécution de l'application Tauri");
}
