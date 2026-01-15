use crate::pmtiles::get_pmtiles_file_path;
use crate::types::Parcours;
use ::pmtiles::{AsyncPmTilesReader, TileCoord};
use image::{DynamicImage, GenericImage, GenericImageView, ImageFormat, Rgba};
use std::path::Path;

pub struct CroppedMap {
    pub image_path: String,
    pub zoom: u8,
    pub tile_origin_x: u32,
    pub tile_origin_y: u32,
    pub width_tiles: u32,
    pub height_tiles: u32,
}

// 2. AJOUT DE LA MÉTHODE DE CALCUL
impl CroppedMap {
    pub fn get_percent_pos(&self, lon: f64, lat: f64) -> (f64, f64) {
        let n = 2.0f64.powi(self.zoom as i32);

        // Formule Mercator Exacte
        let x_world = (lon + 180.0) / 360.0 * n;
        let lat_rad = lat.to_radians();
        let y_world =
            (1.0 - (lat_rad.tan() + 1.0 / lat_rad.cos()).ln() / std::f64::consts::PI) / 2.0 * n;

        let rel_x = x_world - self.tile_origin_x as f64;
        let rel_y = y_world - self.tile_origin_y as f64;

        let pct_x = rel_x / self.width_tiles as f64;
        let pct_y = rel_y / self.height_tiles as f64;

        (pct_x, pct_y)
    }
}

// --- MATHS (Retourne des u32) ---

fn lon_lat_to_tile(lon: f64, lat: f64, zoom: u8) -> (u32, u32) {
    let n = 2.0f64.powi(zoom as i32);
    let x = ((lon + 180.0) / 360.0 * n) as u32;
    let lat_rad = lat.to_radians();
    let y = ((1.0 - (lat_rad.tan() + 1.0 / lat_rad.cos()).ln() / std::f64::consts::PI) / 2.0 * n)
        as u32;
    (x, y)
}

fn tile_to_lon_lat(x: u32, y: u32, zoom: u8) -> (f64, f64) {
    let n = 2.0f64.powi(zoom as i32);
    let lon = x as f64 / n * 360.0 - 180.0;
    let lat_rad = (std::f64::consts::PI * (1.0 - 2.0 * y as f64 / n))
        .sinh()
        .atan();
    let lat = lat_rad.to_degrees();
    (lon, lat)
}

// --- UTILITAIRES POUR PARSER WKT ET TRACER DES LIGNES ---

/// Parse une chaîne WKT LINESTRING et retourne une liste de coordonnées (lon, lat)
fn parse_linestring_wkt(wkt: &str) -> Vec<(f64, f64)> {
    // Format: "LINESTRING(lon1 lat1, lon2 lat2, ...)"
    let wkt = wkt.trim();
    if !wkt.to_uppercase().starts_with("LINESTRING") {
        return vec![];
    }

    // Extraire le contenu entre les parenthèses
    if let Some(start) = wkt.find('(') {
        if let Some(end) = wkt.rfind(')') {
            let coords_str = &wkt[start + 1..end];
            let pairs: Vec<&str> = coords_str.split(',').collect();

            let mut coords = vec![];
            for pair in pairs {
                let parts: Vec<&str> = pair.split_whitespace().collect();
                if parts.len() >= 2 {
                    if let (Ok(lon), Ok(lat)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                        coords.push((lon, lat));
                    }
                }
            }
            return coords;
        }
    }
    vec![]
}

/// Parse une chaîne WKT POLYGON et retourne une liste de coordonnées (lon, lat)
fn parse_polygon_wkt(wkt: &str) -> Vec<(f64, f64)> {
    // Format: "POLYGON((lon1 lat1, lon2 lat2, ..., lon1 lat1))"
    let wkt = wkt.trim();
    if !wkt.to_uppercase().starts_with("POLYGON") {
        return vec![];
    }

    // Extraire le contenu du premier anneau (outer ring)
    if let Some(start) = wkt.find('(') {
        // Trouver la fin du premier anneau (pas du dernier ')')
        if let Some(first_paren_close) = wkt[start + 1..].find(')') {
            let inner_coords = &wkt[start + 1..start + 1 + first_paren_close];
            let pairs: Vec<&str> = inner_coords.split(',').collect();

            let mut coords = vec![];
            for pair in pairs {
                let parts: Vec<&str> = pair.split_whitespace().collect();
                if parts.len() >= 2 {
                    if let (Ok(lon), Ok(lat)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                        coords.push((lon, lat));
                    }
                }
            }
            return coords;
        }
    }
    vec![]
}

