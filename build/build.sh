#!/bin/bash -e
##
# Bash script to compile a chrome extension and output its ID.
#
NAME="SurfAlyze"
FILES="css/ fonts/ js/ _locales/ pages/ res/ LICENSE manifest.json"
KEY_PRIV="surfalyze.key"
KEY_PUB="surfalyze.pub"
#
################################################################################



DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

OUTDIR="$DIR/$NAME"

if [[ -d $OUTDIR ]]; then
	echo "$OUTDIR already exists."
	exit 1
fi

mkdir -p $OUTDIR
cp -a $FILES $OUTDIR/

cd $DIR

./crxmake.sh $NAME $KEY_PRIV > /dev/null
echo "Wrote $DIR/$NAME.crx"

echo -n "Extension ID (calculated from public key $KEY_PUB): "
./extension_id.py $KEY_PUB | /bin/grep "Extension ID: " | cut -c15-

rm -rf $OUTDIR
