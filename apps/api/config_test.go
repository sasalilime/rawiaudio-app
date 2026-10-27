package main

import (
	"strings"
	"testing"
)

// setValidEnv pose une configuration complète ; chaque cas retire ensuite ce qu'il teste.
func setValidEnv(t *testing.T) {
	t.Setenv("HOST", "")
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_URL", "postgres://localhost/rawi")
	t.Setenv("R2_ENDPOINT", "https://compte.eu.r2.cloudflarestorage.com")
	t.Setenv("R2_BUCKET", "rawi-audio")
	t.Setenv("R2_ACCESS_KEY_ID", "cle")
	t.Setenv("R2_SECRET_ACCESS_KEY", "secret")
	t.Setenv("IMAGES_BASE_URL", "")
	t.Setenv("AUTH_SECRET", strings.Repeat("s", 32))
	t.Setenv("APP_URL", "https://app.rawiaudio.com/")
	t.Setenv("SMTP_HOST", "smtp.resend.com")
	t.Setenv("SMTP_PORT", "465")
	t.Setenv("SMTP_USERNAME", "resend")
	t.Setenv("SMTP_PASSWORD", "cle")
	t.Setenv("MAIL_FROM", "Rawi Audio <connexion@rawiaudio.com>")
	t.Setenv("MAIL_DAILY_CAP", "")
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
		if cfg.Host != "" {
			t.Errorf("Host = %q, attendu vide (toutes les interfaces)", cfg.Host)
		}
		if cfg.R2Bucket != "rawi-audio" {
			t.Errorf("R2Bucket = %q, attendu rawi-audio", cfg.R2Bucket)
		}
	})

	t.Run("IMAGES_BASE_URL : par défaut, et sans / final", func(t *testing.T) {
		for value, want := range map[string]string{
			"":                       "https://media.rawiaudio.com",
			"http://localhost:8471/": "http://localhost:8471",
			"https://media.example":  "https://media.example",
		} {
			setValidEnv(t)
			t.Setenv("IMAGES_BASE_URL", value)

			cfg, err := loadConfig()
			if err != nil {
				t.Fatalf("%q : erreur inattendue : %v", value, err)
			}
			if cfg.ImagesBaseURL != want {
				t.Errorf("%q : ImagesBaseURL = %q, attendu %q", value, cfg.ImagesBaseURL, want)
			}
		}
	})

	t.Run("IMAGES_BASE_URL invalide : refusée au démarrage", func(t *testing.T) {
		for _, value := range []string{"media.rawiaudio.com", "ftp://media.example", "https://", "https://media.example?v=1", "https://media.example#a"} {
			setValidEnv(t)
			t.Setenv("IMAGES_BASE_URL", value)

			if _, err := loadConfig(); err == nil || !strings.Contains(err.Error(), "IMAGES_BASE_URL") {
				t.Errorf("%q : erreur = %v, attendu un refus qui nomme IMAGES_BASE_URL", value, err)
			}
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

	t.Run("connexion : valeurs par défaut et URL de la PWA sans / final", func(t *testing.T) {
		setValidEnv(t)
		cfg, err := loadConfig()
		if err != nil {
			t.Fatal(err)
		}
		if cfg.AppURL != "https://app.rawiaudio.com" || cfg.MailDailyCap != 90 {
			t.Errorf("AppURL = %q, MailDailyCap = %d", cfg.AppURL, cfg.MailDailyCap)
		}
	})

	t.Run("connexion : réglages invalides refusés au démarrage", func(t *testing.T) {
		for name, value := range map[string]string{
			"AUTH_SECRET":    strings.Repeat("s", 31),
			"APP_URL":        "https://app.rawiaudio.com/connexion",
			"MAIL_DAILY_CAP": "0",
		} {
			setValidEnv(t)
			t.Setenv(name, value)
			if _, err := loadConfig(); err == nil || !strings.Contains(err.Error(), name) {
				t.Errorf("%s = %q : erreur = %v, attendu un refus qui la nomme", name, value, err)
			}
		}
	})
}
