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
pub struct Team {
    #[serde(default)]
    pub id: String,
    pub name: Option<String>,
    #[serde(default)]
    pub event_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Member {
    pub id: String,
    pub team_id: String,
    pub person_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Equipement {
    pub id: String,
    pub type_id: Option<String>,
    pub length: Option<i32>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Type {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub width: Option<f64>,
    pub length: Option<f64>,
    pub height: Option<f64>,
}

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

#[derive(Debug, Serialize, Deserialize)]
pub struct Point {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub comment: Option<String>,
    pub r#type: Option<String>,
    pub status: Option<bool>,
    pub event_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Person {
    pub id: String,
    pub firstname: Option<String>,
    pub lastname: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub phone_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Picture {
    pub id: String,
    pub point_id: Option<String>,
    pub image: Option<String>,
}

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

#[derive(Debug, Serialize, Deserialize)]
pub struct Obstacle {
    pub id: String,
    pub point_id: String,
    pub type_id: i64,
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
}

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

#[derive(Debug, Serialize, Deserialize)]
pub struct PictureInput {
    pub id: String,
    pub point_id: String,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EquipementComplet {
    pub id: String,
    pub type_id: Option<String>,
    pub type_name: Option<String>,
    pub type_description: Option<String>,
    pub length: Option<i32>,
    pub date_pose: Option<String>,
    pub hour_pose: Option<String>,
    pub date_depose: Option<String>,
    pub hour_depose: Option<String>,
    pub coordinates: Vec<EquipementCoordinate>,
}
