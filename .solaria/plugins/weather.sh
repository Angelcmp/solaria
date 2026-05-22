#!/bin/sh
# DESC: Obtiene el clima actual de una ciudad usando wttr.in
# PARAM: city | string | Nombre de la ciudad (ej: Madrid, London) | required

# Parse JSON: get "city" value from $1
CITY=$(printf '%s' "$1" | sed 's/.*"city":"//' | sed 's/".*//')

if [ -z "$CITY" ]; then
  echo '{"error": "No se pudo determinar la ciudad. Uso: {\"city\":\"Madrid\"}" }'
  exit 1
fi

curl -s "wttr.in/${CITY}?format=%C+%t+%w+%h" 2>/dev/null || echo '{"error": "No se pudo conectar a wttr.in"}'
