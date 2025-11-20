use rand::Rng;
use std::net::SocketAddr;
use qrcode::QrCode;
use std::path::PathBuf;
use image::Luma;
use tungstenite::accept;
use local_ip_address::local_ip;
use std::thread;

fn random_port() -> u16 {
    let mut rng = rand::rng();
    rng.random_range(1025..65535)
}

#[tauri::command]
pub fn create_qrcode(data: String) -> Result<String, String> {
    let code = QrCode::new(data.as_bytes()).map_err(|e| e.to_string())?;

    let image = code
        .render::<Luma<u8>>()
        .min_dimensions(256, 256)
        .build();

    let mut path: PathBuf = std::env::temp_dir();
    path.push("dedale_qrcode.png");

    image
        .save(&path)
        .map_err(|e| format!("Erreur sauvegarde QR PNG: {}", e))?;

    Ok(path.to_string_lossy().to_string())
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
    let ip = local_ip().map_err(|e| e.to_string())?;
    let port = random_port();
    let socket = SocketAddr::new(ip, port);

    let temp = format!("{}:{}", ip, port);
    let _ = create_qrcode(temp.clone());

    // Lancer le serveur WebSocket dans un thread
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
                            handle_websocket(ws);
                        }
                        Err(e) => eprintln!("Erreur accept WebSocket : {}", e),
                    }
                }
                Err(e) => eprintln!("Erreur connexion : {}", e),
            }
        }
    });

    Ok(format!("Serveur WebSocket démarré sur {}:{}", ip, port))
}
