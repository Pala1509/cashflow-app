#!/bin/bash
# Genera el AAB firmado de CashFlow para Play Store.
# Uso:  ./firmar-android.sh
# Solo te pide la clave de la llave (no se ve mientras escribes).
set -e
cd "$(dirname "$0")"

LLAVE="/Users/felipepalacios/Documents/Vantalab Studio/06 Codigo/keystores/cashflow.jks"
ALIAS="key0"
PROPS="android/keystore.properties"

[ -f "$LLAVE" ] || { echo "❌ No encuentro la llave en: $LLAVE"; exit 1; }

# ¿Ya hay clave guardada?
if grep -q "ESCRIBE_AQUI" "$PROPS" 2>/dev/null || [ ! -f "$PROPS" ]; then
  read -s -p "🔑 Clave de la llave de CashFlow: " CLAVE; echo
  echo "→ Verificando la clave..."
  if ! keytool -list -keystore "$LLAVE" -storepass "$CLAVE" -alias "$ALIAS" >/dev/null 2>&1; then
    echo "❌ Esa clave no abre la llave. Prueba otra vez."; exit 1
  fi
  cat > "$PROPS" <<PROPS_EOF
# Firma release de CashFlow (NO se sube a git: está en .gitignore)
storeFile=$LLAVE
storePassword=$CLAVE
keyAlias=$ALIAS
keyPassword=$CLAVE
PROPS_EOF
  chmod 600 "$PROPS"
  echo "✅ Clave correcta y guardada."
fi

echo "→ Compilando la web..."
npm install --silent
npm run build
npx cap sync android

echo "→ Generando el AAB firmado..."
# Gradle 8.14 no soporta Java 25 (y Android Studio nuevo trae 25).
# Se usa Java 21: el del sistema si existe; si no, se descarga UNA vez a
# ~/Library/Java/jdk21-cashflow (no toca el sistema ni pide admin).
JDK_LOCAL="$HOME/Library/Java/jdk21-cashflow"
if [ -x "$JDK_LOCAL/Contents/Home/bin/java" ]; then
  export JAVA_HOME="$JDK_LOCAL/Contents/Home"
elif /usr/libexec/java_home -v 21 >/dev/null 2>&1 && /usr/libexec/java_home -v 21 | grep -qv "25"; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
else
  echo "→ Descargando Java 21 (solo esta vez, ~190 MB)..."
  ARCH=$(uname -m); [ "$ARCH" = "arm64" ] && ARCH=aarch64 || ARCH=x64
  TMP=$(mktemp -d)
  curl -fL --progress-bar -o "$TMP/jdk.tar.gz" \
    "https://api.adoptium.net/v3/binary/latest/21/ga/mac/$ARCH/jdk/hotspot/normal/eclipse"
  mkdir -p "$JDK_LOCAL"
  tar -xzf "$TMP/jdk.tar.gz" -C "$JDK_LOCAL" --strip-components=1
  rm -rf "$TMP"
  export JAVA_HOME="$JDK_LOCAL/Contents/Home"
fi
export PATH="$JAVA_HOME/bin:$PATH"
echo "   Java: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
cd android
chmod +x gradlew 2>/dev/null || true
./gradlew bundleRelease

AAB="app/build/outputs/bundle/release/app-release.aab"
VERSION=$(grep -E "versionName" app/build.gradle | head -1 | sed -E 's/.*"(.*)".*/\1/')
CODIGO=$(grep -E "versionCode" app/build.gradle | head -1 | grep -oE "[0-9]+")
echo ""
echo "🎉 Listo: CashFlow $VERSION (código $CODIGO)"
echo "   $(pwd)/$AAB"
open -R "$AAB"
