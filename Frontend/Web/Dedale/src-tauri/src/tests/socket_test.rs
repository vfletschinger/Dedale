use crate::socket::{
    build_events_query, build_websocket_uri, create_ack_response, create_error_message,
    create_socket_addr, generate_qr_code_base64, generate_sql_placeholders, get_default_local_ip,
    identify_message_type, is_valid_port, random_port, serialize_ack_response,
    WebSocketMessageType,
};
use std::net::{IpAddr, Ipv4Addr};

// ============== Tests pour random_port ==============

#[test]
fn test_random_port_range() {
    for _ in 0..100 {
        let port = random_port();
        assert!((1025..=65534).contains(&port), "Port {} out of range", port);
    }
}

#[test]
fn test_random_port_unique() {
    let ports: Vec<u16> = (0..20).map(|_| random_port()).collect();
    // Au moins quelques ports devraient être différents sur 20 essais
    let unique: std::collections::HashSet<_> = ports.iter().collect();
    assert!(
        unique.len() > 1,
        "All ports are the same, which is highly unlikely"
    );
}

// ============== Tests pour generate_sql_placeholders ==============

#[test]
fn test_generate_sql_placeholders_single() {
    let placeholders = generate_sql_placeholders(1);
    assert_eq!(placeholders, "?");
}

#[test]
fn test_generate_sql_placeholders_multiple() {
    let placeholders = generate_sql_placeholders(3);
    assert_eq!(placeholders, "?, ?, ?");
}

#[test]
fn test_generate_sql_placeholders_zero() {
    let placeholders = generate_sql_placeholders(0);
    assert_eq!(placeholders, "");
}

#[test]
fn test_generate_sql_placeholders_five() {
    let placeholders = generate_sql_placeholders(5);
    assert_eq!(placeholders, "?, ?, ?, ?, ?");
}

// ============== Tests pour build_websocket_uri ==============

#[test]
fn test_build_websocket_uri_basic() {
    let uri = build_websocket_uri("192.168.1.1", 8080, "/ws");
    assert_eq!(uri, "ws://192.168.1.1:8080/ws");
}

#[test]
fn test_build_websocket_uri_localhost() {
    let uri = build_websocket_uri("127.0.0.1", 3000, "/");
    assert_eq!(uri, "ws://127.0.0.1:3000/");
}

#[test]
fn test_build_websocket_uri_empty_path() {
    let uri = build_websocket_uri("localhost", 9000, "");
    assert_eq!(uri, "ws://localhost:9000");
}

// ============== Tests pour generate_qr_code_base64 ==============

#[test]
fn test_generate_qr_code_base64_valid() {
    let result = generate_qr_code_base64("test data");
    assert!(result.is_ok());
    let qr = result.unwrap();
    assert!(qr.starts_with("data:image/png;base64,"));
    assert!(qr.len() > 50);
}

#[test]
fn test_generate_qr_code_base64_url() {
    let result = generate_qr_code_base64("ws://192.168.1.1:8080");
    assert!(result.is_ok());
}

#[test]
fn test_generate_qr_code_base64_long_string() {
    let long_str = "x".repeat(100);
    let result = generate_qr_code_base64(&long_str);
    assert!(result.is_ok());
}

// ============== Tests pour create_ack_response ==============

#[test]
fn test_create_ack_response_success() {
    let response = create_ack_response(200, "Success");
    assert!(response.contains("200"));
    assert!(response.contains("Success"));
}

#[test]
fn test_create_ack_response_error() {
    let response = create_ack_response(500, "Internal Error");
    assert!(response.contains("500"));
    assert!(response.contains("Internal Error"));
}

#[test]
fn test_create_ack_response_json_format() {
    let response = create_ack_response(200, "OK");
    assert!(response.contains("\"code\""));
    assert!(response.contains("\"message\""));
}

// ============== Tests pour serialize_ack_response ==============

#[test]
fn test_serialize_ack_response() {
    let result = serialize_ack_response(200, "Operation successful");
    assert!(result.contains("200"));
    assert!(result.contains("successful"));
}

// ============== Tests pour WebSocketMessageType ==============

#[test]
fn test_websocket_message_type_variants() {
    let event_ack = WebSocketMessageType::EventAck;
    let export_data = WebSocketMessageType::ExportData;
    let action = WebSocketMessageType::Action;
    let unknown = WebSocketMessageType::Unknown;

    // Test Debug trait
    assert!(!format!("{:?}", event_ack).is_empty());
    assert!(!format!("{:?}", export_data).is_empty());
    assert!(!format!("{:?}", action).is_empty());
    assert!(!format!("{:?}", unknown).is_empty());
}

