#[cfg(test)]
mod tests {
    use crate::types::{
        EquipementComplet, EquipementCoordinate, ObstacleWithType, PointWithDetails,
    };

    // ============== Helpers pour créer des données de test ==============

    fn make_point(id: &str, name: Option<&str>, x: f64, y: f64) -> PointWithDetails {
        PointWithDetails {
            id: id.to_string(),
            x,
            y,
            name: name.map(|s| s.to_string()),
            event_id: Some("event-1".to_string()),
            status: Some(true),
            comment: Some("Un commentaire".to_string()),
            r#type: Some("securite".to_string()),
            pictures: vec![],
            obstacles: vec![],
        }
    }

    fn make_obstacle(id: &str, name: Option<&str>, number: Option<i32>) -> ObstacleWithType {
        ObstacleWithType {
            id: id.to_string(),
            point_id: "point-1".to_string(),
            type_id: "type-1".to_string(),
            number,
            name: name.map(|s| s.to_string()),
            description: Some("Description obstacle".to_string()),
            width: Some(2.5),
            length: Some(3.0),
            type_name: Some("Barrière".to_string()),
            type_description: Some("Barrière de sécurité".to_string()),
            type_width: Some(1.0),
            type_length: Some(2.0),
        }
    }

    fn make_equipement(id: &str, type_name: &str, quantity: i32) -> EquipementComplet {
        EquipementComplet {
            id: id.to_string(),
            type_id: Some("type-1".to_string()),
            type_name: Some(type_name.to_string()),
            type_description: Some("Description du type".to_string()),
            length: Some(10),
            quantity: Some(quantity),
            description: Some("Équipement test".to_string()),
            date_pose: Some("2025-06-01".to_string()),
            hour_pose: None,
            date_depose: Some("2025-06-15".to_string()),
            hour_depose: None,
            coordinates: vec![
                EquipementCoordinate {
                    id: "coord-1".to_string(),
                    equipement_id: id.to_string(),
                    x: 2.3522,
                    y: 48.8566,
                    order_index: Some(0),
                },
                EquipementCoordinate {
                    id: "coord-2".to_string(),
                    equipement_id: id.to_string(),
                    x: 2.3530,
                    y: 48.8570,
                    order_index: Some(1),
                },
            ],
        }
    }

    // ============== Tests pour PointWithDetails ==============

    #[test]
    fn test_point_with_details_default_obstacles_empty() {
        let point = make_point("p1", Some("Point A"), 2.35, 48.85);
        assert!(point.obstacles.is_empty());
    }

    #[test]
    fn test_point_with_obstacles() {
        let mut point = make_point("p1", Some("Point A"), 2.35, 48.85);
        point.obstacles.push(make_obstacle("obs-1", Some("Arbre"), Some(3)));
        point.obstacles.push(make_obstacle("obs-2", Some("Rocher"), Some(1)));

        assert_eq!(point.obstacles.len(), 2);
        assert_eq!(point.obstacles[0].name.as_deref(), Some("Arbre"));
        assert_eq!(point.obstacles[0].number, Some(3));
        assert_eq!(point.obstacles[1].name.as_deref(), Some("Rocher"));
    }

    #[test]
    fn test_obstacle_fallback_to_type_name() {
        let obs = ObstacleWithType {
            id: "obs-1".to_string(),
            point_id: "p1".to_string(),
            type_id: "t1".to_string(),
            number: Some(2),
            name: None, // Pas de nom propre
            description: None,
            width: None,
            length: None,
            type_name: Some("Barrière".to_string()), // Fallback
            type_description: Some("Desc type".to_string()),
            type_width: Some(1.5),
            type_length: Some(3.0),
        };

        // Le nom affiché devrait être le type_name quand name est None
        let display_name = obs.name.as_deref().or(obs.type_name.as_deref()).unwrap_or("");
        assert_eq!(display_name, "Barrière");

        // La description devrait fallback sur type_description
        let display_desc = obs
            .description
            .as_deref()
            .or(obs.type_description.as_deref())
            .unwrap_or("");
        assert_eq!(display_desc, "Desc type");

        // La largeur devrait fallback sur type_width
        let display_width = obs.width.or(obs.type_width).unwrap_or(0.0);
        assert!((display_width - 1.5).abs() < 0.001);
    }

    #[test]
    fn test_obstacle_own_values_take_priority() {
        let obs = make_obstacle("obs-1", Some("Mon obstacle"), Some(5));

        let display_name = obs.name.as_deref().or(obs.type_name.as_deref()).unwrap_or("");
        assert_eq!(display_name, "Mon obstacle"); // Propre nom prioritaire

        let display_width = obs.width.or(obs.type_width).unwrap_or(0.0);
        assert!((display_width - 2.5).abs() < 0.001); // Propre largeur prioritaire
    }

    // ============== Tests pour EquipementComplet ==============

    #[test]
    fn test_equipement_has_coordinates() {
        let eq = make_equipement("eq-1", "Barrière", 5);
        assert_eq!(eq.coordinates.len(), 2);
        assert!((eq.coordinates[0].x - 2.3522).abs() < 0.0001);
        assert!((eq.coordinates[0].y - 48.8566).abs() < 0.0001);
    }

    #[test]
    fn test_equipement_has_quantity() {
        let eq = make_equipement("eq-1", "Bloc de béton", 10);
        assert_eq!(eq.quantity, Some(10));
    }

