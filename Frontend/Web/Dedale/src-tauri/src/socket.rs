#![allow(dead_code)]

use crate::db::equipements::send_planning;
use crate::db::{get_db_pool, insert_point, PointWithDetails};
use crate::types::*;
use base64::{engine::general_purpose, Engine as _};
use image::codecs::png::PngEncoder;
use image::{ImageEncoder, Luma};
use local_ip_address::local_ip;
use once_cell::sync::Lazy;
use qrcode::QrCode;
use rand::Rng;
use sqlx::{Row, Sqlite, Transaction};
use std::io::Cursor;
use std::net::SocketAddr;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use tungstenite::accept;
use tungstenite::Message;

// ==================== Fonctions helper publiques et testables ====================

/// Génère un port aléatoire dans la plage valide (1025-65534)
pub fn random_port() -> u16 {
    let mut rng = rand::rng();
    rng.random_range(1025..65535)
}

/// Génère des placeholders SQL pour une liste de valeurs (ex: "?, ?, ?")
pub fn generate_sql_placeholders(count: usize) -> String {
    if count == 0 {
        return String::new();
    }
    vec!["?"; count].join(", ")
}

/// Construit une URI WebSocket
pub fn build_websocket_uri(host: &str, port: u16, path: &str) -> String {
    format!("ws://{}:{}{}", host, port, path)
}

/// Génère un QR code en base64 à partir d'une chaîne
pub fn generate_qr_code_base64(data: &str) -> Result<String, String> {
    let code =
        QrCode::new(data.as_bytes()).map_err(|e| format!("Failed to create QR code: {}", e))?;

    let img = code.render::<Luma<u8>>().build();

    let mut buffer = Vec::new();
    let encoder = PngEncoder::new(&mut buffer);

    encoder
        .write_image(
            img.as_raw(),
            img.width(),
            img.height(),
            image::ColorType::L8,
        )
        .map_err(|e| format!("Failed to encode QR code image: {}", e))?;

    let base64_str = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", base64_str))
}

/// Crée une réponse d'accusé de réception
pub fn create_ack_response(code: i32, message: &str) -> String {
    let response = AckResponse {
        code,
        message: message.to_string(),
    };
    serde_json::to_string(&response)
        .unwrap_or_else(|_| format!(r#"{{"code":{},"message":"{}"}}"#, code, message))
}

/// Parse un accusé de réception d'événement
pub fn parse_event_ack(json_str: &str) -> Result<EventAck, String> {
    serde_json::from_str(json_str).map_err(|e| format!("Failed to parse event ack: {}", e))
}

/// Sérialise une liste d'événements de transfert
pub fn serialize_events(events: &[TransferEvent]) -> Result<String, String> {
    serde_json::to_string(events).map_err(|e| format!("Failed to serialize events: {}", e))
}

/// Types de messages WebSocket
#[derive(Debug, Clone, PartialEq)]
pub enum WebSocketMessageType {
    EventAck,
    ExportData,
    Action,
    Unknown,
}

/// Identifie le type de message WebSocket
pub fn identify_message_type(json_str: &str) -> WebSocketMessageType {
    if json_str.contains("\"action\"") {
        WebSocketMessageType::Action
    } else if json_str.contains("\"event\"") && json_str.contains("\"points\"") {
        WebSocketMessageType::ExportData
    } else if json_str.contains("\"id\"") && json_str.contains("\"name\"") {
        WebSocketMessageType::EventAck
    } else {
        WebSocketMessageType::Unknown
    }
}

/// Crée un message d'erreur formaté
pub fn create_error_message(code: i32, description: &str) -> String {
    format!(
        r#"{{"error":true,"code":{},"message":"{}"}}"#,
        code, description
    )
}

/// Crée une adresse socket à partir d'une IP et d'un port
pub fn create_socket_addr(ip: IpAddr, port: u16) -> SocketAddr {
    SocketAddr::new(ip, port)
}

/// Sérialise une réponse d'accusé de réception
pub fn serialize_ack_response(code: i32, message: &str) -> String {
    create_ack_response(code, message)
}

/// Construit une requête SQL pour récupérer des événements par IDs
pub fn build_events_query(event_ids: &[i64]) -> String {
    if event_ids.is_empty() {
        return String::from("SELECT * FROM event WHERE 1=0");
    }

    let placeholders = generate_sql_placeholders(event_ids.len());
    format!(
        "SELECT id, name, description, date_debut, date_fin, statut, geometry FROM event WHERE id IN ({})",
        placeholders
    )
}

/// Vérifie si un port est dans la plage valide
pub fn is_valid_port(port: u16) -> bool {
    (1025..=65534).contains(&port)
}

/// Génère une adresse IP locale par défaut
pub fn get_default_local_ip() -> IpAddr {
    local_ip().unwrap_or(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)))
}

