use crate::db::{get_db_pool, insert_point_details, Event, PointDetail};
use base64::{engine::general_purpose, Engine as _};
use image::Luma;
use local_ip_address::local_ip;
use qrcode::QrCode;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::io::Cursor;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager, State};
use tungstenite::accept;
use tungstenite::Message;
use std::sync::mpsc::{channel, Sender, Receiver};
use once_cell::sync::Lazy;

/// Canal global pour envoyer des événements au thread WebSocket
static EVENT_SENDER: Lazy<Mutex<Option<Sender<TransferEvent>>>> = Lazy::new(|| Mutex::new(None));

/// Structure pour un event envoyé au mobile (avec noms camelCase pour compatibilité)
#[derive(Debug, Serialize, Clone)]
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

/// Structure pour un accusé de réception d'event du mobile
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventAck {
    id: i64,
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    date_debut: Option<String>,
    #[serde(default)]
    date_fin: Option<String>,
    #[serde(default)]
    statut: Option<String>,
    #[serde(default)]
    geometry: Option<String>,
}

/// Réponse envoyée au mobile
#[derive(Debug, Serialize)]
struct AckResponse {
    code: i32,
    message: String,
}

/// Action demandée par le mobile
#[derive(Debug, Deserialize)]
struct ClientAction {
    action: String,
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
    event_receiver: Receiver<TransferEvent>,
) -> Result<(), String> {
    println!("📱 Client mobile connecté, en attente d'actions...");
    
    // Émettre un événement Tauri pour notifier le frontend
    app.emit("mobile-connected", ()).unwrap_or_else(|e| {
        eprintln!("⚠️ Erreur émission événement mobile-connected: {}", e);
    });
    
    // Passer le socket en mode non-bloquant pour pouvoir vérifier le canal
    websocket.get_ref().set_nonblocking(true).map_err(|e| format!("Erreur set_nonblocking: {}", e))?;
    
    // Envoyer un message de bienvenue avec le nombre d'events disponibles
    let welcome = serde_json::json!({
        "type": "connected",
        "eventCount": event_ids.len(),
        "message": format!("{} événement(s) disponible(s)", event_ids.len())
    });
    websocket
        .write(Message::Text(welcome.to_string().into()))
        .map_err(|e| format!("Erreur envoi welcome: {}", e))?;
    websocket.flush().map_err(|e| format!("Erreur flush: {}", e))?;

    // Boucle principale - attendre les actions du client ou les événements du frontend
    loop {
        // Vérifier s'il y a un événement à envoyer depuis le frontend
        if let Ok(event) = event_receiver.try_recv() {
            println!("📤 Envoi de l'événement {} au mobile...", event.id);
            let response = serde_json::json!({
                "type": "event",
                "data": event
            });
            let json_data = serde_json::to_string(&response)
                .map_err(|e| format!("Erreur sérialisation JSON: {}", e))?;
            
            websocket
                .write(Message::Text(json_data.into()))
                .map_err(|e| format!("Erreur envoi événement: {}", e))?;
            websocket.flush().map_err(|e| format!("Erreur flush: {}", e))?;
            
            println!("✅ Événement {} envoyé avec succès !", event.id);
            
            // Émettre un événement pour confirmer l'envoi au frontend
            app.emit("event-sent", event.id).unwrap_or_else(|e| {
                eprintln!("⚠️ Erreur émission événement event-sent: {}", e);
            });
        }
        
        // Vérifier s'il y a un message du client
        match websocket.read() {
            Ok(msg) => {
                println!("Reçu : {}", msg);
                
                if let Message::Text(text) = msg.clone() {
                    // Essayer de parser comme une action du client
                    if let Ok(client_action) = serde_json::from_str::<ClientAction>(&text) {
                        match client_action.action.as_str() {
                            "get_events" => {
                                // Le mobile demande les events
                                println!("📤 Le mobile demande les événements...");
                                
                                let events = fetch_events_for_transfer(app, &event_ids).await?;
                                let response = serde_json::json!({
                                    "type": "events",
                                    "data": events
                                });
                                let json_data = serde_json::to_string(&response)
                                    .map_err(|e| format!("Erreur sérialisation JSON: {}", e))?;

                                println!("📦 Envoi de {} event(s)", events.len());

                                websocket
                                    .write(Message::Text(json_data.into()))
                                    .map_err(|e| format!("Erreur envoi données: {}", e))?;
                                websocket.flush().map_err(|e| format!("Erreur flush: {}", e))?;

                                println!("✅ Événements envoyés avec succès !");
                                continue;
                            }
                            "terminate" => {
                                // Le mobile demande la fermeture
                                println!("🔚 Le mobile demande la fermeture de la connexion");
                                
                                let response = serde_json::json!({
                                    "type": "goodbye",
                                    "message": "Connexion terminée"
                                });
                                let _ = websocket.write(Message::Text(response.to_string().into()));
                                let _ = websocket.flush();
                                
                                // Fermer proprement
                                let _ = websocket.close(None);
                                println!("👋 Connexion fermée proprement");
                                return Ok(());
                            }
                            _ => {
                                println!("⚠️ Action inconnue: {}", client_action.action);
                            }
                        }
                        continue;
                    }
                    
                    // Essayer de parser comme un accusé de réception d'event (objet unique)
                    if let Ok(event_ack) = serde_json::from_str::<EventAck>(&text) {
                        println!("✅ Accusé de réception reçu pour l'event: {} (id: {})", event_ack.name, event_ack.id);
                        
                        // Envoyer une confirmation
                        let response = AckResponse {
                            code: 3,
                            message: format!("Event {} reçu avec succès", event_ack.id),
                        };
                        let response_json = serde_json::to_string(&response).unwrap_or_default();
                        if let Err(e) = websocket.write(Message::Text(response_json.into())) {
                            eprintln!("⚠️ Erreur envoi accusé: {}", e);
                        }
                        let _ = websocket.flush();
                        continue;
                    }
                    
                    // Sinon, essayer de parser comme un tableau de PointDetail
                    match serde_json::from_str::<Vec<PointDetail>>(&text) {
                        Ok(point_details_vec) => {
                            println!(
                                "🔄 Désérialisation réussie. Nombre de points reçus : {}",
                                point_details_vec.len()
                            );

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
                            // Message non reconnu (ni event, ni points)
                            println!("⚠️ Message non reconnu, ignoré: {}", e);
                        }
                    }
                }
            }
            Err(tungstenite::Error::Io(ref e)) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // Pas de message disponible, c'est normal en mode non-bloquant
                // Attendre un peu avant de réessayer
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(e) => {
                eprintln!("Client déconnecté : {}", e);
                // Nettoyer le sender global
                if let Ok(mut sender) = EVENT_SENDER.lock() {
                    *sender = None;
                }
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
                            
                            // Créer le canal pour cet client
                            let (sender, receiver) = channel::<TransferEvent>();
                            
                            // Stocker le sender globalement
                            if let Ok(mut global_sender) = EVENT_SENDER.lock() {
                                *global_sender = Some(sender);
                            }
                            
                            let app_clone = app_for_thread.clone();
                            let event_ids_clone = Arc::clone(&event_ids_arc);
                            thread::spawn(move || {
                                // Create a Tokio runtime to run the async function
                                let rt = tokio::runtime::Runtime::new().unwrap();
                                rt.block_on(async {
                                    if let Err(e) = handle_websocket(&app_clone, ws, event_ids_clone, receiver).await {
                                        eprintln!("Erreur WebSocket: {}", e);
                                    }
                                });
                                
                                // Nettoyer le sender global quand la connexion se termine
                                if let Ok(mut global_sender) = EVENT_SENDER.lock() {
                                    *global_sender = None;
                                }
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

/// Envoyer un événement individuel au mobile connecté
#[tauri::command]
pub async fn send_event_to_mobile(app: AppHandle, event_id: i64) -> Result<(), String> {
    println!("📤 Demande d'envoi de l'événement {} au mobile", event_id);
    
    // Récupérer l'événement depuis la base de données
    let pool = get_db_pool(&app).await?;
    
    let row = sqlx::query(
        "SELECT id, name, description, date_debut, date_fin, statut, geometry FROM event WHERE id = ?"
    )
    .bind(event_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Erreur récupération event: {}", e))?
    .ok_or_else(|| format!("Event {} non trouvé", event_id))?;
    
    let event = TransferEvent {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        date_debut: row.get("date_debut"),
        date_fin: row.get("date_fin"),
        statut: row.get("statut"),
        geometry: row.get("geometry"),
    };
    
    // Envoyer via le canal global
    let sender = EVENT_SENDER.lock()
        .map_err(|e| format!("Erreur lock: {}", e))?
        .clone()
        .ok_or_else(|| "Aucun mobile connecté".to_string())?;
    
    sender.send(event)
        .map_err(|e| format!("Erreur envoi via canal: {}", e))?;
    
    Ok(())
}
