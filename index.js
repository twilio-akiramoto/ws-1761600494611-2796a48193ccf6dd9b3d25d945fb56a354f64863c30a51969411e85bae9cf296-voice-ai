exports.handler = async function(context, event, callback) {
  const OpenAI = require('openai');
  const twilio = require('twilio');

  const openai = new OpenAI({ apiKey: context.OPENAI_API_KEY });
  const twilioClient = twilio(context.ACCOUNT_SID, context.AUTH_TOKEN);

  const response = new Twilio.Response();
  response.setStatusCode(200);

  // Knowledge Base - Customize for your business
  const knowledgeBase = '\n' +
  '  Company: Acme Healthcare\n' +
  '  Services: Primary care, vaccinations, annual checkups, lab work\n' +
  '  Hours: Mon-Fri 9am-5pm, Sat 10am-2pm, Closed Sunday\n' +
  '  Location: 123 Main St, San Francisco CA 94102\n' +
  '  Phone: ' + (context.DEFAULT_TWILIO_NUMBER || '+1-555-0100') + '\n' +
  '  Insurance: We accept Blue Cross, Aetna, UnitedHealthcare, Medicare\n' +
  '  Parking: Free parking available in rear lot\n';

  // Tool Definitions
  const tools = [
    {
      type: "function",
      name: "check_availability",
      description: "Check available appointment slots for a given date",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date (YYYY-MM-DD)" }
        },
        required: ["date"]
      }
    },
    {
      type: "function",
      name: "book_appointment",
      description: "Book an appointment for a customer",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date (YYYY-MM-DD)" },
          time: { type: "string", description: "Time (HH:MM 24hr)" },
          customerName: { type: "string", description: "Customer name" },
          phone: { type: "string", description: "Phone number" },
          service: { type: "string", description: "Service type" }
        },
        required: ["date", "time", "customerName", "phone"]
      }
    },
    {
      type: "function",
      name: "send_confirmation_sms",
      description: "Send appointment confirmation via SMS",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Customer phone" },
          message: { type: "string", description: "Confirmation message" }
        },
        required: ["phone", "message"]
      }
    }
  ];

  // System Prompt - Critical for AI behavior!
  // Best practices: Be specific, set boundaries, define personality
  const systemPrompt = `You are Sarah, a professional medical receptionist for Acme Healthcare.

ROLE & PERSONALITY:
- Friendly but professional tone
- Speak naturally, use conversational language
- Show empathy and patience
- Keep responses concise (under 3 sentences typically)

COMPANY INFORMATION:
${knowledgeBase}

YOUR CAPABILITIES:
You have access to three tools:
1. check_availability - Check open appointment slots for a date
2. book_appointment - Book confirmed appointments
3. send_confirmation_sms - Send SMS confirmations

WORKFLOW FOR BOOKING:
1. Greet caller warmly and ask how you can help
2. If booking, collect: preferred date, time, name, phone, service type
3. Use check_availability to see open slots (say "Let me check that for you" first)
4. Confirm ALL details before booking
5. Use book_appointment once confirmed (say "I'm booking that for you now" first)
6. Use send_confirmation_sms to send confirmation
7. Provide appointment details verbally AND via SMS

IMPORTANT GUIDELINES:
- ALWAYS confirm date, time, name, and phone before booking
- Use interstitials before tool calls ("Let me check...", "One moment...")
- If caller is vague, ask clarifying questions
- If no slots available, offer alternative dates
- Keep HIPAA in mind - don't ask for sensitive medical info over phone
- If you can't help, offer to transfer or take a message
- End calls gracefully, ask if there's anything else

RESPONSE STYLE:
❌ DON'T: "I have checked the availability for the requested date and determined that..."
✅ DO: "Let me check that for you... Great! We have openings at 9am, 11am, and 2pm. Which works best?"

Remember: You're having a natural conversation, not reading a script!`;

  // Handle WebSocket upgrade
  if (!event.request || event.request.headers['upgrade'] !== 'websocket') {
    response.setBody('WebSocket connection required');
    return callback(null, response);
  }

  const ws = event.request;
  console.log('WebSocket connected');

  // STATE MANAGEMENT - Track where we are in the conversation
  let conversationState = {
    stage: 'greeting',           // greeting, collecting_info, confirming, booking, complete
    appointmentData: {},         // Store collected information
    lastPrompt: null,            // Track what we last asked
    attemptCount: 0              // How many times we've tried to collect info
  };

  // Store conversation history
  const conversationHistory = [{ role: 'system', content: systemPrompt }];

  // STATE-AWARE PROMPT INJECTION
  // This function adds context based on current state
  function getStateContext() {
    const statePrompts = {
      greeting: `
        CURRENT STATE: Greeting/Initial Contact
        - You just answered the call
        - Ask how you can help today
        - Listen for booking requests or questions
      `,
      collecting_info: `
        CURRENT STATE: Collecting Appointment Information
        - You're gathering: date, time, name, phone, service type
        - Current data collected: ${JSON.stringify(conversationState.appointmentData)}
        - Still need: ${getMissingFields().join(', ') || 'nothing - ready to confirm!'}
        - Ask for ONE missing field at a time (don't overwhelm caller)
        - Attempt #${conversationState.attemptCount} - if > 2, offer to have someone call them back
      `,
      confirming: `
        CURRENT STATE: Confirming Details
        - You have all information needed
        - Data to confirm: ${JSON.stringify(conversationState.appointmentData)}
        - Read back ALL details clearly
        - Ask "Does that sound correct?" or "Should I book this for you?"
        - If confirmed, proceed to booking
        - If changes needed, go back to collecting_info
      `,
      booking: `
        CURRENT STATE: Booking in Progress
        - You're actively booking the appointment
        - Use the book_appointment tool
        - Don't ask more questions, just confirm booking
      `,
      complete: `
        CURRENT STATE: Booking Complete
        - Appointment is booked
        - Confirm appointment details one final time
        - Ask if there's anything else you can help with
        - If no, end gracefully
      `
    };

    return statePrompts[conversationState.stage] || '';
  }

  function getMissingFields() {
    const required = ['date', 'time', 'customerName', 'phone'];
    return required.filter(field => !conversationState.appointmentData[field]);
  }

  function updateState(userMessage) {
    // Extract info from user message (simple pattern matching)
    // In production, you'd use more sophisticated NER/entity extraction

    // Check for date
    const dateMatch = userMessage.match(/(d{4}-d{2}-d{2}|tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday)/i);
    if (dateMatch) conversationState.appointmentData.date = dateMatch[0];

    // Check for time
    const timeMatch = userMessage.match(/(d{1,2}:d{2}|d{1,2}s*(am|pm))/i);
    if (timeMatch) conversationState.appointmentData.time = timeMatch[0];

    // Check for phone
    const phoneMatch = userMessage.match(/(d{3}[-.]?d{3}[-.]?d{4})/);
    if (phoneMatch) conversationState.appointmentData.phone = phoneMatch[0];

    // Update stage based on collected data
    const missing = getMissingFields();
    if (conversationState.stage === 'greeting' && userMessage.match(/book|appointment|schedule/i)) {
      conversationState.stage = 'collecting_info';
    } else if (conversationState.stage === 'collecting_info' && missing.length === 0) {
      conversationState.stage = 'confirming';
    }

    console.log('State updated:', conversationState);
  }

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.event) {
        case 'start':
          console.log('Call started:', message.streamSid);
          break;

        case 'transcript':
          console.log('User said:', message.transcript);

          // Update conversation state based on user input
          updateState(message.transcript);

          // Add user message to history
          conversationHistory.push({
            role: 'user',
            content: message.transcript
          });

          // Inject state-aware context
          const stateContext = getStateContext();
          conversationHistory.push({
            role: 'system',
            content: stateContext
          });

          // Call OpenAI with tools
          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: conversationHistory,
            tools: tools,
            tool_choice: 'auto'
          });

          const assistantMessage = completion.choices[0].message;
          conversationHistory.push(assistantMessage);

          // Check if AI wants to call a tool
          if (assistantMessage.tool_calls) {
            for (const toolCall of assistantMessage.tool_calls) {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);

              console.log(`Calling tool: ${functionName}`, functionArgs);

              // Execute the tool
              let toolResult;
              switch (functionName) {
                case 'check_availability':
                  toolResult = await checkAvailability(functionArgs);
                  break;
                case 'book_appointment':
                  // Update state - we're now booking
                  conversationState.stage = 'booking';
                  toolResult = await bookAppointment(functionArgs);
                  // Move to complete state after booking
                  conversationState.stage = 'complete';
                  break;
                case 'send_confirmation_sms':
                  toolResult = await sendConfirmationSMS(functionArgs, twilioClient, context);
                  break;
                default:
                  toolResult = { error: 'Unknown tool' };
              }

              // Add tool result to conversation
              conversationHistory.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
              });
            }

            // Get AI's final response after tool execution
            const finalCompletion = await openai.chat.completions.create({
              model: 'gpt-4',
              messages: conversationHistory
            });

            const finalMessage = finalCompletion.choices[0].message.content;
            conversationHistory.push({ role: 'assistant', content: finalMessage });

            // Send to caller
            ws.send(JSON.stringify({
              event: 'text',
              text: finalMessage
            }));
          } else {
            // No tool call, just send AI response
            ws.send(JSON.stringify({
              event: 'text',
              text: assistantMessage.content
            }));
          }
          break;

        case 'stop':
          console.log('Call ended');
          ws.close();
          break;
      }
    } catch (error) {
      console.error('Error:', error);
      ws.send(JSON.stringify({
        event: 'text',
        text: 'I apologize, but I encountered an error. Could you please repeat that?'
      }));
    }
  });

  ws.on('error', (error) => console.error('WebSocket error:', error));
  ws.on('close', () => console.log('WebSocket closed'));

  callback(null, response);

  // Tool Implementation Functions
  async function checkAvailability(args) {
    // TODO: Connect to your scheduling system
    // This is a mock implementation
    const { date } = args;
    const availableSlots = ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'];
    return {
      date,
      available: true,
      slots: availableSlots,
      message: `Available slots for ${date}: ${availableSlots.join(', ')}`
    };
  }

  async function bookAppointment(args) {
    // TODO: Connect to your scheduling system
    // This is a mock implementation
    const { date, time, customerName, phone, service } = args;
    const appointmentId = 'APT-' + Date.now();

    console.log('Booking appointment:', { date, time, customerName, phone, service });

    return {
      success: true,
      appointmentId,
      date,
      time,
      message: `Appointment booked! ID: ${appointmentId} for ${customerName} on ${date} at ${time}`
    };
  }

  async function sendConfirmationSMS(args, twilioClient, context) {
    try {
      const { phone, message } = args;

      const sms = await twilioClient.messages.create({
        body: message,
        from: context.DEFAULT_TWILIO_NUMBER,
        to: phone
      });

      return {
        success: true,
        messageSid: sms.sid,
        message: 'Confirmation SMS sent successfully'
      };
    } catch (error) {
      console.error('SMS error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};