package mail

import (
	"context"
	"io"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/textproto"
	"strings"
	"testing"
	"time"
)

// received : ce que le faux serveur a reçu, enveloppe SMTP et message.
type received struct {
	from, to string
	data     string
}

// fakeSMTP démarre un serveur SMTP minimal sur 127.0.0.1, sans TLS ni authentification (comme Mailpit).
// Il accepte une connexion et envoie sur le canal ce qu'il a reçu, au QUIT.
func fakeSMTP(t *testing.T) (host, port string, got <-chan received) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	ch := make(chan received, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		tp := textproto.NewConn(conn)
		var r received
		say := func(line string) bool { return tp.PrintfLine("%s", line) == nil }
		if !say("220 faux serveur") {
			return
		}
		for {
			line, err := tp.ReadLine()
			if err != nil {
				return
			}
			upper := strings.ToUpper(line)
			ok := true
			switch {
			case strings.HasPrefix(upper, "EHLO"), strings.HasPrefix(upper, "HELO"):
				ok = say("250 faux serveur")
			case strings.HasPrefix(upper, "MAIL FROM:"):
				r.from = strings.Trim(line[len("MAIL FROM:"):], "<> ")
				ok = say("250 OK")
			case strings.HasPrefix(upper, "RCPT TO:"):
				r.to = strings.Trim(line[len("RCPT TO:"):], "<> ")
				ok = say("250 OK")
			case upper == "DATA":
				if !say("354 la suite") {
					return
				}
				data, err := tp.ReadDotBytes()
				if err != nil {
					return
				}
				r.data = string(data)
				ok = say("250 OK")
			case upper == "QUIT":
				say("221 au revoir")
				ch <- r
				return
			default:
				ok = say("502 commande inconnue")
			}
			if !ok {
				return
			}
		}
	}()
	host, port, err = net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	return host, port, ch
}

func TestSendDeliversUTF8Text(t *testing.T) {
	host, port, got := fakeSMTP(t)
	sender, err := NewSender(host, port, "", "", "Rawi Audio <connexion@rawiaudio.com>")
	if err != nil {
		t.Fatal(err)
	}
	// Une ligne de plus de 76 caractères : le quoted-printable la coupe, le lecteur la recolle.
	text := "Bonjour,\n\nVotre code : 042917. Il est valable 10 minutes.\n" +
		"https://app.rawiaudio.com/connexion#jeton=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdEfG\n"
	if err := sender.Send(context.Background(), "parent@example.com", "Votre code Rawi Audio : 042917", text); err != nil {
		t.Fatal(err)
	}

	var r received
	select {
	case r = <-got:
	case <-time.After(5 * time.Second):
		t.Fatal("le faux serveur n'a rien reçu")
	}
	if r.from != "connexion@rawiaudio.com" || r.to != "parent@example.com" {
		t.Errorf("enveloppe : de %q à %q", r.from, r.to)
	}
	msg, err := mail.ReadMessage(strings.NewReader(r.data))
	if err != nil {
		t.Fatal(err)
	}
	subject, err := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	if err != nil {
		t.Fatal(err)
	}
	if subject != "Votre code Rawi Audio : 042917" {
		t.Errorf("sujet : %q", subject)
	}
	from, err := msg.Header.AddressList("From")
	if err != nil || len(from) != 1 || from[0].Name != "Rawi Audio" || from[0].Address != "connexion@rawiaudio.com" {
		t.Errorf("From : %v (%v)", from, err)
	}
	if ct := msg.Header.Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("Content-Type : %q", ct)
	}
	if !strings.HasSuffix(msg.Header.Get("Message-ID"), "@rawiaudio.com>") {
		t.Errorf("Message-ID : %q", msg.Header.Get("Message-ID"))
	}
	body, err := io.ReadAll(quotedprintable.NewReader(msg.Body))
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.ReplaceAll(string(body), "\r\n", "\n"); got != text {
		t.Errorf("texte reçu :\n%q\nattendu :\n%q", got, text)
	}
}

func TestSendRefusesHeaderInjection(t *testing.T) {
	host, port, got := fakeSMTP(t)
	sender, err := NewSender(host, port, "", "", "connexion@rawiaudio.com")
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct{ to, subject string }{
		{"parent@example.com", "Code\r\nBcc: espion@example.com"},
		{"parent@example.com\r\nBcc: espion@example.com", "Code"},
	} {
		if err := sender.Send(context.Background(), c.to, c.subject, "texte"); err == nil {
			t.Errorf("accepté : destinataire %q, sujet %q", c.to, c.subject)
		}
	}
	select {
	case r := <-got:
		t.Errorf("un e-mail est parti : %+v", r)
	default:
	}
}

func TestNewSenderRefusesAnInvalidSender(t *testing.T) {
	for _, from := range []string{"", "pas une adresse", "Rawi <connexion@>"} {
		if _, err := NewSender("smtp.resend.com", "465", "resend", "clé", from); err == nil {
			t.Errorf("expéditeur %q accepté", from)
		}
	}
	if _, err := NewSender("", "465", "", "", "connexion@rawiaudio.com"); err == nil {
		t.Error("hôte vide accepté")
	}
}