/// Canal global pour envoyer des événements au thread WebSocket
static EVENT_SENDER: Lazy<Mutex<Option<Sender<TransferEvent>>>> = Lazy::new(|| Mutex::new(None));

/// Canal global pour envoyer des messages de contrôle (comme "terminate")
static CONTROL_SENDER: Lazy<Mutex<Option<Sender<String>>>> = Lazy::new(|| Mutex::new(None));

/// Insère les points au format mobile dans la base de données
async fn insert_mobile_points(
    app: &AppHandle,
    event_id: String,
    points: Vec<MobilePointDetail>,
) -> Result<(), String> {
    let pool = get_db_pool(app).await?;
    let mut tx: Transaction<Sqlite> = pool
        .begin()
        .await
        .map_err(|e| format!("Erreur démarrage transaction: {}", e))?;

    for point in &points {
        // Insérer ou mettre à jour le point avec tous les champs (sans created_at/modified_at)
        sqlx::query(
            r#"INSERT OR REPLACE INTO point (id, event_id, x, y, name, type, status, comment) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&point.id)
        .bind(&event_id)
        .bind(point.x)
        .bind(point.y)
        .bind(point.name.as_deref().unwrap_or("Point"))
        .bind(point.point_type.as_deref())
        .bind(point.status.unwrap_or(0))
        .bind(point.comment.as_deref())
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Erreur INSERT point {}: {}", point.id, e))?;

        // Note: Les tables comment et obstacle n'existent pas dans la base web
        // Seule la table picture existe

        // Insérer les images (utiliser image_data au lieu de image)
        for picture in &point.pictures {
            sqlx::query(r#"INSERT OR REPLACE INTO picture (point_id, image_data) VALUES (?, ?)"#)
                .bind(&point.id)
                .bind(&picture.image)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Erreur INSERT picture pour point {}: {}", point.id, e))?;
        }
    }

    tx.commit()
        .await
        .map_err(|e| format!("Erreur commit transaction: {}", e))?;

    Ok(())
}

/// Récupère les events sélectionnés pour le transfert avec leurs parcours, zones et points
/// UNIQUEMENT pour l'export Data - N'inclut JAMAIS teams/actions/équipements
async fn fetch_events_for_transfer(
    app: &AppHandle,
    event_ids: &[String],
) -> Result<Vec<TransferEvent>, String> {
    let pool = get_db_pool(app).await?;

    let mut transfer_events = Vec::new();

    for event_id in event_ids {
        // Récupérer SEULEMENT l'événement de base
        let event_row =
            sqlx::query("SELECT id, name, start_date, end_date FROM event WHERE id = ?")
                .bind(event_id)
                .fetch_optional(&pool)
                .await
                .map_err(|e| format!("Erreur récupération event {}: {}", event_id, e))?;

        if let Some(event_row) = event_row {
            let event_id_str: String = event_row.get("id");

            // Récupérer les parcours de cet événement (DATA EXPORT ONLY)
            let parcours_rows = sqlx::query(
                "SELECT id, event_id, name, color, start_time, speed_low, speed_high, geometry_json 
                 FROM parcours WHERE event_id = ?"
            )
            .bind(&event_id_str)
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("Erreur récupération parcours: {}", e))?;

            let parcours: Vec<TransferParcours> = parcours_rows
                .iter()
                .map(|row| {
                    let start_time_int: Option<i64> = row.try_get("start_time").ok();
                    TransferParcours {
                        id: row.get("id"),
                        event_id: row.get("event_id"),
                        name: row.get("name"),
                        color: row.get("color"),
                        start_time: start_time_int.map(|t| t.to_string()),
                        speed_low: row.get("speed_low"),
                        speed_high: row.get("speed_high"),
                        geometry_json: row.get("geometry_json"),
                    }
                })
                .collect();

            // Récupérer les zones de cet événement (DATA EXPORT ONLY)
            let zones_rows = sqlx::query(
                "SELECT id, event_id, name, color, geometry_json 
                 FROM zone WHERE event_id = ?",
            )
            .bind(&event_id_str)
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("Erreur récupération zones: {}", e))?;

            let zones: Vec<TransferZone> = zones_rows
                .iter()
                .map(|row| TransferZone {
                    id: row.get("id"),
                    event_id: row.get("event_id"),
                    name: row.get("name"),
                    color: row.get("color"),
                    geometry_json: row.get("geometry_json"),
                })
                .collect();

            // Récupérer les points de cet événement (DATA EXPORT ONLY)
            let points_rows = sqlx::query(
                "SELECT id, event_id, x, y, name, comment, type, status 
                 FROM point WHERE event_id = ?",
            )
            .bind(&event_id_str)
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("Erreur récupération points: {}", e))?;

            let points: Vec<TransferPoint> = points_rows
                .iter()
                .map(|row| TransferPoint {
                    id: row.get("id"),
                    event_id: row.get("event_id"),
                    x: row.get("x"),
                    y: row.get("y"),
                    name: row.get("name"),
                    comment: row.get("comment"),
                    point_type: row.get("type"),
                    status: row.get("status"),
                })
                .collect();

            transfer_events.push(TransferEvent {
                id: event_id_str.clone(),
                name: event_row.get("name"),
                start_date: event_row.get("start_date"),
                end_date: event_row.get("end_date"),
                parcours,
                zones,
                points,
            });

            println!(
                "📋 [DATA EXPORT] Event '{}' récupéré avec {} parcours, {} zones, {} points (SANS teams/actions/équipements)",
                event_row.get::<String, _>("name"),
                transfer_events.last().unwrap().parcours.len(),
                transfer_events.last().unwrap().zones.len(),
                transfer_events.last().unwrap().points.len(),
            );
        }
    }

    println!(
        "✅ [DATA EXPORT] {} événement(s) récupéré(s) pour le transfert (SANS données de planning)",
        transfer_events.len()
    );

    Ok(transfer_events)
}

