use crate::map::{
    bbox_intersects, bearing_to_cardinal, calculate_bbox, calculate_bbox_area, calculate_bearing,
    calculate_center, calculate_distance, decimal_to_dms, degrees_to_meters, format_coordinates,
    is_valid_coordinate, meters_to_degrees, midpoint, normalize_longitude, point_in_bbox,
    round_coordinate,
};

// ============== Tests pour decimal_to_dms ==============

#[test]
fn test_decimal_to_dms_positive() {
    let (degrees, minutes, seconds) = decimal_to_dms(45.5);
    assert_eq!(degrees, 45);
    assert_eq!(minutes, 30);
    assert!((seconds - 0.0).abs() < 0.01);
}

#[test]
fn test_decimal_to_dms_negative() {
    let (degrees, minutes, seconds) = decimal_to_dms(-45.5);
    assert_eq!(degrees, -45);
    assert_eq!(minutes, 30);
    assert!((seconds - 0.0).abs() < 0.01);
}

#[test]
fn test_decimal_to_dms_zero() {
    let (degrees, minutes, seconds) = decimal_to_dms(0.0);
    assert_eq!(degrees, 0);
    assert_eq!(minutes, 0);
    assert!((seconds - 0.0).abs() < 0.01);
}

#[test]
fn test_decimal_to_dms_complex() {
    let (degrees, minutes, seconds) = decimal_to_dms(48.8566);
    assert_eq!(degrees, 48);
    assert_eq!(minutes, 51);
    assert!((seconds - 23.76).abs() < 0.1);
}

// ============== Tests pour format_coordinates ==============

#[test]
fn test_format_coordinates_basic() {
    let result = format_coordinates(2.3522, 48.8566);
    assert!(result.contains("2°"));
    assert!(result.contains("48°"));
}

#[test]
fn test_format_coordinates_negative() {
    let result = format_coordinates(-0.1278, 51.5074);
    // Longitude négative = W, Latitude positive = N
    assert!(result.contains("W"));
    assert!(result.contains("N"));
}

#[test]
fn test_format_coordinates_zero() {
    let result = format_coordinates(0.0, 0.0);
    assert!(result.contains("0°"));
}

// ============== Tests pour calculate_distance ==============

#[test]
fn test_calculate_distance_same_point() {
    let distance = calculate_distance(48.8566, 2.3522, 48.8566, 2.3522);
    assert!(distance.abs() < 0.001);
}

#[test]
fn test_calculate_distance_paris_london() {
    // Paris to London approximately 344 km = 344000 m
    let distance = calculate_distance(48.8566, 2.3522, 51.5074, -0.1278);
    assert!(distance > 300_000.0 && distance < 400_000.0);
}

#[test]
fn test_calculate_distance_equator() {
    // 1 degree on equator ≈ 111 km = 111000 m
    let distance = calculate_distance(0.0, 0.0, 0.0, 1.0);
    assert!(distance > 100_000.0 && distance < 120_000.0);
}

// ============== Tests pour point_in_bbox ==============

#[test]
fn test_point_in_bbox_inside() {
    assert!(point_in_bbox(5.0, 5.0, 0.0, 0.0, 10.0, 10.0));
}

#[test]
fn test_point_in_bbox_outside() {
    assert!(!point_in_bbox(15.0, 15.0, 0.0, 0.0, 10.0, 10.0));
}

#[test]
fn test_point_in_bbox_on_edge() {
    assert!(point_in_bbox(0.0, 5.0, 0.0, 0.0, 10.0, 10.0));
}

#[test]
fn test_point_in_bbox_corner() {
    assert!(point_in_bbox(0.0, 0.0, 0.0, 0.0, 10.0, 10.0));
}

// ============== Tests pour calculate_center ==============

#[test]
fn test_calculate_center_basic() {
    let points = vec![(0.0, 0.0), (10.0, 10.0)];
    let result = calculate_center(&points);
    assert!(result.is_some());
    let (cx, cy) = result.unwrap();
    assert!((cx - 5.0).abs() < 0.01);
    assert!((cy - 5.0).abs() < 0.01);
}

