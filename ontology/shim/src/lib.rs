//! Thin HTTP shim exposing the Rust ontology semantic and vector layers over a
//! minimal HTTP/1.1 protocol. Called from the TypeScript ingest normalization
//! path so the gateway/Node side avoids cgo/FFI complexity in CI.
//!
//! Routes:
//!   GET  /health            -> { "status": "ok", "docs": n, "vectors": n, "dim": d }
//!   POST /semantic/index    { "entity_id": s, "text": s }      -> { "indexed": true, "docs": n }
//!   POST /semantic/search   { "query": s, "k": n? }            -> { "hits": [{ "entity_id", "score" }] }
//!   POST /vector/upsert     { "id": s, "vector": [f32] }       -> { "upserted": true, "vectors": n, "dim": d }
//!   POST /vector/search     { "vector": [f32], "k": n? }       -> { "neighbours": [{ "id", "score" }] }
//!
//! The vector store adopts the dimension of the first upserted vector and
//! rejects mismatched dimensions thereafter with HTTP 400.

use daemon_semantic_layer::{SemanticDocument, SemanticIndex};
use daemon_vector_layer::{VectorError, VectorStore};
use serde::Deserialize;
use serde_json::{json, Value};

/// A parsed HTTP request: method, path (without query string), and raw body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpRequest {
    pub method: String,
    pub path: String,
    pub body: String,
}

/// Parse a raw HTTP/1.1 request string into method, path, and body. Returns
/// `None` when the request line is malformed. The body is everything after the
/// first blank line (`\r\n\r\n` or `\n\n`).
pub fn parse_request(raw: &str) -> Option<HttpRequest> {
    let mut lines = raw.lines();
    let request_line = lines.next()?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next()?.to_string();
    let target = parts.next()?.to_string();
    let path = target
        .split('?')
        .next()
        .unwrap_or(&target)
        .trim_end_matches('/')
        .to_string();
    let path = if path.is_empty() { "/".to_string() } else { path };

    let body = match raw.split_once("\r\n\r\n") {
        Some((_, b)) => b.to_string(),
        None => match raw.split_once("\n\n") {
            Some((_, b)) => b.to_string(),
            None => String::new(),
        },
    };

    Some(HttpRequest { method, path, body })
}

/// A serialized HTTP response.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

impl HttpResponse {
    fn json(status: u16, value: Value) -> Self {
        Self {
            status,
            body: value.to_string(),
        }
    }

    fn reason(&self) -> &'static str {
        match self.status {
            200 => "OK",
            400 => "Bad Request",
            404 => "Not Found",
            405 => "Method Not Allowed",
            _ => "Internal Server Error",
        }
    }

    /// Render the full HTTP/1.1 wire response with headers.
    pub fn to_wire(&self) -> String {
        format!(
            "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            self.status,
            self.reason(),
            self.body.as_bytes().len(),
            self.body
        )
    }
}

