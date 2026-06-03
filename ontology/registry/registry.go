// Package registry provides an in-process ontology registry and an HTTP service
// that mirrors the semantics of the TypeScript OntologyRegistry
// (ontology/registry/ontology-registry.ts). It is the system-of-record used by
// the Go ingest path to register and mutate entities.
package registry

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"
)

// ErrNotFound is returned when an entity does not exist for the given ontology
// and entity id.
var ErrNotFound = errors.New("entity not found")

// EntityRecord mirrors the TypeScript EntityRecord shape so payloads are
// interchangeable across the Go and TS registries.
type EntityRecord struct {
	EntityID   string                 `json:"entityId"`
	OntologyID string                 `json:"ontologyId"`
	Properties map[string]interface{} `json:"properties"`
	Version    int                    `json:"version"`
	UpdatedAt  string                 `json:"updatedAt"`
}

// Registry is a concurrency-safe ontology registry keyed by "ontologyId:entityId".
type Registry struct {
	mu       sync.Mutex
	entities map[string]EntityRecord
	seq      int
	now      func() time.Time
}

// New constructs an empty Registry using the wall clock for timestamps.
func New() *Registry {
	return &Registry{
		entities: make(map[string]EntityRecord),
		now:      func() time.Time { return time.Now().UTC() },
	}
}

func key(ontologyID, entityID string) string {
	return ontologyID + ":" + entityID
}

// Register creates a new entity record. When id is empty a deterministic id is
// generated from the current registry size, matching the TS implementation.
func (r *Registry) Register(ontologyID string, props map[string]interface{}, id string) EntityRecord {
	r.mu.Lock()
	defer r.mu.Unlock()
	if id == "" {
		r.seq++
		id = "ent-" + itoa(r.seq)
	}
	rec := EntityRecord{
		EntityID:   id,
		OntologyID: ontologyID,
		Properties: cloneProps(props),
		Version:    1,
		UpdatedAt:  r.now().Format(time.RFC3339Nano),
	}
	r.entities[key(ontologyID, id)] = rec
	return rec
}

// Get returns the entity record and true when present.
func (r *Registry) Get(ontologyID, entityID string) (EntityRecord, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.entities[key(ontologyID, entityID)]
	return rec, ok
}

// Patch merges patch into the existing properties and bumps the version. It
// returns ErrNotFound when the entity does not exist.
func (r *Registry) Patch(ontologyID, entityID string, patch map[string]interface{}) (EntityRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	k := key(ontologyID, entityID)
	existing, ok := r.entities[k]
	if !ok {
		return EntityRecord{}, ErrNotFound
	}
	merged := cloneProps(existing.Properties)
	for field, value := range patch {
		merged[field] = value
	}
	next := EntityRecord{
		EntityID:   existing.EntityID,
		OntologyID: existing.OntologyID,
		Properties: merged,
		Version:    existing.Version + 1,
		UpdatedAt:  r.now().Format(time.RFC3339Nano),
	}
	r.entities[k] = next
	return next, nil
}

// Len reports the number of stored entities.
func (r *Registry) Len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.entities)
}

func cloneProps(in map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(in))
	for field, value := range in {
		out[field] = value
	}
	return out
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

// Handler returns an HTTP handler exposing CRUD operations that mirror the TS
// registry semantics.
//
//	GET   /health
//	POST  /v1/ontologies/{ontologyId}/entities          register
//	GET   /v1/ontologies/{ontologyId}/entities/{id}      get
//	PATCH /v1/ontologies/{ontologyId}/entities/{id}      patch
func (r *Registry) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /v1/ontologies/{ontologyId}/entities", func(w http.ResponseWriter, req *http.Request) {
		ontologyID := req.PathValue("ontologyId")
		if ontologyID == "" {
			http.Error(w, "missing ontologyId", http.StatusBadRequest)
			return
		}
		var body struct {
			EntityID   string                 `json:"entityId"`
			Properties map[string]interface{} `json:"properties"`
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		if body.Properties == nil {
			body.Properties = map[string]interface{}{}
		}
		rec := r.Register(ontologyID, body.Properties, body.EntityID)
		writeJSON(w, http.StatusCreated, rec)
	})

	mux.HandleFunc("GET /v1/ontologies/{ontologyId}/entities/{id}", func(w http.ResponseWriter, req *http.Request) {
		rec, ok := r.Get(req.PathValue("ontologyId"), req.PathValue("id"))
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, rec)
	})

	mux.HandleFunc("PATCH /v1/ontologies/{ontologyId}/entities/{id}", func(w http.ResponseWriter, req *http.Request) {
		var patch map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&patch); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		rec, err := r.Patch(req.PathValue("ontologyId"), req.PathValue("id"), patch)
		if errors.Is(err, ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, rec)
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
