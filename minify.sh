#!/bin/sh
# Régénère les fichiers .min.* servis par index.html, devis.html et
# demande.html à partir des sources (script.js, styles.css). À relancer après
# toute modification de ces fichiers - le site sert les .min.*, pas les
# sources, donc un oubli laisse le site sur une version obsolète.
#
# Cache busting : les .min.* (et les images comme le logo) sont servis avec
# Cache-Control: immutable sur 1 an, sous le même nom de fichier à chaque
# fois (cf. _headers) - un navigateur qui les a déjà en cache ne les
# redemande jamais, même après une nouvelle mise en ligne (vécu en vrai :
# remplacer le logo vert par le noir sous le même nom n'a rien changé chez
# les visiteurs qui l'avaient déjà en cache). Un paramètre ?v=<timestamp>
# est donc ajouté aux références locales (styles.min.css, script.min.js,
# logo.png, logo-blanc.png) dans les trois pages, régénéré à chaque exécution
# de ce script : une URL différente = une requête réseau différente, jamais
# servie depuis le cache immutable précédent.
set -e
cd "$(dirname "$0")"
npx --yes terser script.js -c -m --comments false -o script.min.js
npx --yes clean-css-cli -O2 styles.css -o styles.min.css

VERSION=$(date +%s)
for FILE in index.html devis.html demande.html; do
  sed -E -i '' \
    -e "s/(script\.min\.js)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    -e "s/(styles\.min\.css)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    -e "s/(images\/logo\.png)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    -e "s/(images\/logo-blanc\.png)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    "$FILE"
done

echo "OK - fichiers .min.* régénérés (version cache busting : ${VERSION})."
