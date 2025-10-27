/**
 * Tools Configuration - Define functions the AI can call
 *
 * This file defines the tools/functions that your AI can invoke during conversations.
 * Examples: Database lookups, API calls, scheduling, calculations, etc.
 */

// TODO: Step 8 - Define your tool schemas
// Follow OpenAI function calling format:
// https://platform.openai.com/docs/guides/function-calling

const tools = [
  // Example tool schema:
  // {
  //   type: 'function',
  //   name: 'get_weather',
  //   description: 'Get the current weather for a location',
  //   parameters: {
  //     type: 'object',
  //     properties: {
  //       location: {
  //         type: 'string',
  //         description: 'The city and state, e.g. San Francisco, CA'
  //       },
  //       unit: {
  //         type: 'string',
  //         enum: ['celsius', 'fahrenheit'],
  //         description: 'The temperature unit to use'
  //       }
  //     },
  //     required: ['location']
  //   }
  // }
];

/**
 * Execute a tool function
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Arguments passed by the AI
 * @returns {Promise<Object>} Tool execution result
 */
async function executeToolCall(toolName, args) {
  console.log(`🔧 Executing tool: ${toolName}`, args);

  // TODO: Step 8 - Implement your tool handlers
  switch (toolName) {
    // Example:
    // case 'get_weather':
    //   return await getWeather(args.location, args.unit);

    default:
      return {
        error: `Unknown tool: ${toolName}`
      };
  }
}

// TODO: Step 8 - Implement individual tool functions
// async function getWeather(location, unit = 'fahrenheit') {
//   // Call weather API
//   return { temperature: 72, condition: 'sunny' };
// }

export default {
  tools,
  executeToolCall
};
