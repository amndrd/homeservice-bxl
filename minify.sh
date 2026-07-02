#!/bin/sh
# Régénère les fichiers .min.* servis par index.html / devis.html à partir
# des sources (script.js, brussels-map-data.js, styles.css). À relancer
# après toute modification de ces fichiers - le site sert les .min.*, pas
# les sources, donc un oubli laisse le site sur une version obsolète.
set -e
cd "$(dirname "$0")"
npx --yes terser script.js -c -m --comments false -o script.min.js
npx --yes terser brussels-map-data.js -c -m --comments false -o brussels-map-data.min.js
npx --yes clean-css-cli -O2 styles.css -o styles.min.css
echo "OK - fichiers .min.* régénérés."
