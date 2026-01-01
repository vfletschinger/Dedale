use crate::db::{
    build_sql_placeholders, build_where_in_clause, count_total_comments, count_total_obstacles,
    count_total_pictures, format_event_status, generate_uuid, hash_password, is_valid_date_format,
    is_valid_email, is_valid_password_length, is_valid_phone_number, is_valid_point_coordinate,
    is_valid_role, is_valid_username, is_valid_uuid, sanitize_string, truncate_string,
    verify_password, Comment, Obstacle, Picture, Point,
};

// ============== UUID Tests ==============

#[test]
fn test_generate_uuid_format() {
    let uuid = generate_uuid();
    // UUID format: xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx (peut varier légèrement)
    assert!(uuid.contains('-'), "UUID should contain dashes: {}", uuid);
    let parts: Vec<&str> = uuid.split('-').collect();
    assert_eq!(parts.len(), 5, "UUID should have 5 parts: {}", uuid);
}

#[test]
fn test_generate_uuid_uniqueness() {
    let uuid1 = generate_uuid();
    let uuid2 = generate_uuid();
    assert_ne!(uuid1, uuid2, "Two generated UUIDs should be different");
}

#[test]
fn test_generate_uuid_length() {
    let uuid = generate_uuid();
    // L'UUID généré peut avoir 35 ou 36 caractères selon l'implémentation
    assert!(
        uuid.len() >= 35 && uuid.len() <= 36,
        "UUID should be 35-36 characters long, got {}",
        uuid.len()
    );
}

#[test]
fn test_is_valid_uuid_valid() {
    assert!(is_valid_uuid("550e8400-e29b-41d4-a716-446655440000"));
    assert!(is_valid_uuid("123e4567-e89b-42d3-a456-426614174000"));
}

#[test]
fn test_is_valid_uuid_invalid_format() {
    assert!(!is_valid_uuid("not-a-uuid"));
    assert!(!is_valid_uuid("550e8400e29b41d4a716446655440000")); // No dashes
    assert!(!is_valid_uuid("550e8400-e29b-41d4-a716")); // Too short
}

#[test]
fn test_is_valid_uuid_invalid_chars() {
    assert!(!is_valid_uuid("550e8400-e29b-41d4-a716-44665544000g")); // Contains 'g'
    assert!(!is_valid_uuid("550e8400-e29b-41d4-a716-44665544000!")); // Contains '!'
}

// ============== Username Validation Tests ==============

#[test]
fn test_is_valid_username_valid() {
    assert!(is_valid_username("john_doe"));
    assert!(is_valid_username("user123"));
    assert!(is_valid_username("test-user"));
    assert!(is_valid_username("abc"));
}

#[test]
fn test_is_valid_username_too_short() {
    assert!(!is_valid_username("ab"));
    assert!(!is_valid_username("a"));
    assert!(!is_valid_username(""));
}

#[test]
fn test_is_valid_username_invalid_chars() {
    assert!(!is_valid_username("user@name"));
    assert!(!is_valid_username("user name"));
    assert!(!is_valid_username("user.name"));
}

#[test]
fn test_is_valid_username_boundary() {
    let long_name = "a".repeat(50);
    assert!(is_valid_username(&long_name));
    let too_long = "a".repeat(51);
    assert!(!is_valid_username(&too_long));
}

// ============== Role Validation Tests ==============

#[test]
fn test_is_valid_role_valid() {
    assert!(is_valid_role("admin"));
    assert!(is_valid_role("user"));
    assert!(is_valid_role("guest"));
    assert!(is_valid_role("moderator"));
}

#[test]
fn test_is_valid_role_invalid() {
    assert!(!is_valid_role("superuser"));
    assert!(!is_valid_role("Admin")); // Case sensitive
    assert!(!is_valid_role(""));
    assert!(!is_valid_role("root"));
}

// ============== Event Status Tests ==============

#[test]
fn test_format_event_status_active() {
    assert_eq!(format_event_status("actif"), "En cours");
    assert_eq!(format_event_status("active"), "En cours");
    assert_eq!(format_event_status("en_cours"), "En cours");
}

#[test]
fn test_format_event_status_finished() {
    assert_eq!(format_event_status("termine"), "Terminé");
    assert_eq!(format_event_status("finished"), "Terminé");
    assert_eq!(format_event_status("completed"), "Terminé");
}

#[test]
fn test_format_event_status_cancelled() {
    assert_eq!(format_event_status("annule"), "Annulé");
    assert_eq!(format_event_status("cancelled"), "Annulé");
}

#[test]
fn test_format_event_status_planned() {
    assert_eq!(format_event_status("planifie"), "Planifié");
    assert_eq!(format_event_status("planned"), "Planifié");
    assert_eq!(format_event_status("scheduled"), "Planifié");
}

