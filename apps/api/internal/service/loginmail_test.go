package service

import (
	"strings"
	"testing"
	"time"
)

func TestLoginMailGivesTheCodeTheLinkAndTheValidity(t *testing.T) {
	link := "https://app.rawiaudio.com/connexion#jeton=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdEfG"
	subject, text := LoginMail("042917", link, 10*time.Minute)

	if !strings.Contains(subject, "042917") {
		t.Errorf("le code manque dans le sujet : %q", subject)
	}
	for _, want := range []string{"042917", link, "valable 10 minutes"} {
		if !strings.Contains(text, want) {
			t.Errorf("le texte ne contient pas %q :\n%s", want, text)
		}
	}
}