#[test]
fn test_calculate_center_single_point() {
    let points = vec![(5.0, 5.0)];
    let result = calculate_center(&points);
    assert!(result.is_some());
    let (cx, cy) = result.unwrap();
    assert!((cx - 5.0).abs() < 0.01);
    assert!((cy - 5.0).abs() < 0.01);
}

#[test]
fn test_calculate_center_empty() {
    let points: Vec<(f64, f64)> = vec![];
    let result = calculate_center(&points);
    assert!(result.is_none());
}

// ============== Tests pour calculate_bbox ==============

#[test]
fn test_calculate_bbox_basic() {
    let points = vec![(0.0, 0.0), (10.0, 10.0), (5.0, 5.0)];
    let result = calculate_bbox(&points);
    assert!(result.is_some());
    let (min_x, min_y, max_x, max_y) = result.unwrap();
    assert!((min_x - 0.0).abs() < 0.01);
    assert!((min_y - 0.0).abs() < 0.01);
    assert!((max_x - 10.0).abs() < 0.01);
    assert!((max_y - 10.0).abs() < 0.01);
}

#[test]
fn test_calculate_bbox_negative() {
    let points = vec![(-5.0, -5.0), (5.0, 5.0)];
    let result = calculate_bbox(&points);
    assert!(result.is_some());
    let (min_x, min_y, max_x, max_y) = result.unwrap();
    assert!((min_x - (-5.0)).abs() < 0.01);
    assert!((min_y - (-5.0)).abs() < 0.01);
    assert!((max_x - 5.0).abs() < 0.01);
    assert!((max_y - 5.0).abs() < 0.01);
}

#[test]
fn test_calculate_bbox_empty() {
    let points: Vec<(f64, f64)> = vec![];
    let result = calculate_bbox(&points);
    assert!(result.is_none());
}

// ============== Tests pour is_valid_coordinate ==============

#[test]
fn test_is_valid_coordinate_valid() {
    assert!(is_valid_coordinate(45.0, 90.0));
    assert!(is_valid_coordinate(-45.0, -90.0));
    assert!(is_valid_coordinate(0.0, 0.0));
}

#[test]
fn test_is_valid_coordinate_invalid_lat() {
    assert!(!is_valid_coordinate(100.0, 0.0));
    assert!(!is_valid_coordinate(-100.0, 0.0));
}

#[test]
fn test_is_valid_coordinate_invalid_lon() {
    assert!(!is_valid_coordinate(0.0, 200.0));
    assert!(!is_valid_coordinate(0.0, -200.0));
}

#[test]
fn test_is_valid_coordinate_boundaries() {
    assert!(is_valid_coordinate(90.0, 180.0));
    assert!(is_valid_coordinate(-90.0, -180.0));
}

// ============== Tests pour meters_to_degrees ==============

#[test]
fn test_meters_to_degrees_basic() {
    let degrees = meters_to_degrees(111320.0);
    assert!((degrees - 1.0).abs() < 0.1);
}

#[test]
fn test_meters_to_degrees_zero() {
    let degrees = meters_to_degrees(0.0);
    assert!((degrees - 0.0).abs() < 0.001);
}

// ============== Tests pour degrees_to_meters ==============

#[test]
fn test_degrees_to_meters_basic() {
    let meters = degrees_to_meters(1.0);
    assert!(meters > 111000.0 && meters < 112000.0);
}

#[test]
fn test_degrees_to_meters_zero() {
    let meters = degrees_to_meters(0.0);
    assert!((meters - 0.0).abs() < 0.001);
}

// ============== Tests pour calculate_bbox_area ==============

#[test]
fn test_calculate_bbox_area_basic() {
    let area = calculate_bbox_area(0.0, 0.0, 1.0, 1.0);
    assert!(area > 0.0);
}

#[test]
fn test_calculate_bbox_area_zero() {
    let area = calculate_bbox_area(0.0, 0.0, 0.0, 0.0);
    assert!((area - 0.0).abs() < 0.001);
}

// ============== Tests pour normalize_longitude ==============

#[test]
fn test_normalize_longitude_normal() {
    assert!((normalize_longitude(90.0) - 90.0).abs() < 0.001);
}

