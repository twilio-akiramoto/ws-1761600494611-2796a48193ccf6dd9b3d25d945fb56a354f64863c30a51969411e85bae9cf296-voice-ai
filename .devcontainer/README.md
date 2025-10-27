# 🎙️ Twilio Voice AI Workshop - Codespace

Your development environment is ready!

## Quick Start

The server should start automatically. If you see connection errors in the workshop:

1. **Check if server is running:**
   ```bash
   ps aux | grep "npm start"
   ```

2. **If not running, start it manually:**
   ```bash
   npm start
   ```

3. **Check server logs:**
   ```bash
   cat /tmp/server.log
   ```

## Troubleshooting

### Server not starting?
- Make sure you're in the project directory
- Run `npm install` first if needed
- Check for port conflicts: `lsof -i :3000`

### CORS errors?
- The server has CORS enabled - you should NOT see CORS errors
- If you do, the server might not be running
- Restart with: `npm start`

### Port not public?
Port 3000 should be automatically public. If not:
```bash
bash .devcontainer/setup.sh
```

## Need Help?

The workshop UI will guide you through any issues!