/// Convertit une couleur hexadécimale en RGBA
/// Format attendu: "#RRGGBB" ou "RRGGBB"
fn hex_to_rgba(hex: &str) -> Rgba<u8> {
    let hex = hex.trim_start_matches('#');
    let (r, g, b) = if hex.len() == 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(239);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(68);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(68);
        (r, g, b)
    } else {
        (239, 68, 68) // Couleur par défaut (rouge)
    };
    Rgba([r, g, b, 255])
}

/// Trace une ligne sur l'image avec anti-aliasing basique
fn draw_line(
    img: &mut DynamicImage,
    x1: u32,
    y1: u32,
    x2: u32,
    y2: u32,
    color: Rgba<u8>,
    thickness: u32,
) {
    let (x1, y1, x2, y2) = (x1 as i32, y1 as i32, x2 as i32, y2 as i32);
    let width = img.width() as i32;
    let height = img.height() as i32;

    let dx = (x2 - x1).abs();
    let dy = (y2 - y1).abs();
    let steps = dx.max(dy);

    if steps == 0 {
        return;
    }

    for i in 0..=steps {
        let x = x1 + (x2 - x1) * i / steps;
        let y = y1 + (y2 - y1) * i / steps;

        // Tracer le point et ses alentours pour l'épaisseur
        for dx in 0..(thickness as i32) {
            for dy in 0..(thickness as i32) {
                let px = x + dx;
                let py = y + dy;
                if px >= 0 && px < width && py >= 0 && py < height {
                    img.put_pixel(px as u32, py as u32, color);
                }
            }
        }
    }
}

/// Remplit un polygone avec une couleur semi-transparente
fn fill_polygon(img: &mut DynamicImage, coords_pixel: &[(u32, u32)], color: Rgba<u8>) {
    if coords_pixel.len() < 3 {
        return;
    }

    let width = img.width();
    let height = img.height();

    // Obtenir les limites du polygone
    let min_x = coords_pixel.iter().map(|(x, _)| *x).min().unwrap_or(0);
    let max_x = coords_pixel.iter().map(|(x, _)| *x).max().unwrap_or(0);
    let min_y = coords_pixel.iter().map(|(_, y)| *y).min().unwrap_or(0);
    let max_y = coords_pixel.iter().map(|(_, y)| *y).max().unwrap_or(0);

    let alpha = (color.0[3] as f64) / 255.0;

    // Pour chaque pixel dans la bounding box
    for py in min_y..=max_y {
        if py >= height {
            continue;
        }

        for px in min_x..=max_x {
            if px >= width {
                continue;
            }

            // Vérifier si le point est à l'intérieur du polygone (ray casting)
            if point_in_polygon(px as f64, py as f64, coords_pixel) {
                let existing_pixel = img.get_pixel(px, py);

                // Blending alpha correct
                let r =
                    (color.0[0] as f64 * alpha + existing_pixel[0] as f64 * (1.0 - alpha)) as u8;
                let g =
                    (color.0[1] as f64 * alpha + existing_pixel[1] as f64 * (1.0 - alpha)) as u8;
                let b =
                    (color.0[2] as f64 * alpha + existing_pixel[2] as f64 * (1.0 - alpha)) as u8;
                let a = 255u8;

                img.put_pixel(px, py, Rgba([r, g, b, a]));
            }
        }
    }
}

/// Algorithme ray casting pour vérifier si un point est dans un polygone
fn point_in_polygon(x: f64, y: f64, polygon: &[(u32, u32)]) -> bool {
    let mut inside = false;
    let n = polygon.len();

    for i in 0..n {
        let (x1, y1) = polygon[i];
        let (x2, y2) = polygon[(i + 1) % n];

        let x1 = x1 as f64;
        let y1 = y1 as f64;
        let x2 = x2 as f64;
        let y2 = y2 as f64;

        if ((y1 > y) != (y2 > y)) && (x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) {
            inside = !inside;
        }
    }
    inside
}

// --- GÉNÉRATION ---

