use rand::Rng;
use std::net::SocketAddr;
use qrcode::QrCode;
use std::path::PathBuf;
use image::Luma;
use tungstenite::accept;
use local_ip_address::local_ip;
use std::thread;
use base64::{engine::general_purpose, Engine as _};
use std::io::{Cursor, Write};

fn random_port() -> u16 {
    let mut rng = rand::rng();
    rng.random_range(1025..65535)
}

// --- Nouveau handle WebSocket ---
fn handle_websocket(mut websocket: tungstenite::WebSocket<std::net::TcpStream>) {
    loop {
        match websocket.read() {
            Ok(msg) => {
                println!("Reçu : {}", msg);
                // Répond en echo (ou traite les données SQLite ici)
                if let Err(e) = websocket.write(msg) {
                    eprintln!("Erreur écriture message : {}", e);
                    break;
                }
            }
            Err(e) => {
                eprintln!("Client déconnecté : {}", e);
                break;
            }
        }
    }
}

#[tauri::command]
pub fn start_server() -> Result<String, String> {
    // 1. Déterminer l'IP et le Port
    let ip = local_ip().map_err(|e| e.to_string())?;
    let port = random_port();
    let socket = SocketAddr::new(ip, port);
    
    let ws_uri = format!("ws://{}:{}", ip, port); 

    let code = QrCode::new(ws_uri.as_bytes()).map_err(|e| e.to_string())?;

    let image = code
        .render::<Luma<u8>>()
        .min_dimensions(256, 256)
        .build();

    let mut buffer = Vec::new();
    
    // 2. Encapsuler le buffer dans un Cursor. 
    // Le Cursor implémente Seek et Write, satisfaisant ainsi les exigences de write_to.
    let mut cursor = Cursor::new(&mut buffer);

    // Écrire l'image dans le Cursor. write_to nécessite un mut Write + Seek
    image::DynamicImage::ImageLuma8(image).write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Erreur d'écriture PNG dans le buffer: {}", e))?;

    // 3. Encoder le buffer (qui est maintenant rempli) en Base64
    let base64_data = general_purpose::STANDARD.encode(&buffer);


    // 3. Lancer le serveur WebSocket dans un thread
    thread::spawn(move || {
        let listener = std::net::TcpListener::bind(socket)
            .expect("Impossible de binder le socket WebSocket");
        println!("Serveur WebSocket démarré sur {}", socket);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    match accept(stream) {
                        Ok(ws) => {
                            println!("Client WebSocket connecté");
                            thread::spawn(|| handle_websocket(ws)); 
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