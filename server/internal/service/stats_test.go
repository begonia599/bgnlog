package service

import (
	"testing"
	"time"
)

type fakeVisitStore struct {
	byDay map[string]int64
}

func (f *fakeVisitStore) Increment(day string) error {
	if f.byDay == nil {
		f.byDay = map[string]int64{}
	}
	f.byDay[day]++
	return nil
}
func (f *fakeVisitStore) Total() (int64, error) {
	var n int64
	for _, c := range f.byDay {
		n += c
	}
	return n, nil
}
func (f *fakeVisitStore) CountForDay(day string) (int64, error) { return f.byDay[day], nil }

type fakeSettings map[string]string

func (f fakeSettings) GetMultiple(keys []string) (map[string]string, error) {
	out := map[string]string{}
	for _, k := range keys {
		if v, ok := f[k]; ok {
			out[k] = v
		}
	}
	return out, nil
}

func newTestStats(settings fakeSettings) (*StatsService, *fakeVisitStore, *time.Time) {
	store := &fakeVisitStore{}
	svc := NewStatsService(store, settings)
	clock := time.Date(2026, 9, 2, 10, 0, 0, 0, siteTZ)
	svc.now = func() time.Time { return clock }
	return svc, store, &clock
}

func TestRecordVisit_DedupsWithinWindow(t *testing.T) {
	svc, store, clock := newTestStats(nil)

	counted, err := svc.RecordVisit("visitor-a")
	if err != nil || !counted {
		t.Fatalf("first visit should count, got counted=%v err=%v", counted, err)
	}
	counted, _ = svc.RecordVisit("visitor-a")
	if counted {
		t.Fatal("second visit inside the window must not count")
	}
	counted, _ = svc.RecordVisit("visitor-b")
	if !counted {
		t.Fatal("a different visitor must count")
	}

	*clock = clock.Add(visitDedupWindow)
	counted, _ = svc.RecordVisit("visitor-a")
	if !counted {
		t.Fatal("same visitor after the window must count again")
	}

	total, _ := store.Total()
	if total != 3 {
		t.Fatalf("expected 3 counted visits, got %d", total)
	}
}

func TestGetSiteStats_TodayUsesSiteLocalDay(t *testing.T) {
	svc, store, clock := newTestStats(nil)

	// 23:30 UTC+8 on Sep 2 is still Sep 2 locally even though it is Sep 2 15:30 UTC.
	*clock = time.Date(2026, 9, 2, 23, 30, 0, 0, siteTZ)
	svc.RecordVisit("late-visitor")
	// One hour later it is Sep 3 locally.
	*clock = clock.Add(time.Hour)
	svc.RecordVisit("early-visitor")

	if store.byDay["2026-09-02"] != 1 || store.byDay["2026-09-03"] != 1 {
		t.Fatalf("visits not bucketed by site-local day: %v", store.byDay)
	}

	stats, err := svc.GetSiteStats()
	if err != nil {
		t.Fatal(err)
	}
	if stats.TotalVisits != 2 || stats.TodayVisits != 1 {
		t.Fatalf("expected total=2 today=1, got %+v", stats)
	}
	if !stats.LaunchedAt.Equal(DefaultSiteLaunchedAt) {
		t.Fatalf("expected default launch date, got %v", stats.LaunchedAt)
	}
}

func TestLaunchedAt_ReadsSettingAndFallsBack(t *testing.T) {
	svc, _, _ := newTestStats(fakeSettings{SettingKeySiteLaunchedAt: "2025-12-31"})
	got, err := svc.LaunchedAt()
	if err != nil {
		t.Fatal(err)
	}
	want := time.Date(2025, 12, 31, 0, 0, 0, 0, siteTZ)
	if !got.Equal(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}

	svc, _, _ = newTestStats(fakeSettings{SettingKeySiteLaunchedAt: "not-a-date"})
	got, _ = svc.LaunchedAt()
	if !got.Equal(DefaultSiteLaunchedAt) {
		t.Fatalf("malformed setting should fall back to default, got %v", got)
	}
}
