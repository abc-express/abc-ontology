package daemon

import "testing"

func TestHealthURL(t *testing.T) {
	got := HealthURL("http://localhost:3000/")
	if got != "http://localhost:3000/health" {
		t.Fatalf("got %q", got)
	}
}

func TestTrimSlash(t *testing.T) {
	if trimSlash("http://x/") != "http://x" {
		t.Fatal("trim failed")
	}
}
