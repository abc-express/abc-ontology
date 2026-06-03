use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

// ── Canonical Record ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanonicalRecord {
    pub id: String,
    pub entity_type: String,
    pub source: String,
    pub payload: Value,
    #[serde(default)]
    pub metadata: HashMap<String, Value>,
}

// ── Schema ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSchema {
    pub name: String,
    #[serde(rename = "type")]
    pub field_type: FieldType,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordSchema {
    pub entity_type: String,
    pub fields: Vec<FieldSchema>,
}

// ── Errors ─────────────────────────────────────────────────────────

#[derive(Error, Debug, PartialEq)]
pub enum DataError {
    #[error("invalid id: {0}")]
    InvalidId(String),

    #[error("missing required field: {field}")]
    MissingField { field: String },

    #[error("type mismatch for field '{field}': expected {expected:?}, got {got:?}")]
    TypeMismatch {
        field: String,
        expected: FieldType,
        got: FieldType,
    },

    #[error("unknown entity type: {0}")]
    UnknownEntityType(String),

    #[error("parse error: {0}")]
    Parse(String),
}

// ── Parser ─────────────────────────────────────────────────────────

/// Parse raw JSON input into a `CanonicalRecord`. The input must have an `id`
/// field; `entity_type` and `source` default to `"unknown"` if absent.
pub fn parse_record(raw: &str) -> Result<CanonicalRecord, DataError> {
    let mut value: Value =
        serde_json::from_str(raw).map_err(|e| DataError::Parse(e.to_string()))?;

    let obj = value
        .as_object_mut()
        .ok_or_else(|| DataError::Parse("expected JSON object".into()))?;

    let id = obj
        .remove("id")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default();

    if id.is_empty() {
        return Err(DataError::InvalidId("empty id".into()));
    }

    let entity_type = obj
        .remove("entity_type")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "unknown".into());

    let source = obj
        .remove("source")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "unknown".into());

    let metadata: HashMap<String, Value> = obj
        .remove("metadata")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(CanonicalRecord {
        id,
        entity_type,
        source,
        payload: Value::Object(obj.clone()),
        metadata,
    })
}

// ── Validator ──────────────────────────────────────────────────────

fn infer_type(value: &Value) -> FieldType {
    match value {
        Value::String(_) => FieldType::String,
        Value::Number(_) => FieldType::Number,
        Value::Bool(_) => FieldType::Boolean,
        Value::Array(_) => FieldType::Array,
        Value::Object(_) => FieldType::Object,
        _ => FieldType::String, // null → string
    }
}

/// Validate a record against a schema. Returns `Ok(())` when the record
/// satisfies all field constraints (required + types).
pub fn validate_record(rec: &CanonicalRecord, schema: &RecordSchema) -> Result<(), DataError> {
    if rec.entity_type != schema.entity_type {
        return Err(DataError::UnknownEntityType(rec.entity_type.clone()));
    }

    for field in &schema.fields {
        let payload_value = rec
            .payload
            .get(&field.name)
            .or_else(|| rec.metadata.get(&field.name));

        match payload_value {
            None if field.required => {
                return Err(DataError::MissingField {
                    field: field.name.clone(),
                });
            }
            Some(val) if !val.is_null() => {
                let actual = infer_type(val);
                if actual != field.field_type {
                    return Err(DataError::TypeMismatch {
                        field: field.name.clone(),
                        expected: field.field_type.clone(),
                        got: actual,
                    });
                }
            }
            _ => {} // absent optional or null value
        }
    }

    Ok(())
}

// ── Materializer ───────────────────────────────────────────────────

/// A materialized entity ready for the ontology registry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MaterializedEntity {
    pub id: String,
    pub entity_type: String,
    pub attributes: HashMap<String, Value>,
    pub relationships: Vec<Relationship>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Relationship {
    pub target_id: String,
    pub relation: String,
}

/// Mapping rule: extract a value from a payload path and store it under a
/// target attribute name.
#[derive(Debug, Clone)]
pub struct MappingRule {
    pub source_path: String, // dot-separated: "payload.name" or "metadata.region"
    pub target_attr: String,
    pub default: Option<Value>,
}

/// Materialize a canonical record into an ontology entity using mapping rules.
pub fn materialize(rec: &CanonicalRecord, rules: &[MappingRule]) -> MaterializedEntity {
    let mut attributes = HashMap::new();

    for rule in rules {
        let value = resolve_path(rec, &rule.source_path)
            .or_else(|| rule.default.clone())
            .unwrap_or(Value::Null);
        attributes.insert(rule.target_attr.clone(), value);
    }

    MaterializedEntity {
        id: rec.id.clone(),
        entity_type: rec.entity_type.clone(),
        attributes,
        relationships: Vec::new(),
    }
}

