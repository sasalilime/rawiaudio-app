package service

import (
	"fmt"
	"time"
)

// LoginMail donne le sujet et le texte de l'e-mail de connexion (ADR-0012).
//   - code : les 6 chiffres. Ils sont aussi dans le sujet, pour les lire dans la notification sans ouvrir l'e-mail.
//   - link : https://app.rawiaudio.com/connexion#jeton=…, qui ne marche que dans le navigateur qui a demandé le
//     code ; vide pour l'app mobile, qui n'a que le code.
//   - validFor : la durée de vie de la demande, pour que le texte dise la même chose que la base.
func LoginMail(code, link string, validFor time.Duration) (subject, text string) {
	subject = fmt.Sprintf("Votre code Rawi Audio : %s", code)
	linkPart := ""
	if link != "" {
		linkPart = fmt.Sprintf(`
Vous avez demandé ce code dans un navigateur ? Dans ce même navigateur, ce lien vous connecte aussi :
%s
`, link)
	}
	text = fmt.Sprintf(`Bonjour,

Voici votre code pour vous connecter à Rawi Audio :

    %s

Il est valable %d minutes. Tapez-le dans l'appli.
%s
Vous n'avez rien demandé ? Ignorez cet e-mail : sans ce code, personne ne peut se connecter.

Rawi Audio
https://rawiaudio.com
`, code, int(validFor.Minutes()), linkPart)
	return subject, text
}
