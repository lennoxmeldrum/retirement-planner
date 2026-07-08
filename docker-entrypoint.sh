#!/bin/sh
# Generate runtime-config.js from Cloud Run environment variables at container start.
cat > /usr/share/nginx/html/runtime-config.js << CONFIG
window.RUNTIME_CONFIG = {
  GEMINI_API_KEY: "${GEMINI_API_KEY:-${API_KEY:-}}",
  API_KEY: "${API_KEY:-${GEMINI_API_KEY:-}}"
};
CONFIG
echo "runtime-config.js generated"
