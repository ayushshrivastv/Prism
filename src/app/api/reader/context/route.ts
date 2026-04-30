import { NextResponse } from "next/server";

type ReaderPageContext = {
  sessionId?: string;
  bookId?: string | null;
  bookTitle?: string;
  author?: string;
  chapterTitle?: string;
  pageIndex?: number;
  totalPages?: number;
  progress?: number;
  currentSpreadText?: string;
  previousNearbyText?: string;
  nextNearbyText?: string;
  source?: "preview" | "rendition";
  capturedAt?: string;
};

const readerContextStore = new Map<string, ReaderPageContext>();

function normalizeContext(payload: ReaderPageContext): ReaderPageContext {
  return {
    sessionId: payload.sessionId,
    bookId: payload.bookId ?? null,
    bookTitle: payload.bookTitle,
    author: payload.author,
    chapterTitle: payload.chapterTitle,
    pageIndex: payload.pageIndex,
    totalPages: payload.totalPages,
    progress: payload.progress,
    currentSpreadText: payload.currentSpreadText?.slice(0, 5000),
    previousNearbyText: payload.previousNearbyText?.slice(0, 1500),
    nextNearbyText: payload.nextNearbyText?.slice(0, 1500),
    source: payload.source,
    capturedAt: payload.capturedAt ?? new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ReaderPageContext;

  if (!payload.sessionId || !payload.currentSpreadText?.trim()) {
    return NextResponse.json(
      { error: "Reader context requires sessionId and currentSpreadText." },
      { status: 400 },
    );
  }

  const context = normalizeContext(payload);
  readerContextStore.set(payload.sessionId, context);

  return NextResponse.json({
    ok: true,
    sessionId: payload.sessionId,
    textLength: context.currentSpreadText?.length ?? 0,
  });
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const context = readerContextStore.get(sessionId);
  if (!context) {
    return NextResponse.json({ error: "No reader context found." }, { status: 404 });
  }

  return NextResponse.json({ context });
}
