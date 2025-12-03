use crate::db::{get_db_pool, insert_point_details, Event, PointDetail};
use base64::{engine::general_purpose, Engine as _};
use image::Luma;
use local_ip_address::local_ip;
use qrcode::QrCode;
use rand::Rng;
use serde::Serialize;
use sqlx::Row;
use std::io::Cursor;
use std::net::SocketAddr;
use std::sync::Arc;
use std::thread;
use tauri::AppHandle;
use tungstenite::accept;
use tungstenite::Message;

/// Structure pour un event envoyé au mobile (avec noms camelCase pour compatibilité)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferEvent {
    id: i64,
    name: String,
    description: String,
    date_debut: String,
    date_fin: String,
    statut: String,
    geometry: Option<String>,
}

fn random_port() -> u16 {
    let mut rng = rand::rng();
    rng.random_range(1025..65535)
}

/// Récupère les events sélectionnés pour le transfert
async fn fetch_events_for_transfer(app: &AppHandle, event_ids: &[i64]) -> Result<Vec<TransferEvent>, String> {
    let pool = get_db_pool(app).await?;

    // Récupérer les events sélectionnés
    let event_ids_placeholder = event_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");

    let events_query = format!(
        "SELECT id, name, description, date_debut, date_fin, statut, geometry FROM event WHERE id IN ({})",
        event_ids_placeholder
    );

    let mut query = sqlx::query(&events_query);
    for id in event_ids {
        query = query.bind(id);
    }

    let event_rows = query
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Erreur récupération events: {}", e))?;

    let events: Vec<TransferEvent> = event_rows
        .iter()
        .map(|row| TransferEvent {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            date_debut: row.get("date_debut"),
            date_fin: row.get("date_fin"),
            statut: row.get("statut"),
            geometry: row.get("geometry"),
        })
        .collect();

    println!("📋 {} event(s) récupéré(s) pour le transfert", events.len());

    Ok(events)
}

