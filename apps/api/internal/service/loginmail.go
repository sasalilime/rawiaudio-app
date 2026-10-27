package service

import (
	"fmt"
	"time"
)

// LoginMail donne le sujet et le texte de l'e-mail de connexion (ADR-0012).
//   - code : les 6 chiffres. Ils sont aussi dans le sujet, pour les lire dans la notification sans ouvrir l'e-mail.
//   - link : https://app.rawiaudio.com/connexion#jeton=…, pour se connecter sur l'appareil qui lit l'e-mail.
//   - validFor : la durée de vie de la demande, pour que le texte dise la même chose que la base.
func LoginMail(code, link string, validFor time.Duration) (subject, text string) {
	subject = fmt.Sprintf("Votre code Rawi Audio : %s", code)
	text = fmt.Sprintf(`Bonjour,

Voici votre code pour vous connecter à Rawi Audio :

    %s

Il est valable %d minutes. Tapez-le dans l'appli.

Vous lisez cet e-mail sur l'appareil où vous écoutez Rawi ? Ce lien vous connecte aussi :
%s

Vous n'avez rien demandé ? Ignorez cet e-mail : sans ce code, personne ne peut se connecter.

Rawi Audio
https://rawiaudio.com
`, code, int(validFor.Minutes()), link)
	return subject, text
}
