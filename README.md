# 🎙️ ConversationRelay Starter Pack

Your AI-powered voice assistant built with [Twilio ConversationRelay](https://www.twilio.com/docs/voice/conversationrelay).

This starter pack provides a complete foundation for building sophisticated voice AI applications. **ConversationRelay handles all the audio processing** (speech-to-text, text-to-speech) - you just focus on the AI logic, prompting, and tools.

**Use ANY LLM**: OpenAI, Anthropic Claude, Google Gemini, local models, or any text-based AI.

## 🚀 Quick Start (GitHub Codespaces)

The server should start automatically when you open this Codespace. If it doesn't:

```bash
bash start-server.sh
```

That's it! The server will run in the background on port 3000.

**View logs:** `tail -f server.log`
**Restart server:** `pkill -f 'node.*server.js' && bash start-server.sh`

Return to the workshop UI to continue!

---

## 🚀 Quick Deploy

### Deploy to Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)

### Deploy to Render
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Deploy to Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## 📋 Prerequisites

- **Twilio Account** - [Sign up for free](https://www.twilio.com/try-twilio)
- **Twilio Phone Number** - With Voice capabilities
- **OpenAI API Key** - [Get your API key](https://platform.openai.com/api-keys)
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)

## 🏗️ Architecture

```
┌─────────────┐                                    ┌──────────────┐
│   Caller    │ ◄──── Voice Audio ────────────────►│   Twilio     │
│   (Phone)   │                                    │ ConversationRelay│
└─────────────┘                                    └──────┬───────┘
                                                          │
                        ┌─────────────────────────────────┤
                        │                                 │
                   Text Transcripts              Voice Synthesis
                   (Deepgram STT)               (ElevenLabs TTS)
                        │                                 │
                        ▼                                 ▲
                ┌──────────────────┐                     │
                │  Your Server     │──── Text Response ──┘
                │  (WebSocket)     │
                └────────┬─────────┘
                         │
                    Text to LLM
                         │
                         ▼
                ┌──────────────────┐
                │   Your LLM       │
                │ (OpenAI, Claude, │
                │  Gemini, etc.)   │
                └──────────────────┘
```

### How It Works

1. **Incoming Call** → Twilio calls your `/voice-handler` endpoint
2. **TwiML Response** → Your server returns ConversationRelay TwiML
3. **WebSocket Connection** → Twilio connects to your WebSocket server
4. **Speech-to-Text** → Twilio (Deepgram) converts caller speech to text → sends `prompt` event
5. **AI Processing** → Your server sends text to ANY LLM (OpenAI, Claude, etc.)
6. **Text Response** → Your server sends back text → Twilio speaks it (ElevenLabs TTS)

## 🛠️ Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/conversationrelay-starter-pack.git
cd conversationrelay-starter-pack
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server Configuration
PORT=3000
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### 5. Expose Local Server with ngrok

Your server needs to be publicly accessible for Twilio webhooks.

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and add to `.env`:

```bash
PUBLIC_URL=https://abc123.ngrok.io
```

Restart your server after adding `PUBLIC_URL`.

### 6. Configure Twilio Phone Number

1. Go to [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on your phone number
3. Under **Voice & Fax**, set:
   - **A Call Comes In**: Webhook, `https://your-ngrok-url.ngrok.io/voice-handler`, HTTP POST
4. Click **Save**

### 7. Test Your Voice AI

Call your Twilio phone number and start talking to your AI!

## 📝 Development Workflow

### Project Structure

```
conversationrelay-starter-pack/
├── server.js                   # Express server + WebSocket setup
├── handlers/
│   ├── voice-handler.js        # TwiML generation (Step 4)
│   ├── websocket-handler.js    # ConversationRelay logic (Steps 5-6)
│   └── tools.js                # Function calling (Step 8)
├── config/
│   └── system-prompt.js        # AI personality (Step 7)
├── public/
│   └── index.html              # Status dashboard
├── .env                        # Environment variables (DO NOT COMMIT)
├── .env.example                # Example configuration
└── package.json                # Dependencies
```

### Step-by-Step Implementation

#### Step 4: Voice Handler (Basic Call Handling)

Edit `handlers/voice-handler.js`:

```javascript
function voiceHandler(callData, publicUrl) {
  const twiml = new VoiceResponse();
  twiml.say('Hello! Welcome to my voice AI.');
  return twiml;
}
```

#### Step 5-6: WebSocket Handler (ConversationRelay)

Edit `handlers/voice-handler.js` to use ConversationRelay:

```javascript
function voiceHandler(callData, publicUrl) {
  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  connect.conversationRelay({
    url: `wss://${publicUrl.replace('https://', '').replace('http://', '')}`,
    voice: 'Polly.Joanna-Neural',
    ttsProvider: 'amazon-polly',  // or 'elevenlabs' for premium voices
    transcriptionProvider: 'deepgram',  // Deepgram for STT
    dtmfDetection: true
  });
  return twiml;
}
```

Edit `handlers/websocket-handler.js` to add LLM integration:

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: openaiApiKey });

ws.on('message', async (message) => {
  const data = JSON.parse(message);

  switch (data.type) {
    case 'setup':
      // Call started - store session info
      console.log('Call from:', data.from, 'to:', data.to);
      break;

    case 'prompt':
      // Caller spoke - we got text from Deepgram
      console.log('Caller said:', data.voicePrompt);

      // Send to your LLM (OpenAI Chat API - text-based, NOT Realtime)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: data.voicePrompt }
        ]
      });

      // Send text response back - Twilio will speak it via ElevenLabs
      ws.send(JSON.stringify({
        type: 'text',
        token: completion.choices[0].message.content,
        last: true
      }));
      break;

    case 'dtmf':
      // Caller pressed keypad button
      console.log('DTMF digit:', data.digit);
      break;
  }
});
```

