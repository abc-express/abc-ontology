//! Ontology semantic/vector HTTP shim server.
//!
//! Listens on `ONTOLOGY_SHIM_ADDR` (default `127.0.0.1:8082`) and serves the
//! routes implemented in `daemon_ontology_shim`. A single shared `Shim` is
//! guarded by a mutex so concurrent connections see a consistent store.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};

use daemon_ontology_shim::{parse_request, HttpResponse, Shim};

fn main() {
    let addr = std::env::var("ONTOLOGY_SHIM_ADDR").unwrap_or_else(|_| "127.0.0.1:8082".to_string());
    let listener = TcpListener::bind(&addr).unwrap_or_else(|e| {
        eprintln!("ontology-shim: failed to bind {addr}: {e}");
        std::process::exit(1);
    });
    eprintln!("ontology-shim: listening on {addr}");

    let shim = Arc::new(Mutex::new(Shim::new()));

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let shim = Arc::clone(&shim);
                // Connections are short-lived (Connection: close); handle inline.
                if let Err(e) = handle_connection(stream, &shim) {
                    eprintln!("ontology-shim: connection error: {e}");
                }
            }
            Err(e) => eprintln!("ontology-shim: accept error: {e}"),
        }
    }
}

/// Read a full HTTP request from the socket (headers + Content-Length body),
/// dispatch it to the shim, and write the response back.
fn handle_connection(mut stream: TcpStream, shim: &Mutex<Shim>) -> std::io::Result<()> {
    let raw = match read_http_request(&mut stream)? {
        Some(raw) => raw,
        None => return Ok(()),
    };

    let response = match parse_request(&raw) {
        Some(req) => {
            let mut guard = shim.lock().expect("shim mutex poisoned");
            guard.handle(&req)
        }
        None => HttpResponse {
            status: 400,
            body: "{\"error\":\"malformed request\"}".to_string(),
        },
    };

    stream.write_all(response.to_wire().as_bytes())?;
    stream.flush()
}

/// Read bytes until headers complete, then read exactly `Content-Length` body
/// bytes. Returns `None` if the client closed without sending anything.
fn read_http_request(stream: &mut TcpStream) -> std::io::Result<Option<String>> {
    let mut buf: Vec<u8> = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];

    // Read until we have the end of headers.
    let header_end = loop {
        if let Some(pos) = find_subsequence(&buf, b"\r\n\r\n") {
            break pos + 4;
        }
        let n = stream.read(&mut chunk)?;
        if n == 0 {
            if buf.is_empty() {
                return Ok(None);
            }
            // Headers never terminated; treat what we have as the request.
            return Ok(Some(String::from_utf8_lossy(&buf).to_string()));
        }
        buf.extend_from_slice(&chunk[..n]);
    };

    let content_length = parse_content_length(&buf[..header_end]);
    let body_have = buf.len() - header_end;

    // Read remaining body bytes if Content-Length indicates more.
    while buf.len() - header_end < content_length {
        let n = stream.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }

    let _ = body_have;
    Ok(Some(String::from_utf8_lossy(&buf).to_string()))
}

/// Locate the byte offset of `needle` within `haystack`.
fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

/// Parse the `Content-Length` header value from the raw header bytes.
fn parse_content_length(headers: &[u8]) -> usize {
    let text = String::from_utf8_lossy(headers);
    for line in text.lines() {
        if let Some((name, value)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("content-length") {
                return value.trim().parse().unwrap_or(0);
            }
        }
    }
    0
}
