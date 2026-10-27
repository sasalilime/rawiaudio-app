// Commande api : point d'entrée de l'API Rawi Audio.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"rawiaudio.com/api/internal/httpapi"
	"rawiaudio.com/api/internal/mail"
	"rawiaudio.com/api/internal/migrate"
	"rawiaudio.com/api/internal/r2"
	"rawiaudio.com/api/internal/repository"
	"rawiaudio.com/api/internal/service"
	"rawiaudio.com/api/migrations"
)

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

	// Les migrations sont compilées dans le binaire : l'image Docker n'a pas besoin du dossier.
	if err := migrate.Run(ctx, pool, migrations.FS); err != nil {
		return err
	}

	signer, err := r2.NewSigner(cfg.R2Endpoint, cfg.R2Bucket, cfg.R2AccessKeyID, cfg.R2SecretAccessKey)
	if err != nil {
		return fmt.Errorf("configuration R2: %w", err)
	}

	sender, err := mail.NewSender(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.MailFrom)
	if err != nil {
		return fmt.Errorf("configuration SMTP: %w", err)
	}
	crossOrigin, err := httpapi.CrossOrigin(cfg.CORSAllowedOrigin)
	if err != nil {
		return fmt.Errorf("protection CSRF: %w", err)
	}

	// Assemblage des couches : repository (SQL) → service (règles) → httpapi (HTTP).
	catalog := service.NewCatalog(repository.NewCatalog(pool), signer.PresignGet, cfg.ImagesBaseURL, time.Now)
	auth := service.NewAuth(repository.NewAuth(pool), sender, []byte(cfg.AuthSecret), cfg.AppURL, cfg.MailDailyCap, time.Now)
	history := service.NewHistory(repository.NewHistory(pool), time.Now)
	go cleanupEveryHour(ctx, auth)

	// Sans ces timeouts, un client lent garde une connexion ouverte indéfiniment.
	// CORS en premier : une réponse 403 du CSRF garde ses en-têtes CORS, la PWA peut la lire.
	srv := &http.Server{
		Addr:              cfg.Host + ":" + cfg.Port,
		Handler:           httpapi.CORS(cfg.CORSAllowedOrigin)(crossOrigin(httpapi.NewRouter(pool.Ping, catalog, auth, history))),
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

// cleanupEveryHour supprime les demandes de connexion de plus d'un jour et les sessions expirées,
// jusqu'à l'arrêt de l'API. Une erreur est journalisée : le ménage suivant réessaiera.
func cleanupEveryHour(ctx context.Context, auth *service.Auth) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if err := auth.Cleanup(ctx); err != nil && ctx.Err() == nil {
			slog.Error("ménage de la connexion", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
