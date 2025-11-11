const OpenAI = require('openai');

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

class ChatbotService {
  constructor() {
    this.model = "gpt-5"; // Latest OpenAI model
    this.maxTokens = 500;
    this.temperature = 0.7;
  }

  // Generate context-aware system prompt based on user type and current state
  generateSystemPrompt(userType, userContext = {}) {
    const basePrompt = `You are Pi Assistant, the helpful AI customer support agent for Pi VIP Rideshare Platform. You provide friendly, professional, and efficient support.

PLATFORM OVERVIEW:
- Pi is a premium rideshare platform with rider apps, driver apps, and admin dashboard
- Features: Real-time GPS tracking, surge pricing, airport queues, corporate discounts
- Payment: Stripe integration with cards, Apple Pay, Google Pay
- Vehicle types: Economy, Standard, XL, Premium

YOUR ROLE:
- Provide helpful, accurate information about Pi rideshare services
- Guide users through common issues and questions
- Escalate complex technical issues when needed
- Be concise but thorough in responses
- Always maintain a professional, friendly tone

RESPONSE FORMAT:
- Keep responses under 200 words
- Use bullet points for multiple steps
- Include relevant links or actions when helpful
- End with "Is there anything else I can help you with?"`;

    const userSpecificPrompts = {
      rider: `
USER TYPE: RIDER
You're helping a rider who uses Pi to book rides.

COMMON RIDER ISSUES:
- Booking rides and selecting vehicle types
- Payment methods and billing questions
- Ride tracking and driver communication
- Corporate discount applications
- Trip history and receipts
- Account settings and preferences

CURRENT CONTEXT: ${JSON.stringify(userContext)}`,

      driver: `
USER TYPE: DRIVER
You're helping a driver who provides rides on Pi platform.

COMMON DRIVER ISSUES:
- Driver verification and document upload
- Earnings, payouts, and payment methods
- Navigation and trip management
- Airport queue positioning
- Vehicle requirements and insurance
- Account status and performance metrics

CURRENT CONTEXT: ${JSON.stringify(userContext)}`,

      admin: `
USER TYPE: ADMIN
You're helping an admin who manages Pi platform operations.

COMMON ADMIN ISSUES:
- Dashboard and analytics questions
- Driver and rider management
- Surge pricing and market controls
- Dispute resolution workflows
- Corporate client management
- System configuration and settings

CURRENT CONTEXT: ${JSON.stringify(userContext)}`
    };

    return basePrompt + (userSpecificPrompts[userType] || userSpecificPrompts.rider);
  }

  // Main chat completion function
  async generateResponse(messages, userType, userContext = {}) {
    try {
      const systemPrompt = this.generateSystemPrompt(userType, userContext);
      
      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...messages
      ];

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: chatMessages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      return {
        success: true,
        message: response.choices[0].message.content,
        tokensUsed: response.usage.total_tokens,
        model: this.model
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return {
        success: false,
        error: error.message,
        fallbackMessage: "I'm experiencing technical difficulties. Please try again in a moment, or contact our support team directly for immediate assistance."
      };
    }
  }

  // Analyze user intent to determine if escalation is needed
  async analyzeIntent(userMessage) {
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Analyze the user message and determine:
1. Intent category (booking, payment, technical, account, complaint, urgent)
2. Urgency level (low, medium, high, critical)
3. Whether human escalation is needed
4. Sentiment (positive, neutral, negative, angry)

Respond with JSON in this format:
{
  "intent": "category",
  "urgency": "level",
  "needsEscalation": boolean,
  "sentiment": "sentiment",
  "reason": "brief explanation"
}`
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        intent: "general",
        urgency: "medium",
        needsEscalation: false,
        sentiment: "neutral",
        reason: "Unable to analyze intent"
      };
    }
  }

  // Generate suggested quick replies
  async generateQuickReplies(conversationContext, userType) {
    const commonReplies = {
      rider: [
        "Book a ride",
        "Check my trip history",
        "Payment issue",
        "Contact my driver",
        "Cancel current ride"
      ],
      driver: [
        "Check earnings",
        "Upload documents",
        "Report an issue",
        "Airport queue status",
        "Account verification"
      ],
      admin: [
        "View system status",
        "Check driver applications",
        "Resolve dispute",
        "Market settings",
        "Analytics question"
      ]
    };

    return commonReplies[userType] || commonReplies.rider;
  }

  // Check service health
  async healthCheck() {
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10
      });
      return { healthy: true, model: this.model };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new ChatbotService();