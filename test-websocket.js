#!/usr/bin/env node

/**
 * WebSocket Media Stream Test Client
 * Simulates Twilio's Media Stream format to test your WebSocket handler
 */

const WebSocket = require('ws');
const fs = require('fs');

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';
const STREAM_SID = 'test-stream-' + Date.now();

console.log('🧪 WebSocket Media Stream Test Client');
console.log('====================================');
console.log(`Connecting to: ${WS_URL}`);
console.log(`Stream SID: ${STREAM_SID}`);
console.log('');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  console.log('');

  // Send Twilio's "connected" event
  console.log('📤 Sending "connected" event...');
  ws.send(JSON.stringify({
    event: 'connected',
    protocol: 'Call',
    version: '1.0.0'
  }));

  // Send Twilio's "start" event
  setTimeout(() => {
    console.log('📤 Sending "start" event...');
    ws.send(JSON.stringify({
      event: 'start',
      sequenceNumber: '1',
      start: {
        streamSid: STREAM_SID,
        accountSid: 'ACtest',
        callSid: 'CAtest',
        tracks: ['inbound'],
        mediaFormat: {
          encoding: 'audio/x-mulaw',
          sampleRate: 8000,
          channels: 1
        }
      },
      streamSid: STREAM_SID
    }));
  }, 100);

  // Send some test audio data (silence)
  setTimeout(() => {
    console.log('📤 Sending test media packets (simulated audio)...');

    // Send 10 packets of silence (mulaw encoded silence = 0xFF)
    for (let i = 0; i < 10; i++) {
      const silencePayload = Buffer.alloc(160, 0xFF).toString('base64');

      ws.send(JSON.stringify({
        event: 'media',
        sequenceNumber: String(i + 2),
        media: {
          track: 'inbound',
          chunk: String(i + 1),
          timestamp: String(Date.now() + (i * 20)),
          payload: silencePayload
        },
        streamSid: STREAM_SID
      }));
    }

    console.log('✅ Sent 10 media packets');
  }, 200);

  // Send a mark event
  setTimeout(() => {
    console.log('📤 Sending "mark" event...');
    ws.send(JSON.stringify({
      event: 'mark',
      sequenceNumber: '12',
      mark: {
        name: 'test-mark'
      },
      streamSid: STREAM_SID
    }));
  }, 500);

  // Keep connection alive for 10 seconds to receive responses
  setTimeout(() => {
    console.log('');
    console.log('⏱️  Test duration complete. Closing connection...');
    ws.close();
  }, 10000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', JSON.stringify(message, null, 2));
  } catch (e) {
    console.log('📥 Received (raw):', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log('');
  console.log('🔌 WebSocket closed');
  console.log(`   Code: ${code}`);
  console.log(`   Reason: ${reason || 'No reason provided'}`);
  console.log('');
  console.log('✅ Test complete!');
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  ws.close();
  process.exit(0);
});
