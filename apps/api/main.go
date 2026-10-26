// Commande api : point d'entrée de l'API Rawi Audio.
package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"rawiaudio.com/api/internal/httpapi"
	"rawiaudio.com/api/internal/migrate"
)

// Les migrations sont compilées dans le binaire : l'image Docker n'a pas besoin du dossier.
// go:embed ne peut pas remonter l'arborescence, d'où cette directive à la racine du module.
//
//go:embed migrations/*.sql
var migrationFiles embed.FS

func main() {
	// Logger par défaut en JSON : sert aussi aux logs internes de net/http.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	if err := run(); err != nil {
		slog.Error("arrêt sur erreur", "err", err)
		os.Exit(1)
	}
}

// run porte tout le démarrage : os.Exit ne lance pas les defer,
// donc main ne doit sortir qu'une fois run terminé.
func run() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	// ctx est annulé à la réception de SIGINT (Ctrl+C) ou SIGTERM (docker stop).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("création du pool postgres: %w", err)
	}
	defer pool.Close()

	// fs.Sub retire le préfixe migrations/ : le runner voit directement 0001_init.sql.
	migrations, err := fs.Sub(migrationFiles, "migrations")
	if err != nil {
		return fmt.Errorf("dossier des migrations: %w", err)
	}
	if err := migrate.Run(ctx, pool, migrations); err != nil {
		return err
	}

	// Sans ces timeouts, un client lent garde une connexion ouverte indéfiniment.
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewRouter(pool.Ping),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("serveur démarré", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("serveur http: %w", err)
	case <-ctx.Done():
	}

	slog.Info("arrêt demandé, fin des requêtes en cours")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("arrêt du serveur: %w", err)
	}
	return nil
}
