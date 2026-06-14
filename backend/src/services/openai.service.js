const { OpenAI } = require('openai');
const ChatSession = require('../models/ChatSession');
const lawService = require('./law.service');
const incidentService = require('./incident.service');

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
let openaiClient = null;

if (apiKey && apiKey !== 'mock_key') {
  openaiClient = new OpenAI({ apiKey });
  console.log('OpenAI Agentic AI Assistant Client initialized.');
} else {
  console.log('OpenAI API key not configured. Running AI assistant in MOCK mode.');
}

// System instructions for the Safety Assistant
const SYSTEM_PROMPT = `You are Nigehbaan AI, a compassionate and expert emergency safety assistant for women.
Your goals are:
1. Help users log/register safety complaints if they are victims or witnesses. You MUST ask for details like the category, description, and location (latitude/longitude coordinates) if they want to register a complaint.
2. Provide details about legal rules and safety laws for women.
3. Provide survival instructions and safety precautions for specific categories.
4. Answer questions about existing complaint status.
5. If the user wants to talk to a human operator, feels extremely unsafe, or explicitly asks to connect to an agent, invoke the handoff tool.

You have access to tools to perform all of these actions. ALWAYS invoke the appropriate tool rather than guessing.
Be concise, calm, and reassuring in your responses.`;

// Tool declarations for OpenAI
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_safety_laws',
      description: 'Get legal rules and safety laws for a specific category (e.g. harassment, domestic violence, stalking).',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Safety category name' }
        },
        required: ['category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_survival_instructions',
      description: 'Get survival instructions for a specific danger category.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Safety category name' }
        },
        required: ['category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_precautions',
      description: 'Get safety precautions for a specific safety category.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Safety category name' }
        },
        required: ['category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'register_complaint',
      description: 'Register a safety complaint/incident on behalf of the victim.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['harassment', 'stalking', 'domestic_violence', 'physical_assault', 'kidnapping', 'other'],
            description: 'Incident category'
          },
          description: { type: 'string', description: 'Details of the incident' },
          longitude: { type: 'number', description: 'Current longitude coordinates of the incident' },
          latitude: { type: 'number', description: 'Current latitude coordinates of the incident' }
        },
        required: ['category', 'description', 'longitude', 'latitude']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_complaint_status',
      description: 'Get the status, team reply, and actions taken for a reported complaint.',
      parameters: {
        type: 'object',
        properties: {
          complaintId: { type: 'string', description: 'The 24-character hexadecimal MongoDB ID of the complaint' }
        },
        required: ['complaintId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'trigger_human_handoff',
      description: 'Trigger a handoff to connect the user with a live human emergency operator.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Brief description of why handoff is triggered' }
        },
        required: ['reason']
      }
    }
  }
];

/**
 * Executes a tool function locally
 */
const executeTool = async (userId, name, args) => {
  try {
    switch (name) {
      case 'get_safety_laws': {
        const law = await lawService.getLawByCategory(args.category);
        return JSON.stringify({
          category: law.category,
          title: law.title,
          legalDescription: law.legalDescription
        });
      }
      case 'get_survival_instructions': {
        const instructions = await lawService.getSurvivalInstructions(args.category);
        return JSON.stringify(instructions);
      }
      case 'get_precautions': {
        const precautions = await lawService.getPrecautions(args.category);
        return JSON.stringify(precautions);
      }
      case 'register_complaint': {
        const incident = await incidentService.createIncident(
          userId,
          args.category,
          [args.longitude, args.latitude],
          `[Reported via AI Assistant] ${args.description}`
        );
        return JSON.stringify({
          success: true,
          complaintId: incident._id,
          status: incident.status,
          message: 'Complaint successfully filed in the Incident Hub.'
        });
      }
      case 'check_complaint_status': {
        const incident = await incidentService.getIncidentById(args.complaintId);
        if (!incident) return JSON.stringify({ error: 'Complaint not found.' });
        return JSON.stringify({
          id: incident._id,
          category: incident.category,
          status: incident.status,
          teamReply: incident.teamReply || 'No reply yet from the response team.',
          action: incident.action || 'Investigation pending.'
        });
      }
      case 'trigger_human_handoff': {
        await ChatSession.findOneAndUpdate(
          { user: userId },
          { status: 'human' }
        );
        return JSON.stringify({
          success: true,
          message: 'Human operator handoff initiated. Relaying connection to B2G dispatch room.'
        });
      }
      default:
        return JSON.stringify({ error: `Tool ${name} not found.` });
    }
  } catch (err) {
    console.error(`Error running tool ${name}:`, err.message);
    return JSON.stringify({ error: err.message });
  }
};

