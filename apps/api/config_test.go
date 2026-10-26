package main

import (
	"strings"
	"testing"
)

// setValidEnv pose une configuration complète ; chaque cas retire ensuite ce qu'il teste.
func setValidEnv(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_URL", "postgres://localhost/rawi")
	t.Setenv("R2_ENDPOINT", "https://compte.eu.r2.cloudflarestorage.com")
	t.Setenv("R2_BUCKET", "rawi-audio")
	t.Setenv("R2_ACCESS_KEY_ID", "cle")
	t.Setenv("R2_SECRET_ACCESS_KEY", "secret")
}

func TestLoadConfig(t *testing.T) {
	t.Run("PORT vaut 8080 par défaut", func(t *testing.T) {
		setValidEnv(t)

		cfg, err := loadConfig()
		if err != nil {
			t.Fatalf("erreur inattendue : %v", err)
		}
		if cfg.Port != "8080" {
			t.Errorf("Port = %q, attendu %q", cfg.Port, "8080")
		}
		if cfg.R2Bucket != "rawi-audio" {
			t.Errorf("R2Bucket = %q, attendu rawi-audio", cfg.R2Bucket)
		}
	})

	t.Run("toutes les variables manquantes sont listées", func(t *testing.T) {
		setValidEnv(t)
		t.Setenv("DATABASE_URL", "")
		t.Setenv("R2_SECRET_ACCESS_KEY", "")

		_, err := loadConfig()
		if err == nil {
			t.Fatal("erreur attendue, obtenu nil")
		}
		if want := "DATABASE_URL, R2_SECRET_ACCESS_KEY"; !strings.Contains(err.Error(), want) {
			t.Errorf("erreur = %q, doit contenir %q", err, want)
		}
	})
}
