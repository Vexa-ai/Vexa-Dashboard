import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AIProvider } from "@/stores/ai-store";

export const runtime = "nodejs";

interface UIMessagePart {
  type: string;
  text?: string;
}

interface UIMessage {
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: UIMessagePart[];
}

interface ChatRequest {
  messages: UIMessage[];
  context: string;
  settings: {
    provider: AIProvider;
    apiKey: string;
    model: string;
    customBaseUrl?: string;
    customModel?: string;
  };
}

const SYSTEM_PROMPT = `You are a helpful AI assistant specialized in analyzing meeting transcripts and conversations. You help users find information, summarize discussions, identify action items, and answer questions based on the transcript content provided.

Guidelines:
- Always respond in the same language as the user's message
- Answer questions based on the transcript context provided
- If the answer is not in the transcripts, clearly state that
- When referencing specific parts of conversations, mention the speaker's name when available
- Be concise but thorough
- Format responses with markdown for readability
- When asked to summarize, focus on key points, decisions, and action items

Available transcript context:
`;

function getModel(settings: ChatRequest["settings"]) {
  const { provider, apiKey, model, customBaseUrl, customModel } = settings;

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey,
        baseURL: "https://api.openai.com/v1",
      });
      return openai(model);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey,
      });
      return anthropic(model);
    }

    case "groq": {
      // Groq uses OpenAI-compatible API
      const groq = createOpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      return groq(model);
    }

    case "openrouter": {
      // OpenRouter uses OpenAI-compatible API
      const openrouter = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      return openrouter(model);
    }

    case "custom": {
      if (!customBaseUrl) {
        throw new Error("Custom provider requires a base URL");
      }
      const custom = createOpenAI({
        apiKey: apiKey || "not-needed",
        baseURL: customBaseUrl,
      });
      return custom(customModel || model);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Convert UI messages (with parts) to model messages (with content)
function convertMessages(messages: UIMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => {
      let content = "";

      // If message has parts array (UI message format)
      if (m.parts && Array.isArray(m.parts)) {
        content = m.parts
          .filter(part => part.type === "text" && part.text)
          .map(part => part.text!)
          .join("");
      }
      // If message has content string (model message format)
      else if (m.content) {
        content = m.content;
      }

      return {
        role: m.role as "user" | "assistant",
        content,
      };
    })
    .filter(m => m.content.length > 0);
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, context, settings } = body;

    if (!settings?.provider) {
      return new Response(JSON.stringify({ error: "AI provider not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!settings?.apiKey && settings.provider !== "custom") {
      return new Response(JSON.stringify({ error: "API key is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build the full system prompt with context
    const systemPrompt = context
      ? `${SYSTEM_PROMPT}\n\n${context}`
      : SYSTEM_PROMPT + "\n\nNo transcript context available. You can still help with general questions.";

    const model = getModel(settings);

    // Convert UI messages to model messages
    const modelMessages = convertMessages(messages);

    if (modelMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No valid messages to process" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      onError({ error }) {
        console.error("AI streaming error:", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
