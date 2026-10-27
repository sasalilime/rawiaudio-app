package main

import (
	"fmt"
	"net/url"
	"os"
	"slices"
	"strings"
)

// config regroupe les réglages lus dans l'environnement au démarrage.
type config struct {
	// Adresse d'écoute : vide = toutes les interfaces (dev, Docker) ; 127.0.0.1 sur le VPS, derrière Caddy.
	Host              string
	Port              string
	DatabaseURL       string // contient le mot de passe : ne jamais le logger
	R2Endpoint        string // https://<compte>.eu.r2.cloudflarestorage.com (ADR-0003)
	R2Bucket          string
	R2AccessKeyID     string
	R2SecretAccessKey string // ne jamais le logger
	// Facultatif : l'origine de la PWA autorisée en CORS (https://app.rawiaudio.com en prod, vide en dev).
	CORSAllowedOrigin string
	// Adresse publique des illustrations (ADR-0009), sans / final. https://media.rawiaudio.com par défaut.
	ImagesBaseURL string
}

func loadConfig() (config, error) {
	cfg := config{
		Host:              os.Getenv("HOST"),
		Port:              os.Getenv("PORT"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		R2Endpoint:        os.Getenv("R2_ENDPOINT"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		CORSAllowedOrigin: os.Getenv("CORS_ALLOWED_ORIGIN"),
		ImagesBaseURL:     strings.TrimSuffix(os.Getenv("IMAGES_BASE_URL"), "/"),
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.ImagesBaseURL == "" {
		cfg.ImagesBaseURL = "https://media.rawiaudio.com"
	}

	// Toutes les variables manquantes d'un coup : on corrige le .env en une fois.
	var missing []string
	for name, value := range map[string]string{
		"DATABASE_URL":         cfg.DatabaseURL,
		"R2_ENDPOINT":          cfg.R2Endpoint,
		"R2_BUCKET":            cfg.R2Bucket,
		"R2_ACCESS_KEY_ID":     cfg.R2AccessKeyID,
		"R2_SECRET_ACCESS_KEY": cfg.R2SecretAccessKey,
	} {
		if value == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		slices.Sort(missing) // l'ordre de parcours d'une map change d'un lancement à l'autre
		return config{}, fmt.Errorf("variables d'environnement manquantes : %s", strings.Join(missing, ", "))
	}

	// Chaque adresse d'image est cette base + "/" + la clé : il faut une adresse absolue, sans paramètres.
	base, err := url.Parse(cfg.ImagesBaseURL)
	if err != nil || (base.Scheme != "https" && base.Scheme != "http") || base.Host == "" || base.RawQuery != "" || base.Fragment != "" {
		return config{}, fmt.Errorf("IMAGES_BASE_URL invalide : %q, attendu par exemple https://media.rawiaudio.com", cfg.ImagesBaseURL)
	}
	return cfg, nil
}