#### Step 7: System Prompt

Edit `config/system-prompt.js`:

```javascript
const systemPrompt = `You are a helpful customer service representative.

Your role is to assist customers with their questions in a friendly, professional manner.

Keep responses concise (1-2 sentences) and always confirm understanding before proceeding.`;

module.exports = systemPrompt;
```

#### Step 8: Function Calling (Tools)

Edit `handlers/tools.js`:

```javascript
const tools = [
  {
    type: 'function',
    name: 'check_order_status',
    description: 'Check the status of a customer order',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The order ID to look up'
        }
      },
      required: ['orderId']
    }
  }
];

async function executeToolCall(toolName, args) {
  switch (toolName) {
    case 'check_order_status':
      // Call your database/API
      return { status: 'shipped', trackingNumber: '1Z999AA1234567890' };
    default:
      return { error: 'Unknown tool' };
  }
}
```

## 🌐 Production Deployment

### Railway Deployment

1. Click "Deploy on Railway" button above
2. Add environment variables in Railway dashboard
3. Railway will provide a public URL automatically
4. Update Twilio phone number webhook to Railway URL

### Render Deployment

1. Click "Deploy to Render" button above
2. Add environment variables in Render dashboard
3. Render will provide a public URL automatically
4. Update Twilio phone number webhook to Render URL

### Heroku Deployment

1. Click "Deploy to Heroku" button above
2. Add environment variables (Config Vars) in Heroku dashboard
3. Heroku will provide a public URL automatically
4. Update Twilio phone number webhook to Heroku URL

### Custom Server Deployment

Deploy to any Node.js hosting platform:

```bash
# Build/prepare (if needed)
npm install --production

# Start production server
npm start
```

**Required Environment Variables:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
- `PUBLIC_URL` (your server's public URL)
- `PORT` (defaults to 3000)

## 📊 Conversational Intelligence (Optional)

Add AI-powered call analytics to your application with Twilio Conversational Intelligence.

### What is Conversational Intelligence?

Conversational Intelligence automatically:
- **Transcribes calls** with Deepgram speech-to-text
- **Analyzes sentiment** to understand caller emotions
- **Detects topics** to categorize conversations
- **Identifies PII** for compliance and privacy
- **Extracts keywords** for searchability

### Setup Steps

#### 1. Create Intelligence Service

Create a Conversational Intelligence service in your Twilio Console or via API:

```javascript
// Create CI service (one-time setup)
const response = await fetch('https://intelligence.twilio.com/v2/Services', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    UniqueName: 'my-voice-ai-analytics',
    FriendlyName: 'Voice AI Analytics',
    AutoTranscribe: 'true',
    LanguageCode: 'en-US'
  })
});

const service = await response.json();
console.log('CI Service SID:', service.sid);
```

Add the service SID to your `.env`:

```bash
CI_SERVICE_SID=ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 2. Attach Language Operators

Attach pre-built Language Operators for sentiment analysis, PII redaction, etc.:

```javascript
// Sentiment Analysis Operator
await fetch(
  `https://intelligence.twilio.com/v2/Services/${serviceSid}/Operators/LY4ce7be83d88649e3a24b23571077c122`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`
    }
  }
);

// PII Redaction Operator
await fetch(
  `https://intelligence.twilio.com/v2/Services/${serviceSid}/Operators/LYbcd7006fc1f69d0c522e6fde532856eb`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`
    }
  }
);
```

#### 3. Create Transcripts After Each Call

In your `websocket-handler.js`, create a transcript when the call ends:

```javascript
ws.on('close', async () => {
  console.log('Call ended, creating CI transcript...');

  if (callSid && process.env.CI_SERVICE_SID) {
    // Get recording from the call
    const recordings = await twilioClient.recordings.list({
      callSid: callSid,
      limit: 1
    });

    if (recordings.length > 0) {
      const recording = recordings[0];

      // Create transcript
      await fetch('https://intelligence.twilio.com/v2/Transcripts', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          ServiceSid: process.env.CI_SERVICE_SID,
          Channel: JSON.stringify({
            media_properties: {
              media_url: `https://api.twilio.com${recording.mediaUrl}`
            }
          }),
          CustomerKey: callMetadata.from,
          MediaStartTime: callMetadata.startTime
        })
      });

      console.log('✅ CI Transcript created');
    }
  }
});
```

#### 4. View Analytics

Retrieve transcripts and analytics via the Intelligence API:

```javascript
// Fetch all transcripts
const transcripts = await fetch(
  `https://intelligence.twilio.com/v2/Transcripts?ServiceSid=${serviceSid}`,
  {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  }
);

