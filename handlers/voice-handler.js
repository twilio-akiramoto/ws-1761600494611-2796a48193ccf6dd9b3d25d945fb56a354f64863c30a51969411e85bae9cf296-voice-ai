import twilio from 'twilio';
const { twiml: { VoiceResponse } } = twilio;

/**
 * Voice Handler - Generates TwiML for incoming/outgoing calls
 *
 * This function is called when someone calls your Twilio number
 * or when you initiate an outbound call.
 *
 * @param {Object} callData - Incoming webhook data from Twilio
 * @param {string} publicUrl - Your server's public URL
 * @returns {VoiceResponse} TwiML response
 */
export default function voiceHandler(callData, publicUrl) {
  const twiml = new VoiceResponse();

  // TODO: Step 4 - Basic Call Handling
  // Add your TwiML instructions here
  // Examples:
  // - twiml.say('Hello! Welcome to my voice AI.');
  // - twiml.play('https://example.com/audio.mp3');
  // - twiml.dial('+15551234567');

  // TODO: Step 5-6 - ConversationRelay Integration
  // Replace basic TwiML with ConversationRelay for AI-powered conversations
  // Example:
  // const connect = twiml.connect();
  // connect.conversationRelay({
  //   url: `wss://${publicUrl.replace('https://', '').replace('http://', '')}`,
  //   voice: 'Polly.Joanna-Neural',
  //   dtmfDetection: true
  // });

  return twiml;
}
