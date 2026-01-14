use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Event {
    #[serde(default)]
    pub id: String,
    pub name: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub zone: Option<String>,
    pub parcours: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Zone {
    #[serde(default)]
    pub id: String,
    pub event_id: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub geometry_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Parcours {
    #[serde(default)]
    pub id: String,
    pub event_id: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub start_time: Option<i64>,
    pub speed_low: Option<f64>,
    pub speed_high: Option<f64>,
    pub geometry_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Team {
    #[serde(default)]
    pub id: String,
    pub name: Option<String>,
    pub number: i64,
    pub event_id: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Member {
    pub id: String,
    pub team_id: String,
    pub person_id: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Equipement {
    pub id: String,
    pub type_id: Option<String>,
    pub length: Option<i32>,
    pub description: Option<String>,
    pub date_pose: Option<String>,
    pub hour_pose: Option<String>,
    pub date_depose: Option<String>,
    pub hour_depose: Option<String>,
}

#[derive(sqlx::FromRow, Debug, Clone, Serialize, Deserialize)]
pub struct EquipementCoordinate {
    pub id: String,
    pub equipement_id: String,
    pub x: f64,
    pub y: f64,
    pub order_index: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Type {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub width: Option<f64>,
    pub length: Option<f64>,
    pub height: Option<f64>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Course {
    pub id: String,
    pub name: Option<String>,
    pub color: Option<String>,
    pub start_date: Option<String>,
    pub zone: Option<String>,
    pub parcours: Option<String>,
    pub speed_low: Option<f64>,
    pub speed_high: Option<f64>,
}

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: Option<String>,
    pub password_hash: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Point {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub name: Option<String>,
    pub comment: Option<String>,
    pub r#type: Option<String>,
    pub status: Option<bool>,
    pub event_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Interest {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub description: Option<String>,
    pub event_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PointWithDetails {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub name: Option<String>,
    pub event_id: Option<String>,
    pub status: Option<bool>,
    pub comment: Option<String>,
    pub r#type: Option<String>,
    #[serde(default)]
    pub pictures: Vec<Picture>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Person {
    pub id: String,
    pub firstname: Option<String>,
    pub lastname: Option<String>,
    pub email: Option<String>,
    pub phone_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Picture {
    pub id: i64, // INTEGER PRIMARY KEY dans la base SQLite
    pub point_id: Option<String>,
    pub image: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Comment {
    pub id: String,
    pub point_id: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObstacleType {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub width: Option<f64>,
    pub length: Option<f64>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Obstacle {
    pub id: String,
    pub point_id: String,
    pub type_id: String,
    pub number: Option<i32>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub width: Option<f64>,
    pub length: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Geometry {
    pub id: String,
    pub event_id: String,
    pub geom: String,
    pub geom_type: String, // "point", "parcours", ou "zone"
    pub name: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct PointDetail {
    pub point: Point,
    #[serde(default)]
    pub comment: Vec<Comment>,
    #[serde(default)]
    pub picture: Vec<PictureInput>,
    #[serde(default)]
    pub obstacle: Vec<Obstacle>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct PictureInput {
    pub id: String,
    pub point_id: String,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct EquipementComplet {
    pub id: String,
    pub type_id: Option<String>,
    pub type_name: Option<String>,
    pub type_description: Option<String>,
    pub length: Option<i32>,
    pub description: Option<String>,
    pub date_pose: Option<String>,
    pub hour_pose: Option<String>,
    pub date_depose: Option<String>,
    pub hour_depose: Option<String>,
    pub coordinates: Vec<EquipementCoordinate>,
}

#[derive(Debug, Serialize, Clone, Deserialize, sqlx::FromRow)]
pub struct Action {
    pub id: String,
    pub team_id: String,
    pub equipement_id: String,
    #[sqlx(rename = "type")]
    pub r#type: Option<String>,
    pub scheduled_time: Option<String>,
    pub is_done: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EquipementActionComplet {
    pub equipement: EquipementComplet,
    pub event_id: Option<String>,
    pub action_id: Option<String>,
    pub action_type: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferEquipement {
    pub id: String,
    pub event_id: String,
    pub type_id: String,
    pub quantity: i32,
    pub length_per_unit: f64,
    pub date_pose: Option<String>,
    pub date_depose: Option<String>,
    pub coordinates: Vec<TransferEquipementCoordinate>,
}

/// Structure pour un event envoyé au mobile (avec noms camelCase pour compatibilité)
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransferEquipementCoordinate {
    pub id: String,
    pub equipement_id: String,
    pub x: f64,
    pub y: f64,
    pub order_index: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferTeamInfo {
    pub id: String,
    pub name: String,
    pub event_id: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Planning {
    pub team: TransferTeamInfo,
    pub actions: Vec<Action>,
    pub equipements: Vec<TransferEquipement>,
    pub coordonees: Vec<TransferEquipementCoordinate>,
}

#[derive(sqlx::FromRow)]
pub struct TransferEquipementWithoutCoords {
    pub id: String,
    pub event_id: String,
    pub type_id: String,
    pub quantity: Option<i32>,
    pub length_per_unit: Option<i32>,
    pub date_pose: Option<String>,
    pub date_depose: Option<String>,
}

/// Structure pour un parcours envoyé au mobile
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransferParcours {
    pub id: String,
    pub event_id: String,
    pub name: String,
    pub color: Option<String>,
    pub start_time: Option<String>,
    pub speed_low: Option<f64>,
    pub speed_high: Option<f64>,
    pub geometry_json: Option<String>,
}

/// Structure pour une zone envoyée au mobile
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransferZone {
    pub id: String,
    pub event_id: String,
    pub name: String,
    pub color: Option<String>,
    pub geometry_json: Option<String>,
}

/// Structure pour un point envoyé au mobile
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransferPoint {
    pub id: String,
    pub event_id: String,
    pub x: f64,
    pub y: f64,
    pub name: Option<String>,
    pub comment: Option<String>,
    #[serde(rename = "type")]
    pub point_type: Option<String>,
    pub status: Option<bool>,
}

/// Structure pour un event envoyé au mobile (avec noms camelCase pour compatibilité)
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransferEvent {
    pub id: String,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub parcours: Vec<TransferParcours>,
    pub zones: Vec<TransferZone>,
    pub points: Vec<TransferPoint>,
}

/// Structure simplifiée pour envoyer seulement les données de base de l'événement
#[allow(dead_code)]
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BasicTransferEvent {
    pub id: String,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
}

/// Structure pour un accusé de réception d'event du mobile
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct EventAck {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub date_debut: Option<String>,
    #[serde(default)]
    pub date_fin: Option<String>,
    #[serde(default)]
    pub statut: Option<String>,
    #[serde(default)]
    pub geometry: Option<String>,
}

/// Réponse envoyée au mobile
#[derive(Debug, Serialize)]
pub struct AckResponse {
    pub code: i32,
    pub message: String,
}

/// Action demandée par le mobile
#[derive(Debug, Deserialize)]
pub struct ClientAction {
    pub action: String,
}

/// Structure pour l'export du mobile vers le desktop (event + points)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileExport {
    pub event: MobileExportEvent,
    pub points: Vec<MobilePointDetail>,
}

/// Structure pour un point dans l'export mobile (format différent du desktop)
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct MobilePointDetail {
    pub id: String, // UUID
    pub x: f64,
    pub y: f64,
    pub event_id: String, // UUID
    #[serde(default)]
    pub name: Option<String>,
    #[serde(rename = "type")]
    #[serde(default)]
    pub point_type: Option<String>,
    #[serde(default)]
    pub status: Option<i64>,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub modified_at: Option<String>,
    #[serde(default)]
    pub comments: Vec<MobileComment>,
    #[serde(default)]
    pub pictures: Vec<MobilePicture>,
    #[serde(default)]
    pub obstacles: Vec<MobileObstacle>,
    #[serde(default)]
    pub equipements: Vec<serde_json::Value>, // Flexible pour les équipements
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct MobileComment {
    pub id: String,       // UUID
    pub point_id: String, // UUID reference
    pub value: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct MobilePicture {
    pub id: String,       // UUID
    pub point_id: String, // UUID reference
    pub image: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct MobileObstacle {
    pub id: String,       // UUID
    pub point_id: String, // UUID reference
    pub type_id: i64,
    pub number: i32,
}

/// Structure pour l'event dans l'export mobile
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct MobileExportEvent {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(alias = "date_debut")]
    #[serde(alias = "dateDebut")]
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(alias = "date_fin")]
    #[serde(alias = "dateFin")]
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub statut: Option<String>,
    #[serde(default)]
    pub geometry: Option<String>,
    #[serde(default)]
    #[serde(alias = "calculatedStatus")]
    pub calculated_status: Option<String>,
}
