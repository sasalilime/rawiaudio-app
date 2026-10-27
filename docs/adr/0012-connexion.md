# ADR-0012 : Connexion par e-mail (lien et code)

**Statut :** Accepté le 27 octobre 2026 (« oui pour tout »), sauf la question 5 (historique), encore ouverte
**Date :** 27 octobre 2026
**Décideur :** Salim

## Contexte
- Tranche 6 de `CLAUDE.md` : connexion par lien magique et code reçu par e-mail. Règles déjà fixées : jetons et codes stockés hachés, expiration courte, 5 essais au plus, limites par IP et par e-mail.
- ADR-0010 : un compte par famille, sur tous les appareils du foyer ; les épisodes gratuits marchent sans compte ; les applis iOS et Android ne vendent rien, on s'y connecte et on écoute.
- ADR-0007 : l'historique d'écoute sera synchronisé avec la connexion.
- Deux clients :
  - la PWA sur `app.rawiaudio.com` appelle `api.rawiaudio.com` : autre origine, mais **même site** (même domaine `rawiaudio.com`) ;
  - l'app Expo, sans cookies de navigateur.
- Pièges connus :
  - **iPhone, PWA installée** : elle a son propre stockage, séparé de Safari. Un lien ouvert depuis Mail s'ouvre dans Safari : la session y atterrit, pas dans l'appli installée. Le code à recopier marche partout.
  - **Antivirus des messageries** (Outlook, filtres d'entreprise) : ils ouvrent les liens des e-mails pour les analyser. Un lien qui connecte dès son ouverture (GET) est consommé par le robot avant la personne.
  - L'e-mail lu sur un autre appareil que celui qui se connecte (mail sur l'ordinateur, appli sur le téléphone) : seul le code marche.
- Le site rawiaudio.com envoie déjà son mail de bienvenue par **Resend** : domaine `rawiaudio.com` vérifié (DKIM), région UE. Resend accepte aussi l'envoi en SMTP, que `net/smtp` (bibliothèque standard) sait faire. Plan gratuit : 100 e-mails par jour, 3 000 par mois ; Pro : 20 $ par mois pour 50 000.

## Proposition

### Le parcours
- **Un seul e-mail, avec un code et un lien.** Le code de 6 chiffres est mis en avant (il marche partout) ; le lien sert à se connecter sur l'appareil qui lit l'e-mail.
- **S'inscrire = se connecter.** Pas de mot de passe ni de formulaire d'inscription : le compte est créé à la première vérification réussie. L'API répond donc pareil pour toute adresse, connue ou non : rien à cacher, rien à deviner.
- **Le lien ne connecte pas tout seul.** Il ouvre `https://app.rawiaudio.com/connexion#jeton=…` ; la page affiche « Me connecter » et c'est ce bouton qui envoie le jeton à l'API. Le robot d'un antivirus ne clique pas ; le jeton est dans le fragment (`#`), donc absent des journaux des serveurs et de l'en-tête `Referer`.
- L'app mobile n'utilise que le code. Le lien direct vers l'appli (« universal links ») viendra si le besoin s'en fait sentir.

