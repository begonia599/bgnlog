package service

import (
	"testing"

	"blog-server/internal/model"
)

// A ZoneService with no platform client: any path that reaches evaluate()
// would nil-deref, so these tests double as proof that the early returns
// really are early.
func newGateOnlyZoneService() *ZoneService {
	return &ZoneService{cache: newZoneAccessCache()}
}

func TestCheckAccess_AdminIsExemptFromGating(t *testing.T) {
	s := newGateOnlyZoneService()

	gatedWithRules := &model.Zone{ID: 1, Visibility: model.ZoneVisibilityGated, Rules: []model.ZoneRule{{}}}
	gatedNoRules := &model.Zone{ID: 2, Visibility: model.ZoneVisibilityGated}

	for _, z := range []*model.Zone{gatedWithRules, gatedNoRules} {
		d := s.CheckAccess(z, 42, "jwt", "admin")
		if d.Status != AccessStatusAllowed || d.Reason != "admin" {
			t.Fatalf("zone %d: admin should be allowed with reason admin, got %+v", z.ID, d)
		}
	}
}

func TestCheckAccess_NonAdminStillGated(t *testing.T) {
	s := newGateOnlyZoneService()
	gatedNoRules := &model.Zone{ID: 2, Visibility: model.ZoneVisibilityGated}

	for _, role := range []string{"user", "editor", ""} {
		d := s.CheckAccess(gatedNoRules, 42, "jwt", role)
		if d.Status != AccessStatusDenied || d.Reason != "no_rules_configured" {
			t.Fatalf("role %q: expected denied/no_rules_configured, got %+v", role, d)
		}
	}
}

func TestCheckAccess_PublicIgnoresRole(t *testing.T) {
	s := newGateOnlyZoneService()
	public := &model.Zone{ID: 3, Visibility: model.ZoneVisibilityPublic}

	for _, role := range []string{"admin", "user", ""} {
		d := s.CheckAccess(public, 42, "", role)
		if d.Status != AccessStatusAllowed || d.Reason != "public" {
			t.Fatalf("role %q: expected allowed/public, got %+v", role, d)
		}
	}
}
