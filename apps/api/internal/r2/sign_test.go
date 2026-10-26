package r2

import (
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"
)

// Exemple officiel d'AWS, « Authenticating Requests: Using Query Parameters (AWS Signature Version 4) » :
// clés, date, durée et signature attendue sont publiées dans la documentation S3.
func TestPresignMatchesAWSExample(t *testing.T) {
	got := presign(
		"examplebucket.s3.amazonaws.com", "/test.txt", "us-east-1",
		"AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		time.Date(2013, 5, 24, 0, 0, 0, 0, time.UTC), 86400*time.Second,
	)
	want := "https://examplebucket.s3.amazonaws.com/test.txt" +
		"?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
		"&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request" +
		"&X-Amz-Date=20130524T000000Z" +
		"&X-Amz-Expires=86400" +
		"&X-Amz-SignedHeaders=host" +
		"&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
	if got != want {
		t.Errorf("URL =\n%s\nattendu\n%s", got, want)
	}
}

func TestPresignGetForR2(t *testing.T) {
	signer, err := NewSigner("https://compte.eu.r2.cloudflarestorage.com", "rawi-audio", "CLE", "SECRET")
	if err != nil {
		t.Fatal(err)
	}
	// Heure de Paris, déjà le 27 : la date signée doit être celle d'UTC, le 26.
	now := time.Date(2026, 10, 27, 0, 30, 0, 0, time.FixedZone("Paris", 60*60))

	raw := signer.PresignGet("fr/001-les-gens-de-la-caverne/audio-128.mp3", now, time.Hour)
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if u.Host != "compte.eu.r2.cloudflarestorage.com" || u.Path != "/rawi-audio/fr/001-les-gens-de-la-caverne/audio-128.mp3" {
		t.Errorf("hôte ou chemin inattendu : %s", raw)
	}
	q := u.Query()
	checks := map[string]string{
		"X-Amz-Credential":    "CLE/20261026/auto/s3/aws4_request",
		"X-Amz-Date":          "20261026T233000Z",
		"X-Amz-Expires":       "3600",
		"X-Amz-SignedHeaders": "host",
	}
	for name, want := range checks {
		if got := q.Get(name); got != want {
			t.Errorf("%s = %q, attendu %q", name, got, want)
		}
	}
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(q.Get("X-Amz-Signature")) {
		t.Errorf("signature mal formée : %q", q.Get("X-Amz-Signature"))
	}
	if strings.Contains(raw, "SECRET") {
		t.Error("la clé secrète apparaît dans l'URL")
	}

	other := signer.PresignGet("fr/002-autre/audio-128.mp3", now, time.Hour)
	if mustQuery(t, other).Get("X-Amz-Signature") == q.Get("X-Amz-Signature") {
		t.Error("deux clés différentes donnent la même signature")
	}
}

func mustQuery(t *testing.T, raw string) url.Values {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return u.Query()
}

func TestURIEncode(t *testing.T) {
	tests := []struct {
		in          string
		encodeSlash bool
		want        string
	}{
		{"AZaz09-_.~", true, "AZaz09-_.~"},
		{"a b", true, "a%20b"},                   // url.QueryEscape écrirait a+b
		{"a+b=c&d:e", true, "a%2Bb%3Dc%26d%3Ae"}, // url.PathEscape laisserait + = & :
		{"é", true, "%C3%A9"},
		{"fr/001-x/audio.mp3", false, "fr/001-x/audio.mp3"},
		{"cle/20261026", true, "cle%2F20261026"},
	}
	for _, tt := range tests {
		if got := uriEncode(tt.in, tt.encodeSlash); got != tt.want {
			t.Errorf("uriEncode(%q, %v) = %q, attendu %q", tt.in, tt.encodeSlash, got, tt.want)
		}
	}
}

func TestNewSignerRejectsInvalidConfig(t *testing.T) {
	tests := []struct {
		name, endpoint, bucket, key, secret string
	}{
		{"http au lieu de https", "http://compte.r2.cloudflarestorage.com", "b", "k", "s"},
		{"avec un chemin", "https://compte.r2.cloudflarestorage.com/rawi-audio", "b", "k", "s"},
		{"sans hôte", "https://", "b", "k", "s"},
		{"vide", "", "b", "k", "s"},
		{"bucket vide", "https://compte.r2.cloudflarestorage.com", "", "k", "s"},
		{"secret vide", "https://compte.r2.cloudflarestorage.com", "b", "k", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := NewSigner(tt.endpoint, tt.bucket, tt.key, tt.secret); err == nil {
				t.Error("erreur attendue")
			}
		})
	}
}