/// Resolve a dot-separated path against a record (e.g. `payload.address.city`).
fn resolve_path(rec: &CanonicalRecord, path: &str) -> Option<Value> {
    let mut parts = path.splitn(2, '.');
    let root = parts.next()?;
    let current: &Value = match root {
        "payload" => &rec.payload,
        "metadata" => {
            // We need to serialize metadata as a JSON value for traversal.
            // Use a static for the JSON representation.
            return resolve_json_path(
                &serde_json::to_value(&rec.metadata).ok()?,
                parts.next().unwrap_or(""),
            );
        }
        "id" => return Some(Value::String(rec.id.clone())),
        "entity_type" => return Some(Value::String(rec.entity_type.clone())),
        "source" => return Some(Value::String(rec.source.clone())),
        _ => return None,
    };

    match parts.next() {
        Some(rest) if !rest.is_empty() => resolve_json_path(current, rest),
        _ => Some(current.clone()),
    }
}

fn resolve_json_path(value: &Value, path: &str) -> Option<Value> {
    let mut current = value;
    for segment in path.split('.') {
        match current {
            Value::Object(map) => {
                current = map.get(segment)?;
            }
            _ => return None,
        }
    }
    Some(current.clone())
}

// ── Batch ──────────────────────────────────────────────────────────

