package registry

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRegisterAssignsVersionAndID(t *testing.T) {
	r := New()
	rec := r.Register("default", map[string]interface{}{"name": "alpha"}, "")
	if rec.EntityID == "" {
		t.Fatalf("expected generated entity id, got empty")
	}
	if rec.Version != 1 {
		t.Fatalf("expected version 1, got %d", rec.Version)
	}
	if rec.OntologyID != "default" {
		t.Fatalf("unexpected ontology id: %s", rec.OntologyID)
	}
	if rec.Properties["name"] != "alpha" {
		t.Fatalf("properties not copied: %+v", rec.Properties)
	}
}

func TestRegisterClonesProperties(t *testing.T) {
	r := New()
	props := map[string]interface{}{"name": "alpha"}
	rec := r.Register("default", props, "ent-1")
	props["name"] = "mutated"
	if rec.Properties["name"] != "alpha" {
		t.Fatalf("registry stored a shared reference: %+v", rec.Properties)
	}
}

func TestPatchBumpsVersionAndMerges(t *testing.T) {
	r := New()
	r.Register("default", map[string]interface{}{"name": "alpha"}, "ent-1")
	next, err := r.Patch("default", "ent-1", map[string]interface{}{"status": "active"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if next.Version != 2 {
		t.Fatalf("expected version 2, got %d", next.Version)
	}
	if next.Properties["name"] != "alpha" || next.Properties["status"] != "active" {
		t.Fatalf("merge incorrect: %+v", next.Properties)
	}
}

func TestPatchMissingReturnsNotFound(t *testing.T) {
	r := New()
	if _, err := r.Patch("default", "ghost", map[string]interface{}{}); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestHTTPRegisterGetPatch(t *testing.T) {
	r := New()
	srv := httptest.NewServer(r.Handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]interface{}{
		"properties": map[string]interface{}{"name": "alpha"},
	})
	res, err := http.Post(srv.URL+"/v1/ontologies/default/entities", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register status %d", res.StatusCode)
	}
	var created EntityRecord
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()

	getRes, err := http.Get(srv.URL + "/v1/ontologies/default/entities/" + created.EntityID)
	if err != nil {
		t.Fatal(err)
	}
	if getRes.StatusCode != http.StatusOK {
		t.Fatalf("get status %d", getRes.StatusCode)
	}
	getRes.Body.Close()

	patchBody, _ := json.Marshal(map[string]interface{}{"status": "active"})
	patchReq, _ := http.NewRequest(http.MethodPatch, srv.URL+"/v1/ontologies/default/entities/"+created.EntityID, bytes.NewReader(patchBody))
	patchReq.Header.Set("Content-Type", "application/json")
	patchRes, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		t.Fatal(err)
	}
	if patchRes.StatusCode != http.StatusOK {
		t.Fatalf("patch status %d", patchRes.StatusCode)
	}
	var patched EntityRecord
	if err := json.NewDecoder(patchRes.Body).Decode(&patched); err != nil {
		t.Fatal(err)
	}
	patchRes.Body.Close()
	if patched.Version != 2 || patched.Properties["status"] != "active" {
		t.Fatalf("unexpected patched record: %+v", patched)
	}
}

func TestHTTPGetMissingReturns404(t *testing.T) {
	r := New()
	srv := httptest.NewServer(r.Handler())
	defer srv.Close()
	res, err := http.Get(srv.URL + "/v1/ontologies/default/entities/ghost")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", res.StatusCode)
	}
}
