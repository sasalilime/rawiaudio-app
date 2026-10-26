// Package migrations embarque les fichiers SQL du schéma dans le binaire.
// Package à part pour que l'API et les tests d'intégration appliquent les mêmes fichiers.
package migrations

import "embed"

// FS contient les fichiers *.sql de ce dossier, appliqués dans l'ordre de leurs noms.
//
//go:embed *.sql
var FS embed.FS