/// Parse and validate a batch of records against a schema.
pub fn parse_batch(
    raw_batch: &str,
    schema: &RecordSchema,
) -> Result<Vec<CanonicalRecord>, DataError> {
    let values: Vec<Value> =
        serde_json::from_str(raw_batch).map_err(|e| DataError::Parse(e.to_string()))?;

    let mut records = Vec::with_capacity(values.len());
    for val in values {
        let raw = serde_json::to_string(&val).map_err(|e| DataError::Parse(e.to_string()))?;
        let rec = parse_record(&raw)?;
        validate_record(&rec, schema)?;
        records.push(rec);
    }
    Ok(records)
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_schema() -> RecordSchema {
        RecordSchema {
            entity_type: "invoice".into(),
            fields: vec![
                FieldSchema {
                    name: "amount".into(),
                    field_type: FieldType::Number,
                    required: true,
                },
                FieldSchema {
                    name: "currency".into(),
                    field_type: FieldType::String,
                    required: false,
                },
            ],
        }
    }

    // ── Parser tests ────────────────────────────────────────────

    #[test]
    fn parse_valid_record() {
        let raw = r#"{"id":"inv-1","entity_type":"invoice","source":"erp","amount":1500,"currency":"USD"}"#;
        let rec = parse_record(raw).unwrap();
        assert_eq!(rec.id, "inv-1");
        assert_eq!(rec.entity_type, "invoice");
        assert_eq!(rec.source, "erp");
        assert_eq!(rec.payload["amount"], 1500);
    }

    #[test]
    fn parse_defaults_missing_fields() {
        let raw = r#"{"id":"inv-2","amount":200}"#;
        let rec = parse_record(raw).unwrap();
        assert_eq!(rec.entity_type, "unknown");
        assert_eq!(rec.source, "unknown");
    }

    #[test]
    fn parse_rejects_empty_id() {
        let raw = r#"{"id":"","amount":100}"#;
        assert!(parse_record(raw).is_err());
    }

    #[test]
    fn parse_rejects_non_object() {
        assert!(parse_record("42").is_err());
        assert!(parse_record("\"string\"").is_err());
    }

    #[test]
    fn parse_extracts_metadata() {
        let raw = r#"{"id":"inv-3","entity_type":"invoice","source":"api","amount":99,"metadata":{"region":"eu","priority":1}}"#;
        let rec = parse_record(raw).unwrap();
        assert_eq!(rec.metadata["region"], "eu");
        assert_eq!(rec.metadata["priority"], 1);
    }

    // ── Validator tests ─────────────────────────────────────────

    #[test]
    fn validate_passing_record() {
        let raw = r#"{"id":"inv-ok","entity_type":"invoice","amount":500}"#;
        let rec = parse_record(raw).unwrap();
        assert!(validate_record(&rec, &test_schema()).is_ok());
    }

    #[test]
    fn validate_rejects_wrong_entity_type() {
        let raw = r#"{"id":"x","entity_type":"order","amount":1}"#;
        let rec = parse_record(raw).unwrap();
        let err = validate_record(&rec, &test_schema()).unwrap_err();
        assert!(matches!(err, DataError::UnknownEntityType(_)));
    }

    #[test]
    fn validate_rejects_missing_required() {
        let raw = r#"{"id":"x","entity_type":"invoice"}"#;
        let rec = parse_record(raw).unwrap();
        let err = validate_record(&rec, &test_schema()).unwrap_err();
        assert!(matches!(err, DataError::MissingField { .. }));
    }

    #[test]
    fn validate_rejects_type_mismatch() {
        let raw = r#"{"id":"x","entity_type":"invoice","amount":"a lot"}"#;
        let rec = parse_record(raw).unwrap();
        let err = validate_record(&rec, &test_schema()).unwrap_err();
        assert!(matches!(err, DataError::TypeMismatch { .. }));
    }

    #[test]
    fn validate_allows_optional_absent() {
        let raw = r#"{"id":"x","entity_type":"invoice","amount":10}"#;
        let rec = parse_record(raw).unwrap();
        assert!(validate_record(&rec, &test_schema()).is_ok());
    }

    #[test]
    fn validate_reads_optional_from_metadata() {
        let raw = r#"{"id":"x","entity_type":"invoice","amount":10,"metadata":{"currency":"EUR"}}"#;
        let rec = parse_record(raw).unwrap();
        // currency is optional and provided via metadata — should pass
        assert!(validate_record(&rec, &test_schema()).is_ok());
    }

    // ── Materializer tests ──────────────────────────────────────

    #[test]
    fn materialize_maps_fields() {
        let raw = r#"{"id":"inv-1","entity_type":"invoice","amount":1500,"region":"APAC"}"#;
        let rec = parse_record(raw).unwrap();
        let rules = vec![
            MappingRule {
                source_path: "payload.amount".into(),
                target_attr: "total".into(),
                default: None,
            },
            MappingRule {
                source_path: "payload.region".into(),
                target_attr: "territory".into(),
                default: None,
            },
        ];
        let entity = materialize(&rec, &rules);
        assert_eq!(entity.id, "inv-1");
        assert_eq!(entity.attributes["total"], 1500);
        assert_eq!(entity.attributes["territory"], "APAC");
    }

    #[test]
    fn materialize_applies_default() {
        let raw = r#"{"id":"inv-2","entity_type":"invoice","amount":50}"#;
        let rec = parse_record(raw).unwrap();
        let rules = vec![MappingRule {
            source_path: "payload.missing".into(),
            target_attr: "fallback".into(),
            default: Some(Value::String("N/A".into())),
        }];
        let entity = materialize(&rec, &rules);
        assert_eq!(entity.attributes["fallback"], "N/A");
    }

    #[test]
    fn materialize_resolves_metadata_path() {
        let raw = r#"{"id":"inv-3","entity_type":"invoice","amount":1,"metadata":{"env":"prod"}}"#;
        let rec = parse_record(raw).unwrap();
        let rules = vec![MappingRule {
            source_path: "metadata.env".into(),
            target_attr: "environment".into(),
            default: None,
        }];
        let entity = materialize(&rec, &rules);
        assert_eq!(entity.attributes["environment"], "prod");
    }

    #[test]
    fn materialize_resolves_top_level_fields() {
        let raw = r#"{"id":"inv-4","entity_type":"invoice","source":"sap"}"#;
        let rec = parse_record(raw).unwrap();
        let rules = vec![
            MappingRule {
                source_path: "id".into(),
                target_attr: "external_id".into(),
                default: None,
            },
            MappingRule {
                source_path: "source".into(),
                target_attr: "origin".into(),
                default: None,
            },
        ];
        let entity = materialize(&rec, &rules);
        assert_eq!(entity.attributes["external_id"], "inv-4");
        assert_eq!(entity.attributes["origin"], "sap");
    }

    // ── Batch tests ─────────────────────────────────────────────

    #[test]
    fn parse_batch_validates_all() {
        let batch = r#"[
            {"id":"a","entity_type":"invoice","amount":100},
            {"id":"b","entity_type":"invoice","amount":200}
        ]"#;
        let records = parse_batch(batch, &test_schema()).unwrap();
        assert_eq!(records.len(), 2);
    }

    #[test]
    fn parse_batch_fails_on_first_invalid() {
        let batch = r#"[
            {"id":"a","entity_type":"invoice","amount":100},
            {"id":"b","entity_type":"invoice"}
        ]"#;
        assert!(parse_batch(batch, &test_schema()).is_err());
    }
}
