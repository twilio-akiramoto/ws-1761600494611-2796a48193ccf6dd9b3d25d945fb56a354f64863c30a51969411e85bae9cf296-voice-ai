import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import voiceHandler from './handlers/voice-handler.js';
import websocketHandler from './handlers/websocket-handler.js';

const { twiml: { VoiceResponse } } = twilio;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// CORS middleware - allow all origins for workshop/development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuration
const PORT = process.env.PORT || 3000;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Auto-detect Codespace URL
const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
let PUBLIC_URL = process.env.PUBLIC_URL;

if (!PUBLIC_URL && CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
  PUBLIC_URL = `https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
} else if (!PUBLIC_URL) {
  PUBLIC_URL = `http://localhost:${PORT}`;
}

// Validate environment variables (optional for development/testing)
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.warn('⚠️  TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN not set.');
  console.warn('   Server will start but Twilio features will be limited.');
  console.warn('   Add these to your .env file for full functionality.');
}

// Initialize Twilio client (only if credentials provided)
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN)
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ConversationRelay Starter Pack</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #F22F46; }
        .status { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .success { color: #0a0; }
        .warning { color: #f80; }
        .error { color: #f00; }
        code { background: #eee; padding: 2px 6px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🎙️ ConversationRelay Starter Pack</h1>
      <div class="status">
        <p><strong>Server Status:</strong> <span class="success">✓ Running</span></p>
        <p><strong>Port:</strong> ${PORT}</p>
        <p><strong>WebSocket:</strong> <span class="success">✓ Ready</span></p>
        <p><strong>Twilio Account:</strong> ${TWILIO_ACCOUNT_SID}</p>
        <p><strong>OpenAI:</strong> ${OPENAI_API_KEY ? '<span class="success">✓ Configured</span>' : '<span class="warning">⚠ Not configured</span>'}</p>
      </div>

      <h2>Available Endpoints:</h2>
      <ul>
        <li><code>POST /voice-handler</code> - Webhook for incoming/outgoing calls</li>
        <li><code>WebSocket /</code> - ConversationRelay WebSocket endpoint</li>
      </ul>

      <h2>Configure Your Phone Number:</h2>
      <p>Set your Twilio phone number's voice webhook to:</p>
      <code>${PUBLIC_URL}/voice-handler</code>

      <h2>Next Steps:</h2>
      <ol>
        <li>Complete the code in <code>handlers/voice-handler.js</code></li>
        <li>Complete the code in <code>handlers/websocket-handler.js</code></li>
        <li>Add your AI system prompt in <code>config/system-prompt.js</code></li>
        <li>Configure tools/function calling in <code>handlers/tools.js</code></li>
      </ol>
    </body>
    </html>
  `);
});

// Voice webhook endpoint
app.post('/voice-handler', (req, res) => {
  try {
    const twiml = voiceHandler(req.body, PUBLIC_URL);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error in voice-handler:', error);
    const errorResponse = new VoiceResponse();
    errorResponse.say('An error occurred. Please try again later.');
    res.type('text/xml');
    res.send(errorResponse.toString());
  }
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('📞 New WebSocket connection');

  const streamSid = req.url.split('=')[1]; // Extract streamSid from URL

  websocketHandler(ws, {
    streamSid,
    openaiApiKey: OPENAI_API_KEY,
    twilioClient
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    websocket: wss.clients.size + ' active connections',
    publicUrl: PUBLIC_URL,
    websocketUrl: PUBLIC_URL.replace(/^https?:\/\//, 'wss://').replace(/^http:\/\//, 'ws://'),
    timestamp: new Date().toISOString()
  });
});

// WebSocket test endpoint - helps debug connectivity
app.get('/test-websocket', (req, res) => {
  const wsUrl = PUBLIC_URL.replace(/^https?:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebSocket Test</title>
      <style>
        body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .success { color: #4ec9b0; }
        .error { color: #f48771; }
        .info { color: #4fc1ff; }
        pre { background: #2d2d2d; padding: 15px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>WebSocket Connection Test</h1>
      <p class="info">Testing connection to: ${wsUrl}</p>
      <pre id="log"></pre>
      <script>
        const log = document.getElementById('log');
        const ws = new WebSocket('${wsUrl}');

        ws.onopen = () => {
          log.innerHTML += '<span class="success">✓ WebSocket connected successfully!</span>\\n';
          ws.send(JSON.stringify({ type: 'test', message: 'Hello from test page' }));
        };

        ws.onmessage = (event) => {
          log.innerHTML += '<span class="info">← Received: ' + event.data + '</span>\\n';
        };

        ws.onerror = (error) => {
          log.innerHTML += '<span class="error">✗ WebSocket error: ' + error + '</span>\\n';
        };

        ws.onclose = () => {
          log.innerHTML += '<span class="info">✓ WebSocket closed</span>\\n';
        };
      </script>
    </body>
    </html>
  `);
});

// Start server
server.listen(PORT, () => {
  const WEBSOCKET_URL = PUBLIC_URL.replace(/^https?:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');

  console.log('');
  console.log('🎙️  ConversationRelay Starter Pack');
  console.log('================================');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ WebSocket server ready`);
  console.log(`✓ Public URL: ${PUBLIC_URL}`);
  console.log(`✓ WebSocket URL: ${WEBSOCKET_URL}`);
  console.log('');
  console.log('📝 Configure your Twilio phone number:');
  console.log(`   Voice URL: ${PUBLIC_URL}/voice-handler`);
  console.log('');
  console.log('📡 ConversationRelay WebSocket URL:');
  console.log(`   ${WEBSOCKET_URL}`);
  console.log('');
  console.log('🔧 Next steps:');
  console.log('   1. Complete handlers/voice-handler.js');
  console.log('   2. Complete handlers/websocket-handler.js');
  console.log('   3. Add your system prompt in config/system-prompt.js');
  console.log('');

  // In Codespace, print helpful reminder
  if (CODESPACE_NAME) {
    console.log('💡 GitHub Codespace detected!');
    console.log(`   Port 3000 is publicly accessible at:`);
    console.log(`   ${PUBLIC_URL}`);
    console.log('');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
