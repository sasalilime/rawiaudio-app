# Installer Rawi sur le VPS (une seule fois)

Décision : ADR-0011. Le VPS a déjà son socle (Caddy, ufw, mises à jour automatiques) ; Rawi suit la convention des sites qui y tournent : un utilisateur système, un service systemd, un fichier Caddy, des secrets dans `/etc/<site>.env`, pas de Docker.

Ensuite, chaque nouvelle version de l'API part avec `make deploy-api`, depuis le poste de dev.

## 1. Dans Cloudflare (tableau de bord)
1. **DNS** de `rawiaudio.com` : deux enregistrements `api`, en **« DNS only »** (nuage gris), sinon Caddy ne peut pas obtenir son certificat :
   - `A` → `94.23.107.23`
   - `AAAA` → `2001:41d0:20a:900::750`
2. **DMARC** de `rawiaudio.com` (e-mails de connexion, ADR-0012) : un enregistrement `TXT` nommé `_dmarc`, valeur `v=DMARC1; p=none; rua=mailto:contact@rawiaudio.com`. Sans lui, Gmail et Yahoo classent plus souvent les e-mails en indésirables. `p=none` ne bloque rien : il demande seulement des rapports, à durcir plus tard.
3. **Token R2 de production** : R2, « Manage API tokens », « Create Account API token » :
   - permission « Object Read only », limitée au bucket `rawi-audio` ;
   - garder l'« Access Key ID » et le « Secret Access Key » pour l'étape 3. Ils ne s'affichent qu'une fois.

## 2. Sur le VPS : Postgres, l'utilisateur et les dossiers
Depuis le poste : `ssh vps`, puis :
```bash
sudo apt install --yes postgresql
sudo useradd --system --shell /usr/sbin/nologin --home-dir /var/www/rawi --no-create-home rawi
sudo install -d -o root -g rawi -m 750 /var/www/rawi
sudo install -d -o rawi -g rawi -m 700 /var/backups/rawi
sudo -u postgres createuser rawi
sudo -u postgres createdb --owner=rawi --template=template0 --locale-provider=icu --icu-locale=fr-FR --locale=C.UTF-8 rawi
sudo -u postgres psql -d rawi -c "REVOKE CONNECT, TEMPORARY ON DATABASE rawi FROM PUBLIC"
```
- `useradd --system` : un utilisateur sans mot de passe ni connexion possible, qui ne sert qu'à faire tourner l'API.
- `createuser rawi` : le rôle Postgres du même nom. Ubuntu laisse un utilisateur système se connecter à son rôle sans mot de passe (authentification « peer »), par le socket local : pas de mot de passe de base à garder.
- `--icu-locale=fr-FR` : les textes de la base se trient en français.
- `REVOKE … FROM PUBLIC` : par défaut, tout rôle Postgres peut se connecter à toute base. Les autres sites du VPS auront leur propre rôle : seul `rawi` (propriétaire) entre dans la base `rawi`.
- Postgres n'écoute que sur la machine (réglage d'Ubuntu) : rien à ouvrir dans ufw.

## 3. Sur le VPS : les secrets
```bash
sudo install -m 600 -o root -g root /dev/null /etc/rawi.env
sudoedit /etc/rawi.env
```
- La première commande crée le fichier vide, lisible par root seul. `sudoedit` l'ouvre dans l'éditeur.
- Y coller le contenu de `ops/rawi.env.example`, puis les deux clés du token de l'étape 1 et l'identifiant du compte Cloudflare dans `R2_ENDPOINT`.
- `AUTH_SECRET` : coller la sortie de `openssl rand -hex 32`, lancée sur le VPS. Ce secret ne sert qu'ici, il n'est copié nulle part ailleurs.
- `SMTP_PASSWORD` : une clé API Resend créée pour l'API (Resend, « API Keys », « Create API Key »), en « Sending access », limitée au domaine `rawiaudio.com`. Elle ne s'affiche qu'une fois.
- Enregistrer, puis vérifier les droits : `sudo ls -l /etc/rawi.env` doit afficher `-rw-------` et `root root`.

## 4. Depuis le poste : la première mise en ligne
À la racine du repo, tout étant commité :
```bash
make deploy-api
```
Il compile l'API pour Linux, l'envoie avec le script de sauvegarde, installe les services et le fichier Caddy, puis démarre l'API. La dernière ligne doit être `active`.

## 5. Vérifications
```bash
ssh vps 'systemctl is-active postgresql rawi-api rawi-backup.timer; journalctl -u rawi-api -n 5 --no-pager'
curl -s https://api.rawiaudio.com/health; echo
curl -s "https://api.rawiaudio.com/episodes?lang=fr"; echo
```
- Trois lignes `active`, et des journaux qui disent « migration appliquée » puis « serveur démarré ».
- `/health` répond `{"status":"ok"}`. Le premier appel peut prendre quelques secondes : Caddy obtient le certificat.
- La liste des épisodes est vide tant qu'aucun n'est publié.
- Puis lancer une première sauvegarde et la restaurer à part (`ops/runbooks/sauvegardes.md`).

## 6. Ensuite
1. Les épisodes : `ops/runbooks/publier-un-episode.md`.
2. Le bucket des illustrations : même runbook, section « Une seule fois ».
3. La PWA sur `app.rawiaudio.com`, une fois l'API en ligne (elle l'appelle) :
   ```bash
   cd apps/web
   npm run build:prod && npx wrangler@4.142.0 deploy
   ```
