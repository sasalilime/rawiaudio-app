package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rawiaudio.com/api/internal/service"
)

// Auth lit et écrit les comptes, les demandes de connexion et les sessions (ADR-0012).
// Les durées et limites se décident dans service.Auth ; ici, seulement le SQL.
type Auth struct {
	pool *pgxpool.Pool
}

func NewAuth(pool *pgxpool.Pool) *Auth {
	return &Auth{pool: pool}
}

func (a *Auth) CountLoginRequests(ctx context.Context, email string, since time.Time) (int, error) {
	var n int
	err := a.pool.QueryRow(ctx,
		`SELECT count(*) FROM login_requests WHERE email = $1 AND created_at > $2`, email, since).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("comptage des demandes de l'adresse: %w", err)
	}
	return n, nil
}

func (a *Auth) CountAllLoginRequests(ctx context.Context, since time.Time) (int, error) {
	var n int
	err := a.pool.QueryRow(ctx, `SELECT count(*) FROM login_requests WHERE created_at > $1`, since).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("comptage des demandes: %w", err)
	}
	return n, nil
}

// CreateLoginRequest : fermer les anciennes demandes et créer la nouvelle vont ensemble (transaction),
// sinon deux codes pourraient valoir en même temps.
func (a *Auth) CreateLoginRequest(ctx context.Context, req service.NewLoginRequest, now time.Time) error {
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx,
			`UPDATE login_requests SET closed_at = $2 WHERE email = $1 AND closed_at IS NULL`, req.Email, now); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO login_requests (email, code_hmac, token_hash, browser_hash, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)`, req.Email, req.CodeHMAC, req.TokenHash, req.BrowserHash, req.ExpiresAt, now)
		return err
	})
	if err != nil {
		return fmt.Errorf("création de la demande de connexion: %w", err)
	}
	return nil
}

// AttemptCode : un seul UPDATE compte l'essai et renvoie la demande. Postgres verrouille la ligne :
// deux essais simultanés passent l'un après l'autre, et le second revérifie « attempts < 5 » et « closed_at
// IS NULL » sur la ligne à jour. Les essais ne dépassent donc jamais 5, même en rafale.
func (a *Auth) AttemptCode(ctx context.Context, email string, now time.Time) (service.PendingLogin, error) {
	var p service.PendingLogin
	err := a.pool.QueryRow(ctx, `
		UPDATE login_requests SET attempts = attempts + 1
		WHERE id = (
			SELECT id FROM login_requests
			WHERE email = $1 AND closed_at IS NULL AND expires_at > $2
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		)
		AND closed_at IS NULL AND attempts < 5
		RETURNING id, email, code_hmac`, email, now).Scan(&p.ID, &p.Email, &p.CodeHMAC)
	if errors.Is(err, pgx.ErrNoRows) {
		return service.PendingLogin{}, service.ErrInvalidCode
	}
	if err != nil {
		return service.PendingLogin{}, fmt.Errorf("essai de code: %w", err)
	}
	return p, nil
}

func (a *Auth) PendingByToken(ctx context.Context, tokenHash []byte, now time.Time) (service.PendingLogin, error) {
	var p service.PendingLogin
	err := a.pool.QueryRow(ctx, `
		SELECT id, email, code_hmac, browser_hash FROM login_requests
		WHERE token_hash = $1 AND closed_at IS NULL AND expires_at > $2`, tokenHash, now).Scan(&p.ID, &p.Email, &p.CodeHMAC, &p.BrowserHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return service.PendingLogin{}, service.ErrInvalidCode
	}
	if err != nil {
		return service.PendingLogin{}, fmt.Errorf("lecture de la demande du lien: %w", err)
	}
	return p, nil
}

// CompleteLogin : fermer la demande, créer le compte et ouvrir la session dans une transaction. La fermeture
// passe en premier : si une autre requête vient de l'utiliser, rien d'autre n'est écrit (usage unique).
func (a *Auth) CompleteLogin(ctx context.Context, requestID int64, email string, session service.NewSession, now time.Time) (service.Account, error) {
	var account service.Account
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`UPDATE login_requests SET closed_at = $2 WHERE id = $1 AND closed_at IS NULL`, requestID, now)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return service.ErrInvalidCode
		}
		// DO UPDATE sans changement réel : avec DO NOTHING, RETURNING ne renverrait rien pour un compte existant.
		err = tx.QueryRow(ctx, `
			INSERT INTO accounts (email, created_at) VALUES ($1, $2)
			ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
			RETURNING id, email`, email, now).Scan(&account.ID, &account.Email)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at, expires_at)
			VALUES ($1, $2, $3, $3, $4)`, session.TokenHash, account.ID, now, session.ExpiresAt)
		return err
	})
	if errors.Is(err, service.ErrInvalidCode) {
		return service.Account{}, err
	}
	if err != nil {
		return service.Account{}, fmt.Errorf("ouverture de la session: %w", err)
	}
	return account, nil
}

func (a *Auth) SessionAccount(ctx context.Context, tokenHash []byte, now time.Time) (service.SessionAccount, error) {
	var s service.SessionAccount
	err := a.pool.QueryRow(ctx, `
		SELECT a.id, a.email, s.last_seen_at
		FROM sessions s
		JOIN accounts a ON a.id = s.account_id
		WHERE s.token_hash = $1 AND s.expires_at > $2`, tokenHash, now).Scan(&s.Account.ID, &s.Account.Email, &s.LastSeenAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return service.SessionAccount{}, service.ErrUnauthorized
	}
	if err != nil {
		return service.SessionAccount{}, fmt.Errorf("lecture de la session: %w", err)
	}
	return s, nil
}

func (a *Auth) ExtendSession(ctx context.Context, tokenHash []byte, lastSeenAt, expiresAt time.Time) error {
	_, err := a.pool.Exec(ctx,
		`UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE token_hash = $1`, tokenHash, lastSeenAt, expiresAt)
	if err != nil {
		return fmt.Errorf("prolongation de la session: %w", err)
	}
	return nil
}

func (a *Auth) DeleteSession(ctx context.Context, tokenHash []byte) error {
	if _, err := a.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash); err != nil {
		return fmt.Errorf("suppression de la session: %w", err)
	}
	return nil
}

// DeleteAccount : les sessions partent avec le compte (ON DELETE CASCADE) ; les demandes de connexion,
// liées par l'adresse et non par une clé étrangère, sont supprimées à part, dans la même transaction.
func (a *Auth) DeleteAccount(ctx context.Context, accountID int64) error {
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx,
			`DELETE FROM login_requests WHERE email = (SELECT email FROM accounts WHERE id = $1)`, accountID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM accounts WHERE id = $1`, accountID)
		return err
	})
	if err != nil {
		return fmt.Errorf("suppression du compte: %w", err)
	}
	return nil
}

func (a *Auth) DeleteExpired(ctx context.Context, requestsBefore, now time.Time) error {
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM login_requests WHERE created_at < $1`, requestsBefore); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= $1`, now)
		return err
	})
	if err != nil {
		return fmt.Errorf("ménage des demandes et sessions: %w", err)
	}
	return nil
}