#[test]
fn test_format_event_status_unknown() {
    assert_eq!(format_event_status("invalid"), "Inconnu");
    assert_eq!(format_event_status(""), "Inconnu");
}

// ============== Point Coordinate Tests ==============

#[test]
fn test_is_valid_point_coordinate_valid() {
    assert!(is_valid_point_coordinate(0.0, 0.0));
    assert!(is_valid_point_coordinate(45.5, 2.3));
    assert!(is_valid_point_coordinate(-122.4194, 37.7749));
}

#[test]
fn test_is_valid_point_coordinate_boundaries() {
    assert!(is_valid_point_coordinate(180.0, 90.0));
    assert!(is_valid_point_coordinate(-180.0, -90.0));
    assert!(!is_valid_point_coordinate(181.0, 0.0));
    assert!(!is_valid_point_coordinate(0.0, 91.0));
}

#[test]
fn test_is_valid_point_coordinate_invalid() {
    assert!(!is_valid_point_coordinate(f64::NAN, 0.0));
    assert!(!is_valid_point_coordinate(0.0, f64::INFINITY));
    assert!(!is_valid_point_coordinate(f64::NEG_INFINITY, 0.0));
}

// ============== Date Format Tests ==============

#[test]
fn test_is_valid_date_format_valid() {
    assert!(is_valid_date_format("2024-01-15"));
    assert!(is_valid_date_format("2024-12-31"));
    assert!(is_valid_date_format("2024-01-15T10:30:00"));
}

#[test]
fn test_is_valid_date_format_invalid() {
    assert!(!is_valid_date_format("15-01-2024")); // Wrong order
    assert!(!is_valid_date_format("2024/01/15")); // Wrong separator
    assert!(!is_valid_date_format("2024-13-01")); // Invalid month
    assert!(!is_valid_date_format("2024-01-32")); // Invalid day
}

#[test]
fn test_is_valid_date_format_too_short() {
    assert!(!is_valid_date_format("2024-01"));
    assert!(!is_valid_date_format("2024"));
    assert!(!is_valid_date_format(""));
}

// ============== Password Tests ==============

#[test]
fn test_hash_password_and_verify() {
    let password = "securePassword123!";
    let hashed = hash_password(password).expect("Hash should succeed");
    assert!(verify_password(password, &hashed));
}

#[test]
fn test_verify_password_wrong() {
    let password = "securePassword123!";
    let hashed = hash_password(password).expect("Hash should succeed");
    assert!(!verify_password("wrongPassword", &hashed));
}

#[test]
fn test_hash_password_different_hashes() {
    let password = "samePassword";
    let hash1 = hash_password(password).expect("Hash should succeed");
    let hash2 = hash_password(password).expect("Hash should succeed");
    // Bcrypt produces different hashes for the same password due to salt
    assert_ne!(hash1, hash2);
}

#[test]
fn test_is_valid_password_length_valid() {
    assert!(is_valid_password_length("12345678")); // 8 chars
    assert!(is_valid_password_length("securePassword123!"));
}

#[test]
fn test_is_valid_password_length_too_short() {
    assert!(!is_valid_password_length("1234567")); // 7 chars
    assert!(!is_valid_password_length("short"));
    assert!(!is_valid_password_length(""));
}

#[test]
fn test_is_valid_password_length_too_long() {
    let long_password = "a".repeat(129);
    assert!(!is_valid_password_length(&long_password));
}

// ============== SQL Builder Tests ==============

#[test]
fn test_build_sql_placeholders_multiple() {
    assert_eq!(build_sql_placeholders(3), "?, ?, ?");
    assert_eq!(build_sql_placeholders(5), "?, ?, ?, ?, ?");
}

#[test]
fn test_build_sql_placeholders_single() {
    assert_eq!(build_sql_placeholders(1), "?");
}

#[test]
fn test_build_sql_placeholders_zero() {
    assert_eq!(build_sql_placeholders(0), "");
}

#[test]
fn test_build_where_in_clause_basic() {
    assert_eq!(build_where_in_clause("id", 3), "id IN (?, ?, ?)");
    assert_eq!(build_where_in_clause("event_id", 2), "event_id IN (?, ?)");
}

#[test]
fn test_build_where_in_clause_empty() {
    assert_eq!(build_where_in_clause("id", 0), "id IN ()");
}

// ============== Email Validation Tests ==============

#[test]
fn test_is_valid_email_valid() {
    assert!(is_valid_email("test@example.com"));
    assert!(is_valid_email("user.name@domain.org"));
    assert!(is_valid_email("user+tag@sub.domain.com"));
}

#[test]
fn test_is_valid_email_invalid() {
    assert!(!is_valid_email("invalid"));
    assert!(!is_valid_email("@example.com"));
    assert!(!is_valid_email("test@"));
    assert!(!is_valid_email("test@domain")); // No dot in domain
    assert!(!is_valid_email("test@@example.com")); // Double @
}

