package orchestrator

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type Job struct {
	ID       string    `json:"jobId"`
	SourceID string    `json:"sourceId"`
	Status   string    `json:"status"`
	Started  time.Time `json:"startedAt"`
	Accepted int       `json:"accepted,omitempty"`
}

// EntityRecord is a normalized payload forwarded by the TypeScript ingestion
// facade. Records are validated for an ontology id before being accepted.
type EntityRecord struct {
	OntologyID string                 `json:"ontologyId"`
	EntityID   string                 `json:"entityId,omitempty"`
	Properties map[string]interface{} `json:"properties"`
}

type Orchestrator struct {
	mu    sync.Mutex
	jobs  map[string]Job
	seq   int
}

func NewOrchestrator() *Orchestrator {
	return &Orchestrator{jobs: make(map[string]Job)}
}

func (o *Orchestrator) StartJob(sourceID string) Job {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.seq++
	id := "job-" + itoa(o.seq)
	j := Job{ID: id, SourceID: sourceID, Status: "running", Started: time.Now().UTC()}
	o.jobs[id] = j
	return j
}

func (o *Orchestrator) GetJob(id string) (Job, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	j, ok := o.jobs[id]
	return j, ok
}

// IngestRecords records a completed ingest job for the accepted records. Records
// without an ontology id are rejected and excluded from the accepted count.
func (o *Orchestrator) IngestRecords(sourceID string, records []EntityRecord) (Job, int) {
	accepted := 0
	for _, r := range records {
		if r.OntologyID != "" {
			accepted++
		}
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	o.seq++
	id := "job-" + itoa(o.seq)
	j := Job{ID: id, SourceID: sourceID, Status: "completed", Started: time.Now().UTC(), Accepted: accepted}
	o.jobs[id] = j
	return j, accepted
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

func (o *Orchestrator) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /v1/jobs", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SourceID string `json:"sourceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SourceID == "" {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		j := o.StartJob(body.SourceID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(j)
	})
	mux.HandleFunc("GET /v1/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		j, ok := o.GetJob(id)
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(j)
	})
	mux.HandleFunc("POST /ingest/records", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SourceID string         `json:"sourceId"`
			Records  []EntityRecord `json:"records"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SourceID == "" {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		j, _ := o.IngestRecords(body.SourceID, body.Records)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(j)
	})
	return mux
}