pub async fn generate_cropped_map(
    output_dir: &Path,
    points: &[crate::db::PointWithDetails],
) -> Result<CroppedMap, String> {
    if points.is_empty() {
        return Err("Aucun point à afficher".to_string());
    }

    // 1. Limites
    let min_lon = points.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
    let max_lon = points.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
    let min_lat = points.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
    let max_lat = points.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);

    // 2. Zoom
    let zoom = 16;
    let (tile_min_x, tile_max_y_idx) = lon_lat_to_tile(min_lon, min_lat, zoom);
    let (tile_max_x, tile_min_y_idx) = lon_lat_to_tile(max_lon, max_lat, zoom);

    let t_x1 = tile_min_x.saturating_sub(1);
    let t_y1 = tile_min_y_idx.saturating_sub(1);
    let t_x2 = tile_max_x + 1;
    let t_y2 = tile_max_y_idx + 1;
    let num_tiles_x = t_x2 - t_x1 + 1;
    let num_tiles_y = t_y2 - t_y1 + 1;
    let path_struct = get_pmtiles_file_path()?;
    // 3. Reader
    let reader = AsyncPmTilesReader::new_with_path(path_struct.path)
        .await
        .map_err(|e| format!("Erreur ouverture PMTiles : {:?}", e))?;

    let mut final_img = DynamicImage::new_rgba8(num_tiles_x * 256, num_tiles_y * 256);

    // 4. Lecture des tuiles
    for x in t_x1..=t_x2 {
        for y in t_y1..=t_y2 {
            // CORRECTION FINALE :
            // x et y sont déjà des u32. On les passe directement sans 'as u64'.
            if let Ok(coord) = TileCoord::new(zoom, x, y) {
                if let Ok(Some(tile_bytes)) = reader.get_tile(coord).await {
                    if let Ok(tile_img) = image::load_from_memory(&tile_bytes) {
                        let px = (x - t_x1) * 256;
                        let py = (y - t_y1) * 256;
                        if px < final_img.width() && py < final_img.height() {
                            let _ = final_img.copy_from(&tile_img, px, py);
                        }
                    }
                }
            }
        }
    }

    // 5. Sauvegarde
    let filename = "map_dynamic.jpg";
    let output_path = output_dir.join(filename);
    final_img
        .to_rgb8()
        .save_with_format(&output_path, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    // 6. Retour
    let (_w_lon, _n_lat) = tile_to_lon_lat(t_x1, t_y1, zoom);
    let (_e_lon, _s_lat) = tile_to_lon_lat(t_x2 + 1, t_y2 + 1, zoom);

    Ok(CroppedMap {
        image_path: filename.to_string(),
        zoom,
        tile_origin_x: t_x1,
        tile_origin_y: t_y1,
        width_tiles: num_tiles_x,
        height_tiles: num_tiles_y,
    })
}

/// Génère une carte cropped avec les points, parcours ET les zones
#[allow(dead_code)]
pub async fn generate_cropped_map_with_parcours(
    output_dir: &Path,
    points: &[crate::db::PointWithDetails],
    parcours: &[Parcours],
) -> Result<CroppedMap, String> {
    generate_cropped_map_with_parcours_and_zones(output_dir, points, parcours, &[]).await
}

