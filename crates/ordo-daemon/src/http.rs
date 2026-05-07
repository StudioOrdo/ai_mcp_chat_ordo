use crate::health::{build_health_report, build_readiness_report};
use anyhow::{Context, Result};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};

pub fn render_response(path: &str) -> Result<String> {
    let (status, body) = match path {
        "/health" => ("200 OK", serde_json::to_string(&build_health_report())?),
        "/ready" => ("200 OK", serde_json::to_string(&build_readiness_report())?),
        _ => ("404 Not Found", "{\"error\":\"not_found\"}".to_string()),
    };

    Ok(format!(
        "HTTP/1.1 {status}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
        body.len(),
    ))
}

pub fn serve_once(host: &str, port: u16) -> Result<()> {
    let listener = TcpListener::bind((host, port))
        .with_context(|| format!("Unable to bind ordo-daemon proof listener on {host}:{port}"))?;
    let (stream, _) = listener
        .accept()
        .context("Unable to accept health request")?;
    handle_stream(stream)
}

fn handle_stream(mut stream: TcpStream) -> Result<()> {
    let mut buffer = [0_u8; 1024];
    let read = stream
        .read(&mut buffer)
        .context("Unable to read health request")?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let path = parse_path(&request).unwrap_or("/");
    let response = render_response(path)?;
    stream
        .write_all(response.as_bytes())
        .context("Unable to write health response")
}

fn parse_path(request: &str) -> Option<&str> {
    let mut parts = request.lines().next()?.split_whitespace();
    let method = parts.next()?;
    if method != "GET" {
        return Some("/");
    }
    parts.next()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn response_body(response: &str) -> &str {
        response
            .split_once("\r\n\r\n")
            .map(|(_, body)| body)
            .unwrap_or("")
    }

    fn content_length(response: &str) -> usize {
        response
            .lines()
            .find_map(|line| line.strip_prefix("content-length: "))
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0)
    }

    #[test]
    fn renders_health_endpoint_response() {
        let response = render_response("/health").unwrap();
        assert!(response.starts_with("HTTP/1.1 200 OK"));
        assert!(response.contains("\"service\":\"ordo-daemon\""));
        assert!(response.contains("\"mode\":\"pre_integration_runway\""));
        assert_eq!(content_length(&response), response_body(&response).len());
    }

    #[test]
    fn renders_ready_endpoint_response() {
        let response = render_response("/ready").unwrap();
        assert!(response.starts_with("HTTP/1.1 200 OK"));
        assert!(response.contains("\"schemaVersion\":\"1\""));
        assert_eq!(content_length(&response), response_body(&response).len());
    }

    #[test]
    fn renders_not_found_for_unknown_path() {
        let response = render_response("/jobs").unwrap();
        assert!(response.starts_with("HTTP/1.1 404 Not Found"));
        assert_eq!(response_body(&response), "{\"error\":\"not_found\"}");
        assert_eq!(content_length(&response), response_body(&response).len());
    }
}
