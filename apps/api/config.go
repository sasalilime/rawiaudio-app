package main

import (
	"fmt"
	"net/url"
	"os"
	"slices"
	"strconv"
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

	// Connexion par e-mail (ADR-0012).
	AuthSecret   string // clé du HMAC des codes, 32 caractères au moins : ne jamais la logger
	AppURL       string // adresse de la PWA, sans / final : le lien de l'e-mail y mène
	SMTPHost     string // smtp.resend.com en production, 127.0.0.1 (Mailpit) en dev
	SMTPPort     string // 465 en production (TLS dès la connexion), 1026 pour Mailpit
	SMTPUsername string // vide : pas d'authentification (Mailpit)
	SMTPPassword string // clé API Resend : ne jamais la logger
	MailFrom     string // « Rawi Audio <connexion@rawiaudio.com> »
	// E-mails de connexion par 24 heures, sous le quota du fournisseur (100 par jour pour Resend gratuit).
	MailDailyCap int
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
		AuthSecret:        os.Getenv("AUTH_SECRET"),
		AppURL:            strings.TrimSuffix(os.Getenv("APP_URL"), "/"),
		SMTPHost:          os.Getenv("SMTP_HOST"),
		SMTPPort:          os.Getenv("SMTP_PORT"),
		SMTPUsername:      os.Getenv("SMTP_USERNAME"),
		SMTPPassword:      os.Getenv("SMTP_PASSWORD"),
		MailFrom:          os.Getenv("MAIL_FROM"),
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
		"AUTH_SECRET":          cfg.AuthSecret,
		"APP_URL":              cfg.AppURL,
		"SMTP_HOST":            cfg.SMTPHost,
		"SMTP_PORT":            cfg.SMTPPort,
		"MAIL_FROM":            cfg.MailFrom,
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

	// Un secret court se devinerait, et avec lui les codes à partir de leurs empreintes.
	if len(cfg.AuthSecret) < 32 {
		return config{}, fmt.Errorf("AUTH_SECRET trop court : 32 caractères au moins (openssl rand -hex 32)")
	}
	// Le lien de l'e-mail est cette adresse + "/connexion#jeton=…" : une origine seule, sans chemin.
	app, err := url.Parse(cfg.AppURL)
	if err != nil || (app.Scheme != "https" && app.Scheme != "http") || app.Host == "" || app.Path != "" || app.RawQuery != "" || app.Fragment != "" {
		return config{}, fmt.Errorf("APP_URL invalide : %q, attendu par exemple https://app.rawiaudio.com", cfg.AppURL)
	}
	cfg.MailDailyCap = 90
	if raw := os.Getenv("MAIL_DAILY_CAP"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			return config{}, fmt.Errorf("MAIL_DAILY_CAP invalide : %q, attendu un entier positif", raw)
		}
		cfg.MailDailyCap = n
	}
	return cfg, nil
}
