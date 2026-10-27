-- Connexion par e-mail (ADR-0012) : les comptes, les demandes de connexion (code et lien), les sessions.
-- Aucun code, jeton ou mot de passe en clair : seulement leurs empreintes.

-- Un compte par famille, identifié par son adresse. L'API la normalise (espaces retirés, minuscules) :
-- la base le vérifie, pour que « Parent@x.fr » et « parent@x.fr » ne fassent jamais deux comptes.
CREATE TABLE accounts (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
    created_at timestamptz NOT NULL
);

-- Une demande de connexion : un e-mail parti avec un code et un lien, valable quelques minutes.
-- Pas de clé étrangère vers accounts : le compte n'est créé qu'à la première vérification réussie.
CREATE TABLE login_requests (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL CHECK (email = lower(btrim(email))),
    code_hmac  bytea NOT NULL CHECK (length(code_hmac) = 32),         -- HMAC-SHA256 du code, clé AUTH_SECRET
    token_hash bytea NOT NULL UNIQUE CHECK (length(token_hash) = 32), -- SHA-256 du jeton du lien
    attempts   smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5), -- essais de code, 5 au plus
    expires_at timestamptz NOT NULL,
    closed_at  timestamptz, -- utilisée, ou remplacée par une demande plus récente de la même adresse
    created_at timestamptz NOT NULL
);
-- Sert à compter les demandes récentes d'une adresse (limite par adresse) et à trouver sa demande en cours.
CREATE INDEX login_requests_email_created_at ON login_requests (email, created_at);

-- Une session par appareil connecté. Le jeton reste chez le client (cookie ou trousseau) ;
-- une fuite de la base ne donne donc aucune session.
CREATE TABLE sessions (
    token_hash   bytea PRIMARY KEY CHECK (length(token_hash) = 32), -- SHA-256 du jeton de session
    account_id   bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL, -- écrite au plus une fois par jour, pas à chaque requête
    expires_at   timestamptz NOT NULL
);
-- La clé étrangère ne crée pas d'index : sans lui, supprimer un compte parcourrait toutes les sessions.
CREATE INDEX sessions_account_id ON sessions (account_id);
