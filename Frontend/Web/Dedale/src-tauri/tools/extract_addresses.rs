// Script d'extraction des adresses depuis le fichier OSM PBF
// Exécuter une seule fois avec: cargo run --bin extract_addresses

use osmpbf::{Element, ElementReader};
use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::Path;

// Bounding box de toute l'Alsace (Bas-Rhin + Haut-Rhin)
// Étendue pour capturer toutes les adresses de la région
const MIN_LAT: f64 = 47.40; // Sud de l'Alsace (Mulhouse et au-delà)
const MAX_LAT: f64 = 49.10; // Nord de l'Alsace (Wissembourg)
const MIN_LON: f64 = 6.80; // Ouest (Vosges)
const MAX_LON: f64 = 8.30; // Est (bord du Rhin)

#[derive(Debug, Clone)]
struct Address {
    lat: f64,
    lon: f64,
    housenumber: String,
    street: String,
    city: String,
    postcode: String,
}

fn main() -> Result<(), Box<dyn Error>> {
    // Chemin vers le fichier PBF
    let pbf_path = "../public/alsace-latest.osm.pbf";

    // Chemin vers la base SQLite de sortie
    let db_path = "./resources/addresses.db";

    println!("🔍 Lecture du fichier PBF: {}", pbf_path);

    if !Path::new(pbf_path).exists() {
        eprintln!("❌ Fichier PBF non trouvé: {}", pbf_path);
        return Err("Fichier PBF non trouvé".into());
    }

    // Supprimer l'ancienne base si elle existe
    if Path::new(db_path).exists() {
        fs::remove_file(db_path)?;
    }

    // Créer la connexion SQLite
    let conn = rusqlite::Connection::open(db_path)?;

    // Créer les tables avec FTS5 pour la recherche full-text
    conn.execute_batch(
        "
        CREATE TABLE addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            housenumber TEXT,
            street TEXT NOT NULL,
            city TEXT,
            postcode TEXT,
            display_name TEXT NOT NULL
        );
        
        CREATE VIRTUAL TABLE addresses_fts USING fts5(
            display_name,
            content='addresses',
            content_rowid='id'
        );
        
        CREATE TRIGGER addresses_ai AFTER INSERT ON addresses BEGIN
            INSERT INTO addresses_fts(rowid, display_name) VALUES (new.id, new.display_name);
        END;
        ",
    )?;

    println!("📊 Base de données créée: {}", db_path);
    println!("🗺️ Filtrage sur toute l'Alsace:");
    println!("   Latitude: {:.2}° - {:.2}°", MIN_LAT, MAX_LAT);
    println!("   Longitude: {:.2}° - {:.2}°", MIN_LON, MAX_LON);

    // Lire le fichier PBF
    let _reader = ElementReader::from_path(pbf_path)?;

    // Collecter les nœuds avec leurs coordonnées
    let mut node_coords: HashMap<i64, (f64, f64)> = HashMap::new();
    let mut addresses: Vec<Address> = Vec::new();

    // Premier passage: collecter les coordonnées des nœuds
    println!("📍 Premier passage: collecte des coordonnées...");
    let reader = ElementReader::from_path(pbf_path)?;
    reader.for_each(|element| {
        if let Element::DenseNode(node) = element {
            let lat = node.lat();
            let lon = node.lon();

            // Filtrer par bounding box
            if (MIN_LAT..=MAX_LAT).contains(&lat) && (MIN_LON..=MAX_LON).contains(&lon) {
                node_coords.insert(node.id, (lat, lon));

                // Vérifier si ce nœud a des tags d'adresse
                let tags: HashMap<_, _> = node.tags().collect();
                if let Some(street) = tags.get("addr:street") {
                    let addr = Address {
                        lat,
                        lon,
                        housenumber: tags
                            .get("addr:housenumber")
                            .map(|s| s.to_string())
                            .unwrap_or_default(),
                        street: street.to_string(),
                        city: tags
                            .get("addr:city")
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| "Strasbourg".to_string()),
                        postcode: tags
                            .get("addr:postcode")
                            .map(|s| s.to_string())
                            .unwrap_or_default(),
                    };
                    addresses.push(addr);
                }
            }
        }
    })?;

    println!("   {} nœuds dans la zone", node_coords.len());
    println!("   {} adresses trouvées sur les nœuds", addresses.len());

    // Deuxième passage: collecter les adresses des ways
    println!("🏠 Deuxième passage: collecte des adresses sur les bâtiments...");
    let reader = ElementReader::from_path(pbf_path)?;
    reader.for_each(|element| {
        if let Element::Way(way) = element {
            let tags: HashMap<_, _> = way.tags().collect();

            if let Some(street) = tags.get("addr:street") {
                // Calculer le centroïde du way
                let refs: Vec<i64> = way.refs().collect();
                let coords: Vec<(f64, f64)> = refs
                    .iter()
                    .filter_map(|id| node_coords.get(id).copied())
                    .collect();

                if !coords.is_empty() {
                    let (sum_lat, sum_lon) = coords
                        .iter()
                        .fold((0.0, 0.0), |acc, (lat, lon)| (acc.0 + lat, acc.1 + lon));
                    let lat = sum_lat / coords.len() as f64;
                    let lon = sum_lon / coords.len() as f64;

                    // Vérifier que le centroïde est dans la zone
                    if (MIN_LAT..=MAX_LAT).contains(&lat) && (MIN_LON..=MAX_LON).contains(&lon) {
                        let addr = Address {
                            lat,
                            lon,
                            housenumber: tags
                                .get("addr:housenumber")
                                .map(|s| s.to_string())
                                .unwrap_or_default(),
                            street: street.to_string(),
                            city: tags
                                .get("addr:city")
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| "Strasbourg".to_string()),
                            postcode: tags
                                .get("addr:postcode")
                                .map(|s| s.to_string())
                                .unwrap_or_default(),
                        };
                        addresses.push(addr);
                    }
                }
            }
        }
    })?;

    println!("   {} adresses totales trouvées", addresses.len());

    // Insérer les adresses dans SQLite
    println!("💾 Insertion dans la base de données...");
    let mut stmt = conn.prepare(
        "INSERT INTO addresses (lat, lon, housenumber, street, city, postcode, display_name) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )?;

    for addr in &addresses {
        let display_name = if addr.housenumber.is_empty() {
            format!("{}, {}", addr.street, addr.city)
        } else {
            format!("{} {}, {}", addr.housenumber, addr.street, addr.city)
        };

        stmt.execute(rusqlite::params![
            addr.lat,
            addr.lon,
            addr.housenumber,
            addr.street,
            addr.city,
            addr.postcode,
            display_name
        ])?;
    }

    // Optimiser la base
    conn.execute("ANALYZE", [])?;

    let file_size = fs::metadata(db_path)?.len();
    println!("✅ Extraction terminée!");
    println!("   {} adresses exportées", addresses.len());
    println!(
        "   Taille de la base: {:.2} MB",
        file_size as f64 / 1_048_576.0
    );

    Ok(())
}
