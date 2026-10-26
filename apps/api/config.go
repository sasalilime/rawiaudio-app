package main

import (
	"fmt"
	"os"
	"slices"
	"strings"
)

// config regroupe les réglages lus dans l'environnement au démarrage.
type config struct {
	Port              string
	DatabaseURL       string // contient le mot de passe : ne jamais le logger
	R2Endpoint        string // https://<compte>.eu.r2.cloudflarestorage.com (ADR-0003)
	R2Bucket          string
	R2AccessKeyID     string
	R2SecretAccessKey string // ne jamais le logger
}

func loadConfig() (config, error) {
	cfg := config{
		Port:              os.Getenv("PORT"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		R2Endpoint:        os.Getenv("R2_ENDPOINT"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
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
	return cfg, nil
}
