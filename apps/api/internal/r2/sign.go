// Package r2 signe les URLs de lecture des fichiers stockés dans Cloudflare R2.
// R2 parle le protocole S3 : la signature est la SigV4 d'AWS, passée en paramètres d'URL (URL pré-signée).
// Choix et limites : docs/adr/0003-signature-urls-audio.md.
package r2

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Signer produit des URLs GET pré-signées pour un bucket R2.
type Signer struct {
	host            string // ex. <compte>.eu.r2.cloudflarestorage.com
	bucket          string
	accessKeyID     string
	secretAccessKey string // ne jamais logger
}

// NewSigner : endpoint est le point d'accès S3 du compte, juridiction comprise,
// par exemple https://<compte>.eu.r2.cloudflarestorage.com pour un bucket EU.
func NewSigner(endpoint, bucket, accessKeyID, secretAccessKey string) (*Signer, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || (u.Path != "" && u.Path != "/") || u.RawQuery != "" {
		return nil, errors.New("point d'accès R2 invalide : attendu https://<hôte>, sans chemin")
	}
	if bucket == "" || accessKeyID == "" || secretAccessKey == "" {
		return nil, errors.New("bucket et clés R2 obligatoires")
	}
	return &Signer{host: u.Host, bucket: bucket, accessKeyID: accessKeyID, secretAccessKey: secretAccessKey}, nil
}

// PresignGet renvoie une URL de lecture de key, valable ttl à partir de now.
// Seul l'en-tête host est signé : le navigateur peut ajouter un en-tête Range librement.
//
// ponytail: ttl non contrôlé ; R2 accepte de 1 s à 7 jours et refuse l'URL (403) au-delà.
func (s *Signer) PresignGet(key string, now time.Time, ttl time.Duration) string {
	return presign(s.host, "/"+s.bucket+"/"+key, "auto", s.accessKeyID, s.secretAccessKey, now, ttl)
}

// presign suit l'algorithme « Authenticating Requests: Using Query Parameters » d'AWS.
// region vaut auto pour R2 ; elle n'est un paramètre que pour tester contre l'exemple d'AWS.
func presign(host, path, region, accessKeyID, secretAccessKey string, now time.Time, ttl time.Duration) string {
	now = now.UTC()
	amzDate := now.Format("20060102T150405Z") // Go formate d'après une date de référence, pas avec yyyyMMdd
	day := now.Format("20060102")
	scope := day + "/" + region + "/s3/aws4_request"

	// Paramètres écrits déjà triés par nom, comme l'exige la forme canonique.
	query := "X-Amz-Algorithm=AWS4-HMAC-SHA256" +
		"&X-Amz-Credential=" + uriEncode(accessKeyID+"/"+scope, true) +
		"&X-Amz-Date=" + amzDate +
		"&X-Amz-Expires=" + strconv.FormatInt(int64(ttl/time.Second), 10) +
		"&X-Amz-SignedHeaders=host"
	canonicalPath := uriEncode(path, false)

	// La requête canonique : méthode, chemin, paramètres, en-têtes (chacun suivi d'un saut de ligne),
	// noms des en-têtes signés, empreinte du corps (non signée pour une URL pré-signée).
	canonicalRequest := strings.Join([]string{
		"GET", canonicalPath, query, "host:" + host + "\n", "host", "UNSIGNED-PAYLOAD",
	}, "\n")
	requestHash := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hex.EncodeToString(requestHash[:])

	// Clé dérivée : le secret n'est jamais utilisé directement, chaque étape restreint la clé.
	key := hmacSHA256([]byte("AWS4"+secretAccessKey), day)
	key = hmacSHA256(key, region)
	key = hmacSHA256(key, "s3")
	key = hmacSHA256(key, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(key, stringToSign))

	return "https://" + host + canonicalPath + "?" + query + "&X-Amz-Signature=" + signature
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data)) // l'écriture dans un hash ne renvoie jamais d'erreur
	return mac.Sum(nil)
}

// uriEncode encode selon les règles de SigV4 : seuls A-Z a-z 0-9 - _ . ~ restent tels quels,
// tout le reste devient %XX (hexadécimal majuscule), octet par octet de l'UTF-8.
// url.QueryEscape et url.PathEscape ne conviennent pas : le premier écrit l'espace « + »,
// le second laisse passer : = & + $ , ; @, et la signature ne correspondrait plus.
func uriEncode(s string, encodeSlash bool) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ { // s[i] est un octet, pas un caractère : « é » donne %C3%A9
		c := s[i]
		switch {
		case 'A' <= c && c <= 'Z', 'a' <= c && c <= 'z', '0' <= c && c <= '9',
			c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && !encodeSlash:
			b.WriteByte(c)
		default:
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}
