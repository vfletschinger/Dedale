use image::{DynamicImage, GenericImage, GenericImageView, ImageFormat};
use pmtiles::{AsyncPmTilesReader, TileCoord};
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

    // 3. Reader
    let reader = AsyncPmTilesReader::new_with_path("../public/eurometropole_strasbourg.pmtiles")
        .await
        .map_err(|e| format!("Erreur ouverture PMTiles : {:?}", e))?;

    let mut final_img = DynamicImage::new_rgba8(num_tiles_x * 256, num_tiles_y * 256);

    // 4. Lecture des tuiles
    for x in t_x1..=t_x2 {
        for y in t_y1..=t_y2 {
            // CORRECTION FINALE :
            // x et y sont déjà des u32. On les passe directement sans 'as u64'.
            if let Ok(coord) = TileCoord::new(zoom, x, y) {
                match reader.get_tile(coord).await {
                    Ok(Some(tile_bytes)) => {
                        if let Ok(tile_img) = image::load_from_memory(&tile_bytes) {
                            let px = (x - t_x1) * 256;
                            let py = (y - t_y1) * 256;
                            if px < final_img.width() && py < final_img.height() {
                                let _ = final_img.copy_from(&tile_img, px, py);
                            }
                        }
                    }
                    _ => {}
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
    let (w_lon, n_lat) = tile_to_lon_lat(t_x1, t_y1, zoom);
    let (e_lon, s_lat) = tile_to_lon_lat(t_x2 + 1, t_y2 + 1, zoom);

    Ok(CroppedMap {
        image_path: filename.to_string(),
        zoom,
        tile_origin_x: t_x1,
        tile_origin_y: t_y1,
        width_tiles: num_tiles_x,
        height_tiles: num_tiles_y,
    })
}
