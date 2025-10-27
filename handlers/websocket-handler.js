import OpenAI from 'openai';
import systemPrompt from '../config/system-prompt.js';
import tools from './tools.js';

/**
 * WebSocket Handler - Manages ConversationRelay WebSocket connection
 *
 * ConversationRelay Architecture:
 * - Twilio handles: Speech-to-Text (Deepgram), Text-to-Speech (ElevenLabs), audio streaming
 * - Your server handles: LLM processing (text-based), prompting, tools/functions
 *
 * You receive TEXT from Twilio (from Deepgram STT)
 * You send back TEXT to Twilio (Twilio uses ElevenLabs TTS to speak it)
 *
 * @param {WebSocket} ws - WebSocket connection from Twilio
 * @param {Object} config - Configuration object
 */
export default function websocketHandler(ws, config) {
  const { streamSid, openaiApiKey, twilioClient } = config;

  console.log(`📞 ConversationRelay connected: ${streamSid}`);

  // Initialize OpenAI (or any other LLM)
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Store conversation history for context
  const conversationHistory = [];

  // Store call metadata for Conversational Intelligence
  let callSid = null;
  let callMetadata = {
    from: null,
    to: null,
    direction: null,
    startTime: new Date().toISOString()
  };

  // Handle incoming messages from Twilio ConversationRelay
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        // ----------------------------------------------------------------------
        // Event: SETUP - Initial connection with call metadata
        // ----------------------------------------------------------------------
        case 'setup':
          console.log('📞 Call Setup:');
          console.log('  Session ID:', data.sessionId);
          console.log('  Call SID:', data.callSid);
          console.log('  From:', data.from);
          console.log('  To:', data.to);
          console.log('  Direction:', data.direction);

          // Store call metadata for Conversational Intelligence
          callSid = data.callSid;
          callMetadata.from = data.from;
          callMetadata.to = data.to;
          callMetadata.direction = data.direction;
          callMetadata.sessionId = data.sessionId;
          break;

        // ----------------------------------------------------------------------
        // Event: PROMPT - Caller spoke, we got their words as TEXT
        // ----------------------------------------------------------------------
        case 'prompt':
          console.log('🗣️ Caller said:', data.voicePrompt);
          console.log('  Language:', data.lang);
          console.log('  Is final:', data.last);

          // Add to conversation history
          conversationHistory.push({
            role: 'user',
            content: data.voicePrompt
          });

          // ====================================================================
          // AI PROCESSING: Send to your LLM (text-based)
          // ====================================================================
          // You can use ANY LLM here: OpenAI, Claude, Gemini, local models, etc.
          // Twilio handles all the audio - you just process text!
          try {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',  // Fast, affordable model
              messages: [
                {
                  role: 'system',
                  content: systemPrompt  // Your custom AI personality
                },
                ...conversationHistory
              ],
              max_tokens: 150,  // Keep responses concise for voice
              temperature: 0.7
            });

            const aiResponse = completion.choices[0].message.content;
            console.log('🤖 AI response:', aiResponse);

            // Add to conversation history
            conversationHistory.push({
              role: 'assistant',
              content: aiResponse
            });

            // ==================================================================
            // Send TEXT response back to Twilio
            // Twilio will convert it to speech using ElevenLabs TTS
            // ==================================================================
            ws.send(JSON.stringify({
              type: 'text',
              token: aiResponse,
              last: true  // Indicates this is the complete response
            }));

          } catch (aiError) {
            console.error('❌ LLM API error:', aiError);

            // Send error response to caller
            ws.send(JSON.stringify({
              type: 'text',
              token: 'I apologize, I encountered an error processing your request.',
              last: true
            }));
          }
          break;

        // ----------------------------------------------------------------------
        // Event: DTMF - Caller pressed a keypad button
        // ----------------------------------------------------------------------
        case 'dtmf':
          console.log('🔢 DTMF digit pressed:', data.digit);

          // Handle keypad input (useful for IVR-style menus)
          // Example: "Press 1 for sales, 2 for support"
          if (data.digit === '1') {
            ws.send(JSON.stringify({
              type: 'text',
              token: 'You pressed 1. Transferring to sales.',
              last: true
            }));
          } else if (data.digit === '2') {
            ws.send(JSON.stringify({
              type: 'text',
              token: 'You pressed 2. Transferring to support.',
              last: true
            }));
          }
          break;

        // ----------------------------------------------------------------------
        // Event: INTERRUPT - Caller interrupted the AI mid-sentence
        // ----------------------------------------------------------------------
        case 'interrupt':
          console.log('⚠️ Caller interrupted at:', data.utteranceUntilInterrupt);
          console.log('  Duration:', data.durationUntilInterruptMs, 'ms');

          // Handle interruption
          // You may want to cancel any pending LLM requests here
          break;

        // ----------------------------------------------------------------------
        // Unknown events (log for debugging)
        // ----------------------------------------------------------------------
        default:
          console.log('❓ Unknown event type:', data.type);
      }

    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  // Handle connection close
  ws.on('close', async () => {
    console.log(`📞 ConversationRelay disconnected: ${streamSid}`);

    // =========================================================================
    // CREATE CONVERSATIONAL INTELLIGENCE TRANSCRIPT
    // =========================================================================
    // This automatically creates a transcript for post-call analytics
    if (callSid && process.env.CI_SERVICE_SID) {
      try {
        console.log('📊 Creating Conversational Intelligence transcript...');

        // Get the recording SID from the call
        const call = await twilioClient.calls(callSid).fetch();

        // Get the most recent recording for this call
        const recordings = await twilioClient.recordings.list({
          callSid: callSid,
          limit: 1
        });

        if (recordings.length > 0) {
          const recordingSid = recordings[0].sid;
          const mediaUrl = recordings[0].mediaUrl;

          // Create transcript in Conversational Intelligence
          const transcriptResponse = await fetch(
            `https://intelligence.twilio.com/v2/Transcripts`,
            {
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
                    media_url: `https://api.twilio.com${mediaUrl}`
                  }
                }),
                CustomerKey: callMetadata.from,
                MediaStartTime: callMetadata.startTime
              })
            }
          );

          if (transcriptResponse.ok) {
            const transcriptData = await transcriptResponse.json();
            console.log('✅ CI Transcript created:', transcriptData.sid);
            console.log('   View analytics at: https://console.twilio.com/us1/develop/intelligence');
          } else {
            const errorText = await transcriptResponse.text();
            console.warn('⚠️ Failed to create CI transcript:', errorText);
          }
        } else {
          console.warn('⚠️ No recording found for call:', callSid);
        }

      } catch (ciError) {
        console.error('❌ CI transcript creation error:', ciError);
        // Don't fail the call disconnect if CI fails
      }
    }

    // Optional: Save conversation history to database
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
}