async fn handle_websocket(
    app: &AppHandle,
    mut websocket: tungstenite::WebSocket<std::net::TcpStream>,
    event_ids: Arc<Vec<String>>,
    event_receiver: Receiver<TransferEvent>,
    control_receiver: Receiver<String>,
) -> Result<(), String> {
    println!("📱 Client mobile connecté, en attente d'actions...");

    // Émettre un événement Tauri pour notifier le frontend
    app.emit("mobile-connected", ()).unwrap_or_else(|e| {
        eprintln!("⚠️ Erreur émission événement mobile-connected: {}", e);
    });

    // Passer le socket en mode non-bloquant pour pouvoir vérifier le canal
    websocket
        .get_ref()
        .set_nonblocking(true)
        .map_err(|e| format!("Erreur set_nonblocking: {}", e))?;

    // Envoyer un message de bienvenue avec le nombre d'events disponibles
    let welcome = serde_json::json!({
        "type": "connected",
        "eventCount": event_ids.len(),
        "message": format!("{} événement(s) disponible(s)", event_ids.len())
    });
    websocket
        .write(Message::Text(welcome.to_string().into()))
        .map_err(|e| format!("Erreur envoi welcome: {}", e))?;
    websocket
        .flush()
        .map_err(|e| format!("Erreur flush: {}", e))?;

    // Boucle principale - attendre les actions du client ou les événements du frontend
    loop {
        // Vérifier s'il y a un message de contrôle (comme "terminate")
        if let Ok(control_msg) = control_receiver.try_recv() {
            println!("🛑 Message de contrôle reçu: {}", control_msg);
            if control_msg == "terminate" {
                // Envoyer goodbye au mobile
                let goodbye = serde_json::json!({
                    "type": "goodbye",
                    "message": "Serveur fermé"
                });
                let _ = websocket.write(Message::Text(goodbye.to_string().into()));
                let _ = websocket.flush();
                let _ = websocket.close(None);
                println!("👋 Connexion fermée sur demande du serveur");
                return Ok(());
            }
        }

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
            websocket
                .flush()
                .map_err(|e| format!("Erreur flush: {}", e))?;

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
                                websocket
                                    .flush()
                                    .map_err(|e| format!("Erreur flush: {}", e))?;

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
                        println!(
                            "✅ Accusé de réception reçu pour l'event: {} (id: {})",
                            event_ack.name, event_ack.id
                        );

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

                    // Essayer de parser comme un export mobile (event + points)
                    if let Ok(mobile_export) = serde_json::from_str::<MobileExport>(&text) {
                        let points_count = mobile_export.points.len();
                        let event_name = mobile_export.event.name.clone();
                        let event_id = mobile_export.event.id;

                        println!(
                            "📱 Export mobile reçu: event '{}' (id: {}) avec {} point(s)",
                            event_name, event_id, points_count
                        );

                        // Insérer les points dans la base de données
                        if points_count > 0 {
                            println!(
                                "🚀 Insertion de {} point(s) en base de données...",
                                points_count
                            );
                            match insert_mobile_points(app, event_id.clone(), mobile_export.points)
                                .await
                            {
                                Ok(_) => {
                                    println!("✅ Points insérés avec succès !");
                                    // Émettre un événement pour notifier le frontend
                                    if let Err(e) = app.emit("points-updated", event_id) {
                                        eprintln!(
                                            "⚠️ Erreur émission événement points-updated: {}",
                                            e
                                        );
                                    }
                                }
                                Err(e) => {
                                    eprintln!("❌ Erreur d'insertion des points: {}", e);
                                    let error_response = AckResponse {
                                        code: 1,
                                        message: format!("Erreur insertion points: {}", e),
                                    };
                                    let response_json =
                                        serde_json::to_string(&error_response).unwrap_or_default();
                                    let _ = websocket.write(Message::Text(response_json.into()));
                                    let _ = websocket.flush();
                                    continue;
                                }
                            }
                        }

                        // Envoyer une confirmation de succès
                        let response = AckResponse {
                            code: 3,
                            message: format!(
                                "Event '{}' et {} point(s) reçus avec succès",
                                event_name, points_count
                            ),
                        };
                        let response_json = serde_json::to_string(&response).unwrap_or_default();
                        if let Err(e) = websocket.write(Message::Text(response_json.into())) {
                            eprintln!("⚠️ Erreur envoi confirmation: {}", e);
                        }
                        let _ = websocket.flush();

                        // Émettre événement de déconnexion pour le frontend
                        app.emit("mobile-disconnected", ()).unwrap_or_else(|e| {
                            eprintln!("⚠️ Erreur émission événement mobile-disconnected: {}", e);
                        });

                        // Envoyer goodbye et fermer la connexion après succès
                        let goodbye = serde_json::json!({
                            "type": "goodbye",
                            "message": "Données reçues, connexion fermée"
                        });
                        let _ = websocket.write(Message::Text(goodbye.to_string().into()));
                        let _ = websocket.flush();
                        let _ = websocket.close(None);
                        println!("👋 Connexion fermée après réception réussie");
                        return Ok(());
                    }

                    // Sinon, essayer de parser comme un tableau de PointDetail
                    match serde_json::from_str::<Vec<PointWithDetails>>(&text) {
                        Ok(point_details_vec) => {
                            println!(
                                "🔄 Désérialisation réussie. Nombre de points reçus : {}",
                                point_details_vec.len()
                            );

                            println!("🚀 Début de l'insertion en base de données...");
                            let mut insert_result = Ok(());
                            for point in point_details_vec {
                                if let Err(e) = insert_point(app.clone(), point).await {
                                    insert_result = Err(e);
                                    break;
                                }
                            }
                            match insert_result {
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

                // Émettre événement de déconnexion pour le frontend
                app.emit("mobile-disconnected", ()).unwrap_or_else(|e| {
                    eprintln!("⚠️ Erreur émission événement mobile-disconnected: {}", e);
                });

                // Essayer d'envoyer un message goodbye avant de fermer
                let goodbye = serde_json::json!({
                    "type": "goodbye",
                    "message": "Serveur fermé"
                });
                let _ = websocket.write(Message::Text(goodbye.to_string().into()));
                let _ = websocket.flush();
                let _ = websocket.close(None);

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
pub fn start_server(app: AppHandle, event_ids: Vec<String>) -> Result<String, String> {
    println!(
        "🚀 Démarrage du serveur WebSocket pour {} événement(s)",
        event_ids.len()
    );

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

                            // Créer les canaux pour ce client
                            let (event_sender, event_receiver) = channel::<TransferEvent>();
                            let (control_sender, control_receiver) = channel::<String>();

                            // Stocker les senders globalement
                            if let Ok(mut global_sender) = EVENT_SENDER.lock() {
                                *global_sender = Some(event_sender);
                            }
                            if let Ok(mut global_control) = CONTROL_SENDER.lock() {
                                *global_control = Some(control_sender);
                            }

                            let app_clone = app_for_thread.clone();
                            let event_ids_clone = Arc::clone(&event_ids_arc);
                            thread::spawn(move || {
                                // Create a Tokio runtime to run the async function
                                let rt = tokio::runtime::Runtime::new().unwrap();
                                rt.block_on(async {
                                    if let Err(e) = handle_websocket(
                                        &app_clone,
                                        ws,
                                        event_ids_clone,
                                        event_receiver,
                                        control_receiver,
                                    )
                                    .await
                                    {
                                        eprintln!("Erreur WebSocket: {}", e);
                                    }
                                });

                                // Nettoyer les senders globaux quand la connexion se termine
                                if let Ok(mut global_sender) = EVENT_SENDER.lock() {
                                    *global_sender = None;
                                }
                                if let Ok(mut global_control) = CONTROL_SENDER.lock() {
                                    *global_control = None;
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

/// Envoyer un événement individuel au mobile connecté (DATA EXPORT UNIQUEMENT)
/// N'envoie QUE l'événement + parcours + zones + points
/// PAS de teams, actions ou équipements !
#[tauri::command]
pub async fn send_event_to_mobile(app: AppHandle, event_id: String) -> Result<(), String> {
    println!(
        "📤 [DATA EXPORT] Demande d'envoi de l'événement {} au mobile",
        event_id
    );

    // Utiliser fetch_events_for_transfer qui récupère SEULEMENT event + parcours + zones + points
    let events = fetch_events_for_transfer(&app, std::slice::from_ref(&event_id)).await?;

    let event = events
        .into_iter()
        .next()
        .ok_or_else(|| format!("Event {} non trouvé", event_id))?;

    println!("📋 [DATA EXPORT] Événement récupéré: {} parcours, {} zones, {} points (PAS de teams/actions/équipements)", 
             event.parcours.len(), event.zones.len(), event.points.len());

    // Vérification de sécurité : s'assurer qu'aucune donnée de planning n'est présente
    println!("🔒 [SÉCURITÉ] Envoi DATA uniquement - aucune donnée de planning incluse");

    // Envoyer via le canal global
    let sender = EVENT_SENDER
        .lock()
        .map_err(|e| format!("Erreur lock: {}", e))?
        .clone()
        .ok_or_else(|| "Aucun mobile connecté".to_string())?;

    sender
        .send(event)
        .map_err(|e| format!("Erreur envoi via canal: {}", e))?;

    println!(
        "✅ [DATA EXPORT] Événement {} envoyé avec données géographiques SEULEMENT",
        event_id
    );
    Ok(())
}

/// Terminer le serveur WebSocket et fermer la connexion avec le mobile
#[tauri::command]
pub fn terminate_server() -> Result<(), String> {
    println!("🛑 Demande de fermeture du serveur");

    let sender = CONTROL_SENDER
        .lock()
        .map_err(|e| format!("Erreur lock: {}", e))?
        .clone()
        .ok_or_else(|| "Aucune connexion active".to_string())?;

    sender
        .send("terminate".to_string())
        .map_err(|e| format!("Erreur envoi message terminate: {}", e))?;

    println!("✅ Message de fermeture envoyé au thread WebSocket");
    Ok(())
}

/// Démarrer un serveur WebSocket pour recevoir les données du mobile
#[tauri::command]
pub fn start_receive_server(app: AppHandle, event_id: String) -> Result<String, String> {
    println!(
        "📥 Démarrage du serveur de réception pour l'événement {}",
        event_id
    );

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
        .map_err(|e| format!("Erreur d'écriture PNG: {}", e))?;

    let base64_data = general_purpose::STANDARD.encode(&buffer);

    let app_for_thread = app.clone();

    thread::spawn(move || {
        let listener =
            std::net::TcpListener::bind(socket).expect("Impossible de binder le socket WebSocket");
        println!("📥 Serveur de réception démarré sur {}", socket);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => match accept(stream) {
                    Ok(ws) => {
                        println!("📱 Client mobile connecté pour réception");
                        let app_clone = app_for_thread.clone();
                        let event_id_clone = event_id.clone();

                        thread::spawn(move || {
                            let rt = tokio::runtime::Runtime::new().unwrap();
                            rt.block_on(async {
                                if let Err(e) =
                                    handle_receive_websocket(&app_clone, ws, event_id_clone).await
                                {
                                    eprintln!("Erreur WebSocket réception: {}", e);
                                }
                            });
                        });
                    }
                    Err(e) => eprintln!("Erreur accept WebSocket : {}", e),
                },
                Err(e) => eprintln!("Erreur connexion : {}", e),
            }
        }
    });

    Ok(base64_data)
}

#[tauri::command]
pub fn start_server_planning(app: AppHandle, team_id: String) -> Result<String, String> {
    println!(
        "📥 Démarrage du serveur de réception pour l'envoie des actions {}",
        team_id
    );

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
        .map_err(|e| format!("Erreur d'écriture PNG: {}", e))?;

    let base64_data = general_purpose::STANDARD.encode(&buffer);

    let app_for_thread = app.clone();

    thread::spawn(move || {
        let listener =
            std::net::TcpListener::bind(socket).expect("Impossible de binder le socket WebSocket");
        println!("📥 Serveur de réception démarré sur {}", socket);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => match accept(stream) {
                    Ok(ws) => {
                        println!("📱 Client mobile connecté pour réception");
                        let app_clone = app_for_thread.clone();
                        let team_id_clone = team_id.clone();

                        thread::spawn(move || {
                            let rt = tokio::runtime::Runtime::new().unwrap();
                            rt.block_on(async {
                                if let Err(e) =
                                    handle_receive_planning(&app_clone, ws, team_id_clone).await
                                {
                                    eprintln!("Erreur WebSocket réception: {}", e);
                                }
                            });
                        });
                    }
                    Err(e) => eprintln!("Erreur accept WebSocket : {}", e),
                },
                Err(e) => eprintln!("Erreur connexion : {}", e),
            }
        }
    });

    Ok(base64_data)
}
/// Gère la connexion WebSocket pour recevoir les données du mobile
async fn handle_receive_websocket(
    app: &AppHandle,
    mut websocket: tungstenite::WebSocket<std::net::TcpStream>,
    event_id: String,
) -> Result<(), String> {
    println!("📥 Client connecté pour réception, event_id: {}", event_id);

    // Émettre un événement Tauri pour notifier le frontend
    app.emit("mobile-connected", ()).unwrap_or_else(|e| {
        eprintln!("⚠️ Erreur émission événement mobile-connected: {}", e);
    });

    // Envoyer un message de bienvenue
    let welcome = serde_json::json!({
        "type": "ready_to_receive",
        "eventId": event_id,
        "message": "Prêt à recevoir les données"
    });
    websocket
        .write(Message::Text(welcome.to_string().into()))
        .map_err(|e| format!("Erreur envoi welcome: {}", e))?;
    websocket
        .flush()
        .map_err(|e| format!("Erreur flush: {}", e))?;

    // Boucle de réception
    loop {
        match websocket.read() {
            Ok(msg) => {
                if let Message::Text(text) = msg {
                    println!(
                        "📥 Message reçu: {}...",
                        &text.chars().take(100).collect::<String>()
                    );

                    // Parser comme un export mobile
                    if let Ok(mobile_export) = serde_json::from_str::<MobileExport>(&text) {
                        let points_count = mobile_export.points.len();
                        let event_name = mobile_export.event.name.clone();
                        let event_id = mobile_export.event.id;

                        println!(
                            "📱 Export reçu: '{}' avec {} point(s)",
                            event_name, points_count
                        );

                        if points_count > 0 {
                            println!("🚀 Insertion de {} point(s)...", points_count);
                            match insert_mobile_points(app, event_id.clone(), mobile_export.points)
                                .await
                            {
                                Ok(_) => {
                                    println!("✅ Points insérés avec succès !");

                                    // Émettre un événement pour notifier le frontend
                                    if let Err(e) = app.emit("points-updated", event_id) {
                                        eprintln!(
                                            "⚠️ Erreur émission événement points-updated: {}",
                                            e
                                        );
                                    }
                                }
                                Err(e) => {
                                    eprintln!("❌ Erreur insertion: {}", e);
                                    let error_response = AckResponse {
                                        code: 1,
                                        message: format!("Erreur: {}", e),
                                    };
                                    let response_json =
                                        serde_json::to_string(&error_response).unwrap_or_default();
                                    let _ = websocket.write(Message::Text(response_json.into()));
                                    let _ = websocket.flush();
                                    continue;
                                }
                            }
                        }

                        // Confirmation de succès
                        let response = AckResponse {
                            code: 3,
                            message: format!("{} point(s) reçus", points_count),
                        };
                        let response_json = serde_json::to_string(&response).unwrap_or_default();
                        let _ = websocket.write(Message::Text(response_json.into()));
                        let _ = websocket.flush();
                    } else {
                        // Log l'erreur de parsing pour debug
                        if let Err(e) = serde_json::from_str::<MobileExport>(&text) {
                            println!("⚠️ Erreur parsing MobileExport: {}", e)
                        }
                        println!("⚠️ Format de message non reconnu");
                    }
                }
            }
            Err(e) => {
                eprintln!("📥 Client déconnecté: {}", e);

                // Émettre événement de déconnexion pour le frontend
                app.emit("mobile-disconnected", ()).unwrap_or_else(|e| {
                    eprintln!("⚠️ Erreur émission événement mobile-disconnected: {}", e);
                });

                return Ok(());
            }
        }
    }
}

async fn handle_receive_planning(
    app: &AppHandle,
    mut websocket: tungstenite::WebSocket<std::net::TcpStream>,
    team_id: String,
) -> Result<(), String> {
    println!(
        "📥 [PLANNING EXPORT] Client connecté pour réception, team_id: {}",
        team_id
    );

    // Émettre un événement Tauri pour notifier le frontend
    app.emit("mobile-connected", ()).unwrap_or_else(|e| {
        eprintln!("⚠️ Erreur émission événement mobile-connected: {}", e);
    });

    // Récupérer SEULEMENT les données de planning (teams + actions + équipements)
    let planning = send_planning(team_id.clone(), app.clone()).await?;
    let actions = vec![planning];

    println!("🔒 [SÉCURITÉ] Envoi PLANNING uniquement - teams/actions/équipements SEULEMENT (pas d'events/parcours/zones/points)");

    // Envoyer un message de planning (PAS d'événements géographiques)
    let message = serde_json::json!({
        "type": "planning_data",
        "actions": actions
    });
    websocket
        .write(Message::Text(message.to_string().into()))
        .map_err(|e| format!("Erreur envoi message planning: {}", e))?;
    websocket
        .flush()
        .map_err(|e| format!("Erreur flush: {}", e))?;

    println!("✅ [PLANNING EXPORT] Planning envoyé (teams/actions/équipements uniquement)");

    // Envoyer goodbye et fermer proprement la connexion
    let goodbye = serde_json::json!({
        "type": "goodbye",
        "message": "Planning envoyé avec succès"
    });
    let _ = websocket.write(Message::Text(goodbye.to_string().into()));
    let _ = websocket.flush();
    let _ = websocket.close(None);
    println!("👋 [PLANNING EXPORT] Connexion fermée proprement");

    Ok(())
}