async fn handle_websocket(
    app: &AppHandle,
    mut websocket: tungstenite::WebSocket<std::net::TcpStream>,
    event_ids: Arc<Vec<i64>>,
) -> Result<(), String> {
    // Envoyer les events dès la connexion
    println!("📤 Envoi des événements au client mobile...");
    
    let events = fetch_events_for_transfer(app, &event_ids).await?;
    let json_data = serde_json::to_string(&events)
        .map_err(|e| format!("Erreur sérialisation JSON: {}", e))?;

    println!("📦 Taille des données: {} octets ({} event(s))", json_data.len(), events.len());

    websocket
        .write(Message::Text(json_data.into()))
        .map_err(|e| format!("Erreur envoi données: {}", e))?;

    websocket
        .flush()
        .map_err(|e| format!("Erreur flush: {}", e))?;

    println!("✅ Événements envoyés avec succès !");

    // Continuer à écouter les messages du client
    loop {
        match websocket.read() {
            Ok(msg) => {
                println!("Reçu : {}", msg);
                // insert de donnée
                let mut should_echo = true;
                if let Message::Text(text) = msg.clone() {
                    match serde_json::from_str::<Vec<PointDetail>>(&text) {
                        Ok(point_details_vec) => {
                            println!(
                                "🔄 Désérialisation réussie. Nombre de points reçus : {}",
                                point_details_vec.len()
                            );
                            should_echo = false; // Ne pas renvoyer le message original

                            println!("🚀 Début de l'insertion en base de données...");
                            match insert_point_details(&app, point_details_vec).await {
                                Ok(_) => {
                                    println!("✅ Insertion terminée avec succès ! Envoi du message 'fini'...");

                                    // Envoyer un message de confirmation
                                    let success_msg = Message::Text("fini".to_string().into());
                                    match websocket.write(success_msg) {
                                        Ok(_) => {
                                            println!("📤 Message 'fini' envoyé avec succès !");
                                            // Force le flush du message
                                            if let Err(e) = websocket.flush() {
                                                eprintln!("⚠️ Erreur flush WebSocket : {}", e);
                                            } else {
                                                println!("🔄 WebSocket flush réussi");
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("❌ Erreur envoi message 'fini' : {}", e);
                                            return Err(format!(
                                                "Erreur envoi message 'fini' : {}",
                                                e
                                            ));
                                        }
                                    }

                                    // Attendre un peu pour s'assurer que le message est envoyé
                                    std::thread::sleep(std::time::Duration::from_millis(100));
                                }
                                Err(e) => {
                                    eprintln!("❌ Erreur d'insertion dans la DB : {}", e);
                                    // Envoyer un message d'erreur
                                    let error_msg = Message::Text(format!("erreur: {}", e).into());
                                    match websocket.write(error_msg) {
                                        Ok(_) => {
                                            println!("📤 Message d'erreur envoyé avec succès !");
                                            if let Err(e) = websocket.flush() {
                                                eprintln!(
                                                    "⚠️ Erreur flush WebSocket (erreur) : {}",
                                                    e
                                                );
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("Erreur envoi message d'erreur : {}", e);
                                            return Err(format!(
                                                "Erreur envoi message d'erreur : {}",
                                                e
                                            ));
                                        }
                                    }
                                    std::thread::sleep(std::time::Duration::from_millis(100));
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Erreur de désérialisation JSON : {}", e);
                            should_echo = false; // Ne pas renvoyer le message original
                                                 // Envoyer un message d'erreur de désérialisation
                            let error_msg = Message::Text(format!("erreur_json: {}", e).into());
                            match websocket.write(error_msg) {
                                Ok(_) => {
                                    println!("📤 Message d'erreur JSON envoyé avec succès !");
                                    if let Err(e) = websocket.flush() {
                                        eprintln!(
                                            "⚠️ Erreur flush WebSocket (erreur JSON) : {}",
                                            e
                                        );
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Erreur envoi message d'erreur JSON : {}", e);
                                    return Err(format!(
                                        "Erreur envoi message d'erreur JSON : {}",
                                        e
                                    ));
                                }
                            }
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                    }
                }

                // Ne renvoyer le message original que si ce n'est pas des données JSON à traiter
                if should_echo {
                    if let Err(e) = websocket.write(msg) {
                        eprintln!("Erreur écriture message : {}", e);
                        return Err(format!("Erreur d'écriture WebSocket : {}", e));
                    }
                }
            }
            Err(e) => {
                eprintln!("Client déconnecté : {}", e);
                return Ok(());
            }
        }
    }
}

#[tauri::command]
pub fn start_server(app: AppHandle, event_ids: Vec<i64>) -> Result<String, String> {
    println!("🚀 Démarrage du serveur WebSocket pour {} événement(s)", event_ids.len());
    
    let ip = local_ip().map_err(|e| e.to_string())?;
    let port = random_port();
    let socket = SocketAddr::new(ip, port);

    let ws_uri = format!("ws://{}:{}", ip, port);

    let code = QrCode::new(ws_uri.as_bytes()).map_err(|e| e.to_string())?;

    let image = code.render::<Luma<u8>>().min_dimensions(256, 256).build();

    let mut buffer = Vec::new();

    let mut cursor = Cursor::new(&mut buffer);

    image::DynamicImage::ImageLuma8(image)
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Erreur d'écriture PNG dans le buffer: {}", e))?;

    let base64_data = general_purpose::STANDARD.encode(&buffer);

    let app_for_thread = app.clone();
    let event_ids_arc = Arc::new(event_ids);

    thread::spawn(move || {
        let listener =
            std::net::TcpListener::bind(socket).expect("Impossible de binder le socket WebSocket");
        println!("Serveur WebSocket démarré sur {}", socket);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    match accept(stream) {
                        Ok(ws) => {
                            println!("Client WebSocket connecté");
                            let app_clone = app_for_thread.clone();
                            let event_ids_clone = Arc::clone(&event_ids_arc);
                            thread::spawn(move || {
                                // Create a Tokio runtime to run the async function
                                let rt = tokio::runtime::Runtime::new().unwrap();
                                rt.block_on(async {
                                    if let Err(e) = handle_websocket(&app_clone, ws, event_ids_clone).await {
                                        eprintln!("Erreur WebSocket: {}", e);
                                    }
                                });
                            });
                        }
                        Err(e) => eprintln!("Erreur accept WebSocket : {}", e),
                    }
                }
                Err(e) => eprintln!("Erreur connexion : {}", e),
            }
        }
    });

    Ok(base64_data)
}