// Get sentences (conversation text)
const sentences = await fetch(
  `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/Sentences`,
  {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  }
);

// Get operator results (sentiment, PII, etc.)
const operators = await fetch(
  `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/OperatorResults`,
  {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  }
);
```

### Resources

- [Conversational Intelligence Docs](https://www.twilio.com/docs/voice/intelligence)
- [Intelligence API Reference](https://www.twilio.com/docs/voice/intelligence/api)
- [Language Operators Catalog](https://www.twilio.com/docs/voice/intelligence/operators)

## 🔒 Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Use environment variables** - For all sensitive credentials
3. **Validate webhook signatures** - Add Twilio signature validation in production
4. **Rate limiting** - Implement rate limiting for public endpoints
5. **HTTPS only** - Always use HTTPS in production (HTTP not allowed for webhooks)
6. **Rotate credentials** - Regularly rotate API keys and auth tokens

## 🧪 Testing

### Test Server Status

```bash
curl http://localhost:3000/health
```

### Test Voice Handler

```bash
curl -X POST http://localhost:3000/voice-handler \
  -d "From=+15551234567" \
  -d "To=+15559876543"
```

### Test WebSocket with Simulated Media Stream

The `test-websocket.js` script simulates Twilio's media stream format to test your WebSocket handler locally:

```bash
# From within your Codespace or local environment
node test-websocket.js
```

This will:
- Connect to your WebSocket server
- Send Twilio-formatted events (`connected`, `start`, `media`, `mark`)
- Simulate 10 audio packets (mulaw silence)
- Display all responses from your server
- Run for 10 seconds then close

**For external URLs (like Codespaces):**
```bash
WS_URL=wss://your-codespace-url-3000.app.github.dev node test-websocket.js
```

### Test with Real Call

1. Call your Twilio phone number
2. Watch server logs: `npm run dev`
3. Check WebSocket connections in status dashboard: `http://localhost:3000`

## 📚 Resources

- [Twilio ConversationRelay Docs](https://www.twilio.com/docs/voice/conversationrelay)
- [ConversationRelay WebSocket Messages](https://www.twilio.com/docs/voice/conversationrelay/websocket-messages)
- [OpenAI Chat API Docs](https://platform.openai.com/docs/api-reference/chat)
- [Deepgram Speech-to-Text](https://www.twilio.com/docs/voice/conversationrelay#transcription-providers)
- [ElevenLabs Text-to-Speech](https://www.twilio.com/docs/voice/conversationrelay#voice-synthesis-providers)
- [Twilio Voice Webhooks](https://www.twilio.com/docs/voice/twiml)
- [Node.js WebSocket (ws) Library](https://github.com/websockets/ws)

## 🐛 Troubleshooting

### WebSocket Connection Fails

- Ensure `PUBLIC_URL` is set correctly (must be `wss://` for ConversationRelay)
- Check that your server is publicly accessible
- Verify ngrok is running (for local dev)

### LLM API Error

- Verify your API key is set correctly in environment variables
- Check you have credits in your account
- Ensure your API key has access to the Chat/Completions API (not Realtime)

### Twilio Webhook Errors

- Verify webhook URL is publicly accessible (test with curl)
- Check webhook URL format: `https://your-domain.com/voice-handler`
- View webhook logs in Twilio Console → Monitor → Logs → Errors

### Call Connects but No Audio

- Check WebSocket connection is established (see server logs)
- Verify your LLM API key is working (test with curl)
- Check server logs for errors in the `prompt` event handler
- Ensure system prompt is configured in `config/system-prompt.js`

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

## 📄 License

MIT License - feel free to use this starter pack for any project!

## 💬 Support

- [Twilio Support](https://support.twilio.com/)
- [OpenAI Help Center](https://help.openai.com/)
- [GitHub Issues](https://github.com/YOUR_USERNAME/conversationrelay-starter-pack/issues)

---

Built with ❤️ using [Twilio ConversationRelay](https://www.twilio.com/docs/voice/conversationrelay), [Deepgram STT](https://deepgram.com/), and [ElevenLabs TTS](https://elevenlabs.io/)
