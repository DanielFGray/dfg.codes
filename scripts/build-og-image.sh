#!/usr/bin/env bash
# Build the social card for the landing page: the split screen, with the name bridging it.
#
# The name crosses both halves, so it cannot be one flat colour. The site draws it with
# mix-blend-mode: difference, which inverts it against whatever is behind it: white over
# black, black over white. The card does the same by drawing the name twice and clipping
# each copy to its half, then joining them back into one word.
set -euo pipefail

W=1200
H=630
cd "$(dirname "$0")/.."
OUT=public/og.png
TMP=$(mktemp -d)

NAME='DANIEL F. GRAY'
FONT='DejaVu-Sans'
POINTSIZE=62

# The name as a white shape on transparent ground, sized to the full card.
magick -font "$FONT" -pointsize $POINTSIZE -background none -fill white \
  label:"$NAME" "$TMP/name.png"

# The two halves.
magick -size 600x630 xc:'#0e0e0e' "$TMP/left.png"
magick -size 600x630 xc:'#fafafa' "$TMP/right.png"

# Place the one name across the whole card, then keep only its left half on the dark
# side. Difference against black leaves the white name white.
magick "$TMP/name.png" -background none -gravity center -geometry +0+0 -extent ${W}x${H} \
  "$TMP/name-placed.png"

# Left half of the name, over the dark half.
magick "$TMP/name-placed.png" -crop 600x630+0+0 +repage "$TMP/name-left.png"
magick "$TMP/left.png" "$TMP/name-left.png" -compose difference -composite "$TMP/left.png"

# Right half of the name, over the light half. Difference against white leaves black.
magick "$TMP/name-placed.png" -crop 600x630+600+0 +repage "$TMP/name-right.png"
magick "$TMP/right.png" "$TMP/name-right.png" -compose difference -composite "$TMP/right.png"

magick "$TMP/left.png" "$TMP/right.png" +append "$TMP/split.png"

# Each label is drawn at an explicit offset, so the placement does not depend on how
# -annotate interprets a gravity with an offset. The colour is set on the canvas being
# annotated, because a standalone label image comes out greyscale.
MUSIC_W=$(magick -font "$FONT" -pointsize 30 -background none -fill white \
  label:'I teach music' -format '%w' info:)
CODE_W=$(magick -font "$FONT" -pointsize 30 -background none -fill white \
  label:'I write code' -format '%w' info:)

MUSIC_X=60
CODE_X=$((W - 60 - CODE_W))
TOP=70

magick "$TMP/split.png" \
  -font "$FONT" -pointsize 30 -fill '#e08a3c' \
  -draw "text $MUSIC_X,$((TOP + 30)) 'I teach music'" \
  "$TMP/with-music.png"

magick "$TMP/with-music.png" \
  -font "$FONT" -pointsize 30 -fill '#0ea5e9' \
  -draw "text $CODE_X,$((TOP + 30)) 'I write code'" \
  -strip -quality 88 "$OUT"
rm -rf "$TMP"
echo "wrote $OUT"
