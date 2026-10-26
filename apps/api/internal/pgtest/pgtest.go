// Package pgtest donne aux tests d'intégration une base Postgres isolée.
package pgtest

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool renvoie un pool dont les tables vont dans un schéma jetable, supprimé à la fin du test.
// Le test est sauté si TEST_DATABASE_URL est absent.
func Pool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL absent : test d'intégration sauté")
	}

	admin, err := pgx.Connect(t.Context(), url)
	if err != nil {
		t.Fatalf("connexion: %v", err)
	}
	schema := pgx.Identifier{fmt.Sprintf("test_%d", time.Now().UnixNano())}.Sanitize()
	if _, err := admin.Exec(t.Context(), "CREATE SCHEMA "+schema); err != nil {
		t.Fatalf("création du schéma: %v", err)
	}
	// t.Context() est déjà annulé quand les Cleanup tournent.
	t.Cleanup(func() {
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("suppression du schéma: %v", err)
		}
		admin.Close(context.Background())
	})

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatalf("config: %v", err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}