#[test]
fn test_normalize_longitude_over_180() {
    let normalized = normalize_longitude(270.0);
    assert!((normalized - (-90.0)).abs() < 0.001);
}

#[test]
fn test_normalize_longitude_under_minus_180() {
    let normalized = normalize_longitude(-270.0);
    assert!((normalized - 90.0).abs() < 0.001);
}

// ============== Tests pour calculate_bearing ==============

#[test]
fn test_calculate_bearing_north() {
    let bearing = calculate_bearing(0.0, 0.0, 1.0, 0.0);
    assert!(bearing.abs() < 1.0 || (bearing - 360.0).abs() < 1.0);
}

#[test]
fn test_calculate_bearing_east() {
    let bearing = calculate_bearing(0.0, 0.0, 0.0, 1.0);
    assert!((bearing - 90.0).abs() < 1.0);
}

#[test]
fn test_calculate_bearing_south() {
    let bearing = calculate_bearing(1.0, 0.0, 0.0, 0.0);
    assert!((bearing - 180.0).abs() < 1.0);
}

// ============== Tests pour bearing_to_cardinal ==============

#[test]
fn test_bearing_to_cardinal_north() {
    assert_eq!(bearing_to_cardinal(0.0), "N");
    assert_eq!(bearing_to_cardinal(360.0), "N");
}

#[test]
fn test_bearing_to_cardinal_east() {
    assert_eq!(bearing_to_cardinal(90.0), "E");
}

#[test]
fn test_bearing_to_cardinal_south() {
    assert_eq!(bearing_to_cardinal(180.0), "S");
}

#[test]
fn test_bearing_to_cardinal_west() {
    assert_eq!(bearing_to_cardinal(270.0), "W");
}

#[test]
fn test_bearing_to_cardinal_intermediate() {
    assert_eq!(bearing_to_cardinal(45.0), "NE");
    assert_eq!(bearing_to_cardinal(135.0), "SE");
}

// ============== Tests pour bbox_intersects ==============

#[test]
fn test_bbox_intersects_overlap() {
    assert!(bbox_intersects(
        (0.0, 0.0, 10.0, 10.0),
        (5.0, 5.0, 15.0, 15.0)
    ));
}

#[test]
fn test_bbox_intersects_no_overlap() {
    assert!(!bbox_intersects(
        (0.0, 0.0, 5.0, 5.0),
        (10.0, 10.0, 15.0, 15.0)
    ));
}

#[test]
fn test_bbox_intersects_contained() {
    assert!(bbox_intersects(
        (0.0, 0.0, 10.0, 10.0),
        (2.0, 2.0, 8.0, 8.0)
    ));
}

#[test]
fn test_bbox_intersects_touching() {
    assert!(bbox_intersects((0.0, 0.0, 5.0, 5.0), (5.0, 0.0, 10.0, 5.0)));
}

// ============== Tests pour midpoint ==============

#[test]
fn test_midpoint_basic() {
    let (mid_lat, mid_lon) = midpoint(0.0, 0.0, 10.0, 10.0);
    assert!((mid_lat - 5.0).abs() < 0.01);
    assert!((mid_lon - 5.0).abs() < 0.01);
}

#[test]
fn test_midpoint_same_point() {
    let (mid_lat, mid_lon) = midpoint(5.0, 5.0, 5.0, 5.0);
    assert!((mid_lat - 5.0).abs() < 0.01);
    assert!((mid_lon - 5.0).abs() < 0.01);
}

// ============== Tests pour round_coordinate ==============

#[test]
fn test_round_coordinate_default() {
    let rounded = round_coordinate(1.123456789, 6);
    assert!((rounded - 1.123457).abs() < 0.0000001);
}

#[test]
fn test_round_coordinate_two_decimals() {
    let rounded = round_coordinate(1.126, 2);
    assert!((rounded - 1.13).abs() < 0.001);
}

#[test]
fn test_round_coordinate_zero_decimals() {
    let rounded = round_coordinate(1.6, 0);
    assert!((rounded - 2.0).abs() < 0.001);
}
