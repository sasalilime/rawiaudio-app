package main

import (
	"errors"
	"os"
)

// config regroupe les réglages lus dans l'environnement au démarrage.
type config struct {
	Port        string
	DatabaseURL string // contient le mot de passe : ne jamais le logger
}

func loadConfig() (config, error) {
	cfg := config{
		Port:        os.Getenv("PORT"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.DatabaseURL == "" {
		return config{}, errors.New("variable d'environnement DATABASE_URL manquante")
	}
	return cfg, nil
}
