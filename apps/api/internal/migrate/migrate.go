// Package migrate applique les migrations SQL au démarrage de l'API.
package migrate

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"slices"

	"github.com/jackc/pgx/v5/pgxpool"
)

// lockID identifie le verrou consultatif des migrations dans Postgres.
// Valeur arbitraire : elle doit seulement rester la même partout.
const lockID int64 = 7_402_001

// Run applique, dans l'ordre de leurs noms, les fichiers *.sql de fsys
// qui ne sont pas encore enregistrés dans schema_migrations.
//
// ponytail: runner minimal, limites connues :
//   - chaque fichier tourne dans une transaction : pas de CREATE INDEX CONCURRENTLY ;
//   - pas de somme de contrôle : un fichier déjà appliqué puis modifié n'est pas détecté ;
//   - pas de retour arrière : on corrige par une nouvelle migration.
func Run(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) error {
	names, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return fmt.Errorf("liste des migrations: %w", err)
	}
	slices.Sort(names) // l'ordre des noms (0001_, 0002_…) fixe l'ordre d'application

	for _, name := range names {
		if err := apply(ctx, pool, fsys, name); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}

func apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS, name string) error {
	sql, err := fs.ReadFile(fsys, name)
	if err != nil {
		return fmt.Errorf("lecture: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("début de transaction: %w", err)
	}
	// Annule tout si on sort avant le Commit ; sans effet après un Commit réussi.
	defer tx.Rollback(ctx)

	// Deux instances qui démarrent ensemble migrent l'une après l'autre.
	// Le verrou est relâché à la fin de la transaction.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", lockID); err != nil {
		return fmt.Errorf("verrou: %w", err)
	}
	if _, err := tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    text PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		return fmt.Errorf("création de schema_migrations: %w", err)
	}

	var applied bool
	if err := tx.QueryRow(ctx,
		"SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)", name,
	).Scan(&applied); err != nil {
		return fmt.Errorf("lecture de schema_migrations: %w", err)
	}
	if applied {
		return nil
	}

	// Sans argument, pgx passe par le protocole simple de Postgres,
	// qui accepte plusieurs instructions dans une même chaîne.
	if _, err := tx.Exec(ctx, string(sql)); err != nil {
		return fmt.Errorf("exécution: %w", err)
	}
	if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", name); err != nil {
		return fmt.Errorf("enregistrement de la version: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	slog.Info("migration appliquée", "version", name)
	return nil
}
