-- Lien de connexion lié au navigateur qui l'a demandé (relecture de sécurité du 27/10/2026, ADR-0012).
-- Sans ce lien, un attaquant pouvait envoyer à une victime le lien de SON propre compte : un clic, et la victime
-- se retrouvait connectée chez lui, son historique d'écoute avec. Le navigateur qui demande le code reçoit un
-- cookie ; le lien n'ouvre une session que dans ce navigateur. NULL : demande de l'app mobile, qui n'a pas de lien.
ALTER TABLE login_requests ADD COLUMN browser_hash bytea CHECK (length(browser_hash) = 32);
