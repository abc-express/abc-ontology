package daemon

import (
	"fmt"
	"net/http"
)

func HealthURL(base string) string {
	return fmt.Sprintf("%s/health", trimSlash(base))
}

func CheckHealth(base string) (int, error) {
	res, err := http.Get(HealthURL(base))
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	return res.StatusCode, nil
}

func trimSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}
