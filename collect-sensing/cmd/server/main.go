package main

import (
	"log"
	"net/http"
	"os"

	"github.com/daemon-platform/collect-sensing/orchestrator"
)

func main() {
	addr := ":8081"
	if v := os.Getenv("COLLECT_SENSING_ADDR"); v != "" {
		addr = v
	}
	o := orchestrator.NewOrchestrator()
	log.Printf("collect-sensing listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, o.Handler()))
}
