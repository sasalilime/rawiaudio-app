package repository

import (
	"bytes"
	"errors"
	"testing"
	"time"

	"rawiaudio.com/api/internal/migrate"
	"rawiaudio.com/api/internal/pgtest"
	"rawiaudio.com/api/internal/service"
	"rawiaudio.com/api/migrations"
)

// Une demande ne s'utilise qu'une fois, même si deux requêtes l'ont trouvée ouverte en même temps :
// CompleteLogin la ferme en premier et s'arrête si une autre l'a déjà fermée.
func TestCompleteLoginIsSingleUse(t *testing.T) {
	pool := pgtest.Pool(t)
	if err := migrate.Run(t.Context(), pool, migrations.FS); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	auth := NewAuth(pool)
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	hash := func(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }

	err := auth.CreateLoginRequest(t.Context(), service.NewLoginRequest{
		Email: "parent@example.com", CodeHMAC: hash(1), TokenHash: hash(2), ExpiresAt: now.Add(10 * time.Minute),
	}, now)
	if err != nil {
		t.Fatal(err)
	}
	// Les deux requêtes ont trouvé la demande ouverte, avant que l'une ou l'autre la ferme.
	pending, err := auth.PendingByToken(t.Context(), hash(2), now)
	if err != nil {
		t.Fatal(err)
	}

	first, err := auth.CompleteLogin(t.Context(), pending.ID, pending.Email, service.NewSession{TokenHash: hash(3), ExpiresAt: now.Add(time.Hour)}, now)
	if err != nil || first.Email != "parent@example.com" {
		t.Fatalf("première ouverture : %+v, %v", first, err)
	}
	_, err = auth.CompleteLogin(t.Context(), pending.ID, pending.Email, service.NewSession{TokenHash: hash(4), ExpiresAt: now.Add(time.Hour)}, now)
	if !errors.Is(err, service.ErrInvalidCode) {
		t.Errorf("seconde ouverture avec la même demande : %v", err)
	}
	if _, err := auth.SessionAccount(t.Context(), hash(4), now); !errors.Is(err, service.ErrUnauthorized) {
		t.Errorf("la seconde session existe : %v", err)
	}
}
