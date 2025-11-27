use crate::db::insert_point_details;
use crate::db::PointDetail;
use base64::{engine::general_purpose, Engine as _};
use image::Luma;
use local_ip_address::local_ip;
use qrcode::QrCode;
use rand::Rng;
use std::io::Cursor;
use std::net::SocketAddr;
use std::thread;
use tauri::AppHandle;
use tungstenite::accept;
use tungstenite::Message;

fn random_port() -> u16 {
    let mut rng = rand::rng();
    rng.random_range(1025..65535)
}

async fn handle_websocket(
    app: &AppHandle,
    mut websocket: tungstenite::WebSocket<std::net::TcpStream>,
) -> Result<(), String> {
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
pub fn start_server(app: AppHandle) -> Result<String, String> {
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
                            thread::spawn(move || {
                                // Create a Tokio runtime to run the async function
                                let rt = tokio::runtime::Runtime::new().unwrap();
                                rt.block_on(async {
                                    if let Err(e) = handle_websocket(&app_clone, ws).await {
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