#[derive(Debug, Deserialize)]
struct IndexBody {
    entity_id: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct SemanticSearchBody {
    query: String,
    #[serde(default)]
    k: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct VectorUpsertBody {
    id: String,
    vector: Vec<f32>,
}

#[derive(Debug, Deserialize)]
struct VectorSearchBody {
    vector: Vec<f32>,
    #[serde(default)]
    k: Option<usize>,
}

const DEFAULT_K: usize = 10;

/// In-memory ontology shim holding a semantic index and a lazily-dimensioned
/// vector store. Not thread-safe by itself; the binary serializes access.
#[derive(Debug, Default)]
pub struct Shim {
    semantic: SemanticIndex,
    vectors: Option<VectorStore>,
}

impl Shim {
    pub fn new() -> Self {
        Self::default()
    }

    /// Route and handle a parsed request, producing a JSON response.
    pub fn handle(&mut self, req: &HttpRequest) -> HttpResponse {
        match (req.method.as_str(), req.path.as_str()) {
            ("GET", "/health") => HttpResponse::json(
                200,
                json!({
                    "status": "ok",
                    "docs": self.semantic.len(),
                    "vectors": self.vectors.as_ref().map(VectorStore::len).unwrap_or(0),
                    "dim": self.vectors.as_ref().map(VectorStore::dim).unwrap_or(0),
                }),
            ),
            ("POST", "/semantic/index") => self.semantic_index(&req.body),
            ("POST", "/semantic/search") => self.semantic_search(&req.body),
            ("POST", "/vector/upsert") => self.vector_upsert(&req.body),
            ("POST", "/vector/search") => self.vector_search(&req.body),
            ("GET", _) | ("POST", _) => {
                HttpResponse::json(404, json!({ "error": "not found", "path": req.path }))
            }
            _ => HttpResponse::json(405, json!({ "error": "method not allowed" })),
        }
    }

    fn semantic_index(&mut self, body: &str) -> HttpResponse {
        let parsed: IndexBody = match serde_json::from_str(body) {
            Ok(b) => b,
            Err(e) => return bad_request(&e.to_string()),
        };
        self.semantic.index(&SemanticDocument {
            entity_id: parsed.entity_id,
            text: parsed.text,
        });
        HttpResponse::json(200, json!({ "indexed": true, "docs": self.semantic.len() }))
    }

    fn semantic_search(&mut self, body: &str) -> HttpResponse {
        let parsed: SemanticSearchBody = match serde_json::from_str(body) {
            Ok(b) => b,
            Err(e) => return bad_request(&e.to_string()),
        };
        let hits = self.semantic.search(&parsed.query, parsed.k.unwrap_or(DEFAULT_K));
        let hits: Vec<Value> = hits
            .into_iter()
            .map(|h| json!({ "entity_id": h.entity_id, "score": h.score }))
            .collect();
        HttpResponse::json(200, json!({ "hits": hits }))
    }

    fn vector_upsert(&mut self, body: &str) -> HttpResponse {
        let parsed: VectorUpsertBody = match serde_json::from_str(body) {
            Ok(b) => b,
            Err(e) => return bad_request(&e.to_string()),
        };
        if parsed.vector.is_empty() {
            return bad_request("vector must be non-empty");
        }
        let store = self
            .vectors
            .get_or_insert_with(|| VectorStore::new(parsed.vector.len()));
        match store.upsert(parsed.id, parsed.vector) {
            Ok(()) => HttpResponse::json(
                200,
                json!({ "upserted": true, "vectors": store.len(), "dim": store.dim() }),
            ),
            Err(VectorError::DimensionMismatch { expected, got }) => bad_request(&format!(
                "dimension mismatch: expected {expected}, got {got}"
            )),
        }
    }

    fn vector_search(&mut self, body: &str) -> HttpResponse {
        let parsed: VectorSearchBody = match serde_json::from_str(body) {
            Ok(b) => b,
            Err(e) => return bad_request(&e.to_string()),
        };
        let Some(store) = self.vectors.as_ref() else {
            return HttpResponse::json(200, json!({ "neighbours": [] }));
        };
        match store.search(&parsed.vector, parsed.k.unwrap_or(DEFAULT_K)) {
            Ok(neighbours) => {
                let neighbours: Vec<Value> = neighbours
                    .into_iter()
                    .map(|n| json!({ "id": n.id, "score": n.score }))
                    .collect();
                HttpResponse::json(200, json!({ "neighbours": neighbours }))
            }
            Err(VectorError::DimensionMismatch { expected, got }) => bad_request(&format!(
                "dimension mismatch: expected {expected}, got {got}"
            )),
        }
    }
}

fn bad_request(message: &str) -> HttpResponse {
    HttpResponse::json(400, json!({ "error": message }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(method: &str, path: &str, body: &str) -> HttpRequest {
        HttpRequest {
            method: method.into(),
            path: path.into(),
            body: body.into(),
        }
    }

    #[test]
    fn parses_request_line_and_body() {
        let raw = "POST /semantic/index HTTP/1.1\r\nHost: x\r\nContent-Length: 9\r\n\r\n{\"a\":1}";
        let parsed = parse_request(raw).expect("parse");
        assert_eq!(parsed.method, "POST");
        assert_eq!(parsed.path, "/semantic/index");
        assert_eq!(parsed.body, "{\"a\":1}");
    }

    #[test]
    fn parse_strips_query_and_trailing_slash() {
        let raw = "GET /health/?verbose=1 HTTP/1.1\r\n\r\n";
        let parsed = parse_request(raw).expect("parse");
        assert_eq!(parsed.path, "/health");
        assert_eq!(parsed.body, "");
    }

    #[test]
    fn parse_rejects_empty() {
        assert!(parse_request("").is_none());
    }

    #[test]
    fn wire_includes_status_and_length() {
        let res = HttpResponse::json(200, json!({ "ok": true }));
        let wire = res.to_wire();
        assert!(wire.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(wire.contains("Content-Length: 11"));
        assert!(wire.ends_with("{\"ok\":true}"));
    }

    #[test]
    fn health_reports_counts() {
        let mut shim = Shim::new();
        let res = shim.handle(&req("GET", "/health", ""));
        assert_eq!(res.status, 200);
        let v: Value = serde_json::from_str(&res.body).unwrap();
        assert_eq!(v["status"], "ok");
        assert_eq!(v["docs"], 0);
        assert_eq!(v["vectors"], 0);
    }

    #[test]
    fn semantic_index_then_search() {
        let mut shim = Shim::new();
        let r = shim.handle(&req(
            "POST",
            "/semantic/index",
            "{\"entity_id\":\"inv\",\"text\":\"invoice payment overdue\"}",
        ));
        assert_eq!(r.status, 200);
        let v: Value = serde_json::from_str(&r.body).unwrap();
        assert_eq!(v["indexed"], true);
        assert_eq!(v["docs"], 1);

        let s = shim.handle(&req(
            "POST",
            "/semantic/search",
            "{\"query\":\"invoice\",\"k\":5}",
        ));
        assert_eq!(s.status, 200);
        let sv: Value = serde_json::from_str(&s.body).unwrap();
        assert_eq!(sv["hits"].as_array().unwrap().len(), 1);
        assert_eq!(sv["hits"][0]["entity_id"], "inv");
    }

    #[test]
    fn vector_upsert_sets_dimension_and_searches() {
        let mut shim = Shim::new();
        let u = shim.handle(&req(
            "POST",
            "/vector/upsert",
            "{\"id\":\"near\",\"vector\":[1.0,0.1]}",
        ));
        assert_eq!(u.status, 200);
        let uv: Value = serde_json::from_str(&u.body).unwrap();
        assert_eq!(uv["dim"], 2);

        shim.handle(&req(
            "POST",
            "/vector/upsert",
            "{\"id\":\"far\",\"vector\":[0.0,1.0]}",
        ));

        let s = shim.handle(&req(
            "POST",
            "/vector/search",
            "{\"vector\":[1.0,0.0],\"k\":2}",
        ));
        assert_eq!(s.status, 200);
        let sv: Value = serde_json::from_str(&s.body).unwrap();
        let neighbours = sv["neighbours"].as_array().unwrap();
        assert_eq!(neighbours.len(), 2);
        assert_eq!(neighbours[0]["id"], "near");
    }

    #[test]
    fn vector_dimension_mismatch_is_bad_request() {
        let mut shim = Shim::new();
        shim.handle(&req(
            "POST",
            "/vector/upsert",
            "{\"id\":\"a\",\"vector\":[1.0,0.0,0.0]}",
        ));
        let bad = shim.handle(&req(
            "POST",
            "/vector/upsert",
            "{\"id\":\"b\",\"vector\":[1.0,0.0]}",
        ));
        assert_eq!(bad.status, 400);
        let v: Value = serde_json::from_str(&bad.body).unwrap();
        assert!(v["error"].as_str().unwrap().contains("dimension mismatch"));
    }

    #[test]
    fn vector_search_before_upsert_is_empty() {
        let mut shim = Shim::new();
        let s = shim.handle(&req("POST", "/vector/search", "{\"vector\":[1.0,0.0]}"));
        assert_eq!(s.status, 200);
        let v: Value = serde_json::from_str(&s.body).unwrap();
        assert_eq!(v["neighbours"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn malformed_json_is_bad_request() {
        let mut shim = Shim::new();
        let r = shim.handle(&req("POST", "/semantic/index", "not json"));
        assert_eq!(r.status, 400);
    }

    #[test]
    fn unknown_route_is_not_found() {
        let mut shim = Shim::new();
        let r = shim.handle(&req("GET", "/nope", ""));
        assert_eq!(r.status, 404);
    }

    #[test]
    fn unsupported_method_is_405() {
        let mut shim = Shim::new();
        let r = shim.handle(&req("DELETE", "/health", ""));
        assert_eq!(r.status, 405);
    }
}
