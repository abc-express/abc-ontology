// Command server runs the ontology registry HTTP service. It mirrors the
// TypeScript OntologyRegistry semantics and is consumed by the Go ingest path.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/daemon-platform/ontology-registry"
)

func main() {
	addr := ":8083"
	if v := os.Getenv("ONTOLOGY_REGISTRY_ADDR"); v != "" {
		addr = v
	}
	reg := registry.New()
	log.Printf("ontology-registry listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, reg.Handler()))
}