/**
 * Fallback local mockup for AI replies when OpenAI API key is missing
 */
const processMockResponse = async (userId, messageText) => {
  const normalizedMsg = messageText.toLowerCase();
  let reply = "I'm here to help. You can ask me about safety laws, precautions, file a complaint, or say 'human' to connect with a live emergency agent.";
  let handoffTriggered = false;

  if (normalizedMsg.includes('human') || normalizedMsg.includes('agent') || normalizedMsg.includes('operator') || normalizedMsg.includes('help me') || normalizedMsg.includes('emergency')) {
    await ChatSession.findOneAndUpdate({ user: userId }, { status: 'human' });
    reply = "I am connecting you with a live emergency operator immediately. Please stay calm.";
    handoffTriggered = true;
  } else if (normalizedMsg.includes('law') || normalizedMsg.includes('rule')) {
    reply = "Women's safety laws protect you from harassment (Criminal Law Act Amendment), stalking, and domestic abuse. To fetch laws, search under categories like 'harassment' or 'domestic_violence'.";
  } else if (normalizedMsg.includes('precaution') || normalizedMsg.includes('safe')) {
    reply = "Precautionary steps: Keep trusted contacts updated, share your live SOS track, and avoid isolated pathways.";
  } else if (normalizedMsg.includes('instruction') || normalizedMsg.includes('survive')) {
    reply = "Survival Instructions: Shout to attract attention, use pepper spray if available, trigger Nigehbaan SOS immediately, and move to well-lit public areas.";
  } else if (normalizedMsg.includes('complaint') || normalizedMsg.includes('register') || normalizedMsg.includes('file')) {
    reply = "I can register a complaint for you. Please say: 'Register complaint category: harassment, details: [description], location: [lng, lat]'.";
  } else if (normalizedMsg.includes('status') || normalizedMsg.includes('check')) {
    reply = "To check complaint status, please provide the 24-character complaint ID.";
  }

  // Save messages to history
  await ChatSession.findOneAndUpdate(
    { user: userId },
    {
      $push: {
        messages: [
          { sender: 'user', content: messageText },
          { sender: 'ai', content: reply }
        ]
      }
    },
    { upsert: true, new: true }
  );

  return { reply, handoffTriggered };
};

/**
 * Main process loop for User agent chat interactions
 */
const processUserMessage = async (userId, messageText) => {
  if (!openaiClient) {
    return processMockResponse(userId, messageText);
  }

  try {
    // 1. Retrieve or create session
    let session = await ChatSession.findOne({ user: userId });
    if (!session) {
      session = await ChatSession.create({ user: userId, messages: [] });
    }

    // Append the new user message
    session.messages.push({ sender: 'user', content: messageText });
    await session.save();

    // 2. Format history for OpenAI
    // Map past messages (up to 15) to ChatGPT format
    const historyLimit = 15;
    const historySlice = session.messages.slice(-historyLimit);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historySlice.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    let runLoop = true;
    let iterations = 0;
    let handoffTriggered = false;
    let assistantReply = '';

    while (runLoop && iterations < 5) {
      iterations++;
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto'
      });

      const choice = response.choices[0];
      const message = choice.message;

      if (message.content) {
        assistantReply = message.content;
      }

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message); // append assistant msg with tool calls to dialog

        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`[AI Agent Tool Call] Running tool: ${name} with args:`, args);
          const toolResult = await executeTool(userId, name, args);

          // Append tool response
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name,
            content: toolResult
          });

          if (name === 'trigger_human_handoff') {
            handoffTriggered = true;
            runLoop = false;
          }
        }
      } else {
        // No more tool calls, exit loop
        runLoop = false;
      }
    }

    // Save final AI reply to MongoDB
    if (assistantReply) {
      session.messages.push({ sender: 'ai', content: assistantReply });
      await session.save();
    }

    return {
      reply: assistantReply || 'Relaying details to operators. Please standby.',
      handoffTriggered
    };
  } catch (error) {
    console.error('OpenAI Agent processing failed, falling back to mock responses:', error.message);
    return processMockResponse(userId, messageText);
  }
};

module.exports = {
  processUserMessage
};
