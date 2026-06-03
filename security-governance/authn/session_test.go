package authn

import "testing"

func TestValidateSession(t *testing.T) {
	if err := ValidateSession(Session{SubjectID: "u", TenantID: "t"}); err != nil {
		t.Fatal(err)
	}
}