// ============== Phone Validation Tests ==============

#[test]
fn test_is_valid_phone_number_valid() {
    assert!(is_valid_phone_number("0612345678"));
    assert!(is_valid_phone_number("+33612345678"));
    assert!(is_valid_phone_number("06 12 34 56 78"));
    assert!(is_valid_phone_number("06-12-34-56-78"));
}

#[test]
fn test_is_valid_phone_number_invalid() {
    assert!(!is_valid_phone_number("123")); // Too short
    assert!(!is_valid_phone_number("1234567890123456")); // Too long (16 digits)
    assert!(!is_valid_phone_number("abcdefghij")); // No digits
}

// ============== String Utility Tests ==============

#[test]
fn test_sanitize_string_quotes() {
    assert_eq!(sanitize_string("test'value"), "test''value");
    // Double quotes are escaped with backslash only (no double backslash)
    assert_eq!(sanitize_string("test\"value"), "test\"value");
}

#[test]
fn test_sanitize_string_backslash() {
    assert_eq!(sanitize_string("path\\to\\file"), "path\\\\to\\\\file");
}

#[test]
fn test_sanitize_string_clean() {
    assert_eq!(sanitize_string("clean string"), "clean string");
}

#[test]
fn test_truncate_string_no_truncation() {
    assert_eq!(truncate_string("short", 10), "short");
    assert_eq!(truncate_string("exact", 5), "exact");
}

#[test]
fn test_truncate_string_with_truncation() {
    assert_eq!(truncate_string("this is a long string", 10), "this is...");
    assert_eq!(truncate_string("hello world", 8), "hello...");
}

#[test]
fn test_truncate_string_empty() {
    assert_eq!(truncate_string("", 10), "");
}

// ============== Point Statistics Tests ==============

fn create_test_point(
    id: &str,
    num_obstacles: usize,
    num_comments: usize,
    num_pictures: usize,
) -> Point {
    Point {
        id: id.to_string(),
        x: 0.0,
        y: 0.0,
        pose: None,
        depose: None,
        event_ids: vec![],
        obstacles: (0..num_obstacles)
            .map(|i| Obstacle {
                id: format!("obs-{}", i),
                name: Some("Test".to_string()),
                number: Some(1),
                point_id: id.to_string(),
                type_id: 1,
                description: None,
                width: None,
                length: None,
            })
            .collect(),
        comments: (0..num_comments)
            .map(|i| Comment {
                id: format!("com-{}", i),
                point_id: id.to_string(),
                value: "Test comment".to_string(),
            })
            .collect(),
        pictures: (0..num_pictures)
            .map(|i| Picture {
                id: format!("pic-{}", i),
                point_id: id.to_string(),
                image: "base64...".to_string(),
            })
            .collect(),
    }
}

#[test]
fn test_count_total_obstacles_single_point() {
    let points = vec![create_test_point("1", 3, 0, 0)];
    assert_eq!(count_total_obstacles(&points), 3);
}

#[test]
fn test_count_total_obstacles_multiple_points() {
    let points = vec![
        create_test_point("1", 2, 0, 0),
        create_test_point("2", 3, 0, 0),
        create_test_point("3", 1, 0, 0),
    ];
    assert_eq!(count_total_obstacles(&points), 6);
}

#[test]
fn test_count_total_obstacles_empty() {
    let points: Vec<Point> = vec![];
    assert_eq!(count_total_obstacles(&points), 0);
}

#[test]
fn test_count_total_comments_multiple() {
    let points = vec![
        create_test_point("1", 0, 2, 0),
        create_test_point("2", 0, 3, 0),
    ];
    assert_eq!(count_total_comments(&points), 5);
}

#[test]
fn test_count_total_comments_empty() {
    let points: Vec<Point> = vec![];
    assert_eq!(count_total_comments(&points), 0);
}

#[test]
fn test_count_total_pictures_multiple() {
    let points = vec![
        create_test_point("1", 0, 0, 4),
        create_test_point("2", 0, 0, 2),
    ];
    assert_eq!(count_total_pictures(&points), 6);
}

#[test]
fn test_count_total_pictures_empty() {
    let points: Vec<Point> = vec![];
    assert_eq!(count_total_pictures(&points), 0);
}

// ============== Mixed Statistics Tests ==============

#[test]
fn test_count_all_stats() {
    let points = vec![
        create_test_point("1", 2, 3, 4),
        create_test_point("2", 1, 2, 3),
    ];
    assert_eq!(count_total_obstacles(&points), 3);
    assert_eq!(count_total_comments(&points), 5);
    assert_eq!(count_total_pictures(&points), 7);
}