    #[test]
    fn test_equipement_has_dates() {
        let eq = make_equipement("eq-1", "Barrière", 3);
        assert_eq!(eq.date_pose.as_deref(), Some("2025-06-01"));
        assert_eq!(eq.date_depose.as_deref(), Some("2025-06-15"));
    }

    #[test]
    fn test_equipement_has_type_info() {
        let eq = make_equipement("eq-1", "Véhicule", 2);
        assert_eq!(eq.type_name.as_deref(), Some("Véhicule"));
        assert_eq!(eq.type_description.as_deref(), Some("Description du type"));
    }

    #[test]
    fn test_equipement_default() {
        let eq = EquipementComplet::default();
        assert_eq!(eq.id, "");
        assert!(eq.type_id.is_none());
        assert!(eq.type_name.is_none());
        assert!(eq.quantity.is_none());
        assert!(eq.coordinates.is_empty());
    }

    #[test]
    fn test_equipement_coordinates_order() {
        let eq = make_equipement("eq-1", "Barrière", 1);
        assert_eq!(eq.coordinates[0].order_index, Some(0));
        assert_eq!(eq.coordinates[1].order_index, Some(1));
    }

    // ============== Tests pour le formatage des coordonnées (logique Excel) ==============

    #[test]
    fn test_format_coordinates_string() {
        let eq = make_equipement("eq-1", "Barrière", 1);
        let coords_str: String = eq
            .coordinates
            .iter()
            .map(|c| format!("({:.6}, {:.6})", c.x, c.y))
            .collect::<Vec<_>>()
            .join(" → ");

        assert!(coords_str.contains("2.352200"));
        assert!(coords_str.contains("48.856600"));
        assert!(coords_str.contains(" → "));
    }

    #[test]
    fn test_format_coordinates_empty() {
        let mut eq = make_equipement("eq-1", "Barrière", 1);
        eq.coordinates = vec![];

        let coords_str: String = eq
            .coordinates
            .iter()
            .map(|c| format!("({:.6}, {:.6})", c.x, c.y))
            .collect::<Vec<_>>()
            .join(" → ");

        assert_eq!(coords_str, "");
    }

    // ============== Tests pour la sérialisation/désérialisation ==============

    #[test]
    fn test_point_with_details_deserialize_without_obstacles() {
        let json = r#"{
            "id": "p1",
            "x": 2.35,
            "y": 48.85,
            "name": "Test",
            "event_id": "ev1",
            "status": true,
            "comment": null,
            "type": null,
            "pictures": []
        }"#;

        let point: PointWithDetails = serde_json::from_str(json).unwrap();
        assert_eq!(point.id, "p1");
        assert!(point.obstacles.is_empty()); // Default = vec vide grâce à #[serde(default)]
    }

    #[test]
    fn test_point_with_details_serialize_includes_obstacles() {
        let mut point = make_point("p1", Some("Test"), 2.35, 48.85);
        point.obstacles.push(make_obstacle("obs-1", Some("Arbre"), Some(2)));

        let json = serde_json::to_string(&point).unwrap();
        assert!(json.contains("obstacles"));
        assert!(json.contains("Arbre"));
    }

    #[test]
    fn test_equipement_serialize_includes_quantity() {
        let eq = make_equipement("eq-1", "Barrière", 7);
        let json = serde_json::to_string(&eq).unwrap();
        assert!(json.contains("\"quantity\":7"));
    }

    // ============== Tests pour les cas limites de l'export ==============

    #[test]
    fn test_point_without_optional_fields() {
        let point = PointWithDetails {
            id: "p1".to_string(),
            x: 0.0,
            y: 0.0,
            name: None,
            event_id: None,
            status: None,
            comment: None,
            r#type: None,
            pictures: vec![],
            obstacles: vec![],
        };

        // Vérifier que les valeurs par défaut sont gérées proprement
        assert_eq!(point.name.as_deref().unwrap_or(""), "");
        assert_eq!(point.comment.as_deref().unwrap_or(""), "");
        assert_eq!(
            match point.status {
                Some(true) => "Validé",
                Some(false) => "Non validé",
                None => "",
            },
            ""
        );
    }

    #[test]
    fn test_multiple_obstacles_per_point() {
        let mut point = make_point("p1", Some("Multi-obstacles"), 2.0, 48.0);
        for i in 0..5 {
            point.obstacles.push(make_obstacle(
                &format!("obs-{}", i),
                Some(&format!("Obstacle {}", i)),
                Some(i),
            ));
        }

        assert_eq!(point.obstacles.len(), 5);
        assert_eq!(point.obstacles[3].number, Some(3));
    }

    #[test]
    fn test_equipement_without_optional_fields() {
        let eq = EquipementComplet {
            id: "eq-1".to_string(),
            type_id: None,
            type_name: None,
            type_description: None,
            length: None,
            quantity: None,
            description: None,
            date_pose: None,
            hour_pose: None,
            date_depose: None,
            hour_depose: None,
            coordinates: vec![],
        };

        assert_eq!(eq.type_name.as_deref().unwrap_or(""), "");
        assert_eq!(eq.quantity.unwrap_or(0), 0);
        assert_eq!(eq.length.unwrap_or(0), 0);
    }
}
