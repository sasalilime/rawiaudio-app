# Image de l'API Rawi Audio. Contexte de build : apps/api.
# Images épinglées par digest d'index (multi-architecture) : mise à jour décrite dans le README.

# Étape 1 : compilation. La version de Go doit suivre la directive go du go.mod :
# l'image officielle refuse de télécharger une autre version (GOTOOLCHAIN=local).
FROM golang:1.26.10-alpine3.24@sha256:27f2d3b83cfc5803c8078f8e730af0f7c431bf067afaec8f60a36fb763187cba AS build
WORKDIR /src

# Dépendances d'abord : cette couche reste en cache tant que go.mod et go.sum ne changent pas.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO_ENABLED=0 : binaire statique, qui tourne sans libc dans l'image finale.
# -trimpath : retire les chemins de la machine de build du binaire.
RUN CGO_ENABLED=0 go build -trimpath -o /out/api .

# Étape 2 : exécution. Distroless : ni shell ni gestionnaire de paquets, utilisateur non root (65532).
FROM gcr.io/distroless/static-debian13:nonroot@sha256:18f4cc26c9ffa7f20a359298be7deadac5c607c8e03a02b8119f1a5fc2f82c99
COPY --from=build /out/api /api
EXPOSE 8080
ENTRYPOINT ["/api"]
