import { NextResponse } from "next/server";

type ReaderPageContext = {
  bookTitle?: string;
  author?: string;
  chapterTitle?: string;
  pageIndex?: number;
  totalPages?: number;
  progress?: number;
  currentSpreadText?: string;
  previousNearbyText?: string;
  nextNearbyText?: string;
};

type CompanionRequest = {
  question?: string;
  context?: ReaderPageContext;
};

function fallbackAnswer(context: ReaderPageContext) {
  const title = context.bookTitle ? ` in ${context.bookTitle}` : "";
  const pageText = context.currentSpreadText?.replace(/\s+/g, " ").trim() ?? "";
  const firstSentence = pageText.match(/[^.!?]+[.!?]/)?.[0]?.trim();

  if (firstSentence) {
    return `I have this page${title} ready. It opens with: ${firstSentence}`;
  }

  return `I have this page${title} ready. Add your OpenAI and ElevenLabs keys to enable live voice answers.`;
}

export async function POST(request: Request) {
  const { question, context } = (await request.json()) as CompanionRequest;

  if (!context?.currentSpreadText?.trim()) {
    return NextResponse.json(
      { error: "Current page text is required before starting the companion." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      answer: fallbackAnswer(context),
    });
  }

  const model = process.env.OPENAI_READER_MODEL ?? "gpt-4o-mini";
  const enableWebSearch = process.env.OPENAI_ENABLE_WEB_SEARCH === "true";
  const prompt = [
    `Book: ${context.bookTitle ?? "Unknown"}`,
    `Author: ${context.author ?? "Unknown"}`,
    context.chapterTitle ? `Chapter/section: ${context.chapterTitle}` : null,
    `Page: ${context.pageIndex ?? "unknown"} of ${context.totalPages ?? "unknown"}`,
    "",
    "Visible page text:",
    context.currentSpreadText,
    context.previousNearbyText ? `\nNearby previous text:\n${context.previousNearbyText}` : null,
    context.nextNearbyText ? `\nNearby next text:\n${context.nextNearbyText}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const responseBody: Record<string, unknown> = {
    model,
    input: [
      {
        role: "system",
        content:
          "You are Prism's voice-first reading companion. Use the visible page context as the primary source. You can explain the narrator's intent, define words, narrate the page like a story, summarize, compare ideas, and answer follow-up questions. Keep answers warm, clear, and conversational. If asked about facts outside the page, use general knowledge or web search when available, and clearly connect back to the current page.",
      },
      {
        role: "user",
        content: `${question ?? "Explain what this page is trying to say."}\n\n${prompt}`,
      },
    ],
  };

  if (enableWebSearch) {
    responseBody.tools = [{ type: "web_search_preview" }];
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(responseBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: "OpenAI reader companion request failed.",
        detail: errorText.slice(0, 600),
      },
      { status: 502 },
    );
  }

  const result = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ text?: string }>;
    }>;
  };
  const answer =
    result.output_text ??
    result.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text ??
    fallbackAnswer(context);

  return NextResponse.json({
    configured: true,
    answer,
  });
}
