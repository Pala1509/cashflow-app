#!/bin/bash
# Compila CashFlow y abre Xcode / Android Studio para probar.
#
#   ./probar.sh            → iPhone (Xcode)
#   ./probar.sh android    → Android (Android Studio)
#   ./probar.sh todo       → los dos
#
# Después, en Xcode o Android Studio: elegir el celular y darle Run (▶).

set -e
cd "$(dirname "$0")"
DESTINO="${1:-ios}"

echo "→ 1/3 Instalando dependencias (si hace falta)…"
npm install --no-audit --no-fund

echo "→ 2/3 Compilando la app web…"
npm run build

echo "→ 3/3 Pasando los cambios al proyecto nativo…"
case "$DESTINO" in
  ios)     npx cap sync ios && npx cap open ios ;;
  android) npx cap sync android && npx cap open android ;;
  todo)    npx cap sync && npx cap open ios && npx cap open android ;;
  *)       echo "Uso: ./probar.sh [ios|android|todo]"; exit 1 ;;
esac

echo "✓ Listo. Elegí tu celular arriba y dale Run (▶)."
