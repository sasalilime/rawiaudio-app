package main

import "testing"

func TestLoadConfig(t *testing.T) {
	t.Run("PORT vaut 8080 par défaut", func(t *testing.T) {
		t.Setenv("PORT", "")
		t.Setenv("DATABASE_URL", "postgres://localhost/rawi")

		cfg, err := loadConfig()
		if err != nil {
			t.Fatalf("erreur inattendue : %v", err)
		}
		if cfg.Port != "8080" {
			t.Errorf("Port = %q, attendu %q", cfg.Port, "8080")
		}
	})

	t.Run("DATABASE_URL est obligatoire", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "")

		if _, err := loadConfig(); err == nil {
			t.Fatal("erreur attendue, obtenu nil")
		}
	})
}
