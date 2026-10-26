package migrate

import (
	"slices"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5"

	"rawiaudio.com/api/internal/pgtest"
)

func TestRunAppliesEachFileOnce(t *testing.T) {
	pool := pgtest.Pool(t)
	fsys := fstest.MapFS{
		// Plusieurs instructions dans un fichier ; 0002 a besoin de la table créée par 0001.
		"0001_items.sql": {Data: []byte("CREATE TABLE items (id int); INSERT INTO items VALUES (1);")},
		"0002_more.sql":  {Data: []byte("INSERT INTO items VALUES (2);")},
		"README.md":      {Data: []byte("pas une migration")},
	}

	for range 2 {
		if err := Run(t.Context(), pool, fsys); err != nil {
			t.Fatalf("Run: %v", err)
		}
	}

	var count int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM items").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("items: %d lignes, attendu 2 (une migration rejouée ?)", count)
	}

	rows, err := pool.Query(t.Context(), "SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		t.Fatal(err)
	}
	versions, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"0001_items.sql", "0002_more.sql"}; !slices.Equal(versions, want) {
		t.Errorf("versions = %v, attendu %v", versions, want)
	}
}

func TestRunRollsBackFailedFile(t *testing.T) {
	pool := pgtest.Pool(t)
	fsys := fstest.MapFS{
		"0001_broken.sql": {Data: []byte("CREATE TABLE half (id int); SELEC 1;")},
	}

	if err := Run(t.Context(), pool, fsys); err == nil {
		t.Fatal("Run: erreur attendue sur un SQL invalide")
	}

	// Rien ne doit rester du fichier en échec : ni la table, ni la version.
	var leftovers int
	if err := pool.QueryRow(t.Context(),
		"SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename IN ('half', 'schema_migrations')",
	).Scan(&leftovers); err != nil {
		t.Fatal(err)
	}
	if leftovers != 0 {
		t.Errorf("%d table(s) restée(s) après l'échec, attendu 0", leftovers)
	}
}
