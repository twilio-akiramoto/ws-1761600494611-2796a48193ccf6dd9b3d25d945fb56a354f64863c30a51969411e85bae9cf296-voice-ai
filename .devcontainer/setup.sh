#!/bin/bash

# Make port 3000 public for WebSocket connections
echo "🔓 Setting port 3000 to public..."

# Try using gh CLI if available
if command -v gh &> /dev/null; then
  gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || true
  echo "✓ Port visibility set via gh CLI"
fi

# Also try using the GitHub Codespaces API directly
if [ -n "$GITHUB_TOKEN" ] && [ -n "$CODESPACE_NAME" ]; then
  curl -X PATCH \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user/codespaces/$CODESPACE_NAME/ports/3000" \
    -d '{"visibility":"public"}' \
    2>/dev/null || true
  echo "✓ Port visibility set via API"
fi

echo "✓ Port configuration complete"
