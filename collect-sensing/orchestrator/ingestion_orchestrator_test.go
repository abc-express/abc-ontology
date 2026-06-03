package orchestrator

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStartJob(t *testing.T) {
	o := NewOrchestrator()
	j := o.StartJob("src-1")
	if j.SourceID != "src-1" || j.Status != "running" {
		t.Fatalf("unexpected job: %+v", j)
	}
}

func TestHTTPPostJob(t *testing.T) {
	o := NewOrchestrator()
	srv := httptest.NewServer(o.Handler())
	defer srv.Close()
	body, _ := json.Marshal(map[string]string{"sourceId": "postgres-main"})
	res, err := http.Post(srv.URL+"/v1/jobs", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status %d", res.StatusCode)
	}
}

func TestIngestRecordsCountsValid(t *testing.T) {
	o := NewOrchestrator()
	j, accepted := o.IngestRecords("crm-main", []EntityRecord{
		{OntologyID: "crm.contact", EntityID: "1", Properties: map[string]interface{}{"name": "Ada"}},
		{OntologyID: "", Properties: map[string]interface{}{"name": "skip"}},
		{OntologyID: "crm.contact", EntityID: "2"},
	})
	if accepted != 2 {
		t.Fatalf("expected 2 accepted, got %d", accepted)
	}
	if j.Status != "completed" || j.Accepted != 2 {
		t.Fatalf("unexpected job: %+v", j)
	}
}

func TestHTTPIngestRecords(t *testing.T) {
	o := NewOrchestrator()
	srv := httptest.NewServer(o.Handler())
	defer srv.Close()
	body, _ := json.Marshal(map[string]interface{}{
		"sourceId": "crm-main",
		"records": []map[string]interface{}{
			{"ontologyId": "crm.contact", "entityId": "1", "properties": map[string]interface{}{"name": "Ada"}},
		},
	})
	res, err := http.Post(srv.URL+"/ingest/records", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status %d", res.StatusCode)
	}
	var j Job
	if err := json.NewDecoder(res.Body).Decode(&j); err != nil {
		t.Fatal(err)
	}
	if j.Accepted != 1 || j.Status != "completed" {
		t.Fatalf("unexpected job: %+v", j)
	}
}
