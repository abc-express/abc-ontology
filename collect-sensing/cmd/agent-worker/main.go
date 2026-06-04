// Agent worker v1: registers with the gateway and pushes ingest records over HTTP.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	gateway := envOr("DAEMON_GATEWAY_URL", "http://127.0.0.1:3000")
	agentID := envOr("DAEMON_AGENT_ID", "agent-worker-1")
	apiKey := os.Getenv("DAEMON_API_KEY")
	tenant := envOr("DAEMON_TENANT", "inst-alpha")
	domain := envOr("DAEMON_DOMAIN", "foundation")

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		if err := heartbeat(gateway, agentID, apiKey, tenant, domain); err != nil {
			log.Printf("heartbeat: %v", err)
		}
		if err := pushSample(gateway, apiKey, tenant, domain); err != nil {
			log.Printf("push: %v", err)
		}
		<-ticker.C
	}
}

func heartbeat(base, agentID, apiKey, tenant, domain string) error {
	body, _ := json.Marshal(map[string]string{"agentId": agentID, "status": "ok"})
	req, err := http.NewRequest(http.MethodPost, base+"/v1/ingest/agents/heartbeat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	setHeaders(req, apiKey, tenant, domain)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("heartbeat status %d", res.StatusCode)
	}
	return nil
}

func pushSample(base, apiKey, tenant, domain string) error {
	payload := map[string]any{
		"records": []map[string]any{
			{
				"ontologyId": "foundation",
				"entityId":   fmt.Sprintf("agent-push-%d", time.Now().Unix()),
				"entityType": "Party",
				"properties": map[string]any{
					"partyId":   fmt.Sprintf("agent-push-%d", time.Now().Unix()),
					"displayName": "Agent Worker Push",
					"partyKind": "organization",
				},
			},
		},
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, base+"/v1/ingest/records", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	setHeaders(req, apiKey, tenant, domain)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("ingest status %d", res.StatusCode)
	}
	return nil
}

func setHeaders(req *http.Request, apiKey, tenant, domain string) {
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("X-Api-Key", apiKey)
	}
	req.Header.Set("X-Daemon-Tenant", tenant)
	req.Header.Set("X-Daemon-Domain", domain)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
