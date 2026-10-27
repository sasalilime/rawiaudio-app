package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ipLimiter laisse passer au plus max requêtes par IP sur une fenêtre glissante.
// ponytail: en mémoire, remis à zéro au redémarrage : il n'y a qu'une instance de l'API (ADR-0011).
// Une table en base si l'API tourne un jour sur plusieurs machines.
type ipLimiter struct {
	mu        sync.Mutex
	max       int
	window    time.Duration
	hits      map[string][]time.Time
	lastSweep time.Time
	now       func() time.Time
}

func newIPLimiter(max int, window time.Duration) *ipLimiter {
	return &ipLimiter{max: max, window: window, hits: map[string][]time.Time{}, now: time.Now}
}

func (l *ipLimiter) allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	// Ménage au plus une fois par fenêtre : la map ne garde que les IP vues récemment.
	if now.Sub(l.lastSweep) >= l.window {
		for key, times := range l.hits {
			if now.Sub(times[len(times)-1]) >= l.window {
				delete(l.hits, key)
			}
		}
		l.lastSweep = now
	}
	recent := l.hits[ip][:0:0] // nouvelle tranche vide : ne pas réécrire l'ancienne pendant qu'on la lit
	for _, t := range l.hits[ip] {
		if now.Sub(t) < l.window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.max {
		l.hits[ip] = recent
		return false
	}
	l.hits[ip] = append(recent, now)
	return true
}

func (l *ipLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(clientIP(r)) {
			writeTooManyRequests(w, r, l.window)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP : l'adresse du client. Sur le VPS, l'API n'écoute que sur 127.0.0.1, derrière Caddy (ADR-0011) :
// une connexion venue de la machine est donc Caddy, et l'adresse du client est la dernière de
// X-Forwarded-For, celle que Caddy ajoute. D'ailleurs (dev, Docker), cet en-tête que n'importe qui peut
// écrire est ignoré.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
		return host
	}
	values := r.Header.Values("X-Forwarded-For")
	if len(values) == 0 {
		return host
	}
	parts := strings.Split(values[len(values)-1], ",")
	if last := strings.TrimSpace(parts[len(parts)-1]); last != "" {
		return last
	}
	return host
}
