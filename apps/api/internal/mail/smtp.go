// Package mail envoie les e-mails de l'API en SMTP : Resend en production, Mailpit en développement (ADR-0012).
// Bibliothèque standard seulement (net/smtp).
package mail

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

// sendTimeout borne un envoi quand le contexte n'a pas d'échéance : un serveur muet ne bloque pas l'envoi pour toujours.
const sendTimeout = 30 * time.Second

// Sender envoie des e-mails texte par un serveur SMTP.
type Sender struct {
	addr        string // hôte:port
	host        string // nom vérifié dans le certificat TLS
	implicitTLS bool   // port 465 : TLS dès la connexion ; sinon STARTTLS si le serveur le propose
	username    string
	password    string // ne jamais le logger
	from        *mail.Address
}

// NewSender prépare l'envoi par host:port.
//   - Port 465 : TLS dès la connexion (Resend en production).
//   - Autre port : STARTTLS si le serveur le propose. Mailpit, en dev, ne le propose pas.
//   - username vide : pas d'authentification.
//   - from : l'expéditeur, par exemple « Rawi Audio <connexion@rawiaudio.com> ».
func NewSender(host, port, username, password, from string) (*Sender, error) {
	if host == "" || port == "" {
		return nil, errors.New("hôte et port SMTP obligatoires")
	}
	sender, err := mail.ParseAddress(from)
	if err != nil {
		return nil, fmt.Errorf("expéditeur invalide %q : %w", from, err)
	}
	return &Sender{
		addr:        net.JoinHostPort(host, port),
		host:        host,
		implicitTLS: port == "465",
		username:    username,
		password:    password,
		from:        sender,
	}, nil
}

// Send envoie un e-mail texte à to. Accents et lignes longues passent : UTF-8 en quoted-printable.
func (s *Sender) Send(ctx context.Context, to, subject, text string) error {
	recipient, err := mail.ParseAddress(to)
	if err != nil {
		return fmt.Errorf("destinataire invalide : %w", err)
	}
	// Un retour à la ligne dans le sujet ajouterait des en-têtes au message (injection d'en-têtes).
	if strings.ContainsAny(subject, "\r\n") {
		return errors.New("sujet sur plusieurs lignes")
	}
	message, err := s.message(recipient, subject, text, time.Now())
	if err != nil {
		return fmt.Errorf("composition de l'e-mail : %w", err)
	}

	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, sendTimeout)
		defer cancel()
	}
	conn, err := s.dial(ctx)
	if err != nil {
		return fmt.Errorf("connexion SMTP : %w", err)
	}
	// net/smtp ne connaît pas le contexte : son échéance s'applique à toute la connexion.
	deadline, _ := ctx.Deadline()
	if err := conn.SetDeadline(deadline); err != nil {
		return errors.Join(fmt.Errorf("échéance SMTP : %w", err), conn.Close())
	}
	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return errors.Join(fmt.Errorf("accueil SMTP : %w", err), conn.Close())
	}
	// Ferme la connexion si l'envoi s'arrête en route ; après Quit, elle l'est déjà et l'erreur ne dit rien.
	defer client.Close()

	if !s.implicitTLS {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(s.tlsConfig()); err != nil {
				return fmt.Errorf("STARTTLS : %w", err)
			}
		}
	}
	if s.username != "" {
		// PlainAuth refuse d'envoyer le mot de passe sur une connexion sans TLS, sauf vers localhost.
		if err := client.Auth(smtp.PlainAuth("", s.username, s.password, s.host)); err != nil {
			return fmt.Errorf("authentification SMTP : %w", err)
		}
	}
	if err := client.Mail(s.from.Address); err != nil {
		return fmt.Errorf("expéditeur refusé : %w", err)
	}
	if err := client.Rcpt(recipient.Address); err != nil {
		return fmt.Errorf("destinataire refusé : %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("début du message : %w", err)
	}
	if _, err := w.Write(message); err != nil {
		return fmt.Errorf("envoi du message : %w", err)
	}
	// Le serveur accepte ou refuse l'e-mail ici.
	if err := w.Close(); err != nil {
		return fmt.Errorf("message refusé : %w", err)
	}
	// L'e-mail est déjà accepté : un échec du QUIT ne doit pas le faire renvoyer.
	_ = client.Quit()
	return nil
}

func (s *Sender) dial(ctx context.Context) (net.Conn, error) {
	if s.implicitTLS {
		d := tls.Dialer{Config: s.tlsConfig()}
		return d.DialContext(ctx, "tcp", s.addr)
	}
	var d net.Dialer
	return d.DialContext(ctx, "tcp", s.addr)
}

func (s *Sender) tlsConfig() *tls.Config {
	return &tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}
}

// message compose l'e-mail : en-têtes, puis le texte en quoted-printable (lignes de 76 caractères au plus,
// accents en =C3=A9), que tout serveur SMTP transporte sans l'abîmer.
func (s *Sender) message(to *mail.Address, subject, text string, now time.Time) ([]byte, error) {
	domain := s.from.Address[strings.LastIndex(s.from.Address, "@")+1:]
	var b bytes.Buffer
	// Écrire dans un bytes.Buffer n'échoue jamais : fmt.Fprintf ne renvoie pas d'erreur ici.
	fmt.Fprintf(&b, "From: %s\r\n", s.from)
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", subject))
	fmt.Fprintf(&b, "Date: %s\r\n", now.Format(time.RFC1123Z))
	fmt.Fprintf(&b, "Message-ID: <%s@%s>\r\n", rand.Text(), domain)
	b.WriteString("MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n")
	body := quotedprintable.NewWriter(&b)
	if _, err := body.Write([]byte(text)); err != nil {
		return nil, err
	}
	if err := body.Close(); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}