### Les routes (contrat à écrire dans `contracts/openapi.yaml`)
| Route | Accès | Rôle |
|---|---|---|
| `POST /auth/login` `{email}` | public | envoie l'e-mail ; toujours `202`, sauf limite atteinte (`429`) |
| `POST /auth/code` `{email, code, client}` | public | vérifie le code, crée le compte s'il n'existe pas, ouvre une session |
| `POST /auth/link` `{token, client}` | public | même chose avec le jeton du lien |
| `POST /auth/logout` | compte | ferme la session de cet appareil |
| `GET /account` | compte | e-mail du compte (plus tard : l'abonnement) |
| `DELETE /account` | compte | supprime le compte et toutes ses sessions |

- Échec de vérification : toujours la même réponse `400 {"error":"invalid_code"}`, que le code soit faux, expiré, déjà utilisé ou inconnu.
- `DELETE /account` est obligatoire chez Apple : une appli où l'on peut créer un compte doit permettre de le supprimer depuis l'appli (règle 5.1.1(v)). C'est aussi le droit à l'effacement du RGPD.

### Les sessions
- Jeton de session : 32 octets aléatoires (`crypto/rand`), stocké en base sous son empreinte SHA-256. Une fuite de la base ne donne aucune session.
- **PWA : cookie** `__Host-rawi_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, posé par `api.rawiaudio.com`. Le JavaScript de la page ne le voit jamais, donc une faille XSS ne peut pas le voler.
  - La PWA appelle l'API avec `credentials: 'include'`, et le CORS répond `Access-Control-Allow-Credentials: true` pour `https://app.rawiaudio.com` seulement.
  - Les deux sous-domaines sont du même site : Safari ne bloque pas ce cookie comme un cookie tiers.
  - En dev, rien ne change : Vite relaie `/api`, tout est sur `localhost`.
- **App mobile : jeton** renvoyé dans la réponse quand `client` vaut `"app"`, envoyé ensuite dans `Authorization: Bearer …`, gardé dans le trousseau du téléphone (`expo-secure-store`, module officiel d'Expo).
- **CSRF** : `SameSite=Lax` ne protège pas d'un autre sous-domaine de `rawiaudio.com` (le site vitrine est du même site). L'API passe donc toutes ses routes par `http.CrossOriginProtection` (bibliothèque standard depuis Go 1.25), avec `https://app.rawiaudio.com` en origine de confiance. L'app mobile n'envoie pas d'en-tête `Origin` : elle passe.
- Durée : 180 jours, prolongée à l'usage (la date de dernière utilisation est écrite au plus une fois par jour, pas à chaque requête).

### Le code et le jeton du lien
- Code : 6 chiffres tirés avec `crypto/rand`. Un million de possibilités seulement : une empreinte SHA-256 simple se retrouverait en une seconde si la base fuyait. Il est donc stocké en **HMAC-SHA256 avec un secret du serveur** (`AUTH_SECRET`, hors de la base).
- Jeton du lien : 32 octets aléatoires, SHA-256 suffit.
- Comparaison en temps constant (`hmac.Equal`).
- 10 minutes, usage unique ; une nouvelle demande annule la précédente pour cette adresse.
- 5 essais par demande, comptés de façon atomique en base (`UPDATE … SET attempts = attempts + 1 WHERE … AND attempts < 5 RETURNING …`) : des essais lancés en parallèle ne dépassent pas la limite.

### Les limites (contre la force brute et contre l'envoi d'e-mails à des inconnus)
- Par adresse : 3 demandes par heure (comptées en base). Avec 5 essais par demande, au plus 15 essais par heure sur un million de codes.
- Par IP : 10 demandes par heure, en mémoire (une seule instance de l'API). L'IP vient de `X-Forwarded-For`, ajouté par Caddy ; l'API n'écoute que sur `127.0.0.1`, personne d'autre ne peut l'inventer.
- Plafond global : le quota quotidien du plan Resend moins une marge. Au-delà, `503` et une erreur dans les journaux. Un attaquant pourrait épuiser ce plafond et bloquer les connexions de la journée : c'est le prix du plan gratuit, et le passage au plan Pro le repousse.
- Si des abus apparaissent : Turnstile (déjà utilisé par le site) sur le formulaire de la PWA.

### La base (migrations)
```sql
accounts       (id, email UNIQUE, CHECK (email = lower(email)), created_at)
login_requests (id, email, code_hmac, token_hash UNIQUE, attempts CHECK 0..5,
                expires_at, used_at, created_at)          -- index (email, created_at)
sessions       (token_hash PRIMARY KEY, account_id → accounts ON DELETE CASCADE,
                created_at, last_seen_at, expires_at)
```
- L'adresse est normalisée une fois (espaces retirés, minuscules) et validée par `net/mail.ParseAddress`, 254 caractères au plus.
- Ménage : une goroutine supprime chaque heure les demandes et sessions expirées.

### L'envoi
- Port `mail.Sender` dans `internal/service`, adaptateur SMTP avec `net/smtp` (TLS sur le port 465) vers Resend ; aucune dépendance.
- Dev : Mailpit dans `apps/api/compose.yaml` (un faux serveur SMTP, les e-mails s'affichent sur `http://127.0.0.1:8025`, rien ne part).
- Clé Resend propre à l'API, limitée à l'envoi depuis `rawiaudio.com`, dans `/etc/rawi.env` avec `AUTH_SECRET`.
- Production : le service systemd interdit aujourd'hui toute sortie réseau (`IPAddressDeny=any`, revue du 27 octobre). Il faut l'ouvrir vers Resend : les adresses de Resend changent, donc on retire `IPAddressAllow`/`IPAddressDeny` et on garde `SocketBindAllow` (l'API ne prend toujours que son port).
- Ajouter l'enregistrement DMARC de `rawiaudio.com` (`_dmarc`), pas encore posé : sans lui, Gmail et Yahoo classent plus souvent en indésirables.

### Qui écrit quoi (zone sensible, `CLAUDE.md`)
- **Salim** : vérification du code et du lien, sessions, middleware d'accès, limites, création et suppression du compte. Claude relit, pointe ce qui casse, écrit les tests si Salim le demande.
- **Claude**, si Salim est d'accord : le contrat OpenAPI, l'adaptateur d'envoi et Mailpit, le texte de l'e-mail, les écrans de la PWA et de l'app (e-mail, code avec `autocomplete="one-time-code"`, « Mon compte » avec déconnexion et suppression).

## Questions pour Salim
1. ~~Resend~~ : oui, avec `connexion@rawiaudio.com` (27 octobre 2026).
2. ~~Durée de session~~ : 180 jours, prolongés à l'usage.
3. ~~`expo-secure-store`~~ : oui.
4. ~~Le partage~~ : la déconnexion et `DELETE /account` suffisent pour la tranche 6 ; « se déconnecter de tous les appareils » et la limite d'appareils se discutent avec l'abonnement.
5. **Historique** (ADR-0007) : synchronisé dans cette tranche, ou juste après ? Sans lui, la tranche 6 ne change rien de visible tant que l'abonnement n'existe pas.
6. ~~Le partage du travail~~ : Salim confie toute la tranche à Claude (« fais tout », 27 octobre 2026), migrations comprises ; il relit chaque diff.

## Conséquences
- Écrit le 27 octobre 2026 (étapes 3 à 5) :
  - migration `0006_auth.sql` ; `service.Auth` pour les règles, `repository.Auth` pour le SQL ; `internal/httpapi/auth.go` pour les routes et la session, et `ratelimit.go` pour la limite par IP ;
  - l'e-mail part pendant la requête, en 10 secondes au plus, et non en arrière-plan : une panne d'envoi répond 500 et le client peut réessayer ;
  - tests contre la vraie base : usage unique, expiration, 5 essais même en rafale, limites, sessions prolongées, suppression du compte, et A ne voit jamais B ;
  - essai de bout en bout avec Mailpit.
- Écrit le 27 octobre 2026 (étape 6) :
  - code partagé : `AuthGateway` (cœur), `createAccountSession`, `createHttpAuthGateway` (cookie pour la PWA, jeton et `TokenStore` pour l'app), textes et messages d'erreur ;
  - PWA : pages `/connexion` (le lien `#jeton=` attend un clic, puis le jeton disparaît de l'adresse et de l'historique) et `/compte`, lien « Mon compte » dans l'en-tête ;
  - app : écrans de connexion (code seulement) et « Mon compte », jeton dans le trousseau avec `expo-secure-store` 58.0.2, en `AFTER_FIRST_UNLOCK` pour la lecture écran verrouillé. Le jeton suit une sauvegarde iCloud chiffrée vers un nouvel iPhone : la session continue après restauration (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` l'empêcherait). Sur Android, le plugin retire le jeton de la sauvegarde automatique ;
  - essayé dans Chrome sans écran contre l'API de dev et Mailpit (PWA) ; l'app n'a pas encore été vue sur un téléphone.
- Les routes du catalogue restent publiques ; `routes.go` gagne un wrapper par niveau d'accès (`public`, `compte`), comme prévu par son commentaire.
- Le client HTTP partagé passe `credentials: 'include'` côté PWA, et l'en-tête `Authorization` côté app.
- Le CORS accepte `POST` et `DELETE`, les en-têtes `Content-Type` et `Authorization`, et les cookies, pour l'origine de la PWA seulement.
- La politique de confidentialité du site doit mentionner le compte (une adresse e-mail, rien d'autre) et sa suppression.
- Nouvelles variables : `AUTH_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`, `APP_URL`.

## Ordre proposé (une étape, un « go »)
1. Réponses aux questions, ADR accepté.
2. Contrat OpenAPI des routes ci-dessus.
3. Migrations.
4. Adaptateur d'envoi et Mailpit.
5. Service, handlers, middleware et tests.
6. Écrans de la PWA, puis de l'app mobile.
7. VPS : secrets, ouverture de la sortie vers Resend, DMARC, puis `make deploy-api`.

## Sources
- [Resend, envoi en SMTP](https://resend.com/docs/send-with-smtp), [Resend, tarifs](https://resend.com/pricing) (relevés le 27 octobre 2026)
- [Apple, règles de l'App Store (5.1.1(v), suppression du compte)](https://developer.apple.com/app-store/review/guidelines/)
- [Go, `http.CrossOriginProtection`](https://pkg.go.dev/net/http#CrossOriginProtection)