/// Génère une carte cropped avec les points, parcours ET les zones
pub async fn generate_cropped_map_with_parcours_and_zones(
    output_dir: &Path,
    points: &[crate::db::PointWithDetails],
    parcours: &[Parcours],
    zones: &[crate::types::Zone],
) -> Result<CroppedMap, String> {
    if points.is_empty() {
        return Err("Aucun point à afficher".to_string());
    }

    // 1. Limites basées sur les points
    let mut min_lon = points.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
    let mut max_lon = points.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
    let mut min_lat = points.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
    let mut max_lat = points.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);

    // Étendre les limites pour inclure les parcours
    for parcours_item in parcours {
        if let Some(geom_json) = &parcours_item.geometry_json {
            let coords = parse_linestring_wkt(geom_json);
            for (lon, lat) in coords {
                min_lon = min_lon.min(lon);
                max_lon = max_lon.max(lon);
                min_lat = min_lat.min(lat);
                max_lat = max_lat.max(lat);
            }
        }
    }

    // Étendre les limites pour inclure les zones
    for zone in zones {
        if let Some(geom_json) = &zone.geometry_json {
            let coords = parse_polygon_wkt(geom_json);
            for (lon, lat) in coords {
                min_lon = min_lon.min(lon);
                max_lon = max_lon.max(lon);
                min_lat = min_lat.min(lat);
                max_lat = max_lat.max(lat);
            }
        }
    }

    // 2. Zoom
    let zoom = 16;
    let (tile_min_x, tile_max_y_idx) = lon_lat_to_tile(min_lon, min_lat, zoom);
    let (tile_max_x, tile_min_y_idx) = lon_lat_to_tile(max_lon, max_lat, zoom);

    let t_x1 = tile_min_x.saturating_sub(1);
    let t_y1 = tile_min_y_idx.saturating_sub(1);
    let t_x2 = tile_max_x + 1;
    let t_y2 = tile_max_y_idx + 1;
    let num_tiles_x = t_x2 - t_x1 + 1;
    let num_tiles_y = t_y2 - t_y1 + 1;
    let path_struct = get_pmtiles_file_path()?;

    // 3. Reader
    let reader = AsyncPmTilesReader::new_with_path(path_struct.path)
        .await
        .map_err(|e| format!("Erreur ouverture PMTiles : {:?}", e))?;

    let mut final_img = DynamicImage::new_rgba8(num_tiles_x * 256, num_tiles_y * 256);

    // 4. Lecture des tuiles
    for x in t_x1..=t_x2 {
        for y in t_y1..=t_y2 {
            if let Ok(coord) = TileCoord::new(zoom, x, y) {
                if let Ok(Some(tile_bytes)) = reader.get_tile(coord).await {
                    if let Ok(tile_img) = image::load_from_memory(&tile_bytes) {
                        let px = (x - t_x1) * 256;
                        let py = (y - t_y1) * 256;
                        if px < final_img.width() && py < final_img.height() {
                            let _ = final_img.copy_from(&tile_img, px, py);
                        }
                    }
                }
            }
        }
    }

    // 5. Tracer les zones d'abord (en arrière-plan)
    let cropped_map = CroppedMap {
        image_path: String::new(),
        zoom,
        tile_origin_x: t_x1,
        tile_origin_y: t_y1,
        width_tiles: num_tiles_x,
        height_tiles: num_tiles_y,
    };

    for zone in zones {
        if let Some(geom_json) = &zone.geometry_json {
            let coords = parse_polygon_wkt(geom_json);
            if coords.len() >= 3 {
                // Obtenir la couleur de la zone
                let color_hex = zone.color.as_deref().unwrap_or("#3b82f6");
                let mut color = hex_to_rgba(color_hex);
                // Utiliser 60% d'opacité
                color.0[3] = 153; // 0.6 * 255 = 153

                // Convertir les coordonnées en pixels
                let mut coords_pixel: Vec<(u32, u32)> = vec![];
                for (lon, lat) in &coords {
                    let (pct_x, pct_y) = cropped_map.get_percent_pos(*lon, *lat);
                    let pixel_x = (pct_x * num_tiles_x as f64 * 256.0) as u32;
                    let pixel_y = (pct_y * num_tiles_y as f64 * 256.0) as u32;
                    coords_pixel.push((pixel_x, pixel_y));
                }

                // Remplir le polygone
                fill_polygon(&mut final_img, &coords_pixel, color);
            }
        }
    }

    // 6. Tracer les parcours sur la carte
    for parcours_item in parcours {
        if let Some(geom_json) = &parcours_item.geometry_json {
            let coords = parse_linestring_wkt(geom_json);
            if coords.len() > 1 {
                // Obtenir la couleur du parcours
                let color_hex = parcours_item.color.as_deref().unwrap_or("#ef4444");
                let color = hex_to_rgba(color_hex);

                // Tracer chaque segment de la ligne
                for i in 0..coords.len() - 1 {
                    let (lon1, lat1) = coords[i];
                    let (lon2, lat2) = coords[i + 1];

                    let (pct_x1, pct_y1) = cropped_map.get_percent_pos(lon1, lat1);
                    let (pct_x2, pct_y2) = cropped_map.get_percent_pos(lon2, lat2);

                    let pixel_x1 = (pct_x1 * num_tiles_x as f64 * 256.0) as u32;
                    let pixel_y1 = (pct_y1 * num_tiles_y as f64 * 256.0) as u32;
                    let pixel_x2 = (pct_x2 * num_tiles_x as f64 * 256.0) as u32;
                    let pixel_y2 = (pct_y2 * num_tiles_y as f64 * 256.0) as u32;

                    // Tracer la ligne avec une épaisseur de 3 pixels
                    draw_line(
                        &mut final_img,
                        pixel_x1,
                        pixel_y1,
                        pixel_x2,
                        pixel_y2,
                        color,
                        3,
                    );
                }
            }
        }
    }

    // 7. Sauvegarde
    let filename = "map_dynamic.jpg";
    let output_path = output_dir.join(filename);
    final_img
        .to_rgb8()
        .save_with_format(&output_path, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    // 8. Retour
    let (_w_lon, _n_lat) = tile_to_lon_lat(t_x1, t_y1, zoom);
    let (_e_lon, _s_lat) = tile_to_lon_lat(t_x2 + 1, t_y2 + 1, zoom);

    Ok(CroppedMap {
        image_path: filename.to_string(),
        zoom,
        tile_origin_x: t_x1,
        tile_origin_y: t_y1,
        width_tiles: num_tiles_x,
        height_tiles: num_tiles_y,
    })
}