#[test]
fn test_websocket_message_type_equality() {
    assert_eq!(
        WebSocketMessageType::EventAck,
        WebSocketMessageType::EventAck
    );
    assert_ne!(WebSocketMessageType::EventAck, WebSocketMessageType::Action);
}

// ============== Tests pour identify_message_type ==============

#[test]
fn test_identify_message_type_action() {
    let msg_type = identify_message_type(r#"{"action":"connect"}"#);
    assert_eq!(msg_type, WebSocketMessageType::Action);
}

#[test]
fn test_identify_message_type_export_data() {
    let msg_type = identify_message_type(r#"{"event":{},"points":[]}"#);
    assert_eq!(msg_type, WebSocketMessageType::ExportData);
}

#[test]
fn test_identify_message_type_event_ack() {
    let msg_type = identify_message_type(r#"{"id":1,"name":"test"}"#);
    assert_eq!(msg_type, WebSocketMessageType::EventAck);
}

#[test]
fn test_identify_message_type_unknown() {
    let msg_type = identify_message_type(r#"{"something":"else"}"#);
    assert_eq!(msg_type, WebSocketMessageType::Unknown);
}

// ============== Tests pour create_error_message ==============

#[test]
fn test_create_error_message_basic() {
    let error = create_error_message(500, "Something went wrong");
    assert!(error.contains("error"));
    assert!(error.contains("true"));
    assert!(error.contains("500"));
    assert!(error.contains("Something went wrong"));
}

#[test]
fn test_create_error_message_not_found() {
    let error = create_error_message(404, "Not found");
    assert!(error.contains("404"));
    assert!(error.contains("Not found"));
}

// ============== Tests pour create_socket_addr ==============

#[test]
fn test_create_socket_addr_ipv4() {
    let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
    let addr = create_socket_addr(ip, 8080);
    assert_eq!(addr.port(), 8080);
    assert_eq!(addr.ip(), ip);
}

#[test]
fn test_create_socket_addr_different_ports() {
    let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1));

    let addr1 = create_socket_addr(ip, 3000);
    let addr2 = create_socket_addr(ip, 9000);

    assert_eq!(addr1.port(), 3000);
    assert_eq!(addr2.port(), 9000);
}

// ============== Tests pour build_events_query ==============

#[test]
fn test_build_events_query_single() {
    let query = build_events_query(&[1]);
    assert!(query.contains("SELECT"));
    assert!(query.contains("FROM event"));
    assert!(query.contains("IN (?)"));
}

#[test]
fn test_build_events_query_multiple() {
    let query = build_events_query(&[1, 2, 3]);
    assert!(query.contains("SELECT"));
    assert!(query.contains("IN (?, ?, ?)"));
}

#[test]
fn test_build_events_query_empty() {
    let query = build_events_query(&[]);
    assert!(query.contains("WHERE 1=0"));
}

// ============== Tests pour is_valid_port ==============

#[test]
fn test_is_valid_port_valid() {
    assert!(is_valid_port(8080));
    assert!(is_valid_port(3000));
    assert!(is_valid_port(1025));
    assert!(is_valid_port(65534));
}

#[test]
fn test_is_valid_port_invalid_low() {
    assert!(!is_valid_port(0));
    assert!(!is_valid_port(1));
    assert!(!is_valid_port(80));
    assert!(!is_valid_port(1024));
}

#[test]
fn test_is_valid_port_invalid_high() {
    assert!(!is_valid_port(65535));
}

// ============== Tests pour get_default_local_ip ==============

#[test]
fn test_get_default_local_ip_not_empty() {
    let ip = get_default_local_ip();
    // L'IP doit être valide (soit locale, soit 127.0.0.1)
    match ip {
        IpAddr::V4(v4) => {
            // IPv4 is valid
            let octets = v4.octets();
            assert!(
                octets[0] > 0
                    || (octets[0] == 127 && octets[1] == 0 && octets[2] == 0 && octets[3] == 1)
            );
        }
        IpAddr::V6(_) => {
            // IPv6 is also valid
        }
    }
}

#[test]
fn test_get_default_local_ip_format() {
    let ip = get_default_local_ip();
    let ip_str = format!("{}", ip);
    assert!(!ip_str.is_empty());
}
