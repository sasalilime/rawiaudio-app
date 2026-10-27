-- Historique d'écoute d'un compte (ADR-0007, ADR-0012) : les épisodes entendus, sur tous les appareils de la famille.
-- Un épisode entendu le reste : l'historique ne fait que grandir. Deux appareils se fusionnent donc par
-- simple union, sans conflit possible.
CREATE TABLE heard_episodes (
    account_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE, -- supprimé avec le compte
    episode_id text NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
    heard_at   timestamptz NOT NULL, -- première synchronisation qui l'a apporté
    PRIMARY KEY (account_id, episode_id)
);
