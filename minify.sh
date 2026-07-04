#!/bin/sh
# Régénère les fichiers .min.* servis par index.html / devis.html à partir
# des sources (script.js, brussels-map-data.js, styles.css). À relancer
# après toute modification de ces fichiers - le site sert les .min.*, pas
# les sources, donc un oubli laisse le site sur une version obsolète.
#
# Cache busting : les .min.* sont servis avec Cache-Control: immutable sur
# 1 an, sous le même nom de fichier à chaque fois (cf. _headers) - un
# navigateur qui les a déjà en cache ne les redemande jamais, même après une
# nouvelle mise en ligne. Un paramètre ?v=<timestamp> est donc ajouté aux
# références locales (styles.min.css, script.min.js,
# brussels-map-data.min.js) dans index.html et devis.html, régénéré à
# chaque exécution de ce script : une URL différente = une requête réseau
# différente, jamais servie depuis le cache immutable précédent.
set -e
cd "$(dirname "$0")"
npx --yes terser script.js -c -m --comments false -o script.min.js
npx --yes terser brussels-map-data.js -c -m --comments false -o brussels-map-data.min.js
npx --yes clean-css-cli -O2 styles.css -o styles.min.css

VERSION=$(date +%s)
for FILE in index.html devis.html; do
  sed -E -i '' \
    -e "s/(script\.min\.js)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    -e "s/(styles\.min\.css)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    -e "s/(brussels-map-data\.min\.js)(\?v=[0-9]+)?/\\1?v=${VERSION}/g" \
    "$FILE"
done

echo "OK - fichiers .min.* régénérés (version cache busting : ${VERSION})."
