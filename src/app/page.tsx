"use client";

import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import JSZip from "jszip";
import Image from "next/image";

import makeSomethingWonderfulMetadata from "../../public/books/make-something-wonderful.metadata.json";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  Bot,
  BookOpen,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Files,
  Headphones,
  Home,
  ImageIcon,
  LoaderCircle,
  LogOut,
  Plus,
  Store,
} from "lucide-react";

import {
  firebaseAuth,
  googleAuthProvider,
  loadFirebaseAnalytics,
} from "@/lib/firebase";

const libraryItems = [
  { label: "Read", icon: BookOpenText },
  { label: "Audiobooks", icon: Headphones },
  { label: "Files", icon: Files },
];

type Book = {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  currentPage: number;
  status: "reading" | "finished";
  coverUrl?: string | null;
  source?: "seed" | "upload";
  uploadStatus?: "uploading" | "ready" | "error";
  uploadProgress?: number;
  uploadLoadedBytes?: number;
  uploadTotalBytes?: number;
  errorMessage?: string | null;
};

type UploadedBookData = {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  rawFile: ArrayBuffer;
  spine: string[];
};

type ReadingSession = {
  bookId: string;
  date: string;
  minutes: number;
  pages: number;
};

type ReaderFastPreview = {
  url: string;
  cleanupUrls: string[];
  spreadCount: number;
  pageCount: number;
};

type ReaderFastPreviewChunk = {
  spreadsHtml: string[];
  cleanupUrls: string[];
  spreadCount: number;
  pageCount: number;
  hasMore: boolean;
  headMarkup: string;
};

type EpubBookInstance = import("epubjs").Book;
type EpubRenditionInstance = import("epubjs").Rendition;
type EpubLocation = import("epubjs").Location;
type AuthViewState = "loading" | "authenticated" | "unauthenticated";
type StoreBookMetadata = {
  bookId: string;
  title: string;
  author: string;
  fileName: string;
  fileSize: number;
  path: string;
  coverUrl: string;
  packagePath: string;
  coverHref: string | null;
  spine: string[];
};

const UPLOADED_BOOK_SUMMARIES_KEY = "prism-uploaded-book-summaries-v1";
const READING_SESSIONS_KEY = "prism-reading-sessions-v1";
const LIBRARY_DB_NAME = "prism-library";
const LIBRARY_DB_VERSION = 1;
const LIBRARY_STORE_NAME = "uploaded-books";
const SHOULD_BYPASS_AUTH_IN_DEV = process.env.NODE_ENV === "development";
const makeSomethingWonderfulStoreMetadata =
  makeSomethingWonderfulMetadata as StoreBookMetadata;

const initialBooks: Book[] = [
  {
    id: "psychology-money",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    progress: 70,
    totalPages: 256,
    currentPage: 179,
    status: "reading",
    source: "seed",
  },
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    progress: 92,
    totalPages: 304,
    currentPage: 280,
    status: "reading",
    source: "seed",
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    progress: 100,
    totalPages: 320,
    currentPage: 320,
    status: "finished",
    source: "seed",
  },
  {
    id: "ikigai",
    title: "Ikigai",
    author: "Hector Garcia",
    progress: 48,
    totalPages: 208,
    currentPage: 100,
    status: "reading",
    source: "seed",
  },
];

const readingSessions = [
  { bookId: "psychology-money", date: "2026-04-23T00:10:00+05:30", minutes: 24, pages: 14 },
  { bookId: "deep-work", date: "2026-04-22T22:30:00+05:30", minutes: 36, pages: 18 },
  { bookId: "psychology-money", date: "2026-04-22T19:20:00+05:30", minutes: 28, pages: 12 },
  { bookId: "ikigai", date: "2026-04-21T21:45:00+05:30", minutes: 42, pages: 20 },
  { bookId: "deep-work", date: "2026-04-20T20:00:00+05:30", minutes: 58, pages: 24 },
  { bookId: "psychology-money", date: "2026-04-19T22:10:00+05:30", minutes: 34, pages: 17 },
  { bookId: "psychology-money", date: "2026-04-18T18:40:00+05:30", minutes: 51, pages: 28 },
  { bookId: "ikigai", date: "2026-04-17T23:05:00+05:30", minutes: 27, pages: 10 },
  { bookId: "deep-work", date: "2026-04-16T21:15:00+05:30", minutes: 44, pages: 21 },
  { bookId: "psychology-money", date: "2026-04-15T19:05:00+05:30", minutes: 62, pages: 30 },
  { bookId: "atomic-habits", date: "2026-04-14T20:50:00+05:30", minutes: 39, pages: 22 },
  { bookId: "deep-work", date: "2026-04-13T22:15:00+05:30", minutes: 49, pages: 19 },
  { bookId: "psychology-money", date: "2026-04-12T21:40:00+05:30", minutes: 66, pages: 32 },
  { bookId: "ikigai", date: "2026-04-11T18:10:00+05:30", minutes: 33, pages: 14 },
  { bookId: "deep-work", date: "2026-04-10T22:25:00+05:30", minutes: 57, pages: 25 },
  { bookId: "atomic-habits", date: "2026-04-08T20:35:00+05:30", minutes: 41, pages: 20 },
  { bookId: "deep-work", date: "2026-04-05T19:25:00+05:30", minutes: 53, pages: 26 },
  { bookId: "psychology-money", date: "2026-04-02T21:20:00+05:30", minutes: 48, pages: 18 },
  { bookId: "ikigai", date: "2026-03-28T20:40:00+05:30", minutes: 38, pages: 16 },
  { bookId: "atomic-habits", date: "2026-03-24T19:50:00+05:30", minutes: 46, pages: 23 },
  { bookId: "deep-work", date: "2026-03-18T21:40:00+05:30", minutes: 52, pages: 24 },
  { bookId: "psychology-money", date: "2026-03-10T20:15:00+05:30", minutes: 61, pages: 29 },
  { bookId: "ikigai", date: "2026-02-25T22:05:00+05:30", minutes: 32, pages: 13 },
] as const;

const updates = [
  {
    title: "ElevenLabs voices are now available in Prism",
    time: "2 days ago",
    description:
      "Listen to books with more natural narration, clearer pacing, and richer voice options for long reading sessions.",
    icon: ImageIcon,
  },
  {
    title: "Built with Kiro IDE",
    time: "8 days ago",
    description:
      "Prism is now being shaped with Kiro IDE, helping us move faster on reading workflows, UI polish, and book-first improvements.",
    icon: Bot,
  },
];

const timeRanges = ["24h", "7d", "30d", "90d"] as const;

const cachedUser = {
  name: "ayush.shrivastv",
  badge: "Max",
};

const readerExitHintPositions = [
  {
    id: "top-left",
    wrapperClassName: "left-0 top-0 items-start justify-start",
    badgeClassName: "ml-4 mt-4 origin-top-left",
  },
  {
    id: "top-right",
    wrapperClassName: "right-0 top-0 items-start justify-end",
    badgeClassName: "mr-4 mt-4 origin-top-right",
  },
  {
    id: "bottom-left",
    wrapperClassName: "bottom-0 left-0 items-end justify-start",
    badgeClassName: "mb-4 ml-4 origin-bottom-left",
  },
  {
    id: "bottom-right",
    wrapperClassName: "bottom-0 right-0 items-end justify-end",
    badgeClassName: "mb-4 mr-4 origin-bottom-right",
  },
] as const;

type PageView = "home" | "read" | "store";

const storeBooks = [
  {
    id: makeSomethingWonderfulStoreMetadata.bookId,
    title: makeSomethingWonderfulStoreMetadata.title,
    author: makeSomethingWonderfulStoreMetadata.author,
    fileName: makeSomethingWonderfulStoreMetadata.fileName,
    path: makeSomethingWonderfulStoreMetadata.path,
    coverUrl: makeSomethingWonderfulStoreMetadata.coverUrl,
    fileSize: makeSomethingWonderfulStoreMetadata.fileSize,
    spine: makeSomethingWonderfulStoreMetadata.spine,
    packagePath: makeSomethingWonderfulStoreMetadata.packagePath,
    coverHref: makeSomethingWonderfulStoreMetadata.coverHref,
  },
] as const;

const dashboardNow = new Date("2026-04-23T01:30:00+05:30");
const THIRTY_DAY_DUMMY_BOOK = {
  title: "Zero to One",
  author: "Peter Thiel",
  progress: 74,
  currentPage: 168,
  totalPages: 224,
};

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatStorageProgress(loadedBytes = 0, totalBytes = 0) {
  const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1);
  const totalMb = Math.max(totalBytes / (1024 * 1024), 0.1).toFixed(1);
  return `${loadedMb} / ${totalMb} MB`;
}

function formatLoadTime(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function getHighResolutionTime() {
  return window.performance.now();
}

function createUploadedBookId(fileName: string) {
  const sanitizedFileName = fileName.replace(/\W+/g, "-").toLowerCase();
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ??
    `${globalThis.Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${uniqueId}-${sanitizedFileName}`;
}

function mergeBooks(seedBooks: Book[], uploadedBooks: Book[]) {
  const merged = new Map<string, Book>();
  [...uploadedBooks, ...seedBooks].forEach((book) => merged.set(book.id, book));
  return Array.from(merged.values());
}

function getRangeWindow(range: (typeof timeRanges)[number]) {
  switch (range) {
    case "24h":
      return { days: 1, goal: 120, label: "Today" };
    case "7d":
      return { days: 7, goal: 420, label: "This week" };
    case "30d":
      return { days: 30, goal: 1800, label: "This month" };
    case "90d":
      return { days: 90, goal: 5400, label: "Last 90 days" };
  }
}

function createZeroReadingProgress(
  range: (typeof timeRanges)[number],
  books: Book[],
  referenceBook?: Partial<Book> & { title?: string; author?: string },
) {
  const windowConfig = getRangeWindow(range);
  const fallbackBook =
    referenceBook ??
    books.find((book) => book.source === "upload" && book.uploadStatus === "ready") ??
    books.find((book) => book.source === "upload") ??
    books[0] ?? {
      title: "Make Something Wonderful",
      author: "Steve Jobs",
      progress: 0,
      currentPage: 0,
      totalPages: 0,
    };

  return {
    label: windowConfig.label,
    minutes: 0,
    goal: windowConfig.goal,
    timeSpent: "0m",
    pagesRead: 0,
    streak: "0 active days",
    currentBook: fallbackBook.title ?? "Make Something Wonderful",
    currentAuthor: fallbackBook.author ?? "Steve Jobs",
    chapter: "Page 0 of 0",
    remaining: "0 pages left",
    topBook: {
      title: fallbackBook.title ?? "Make Something Wonderful",
      progress: 0,
    },
    bars: Array.from({ length: 12 }, () => 0),
  };
}

function normalizeProgressBars(values: number[]) {
  const maxBucketValue = Math.max(...values, 0);
  if (maxBucketValue === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => Math.max(14, Math.round((value / maxBucketValue) * 100)));
}

function buildTimelineChart(
  range: (typeof timeRanges)[number],
  values: number[],
) {
  const width = 1120;
  const height = 100;
  const baselineY = 78;
  const paddingX = 20;
  const maxRise = 56;
  const innerWidth = width - paddingX * 2;
  const sampleCount = 15;
  const step = innerWidth / (sampleCount - 1);
  const rangeColors: Record<(typeof timeRanges)[number], string> = {
    "24h": "#d43c79",
    "7d": "#d43c79",
    "30d": "#e36c2d",
    "90d": "#b9b9b9",
  };
  const selectedValues: Record<(typeof timeRanges)[number], number[]> = {
    "24h": values,
    "7d": values,
    "30d": values,
    "90d": Array.from({ length: sampleCount }, () => 0),
  };
  const padValues = (sourceValues: number[]) =>
    Array.from({ length: sampleCount }, (_, index) => sourceValues[index] ?? 0);

  const buildPoints = (sourceValues: number[]) =>
    padValues(sourceValues).map((value, index) => {
      const normalizedValue = Math.max(0, Math.min(100, value));
      return {
        x: paddingX + index * step,
        y: baselineY - (normalizedValue / 100) * maxRise,
      };
    });

  const points = buildPoints(selectedValues[range]);
  const buildPath = (sourcePoints: Array<{ x: number; y: number }>) =>
    sourcePoints.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }

      const previousPoint = sourcePoints[index - 1];
      const controlX = previousPoint.x + (point.x - previousPoint.x) / 2;
      return `${path} C ${controlX.toFixed(2)} ${previousPoint.y.toFixed(2)} ${controlX.toFixed(2)} ${point.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }, "");
  const linePath = buildPath(points);
  const lastPoint = points[points.length - 1] ?? {
    x: width - paddingX,
    y: baselineY,
  };
  const color = rangeColors[range];

  return {
    width,
    height,
    baselineY,
    linePath,
    lastPoint,
    color,
  };
}

function buildReadingProgress(
  range: (typeof timeRanges)[number],
  books: Book[],
  realReadingSessions: ReadingSession[],
) {
  if (range === "24h") {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const sessions = realReadingSessions.filter((session) => new Date(session.date) >= cutoff);
    const minutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
    const pagesRead = sessions.reduce((sum, session) => sum + session.pages, 0);
    const fallbackBook =
      books.find((book) => book.source === "upload" && book.uploadStatus === "ready") ??
      books.find((book) => book.source === "upload") ??
      books[0];

    if (sessions.length === 0) {
      return createZeroReadingProgress("24h", books, fallbackBook);
    }

    const topBookTotals = sessions.reduce<Record<string, { minutes: number; pages: number }>>(
      (accumulator, session) => {
        const existing = accumulator[session.bookId] ?? { minutes: 0, pages: 0 };
        accumulator[session.bookId] = {
          minutes: existing.minutes + session.minutes,
          pages: existing.pages + session.pages,
        };
        return accumulator;
      },
      {},
    );

    const activeDayKeys = new Set(
      sessions.map((session) => new Date(session.date).toISOString().slice(0, 10)),
    );

    const currentBook =
      books
        .filter((book) => topBookTotals[book.id])
        .sort((left, right) => {
          const leftMinutes = topBookTotals[left.id]?.minutes ?? 0;
          const rightMinutes = topBookTotals[right.id]?.minutes ?? 0;
          if (rightMinutes !== leftMinutes) {
            return rightMinutes - leftMinutes;
          }

          const leftPages = topBookTotals[left.id]?.pages ?? 0;
          const rightPages = topBookTotals[right.id]?.pages ?? 0;
          return rightPages - leftPages;
        })[0] ?? fallbackBook;

    const bucketCount = 12;
    const bars = Array.from({ length: bucketCount }, () => 0);
    const now = Date.now();
    const windowStart = cutoff.getTime();
    const totalWindow = Math.max(1, now - windowStart);

    sessions.forEach((session) => {
      const sessionTime = new Date(session.date).getTime();
      const elapsed = Math.max(0, sessionTime - windowStart);
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor((elapsed / totalWindow) * bucketCount),
      );
      bars[bucketIndex] += session.minutes;
    });

    return {
      label: "Today",
      minutes,
      goal: 120,
      timeSpent: formatMinutes(minutes),
      pagesRead,
      streak:
        activeDayKeys.size === 1
          ? "1 active day"
          : `${activeDayKeys.size} active days`,
      currentBook: currentBook?.title ?? "Make Something Wonderful",
      currentAuthor: currentBook?.author ?? "Steve Jobs",
      chapter: `Page ${currentBook?.currentPage ?? 0} of ${currentBook?.totalPages ?? 0}`,
      remaining:
        (currentBook?.totalPages ?? 0) > 0
          ? `${Math.max(0, (currentBook?.totalPages ?? 0) - (currentBook?.currentPage ?? 0))} pages left`
          : "0 pages left",
      topBook: {
        title: currentBook?.title ?? "Make Something Wonderful",
        progress: currentBook?.progress ?? 0,
      },
      bars: normalizeProgressBars(bars),
    };
  }

  if (range === "90d") {
    return createZeroReadingProgress("90d", books);
  }

  const windowConfig = getRangeWindow(range);
  const cutoff = new Date(dashboardNow);
  cutoff.setDate(cutoff.getDate() - (windowConfig.days - 1));

  const sessions = readingSessions.filter((session) => new Date(session.date) >= cutoff);
  const minutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const pagesRead = sessions.reduce((sum, session) => sum + session.pages, 0);

  const activeDayKeys = new Set(
    sessions.map((session) => new Date(session.date).toISOString().slice(0, 10)),
  );

  const topBookTotals = sessions.reduce<Record<string, { minutes: number; pages: number }>>(
    (accumulator, session) => {
      const existing = accumulator[session.bookId] ?? { minutes: 0, pages: 0 };
      accumulator[session.bookId] = {
        minutes: existing.minutes + session.minutes,
        pages: existing.pages + session.pages,
      };
      return accumulator;
    },
    {},
  );

  const mostCompletedBook =
    books
      .filter((book) => topBookTotals[book.id])
      .sort((left, right) => {
        const leftPages = topBookTotals[left.id]?.pages ?? 0;
        const rightPages = topBookTotals[right.id]?.pages ?? 0;

        if (right.progress !== left.progress) {
          return right.progress - left.progress;
        }

        return rightPages - leftPages;
      })[0] ?? books[0];

  const bucketCount = 12;
  const bars = Array.from({ length: bucketCount }, () => 0);

  sessions.forEach((session) => {
    const sessionTime = new Date(session.date).getTime();
    const elapsed = Math.max(0, sessionTime - cutoff.getTime());
    const totalWindow = Math.max(1, dashboardNow.getTime() - cutoff.getTime());
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor((elapsed / totalWindow) * bucketCount),
    );

    bars[bucketIndex] += session.minutes;
  });

  const progress = {
    label: windowConfig.label,
    minutes,
    goal: windowConfig.goal,
    timeSpent: formatMinutes(minutes),
    pagesRead,
    streak:
      activeDayKeys.size === 1
        ? "1 active day"
        : `${activeDayKeys.size} active days`,
    currentBook: mostCompletedBook.title,
    currentAuthor: mostCompletedBook.author,
    chapter:
      mostCompletedBook.progress === 100
        ? "Finished most recently in this range"
        : `Page ${mostCompletedBook.currentPage} of ${mostCompletedBook.totalPages}`,
    remaining:
      mostCompletedBook.progress === 100
        ? "Ready to start a new book"
        : `${mostCompletedBook.totalPages - mostCompletedBook.currentPage} pages left`,
    topBook: {
      title: mostCompletedBook.title,
      progress: mostCompletedBook.progress,
    },
    bars: normalizeProgressBars(bars),
  };

  if (range === "30d") {
    return {
      ...progress,
      currentBook: THIRTY_DAY_DUMMY_BOOK.title,
      currentAuthor: THIRTY_DAY_DUMMY_BOOK.author,
      chapter: `Page ${THIRTY_DAY_DUMMY_BOOK.currentPage} of ${THIRTY_DAY_DUMMY_BOOK.totalPages}`,
      remaining: `${THIRTY_DAY_DUMMY_BOOK.totalPages - THIRTY_DAY_DUMMY_BOOK.currentPage} pages left`,
      topBook: {
        title: THIRTY_DAY_DUMMY_BOOK.title,
        progress: THIRTY_DAY_DUMMY_BOOK.progress,
      },
    };
  }

  return progress;
}

function SidebarButton({
  label,
  active = false,
  icon: Icon,
  onClick,
  badge,
}: {
  label: string;
  active?: boolean;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick?: () => void;
  badge?: string | null;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-10 w-full items-center gap-2.5 rounded-[1rem] px-3 text-left text-[0.88rem] font-medium tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 ${
          active ? "bg-[#dddddb] text-[#161616]" : "text-[#2c2c2c] hover:bg-[#ececea]"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={2.1} />
        <span>{label}</span>
      </button>
      {badge ? (
        <p className="pl-[2.95rem] pt-1 text-[0.64rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
          {badge}
        </p>
      ) : null}
    </div>
  );
}

function getBasePath(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function resolveEpubPath(basePath: string, targetPath: string) {
  const source = basePath ? `${basePath}/${targetPath}` : targetPath;
  const segments = source.split("/");
  const resolved: string[] = [];

  segments.forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") {
      resolved.pop();
      return;
    }
    resolved.push(segment);
  });

  return resolved.join("/");
}

function getMimeType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".xhtml") || lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "application/xhtml+xml";
  }
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  return "application/octet-stream";
}

function sanitizeAssetTarget(targetPath: string) {
  return targetPath.split("#")[0]?.split("?")[0] ?? targetPath;
}

function isExternalAssetTarget(targetPath: string) {
  const normalized = targetPath.trim().toLowerCase();
  return (
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("//") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("#")
  );
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...slice);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

function readBlobChunk(blob: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file chunk."));
    reader.readAsArrayBuffer(blob);
  });
}

async function readFileWithProgress(
  file: File,
  onProgress: (loadedBytes: number, totalBytes: number) => void,
) {
  const chunkSize = 256 * 1024;
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (loadedBytes < file.size) {
    const nextChunk = await readBlobChunk(file.slice(loadedBytes, loadedBytes + chunkSize));
    const nextBytes = new Uint8Array(nextChunk);
    chunks.push(nextBytes);
    loadedBytes += nextBytes.byteLength;
    onProgress(loadedBytes, file.size);
  }

  const fileBytes = new Uint8Array(file.size);
  let writeOffset = 0;

  chunks.forEach((chunk) => {
    fileBytes.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  });

  return fileBytes.buffer;
}

function openLibraryDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
        database.createObjectStore(LIBRARY_STORE_NAME, { keyPath: "bookId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local library."));
  });
}

async function saveUploadedBookRecord(bookData: UploadedBookData) {
  const database = await openLibraryDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE_NAME, "readwrite");
    transaction.objectStore(LIBRARY_STORE_NAME).put(bookData);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to save uploaded book."));
  });

  database.close();
}

async function loadUploadedBookRecords() {
  const database = await openLibraryDb();

  const records = await new Promise<UploadedBookData[]>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE_NAME, "readonly");
    const request = transaction.objectStore(LIBRARY_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as UploadedBookData[]) ?? []);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to load uploaded books."));
  });

  database.close();
  return records;
}

async function loadUploadedBookRecord(bookId: string) {
  const database = await openLibraryDb();

  const record = await new Promise<UploadedBookData | null>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE_NAME, "readonly");
    const request = transaction.objectStore(LIBRARY_STORE_NAME).get(bookId);
    request.onsuccess = () => resolve((request.result as UploadedBookData | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to load uploaded book."));
  });

  database.close();
  return record;
}

async function removeUploadedBookRecord(bookId: string) {
  const database = await openLibraryDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE_NAME, "readwrite");
    transaction.objectStore(LIBRARY_STORE_NAME).delete(bookId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to remove uploaded book."));
  });

  database.close();
}

async function parseEpubFile(file: File, fileBuffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(fileBuffer);
  const parser = new DOMParser();

  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) {
    throw new Error("This EPUB is missing container metadata.");
  }

  const containerXml = await containerEntry.async("text");
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath =
    containerDoc.querySelector("rootfile")?.getAttribute("full-path") ?? "";

  if (!rootfilePath) {
    throw new Error("Unable to find the EPUB package file.");
  }

  const packageEntry = zip.file(rootfilePath);
  if (!packageEntry) {
    throw new Error("Unable to read the EPUB package file.");
  }

  const packageXml = await packageEntry.async("text");
  const packageDoc = parser.parseFromString(packageXml, "application/xml");
  const metadata = packageDoc.querySelector("metadata");

  const title =
    metadata?.querySelector("title, dc\\:title")?.textContent?.trim() ||
    file.name.replace(/\.epub$/i, "");
  const author =
    metadata?.querySelector("creator, dc\\:creator")?.textContent?.trim() ||
    "Unknown author";

  const manifestItems = Array.from(packageDoc.querySelectorAll("manifest > item"));
  const coverMetaId =
    metadata?.querySelector('meta[name="cover"]')?.getAttribute("content") ?? "";

  const coverItem =
    manifestItems.find((item) => item.getAttribute("id") === coverMetaId) ||
    manifestItems.find((item) => item.getAttribute("properties")?.includes("cover-image")) ||
    manifestItems.find((item) => (item.getAttribute("media-type") || "").startsWith("image/"));

  let coverUrl: string | null = null;

  if (coverItem) {
    const href = coverItem.getAttribute("href");
    if (href) {
      const coverPath = resolveEpubPath(getBasePath(rootfilePath), href);
      const coverFile = zip.file(coverPath);

      if (coverFile) {
        const coverBuffer = await coverFile.async("arraybuffer");
        coverUrl = arrayBufferToDataUrl(coverBuffer, getMimeType(coverPath));
      }
    }
  }

  const chapterIds = Array.from(packageDoc.querySelectorAll("spine > itemref"))
    .map((item) => item.getAttribute("idref") ?? "")
    .filter(Boolean);

  return {
    title,
    author,
    coverUrl,
    rawFile: fileBuffer,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    spine: chapterIds,
  };
}

function createFastPreviewDocument(spreadsHtml: string[], headMarkup: string) {
  const fastPreviewStyles = `
    :root {
      color-scheme: light only;
      --prism-stage: #ffffff;
      --prism-paper: #ffffff;
      --prism-ink: #1c1b19;
      --prism-muted: #7d7d80;
      --prism-gutter: rgba(28, 27, 25, 0.06);
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      width: 100%;
      max-width: 100%;
      height: 100%;
      background: var(--prism-stage);
      overflow-x: hidden;
      overflow-y: auto;
    }
    body {
      overflow-x: hidden;
      overflow-y: auto;
      background: var(--prism-stage);
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    :where(body) {
      color: var(--prism-ink);
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
      font-size: clamp(16px, 1.02vw, 18px);
      line-height: 1.4;
      letter-spacing: 0;
      hyphens: auto;
      -webkit-hyphens: auto;
    }
    #prism-preview-track {
      display: flex;
      width: 100%;
      height: 100%;
      padding: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -ms-overflow-style: none;
      gap: 0;
      background: var(--prism-stage);
    }
    #prism-preview-track::-webkit-scrollbar {
      display: none;
    }
    .prism-fast-spread {
      position: relative;
      width: 100%;
      min-width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: clamp(24px, 2.8vw, 46px);
      box-sizing: border-box;
      padding: clamp(20px, 2.4vw, 34px) clamp(30px, 4.4vw, 58px) clamp(22px, 2.7vw, 36px);
      align-items: stretch;
      scroll-snap-align: start;
      background: var(--prism-paper);
      overflow: hidden;
    }
    .prism-fast-spread::before {
      content: "";
      position: absolute;
      top: clamp(16px, 2vw, 28px);
      bottom: clamp(18px, 2.3vw, 30px);
      left: 50%;
      width: 1px;
      transform: translateX(-0.5px);
      background: linear-gradient(180deg, transparent 0%, var(--prism-gutter) 8%, var(--prism-gutter) 92%, transparent 100%);
      pointer-events: none;
    }
    .prism-fast-page {
      width: 100%;
      height: 100%;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      padding: clamp(8px, 0.8vw, 14px) clamp(4px, 0.5vw, 10px) clamp(10px, 1vw, 16px);
      border: none;
      background: transparent;
    }
    .prism-fast-page > * {
      flex-shrink: 0;
      max-width: 100%;
      overflow-x: hidden;
      box-sizing: border-box;
    }
    :where(.prism-fast-page > :last-child) {
      margin-bottom: 0 !important;
    }
    :where(.prism-fast-page p) {
      margin: 0 0 0.72em;
      text-wrap: pretty;
      orphans: 2;
      widows: 2;
    }
    :where(.prism-fast-page figure) {
      margin: 0.15em 0 1em;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    :where(.prism-fast-page .prism-fast-page-media) {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      align-items: center;
      max-height: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      margin: 0.1em 0 0.8em;
    }
    :where(.prism-fast-page figcaption) {
      margin-top: 0.72em;
      font-size: 0.84em;
      line-height: 1.35;
      text-align: center;
      color: var(--prism-muted);
      font-style: italic;
    }
    :where(.prism-fast-page .prism-fast-page-media > img, .prism-fast-page .prism-fast-page-media > svg, .prism-fast-page .prism-fast-page-media > video, .prism-fast-page .prism-fast-page-media > canvas) {
      width: 100%;
      max-height: 100%;
      min-height: 0;
    }
    :where(.prism-fast-page .prism-fast-page-media img, .prism-fast-page .prism-fast-page-media svg, .prism-fast-page .prism-fast-page-media video, .prism-fast-page .prism-fast-page-media canvas) {
      max-height: min(100%, 30vh);
    }
    :where(.prism-fast-page .prism-fast-page-media figcaption) {
      margin-top: 0.5em;
    }
    :where(.prism-fast-page img, .prism-fast-page svg, .prism-fast-page video, .prism-fast-page canvas) {
      max-width: 100%;
      max-height: 34vh;
      height: auto;
      object-fit: contain;
      display: block;
      margin: 0 auto;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    :where(.prism-fast-page blockquote, .prism-fast-page ul, .prism-fast-page ol, .prism-fast-page pre, .prism-fast-page table) {
      margin: 0.15em 0 0.95em;
      max-width: 100%;
    }
    :where(.prism-fast-page blockquote) {
      padding-left: 1em;
      border-left: 1px solid rgba(28, 27, 25, 0.16);
      font-style: italic;
    }
    :where(.prism-fast-page ul, .prism-fast-page ol) {
      padding-left: 1.1em;
    }
    :where(.prism-fast-page pre, .prism-fast-page code) {
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    :where(.prism-fast-page table, .prism-fast-page pre) {
      width: 100%;
      overflow-x: hidden;
    }
    :where(.prism-fast-page h1, .prism-fast-page h2, .prism-fast-page h3, .prism-fast-page h4, .prism-fast-page h5, .prism-fast-page h6) {
      margin-top: 0;
      margin-bottom: 0.7em;
      text-wrap: balance;
      line-height: 1.14;
      letter-spacing: -0.01em;
      break-after: avoid;
    }
    :where(.prism-fast-page h1) {
      font-size: clamp(2.4rem, 3vw, 3.6rem);
    }
    :where(.prism-fast-page h2) {
      font-size: clamp(1.9rem, 2.3vw, 2.8rem);
    }
    :where(.prism-fast-page h3) {
      font-size: clamp(1.4rem, 1.5vw, 1.8rem);
    }
    :where(.prism-fast-page a) {
      color: inherit;
      text-decoration-color: rgba(28, 27, 25, 0.28);
      text-underline-offset: 0.15em;
    }
    :where(.prism-fast-page hr) {
      margin: 1.35em auto;
      width: 22%;
      border: 0;
      border-top: 1px solid rgba(28, 27, 25, 0.12);
    }
    ::selection {
      background: rgba(255, 221, 87, 0.72);
    }
    @media (max-width: 1024px) {
      .prism-fast-spread {
        grid-template-columns: 1fr;
        gap: 0;
        padding: 18px 22px 24px;
      }
      .prism-fast-spread::before {
        display: none;
      }
      .prism-fast-page {
        min-height: 100%;
        padding: 0;
      }
      :where(body) {
        font-size: 16px;
      }
      :where(.prism-fast-page .prism-fast-page-media img, .prism-fast-page .prism-fast-page-media svg, .prism-fast-page .prism-fast-page-media video, .prism-fast-page .prism-fast-page-media canvas) {
        max-height: min(100%, 24vh);
      }
      :where(.prism-fast-page img, .prism-fast-page svg, .prism-fast-page video, .prism-fast-page canvas) {
        max-height: 26vh;
      }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    ${headMarkup}
    <style>${fastPreviewStyles}</style>
  </head>
  <body>
    <main id="prism-preview-track">
      ${spreadsHtml.join("\n")}
    </main>
  </body>
</html>`;
}

function fallbackPaginatePreviewBlocks(collectedBlocks: string[], pageLimit = Number.POSITIVE_INFINITY) {
  const pages: string[] = [];
  const maxPageWeight = 170;
  let currentPageBlocks: string[] = [];
  let currentPageWeight = 0;

  const estimateBlockWeight = (blockMarkup: string) => {
    const plainText = blockMarkup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let weight = Math.max(10, Math.ceil(plainText.length / 70));

    if (/<h[1-6]\b/i.test(blockMarkup)) weight += 8;
    if (/<img|<figure|<svg|<video|<canvas/i.test(blockMarkup)) weight += 26;
    if (/<blockquote|<ul|<ol|<table|<pre/i.test(blockMarkup)) weight += 18;

    return weight;
  };

  for (const blockMarkup of collectedBlocks) {
    const nextWeight = estimateBlockWeight(blockMarkup);

    if (
      currentPageBlocks.length > 0 &&
      currentPageWeight + nextWeight > maxPageWeight
    ) {
      pages.push(currentPageBlocks.join("\n"));
      if (pages.length >= pageLimit) return pages;
      currentPageBlocks = [];
      currentPageWeight = 0;
    }

    currentPageBlocks.push(blockMarkup);
    currentPageWeight += nextWeight;
  }

  if (currentPageBlocks.length > 0) {
    pages.push(currentPageBlocks.join("\n"));
  }

  return pages.slice(0, pageLimit);
}

async function waitForPreviewStylesheets(root: ParentNode) {
  const stylesheetLinks = Array.from(root.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'));

  await Promise.all(
    stylesheetLinks.map((link) => {
      if (link.sheet) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        link.addEventListener("load", finish, { once: true });
        link.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 300);
      });
    }),
  );
}

async function paginatePreviewBlocks(
  collectedBlocks: string[],
  headMarkup: string,
  pageLimit = Number.POSITIVE_INFINITY,
): Promise<string[]> {
  if (collectedBlocks.length === 0) return [];

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !document.body ||
    typeof Element === "undefined"
  ) {
    return fallbackPaginatePreviewBlocks(collectedBlocks, pageLimit);
  }

  const viewportWidth = Math.max(720, window.innerWidth - 40);
  const viewportHeight = Math.max(520, window.innerHeight - 120);
  const compactLayout = window.innerWidth <= 1024;
  const clampNumber = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value));
  const spreadGap = compactLayout ? 10 : Math.round(clampNumber(viewportWidth * 0.028, 24, 46));
  const spreadPaddingX = compactLayout ? 22 : Math.round(clampNumber(viewportWidth * 0.044, 30, 58));
  const spreadPaddingTop = compactLayout ? 18 : Math.round(clampNumber(viewportWidth * 0.024, 20, 34));
  const spreadPaddingBottom = compactLayout ? 24 : Math.round(clampNumber(viewportWidth * 0.027, 22, 36));
  const gutterTop = compactLayout ? 0 : Math.max(16, spreadPaddingTop - 4);
  const gutterBottom = compactLayout ? 0 : Math.max(18, spreadPaddingBottom - 4);
  const pagePaddingTop = compactLayout ? 0 : Math.round(clampNumber(viewportWidth * 0.008, 8, 14));
  const pagePaddingX = compactLayout ? 0 : Math.round(clampNumber(viewportWidth * 0.005, 4, 10));
  const pagePaddingBottom = compactLayout ? 0 : Math.round(clampNumber(viewportWidth * 0.009, 10, 16));
  const pageFontSize = compactLayout ? 16 : clampNumber(viewportWidth * 0.0098, 16, 18);
  const pageImageMaxHeight = compactLayout
    ? Math.round(viewportHeight * 0.26)
    : Math.round(viewportHeight * 0.34);

  const measurementHost = document.createElement("div");
  measurementHost.setAttribute("aria-hidden", "true");
  measurementHost.style.position = "fixed";
  measurementHost.style.left = "-100000px";
  measurementHost.style.top = "0";
  measurementHost.style.width = `${viewportWidth}px`;
  measurementHost.style.height = `${viewportHeight}px`;
  measurementHost.style.overflow = "hidden";
  measurementHost.style.visibility = "hidden";
  measurementHost.style.pointerEvents = "none";
  measurementHost.style.contain = "layout style size";
  document.body.appendChild(measurementHost);

  const measurementRoot = measurementHost.attachShadow({ mode: "open" });
  measurementRoot.innerHTML = `
    ${headMarkup}
    <style>
      :host {
        color-scheme: light only;
      }
      #prism-pagination-root {
        position: relative;
        width: ${viewportWidth}px;
        height: ${viewportHeight}px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: ${spreadGap}px;
        box-sizing: border-box;
        padding: ${spreadPaddingTop}px ${spreadPaddingX}px ${spreadPaddingBottom}px;
        align-items: stretch;
        background: #ffffff;
        overflow: hidden;
      }
      #prism-pagination-root::before {
        content: "";
        position: absolute;
        top: ${gutterTop}px;
        bottom: ${gutterBottom}px;
        left: 50%;
        width: 1px;
        transform: translateX(-0.5px);
        background: linear-gradient(180deg, transparent 0%, rgba(28, 27, 25, 0.06) 8%, rgba(28, 27, 25, 0.06) 92%, transparent 100%);
        pointer-events: none;
        display: ${compactLayout ? "none" : "block"};
      }
      .prism-fast-page {
        width: 100%;
        height: 100%;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        padding: ${pagePaddingTop}px ${pagePaddingX}px ${pagePaddingBottom}px;
        box-sizing: border-box;
        border: none;
        background: transparent;
      }
      .prism-fast-page > * {
        flex-shrink: 0;
        max-width: 100%;
        overflow-x: hidden;
        box-sizing: border-box;
      }
      :where(.prism-fast-page) {
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        font-size: ${pageFontSize}px;
        line-height: 1.4;
        letter-spacing: 0;
        color: #1c1b19;
        hyphens: auto;
        -webkit-hyphens: auto;
      }
      :where(.prism-fast-page > :last-child) {
        margin-bottom: 0 !important;
      }
      :where(.prism-fast-page p) {
        margin: 0 0 0.72em;
        orphans: 2;
        widows: 2;
        text-wrap: pretty;
      }
      :where(.prism-fast-page figure) {
        margin: 0.2em 0 1.1em;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      :where(.prism-fast-page .prism-fast-page-media) {
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        align-items: center;
        max-height: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        margin: 0.1em 0 0.8em;
      }
      :where(.prism-fast-page figcaption) {
        margin-top: 0.8em;
        font-size: 0.88em;
        line-height: 1.42;
        text-align: center;
        color: #7d7d80;
      }
      :where(.prism-fast-page .prism-fast-page-media > img, .prism-fast-page .prism-fast-page-media > svg, .prism-fast-page .prism-fast-page-media > video, .prism-fast-page .prism-fast-page-media > canvas) {
        width: 100%;
        max-height: 100%;
        min-height: 0;
      }
      :where(.prism-fast-page .prism-fast-page-media img, .prism-fast-page .prism-fast-page-media svg, .prism-fast-page .prism-fast-page-media video, .prism-fast-page .prism-fast-page-media canvas) {
        max-height: min(100%, ${Math.max(180, pageImageMaxHeight - 56)}px);
      }
      :where(.prism-fast-page .prism-fast-page-media figcaption) {
        margin-top: 0.5em;
      }
      :where(.prism-fast-page img, .prism-fast-page svg, .prism-fast-page video, .prism-fast-page canvas) {
        max-width: 100%;
        max-height: ${pageImageMaxHeight}px;
        height: auto;
        object-fit: contain;
        display: block;
        margin: 0 auto;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      :where(.prism-fast-page blockquote, .prism-fast-page ul, .prism-fast-page ol, .prism-fast-page pre, .prism-fast-page table) {
        margin: 0.2em 0 1em;
        max-width: 100%;
      }
      :where(.prism-fast-page blockquote) {
        padding-left: 1em;
        border-left: 1px solid rgba(28, 27, 25, 0.16);
        font-style: italic;
      }
      :where(.prism-fast-page ul, .prism-fast-page ol) {
        padding-left: 1.1em;
      }
      :where(.prism-fast-page pre, .prism-fast-page code) {
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }
      :where(.prism-fast-page table, .prism-fast-page pre) {
        width: 100%;
        overflow-x: hidden;
      }
      :where(.prism-fast-page h1, .prism-fast-page h2, .prism-fast-page h3, .prism-fast-page h4, .prism-fast-page h5, .prism-fast-page h6) {
        margin-top: 0;
        margin-bottom: 0.7em;
        line-height: 1.14;
        letter-spacing: -0.01em;
        break-after: avoid;
        text-wrap: balance;
      }
      :where(.prism-fast-page h1) {
        font-size: 2.4em;
      }
      :where(.prism-fast-page h2) {
        font-size: 1.9em;
      }
      :where(.prism-fast-page h3) {
        font-size: 1.4em;
      }
    </style>
    <section id="prism-pagination-root">
      <article id="prism-pagination-measure-page" class="prism-fast-page"></article>
      <article class="prism-fast-page" aria-hidden="true"></article>
    </section>
  `;

  try {
    await waitForPreviewStylesheets(measurementRoot);

    const measurePage = measurementRoot.getElementById("prism-pagination-measure-page");
    if (!(measurePage instanceof HTMLElement)) {
      return fallbackPaginatePreviewBlocks(collectedBlocks, pageLimit);
    }

    const measurementDocument = measurementHost.ownerDocument;
    const paginatedPages: string[] = [];
    let currentPageBlocks: string[] = [];

    const setMeasurePage = (blocks: string[]) => {
      measurePage.innerHTML = blocks.join("\n");
    };

    const pageOverflows = () =>
      measurePage.scrollHeight > measurePage.clientHeight + 1 ||
      measurePage.scrollWidth > measurePage.clientWidth + 1;

    const createSplittableTextBlock = (blockMarkup: string) => {
      const template = measurementDocument.createElement("template");
      template.innerHTML = blockMarkup.trim();
      const blockElement = template.content.firstElementChild;

      if (!(blockElement instanceof Element) || template.content.childElementCount !== 1) {
        return null;
      }

      if (
        blockElement.matches("figure, img, svg, video, canvas, ul, ol, table, pre, hr") ||
        blockElement.querySelector("img, svg, video, canvas, table, pre, figure")
      ) {
        return null;
      }

      const normalizedText = blockElement.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (normalizedText.length < 180) {
        return null;
      }

      const words = normalizedText.split(" ").filter(Boolean);
      if (words.length < 32) {
        return null;
      }

      const serializeSlice = (startIndex: number, endIndex: number) => {
        const clone = blockElement.cloneNode(false) as HTMLElement;
        clone.textContent = words.slice(startIndex, endIndex).join(" ");
        return clone.outerHTML;
      };

      return {
        words,
        serializeSlice,
      };
    };

    const splitOversizedTextBlock = (blockMarkup: string) => {
      const splittableTextBlock = createSplittableTextBlock(blockMarkup);
      if (!splittableTextBlock) {
        return null;
      }

      const { words, serializeSlice } = splittableTextBlock;

      const splitPages: string[] = [];
      let startIndex = 0;

      while (startIndex < words.length) {
        let low = startIndex + 1;
        let high = words.length;
        let bestFit = startIndex + 1;

        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          setMeasurePage([serializeSlice(startIndex, middle)]);

          if (pageOverflows()) {
            high = middle - 1;
          } else {
            bestFit = middle;
            low = middle + 1;
          }
        }

        splitPages.push(serializeSlice(startIndex, bestFit));
        startIndex = bestFit;
      }

      return splitPages;
    };

    const splitTextBlockAcrossCurrentPage = (
      blockMarkup: string,
      leadingBlocks: string[],
    ) => {
      const splittableTextBlock = createSplittableTextBlock(blockMarkup);
      if (!splittableTextBlock) {
        return null;
      }

      const { words, serializeSlice } = splittableTextBlock;
      let low = 1;
      let high = words.length - 1;
      let bestFit = 0;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        setMeasurePage([...leadingBlocks, serializeSlice(0, middle)]);

        if (pageOverflows()) {
          high = middle - 1;
        } else {
          bestFit = middle;
          low = middle + 1;
        }
      }

      if (bestFit <= 0 || bestFit >= words.length) {
        return null;
      }

      return {
        fittingMarkup: serializeSlice(0, bestFit),
        trailingMarkup: serializeSlice(bestFit, words.length),
      };
    };

    const createMediaPageFittedBlock = (blockMarkup: string) => {
      const template = measurementDocument.createElement("template");
      template.innerHTML = blockMarkup.trim();
      const blockElement = template.content.firstElementChild;

      if (!(blockElement instanceof HTMLElement) || template.content.childElementCount !== 1) {
        return null;
      }

      const mediaSelector = "img, svg, video, canvas";
      if (blockElement.matches(mediaSelector)) {
        const wrapper = measurementDocument.createElement("figure");
        wrapper.className = "prism-fast-page-media";
        wrapper.appendChild(blockElement.cloneNode(true));
        return wrapper.outerHTML;
      }

      if (!blockElement.querySelector(mediaSelector)) {
        return null;
      }

      const clone = blockElement.cloneNode(true) as HTMLElement;
      clone.classList.add("prism-fast-page-media");
      return clone.outerHTML;
    };

    const commitPage = () => {
      if (currentPageBlocks.length === 0) return false;
      paginatedPages.push(currentPageBlocks.join("\n"));
      currentPageBlocks = [];
      setMeasurePage([]);
      return paginatedPages.length >= pageLimit;
    };

    const placeBlockOnFreshPage = (blockMarkup: string) => {
      currentPageBlocks = [blockMarkup];
      setMeasurePage(currentPageBlocks);

      if (!pageOverflows()) {
        return false;
      }

      const fittedMediaMarkup = createMediaPageFittedBlock(blockMarkup);
      if (fittedMediaMarkup) {
        currentPageBlocks = [fittedMediaMarkup];
        setMeasurePage(currentPageBlocks);

        if (!pageOverflows()) {
          return false;
        }
      }

      const splitPages = splitOversizedTextBlock(blockMarkup);
      if (!splitPages || splitPages.length === 0) {
        return commitPage();
      }

      const pagesToCommit = splitPages.slice(0, -1);
      const trailingPage = splitPages[splitPages.length - 1] ?? "";

      for (const pageMarkup of pagesToCommit) {
        paginatedPages.push(pageMarkup);
        if (paginatedPages.length >= pageLimit) {
          currentPageBlocks = [];
          setMeasurePage([]);
          return true;
        }
      }

      currentPageBlocks = trailingPage ? [trailingPage] : [];
      setMeasurePage(currentPageBlocks);

      if (currentPageBlocks.length > 0 && pageOverflows()) {
        return commitPage();
      }

      return false;
    };

    for (const blockMarkup of collectedBlocks) {
      const nextPageBlocks = [...currentPageBlocks, blockMarkup];
      setMeasurePage(nextPageBlocks);

      if (!pageOverflows()) {
        currentPageBlocks = nextPageBlocks;
        continue;
      }

      const splitAcrossCurrentPage = splitTextBlockAcrossCurrentPage(
        blockMarkup,
        currentPageBlocks,
      );
      if (splitAcrossCurrentPage) {
        currentPageBlocks = [...currentPageBlocks, splitAcrossCurrentPage.fittingMarkup];

        if (commitPage()) {
          return paginatedPages;
        }

        if (placeBlockOnFreshPage(splitAcrossCurrentPage.trailingMarkup)) {
          return paginatedPages;
        }

        continue;
      }

      if (commitPage()) {
        return paginatedPages;
      }

      if (placeBlockOnFreshPage(blockMarkup)) {
        return paginatedPages;
      }
    }

    if (currentPageBlocks.length > 0) {
      paginatedPages.push(currentPageBlocks.join("\n"));
    }

    return paginatedPages;
  } catch (error) {
    console.error("Unable to paginate EPUB preview blocks accurately.", error);
    return fallbackPaginatePreviewBlocks(collectedBlocks, pageLimit);
  } finally {
    measurementHost.remove();
  }
}

function collectReadablePreviewBlocks(root: Element) {
  const directChildren = Array.from(root.children);
  if (directChildren.length === 0) return [];

  const leafSelector =
    "h1, h2, h3, h4, h5, h6, p, blockquote, figure, img, ul, ol, pre, table, hr";
  const containerTags = new Set(["DIV", "SECTION", "ARTICLE", "MAIN", "ASIDE"]);
  const readableBlocks: Element[] = [];

  for (const child of directChildren) {
    if (child.matches(leafSelector)) {
      readableBlocks.push(child);
      continue;
    }

    if (containerTags.has(child.tagName)) {
      const nestedBlocks = collectReadablePreviewBlocks(child);
      if (nestedBlocks.length > 0) {
        readableBlocks.push(...nestedBlocks);
        continue;
      }
    }

    const textContent = child.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (textContent) {
      readableBlocks.push(child);
    }
  }

  return readableBlocks;
}

async function extractFastPreviewChunkFromEpub(
  fileBuffer: ArrayBuffer,
  {
    skipPages = 0,
    maxPages = 20,
  }: {
    skipPages?: number;
    maxPages?: number;
  } = {},
): Promise<ReaderFastPreviewChunk> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const parser = new DOMParser();

  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) {
    throw new Error("This EPUB is missing container metadata.");
  }

  const containerXml = await containerEntry.async("text");
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath =
    containerDoc.querySelector("rootfile")?.getAttribute("full-path") ?? "";

  if (!rootfilePath) {
    throw new Error("Unable to find the EPUB package file.");
  }

  const packageEntry = zip.file(rootfilePath);
  if (!packageEntry) {
    throw new Error("Unable to read the EPUB package file.");
  }

  const packageXml = await packageEntry.async("text");
  const packageDoc = parser.parseFromString(packageXml, "application/xml");
  const manifestItems = Array.from(packageDoc.querySelectorAll("manifest > item"));
  const manifestById = Object.fromEntries(
    manifestItems.map((item) => [
      item.getAttribute("id") ?? "",
      {
        href: item.getAttribute("href") ?? "",
        mediaType: item.getAttribute("media-type") ?? "",
      },
    ]),
  );
  const manifestByResolvedPath = Object.fromEntries(
    manifestItems
      .map((item) => {
        const href = item.getAttribute("href") ?? "";
        if (!href) return null;

        return [
          resolveEpubPath(getBasePath(rootfilePath), href),
          item.getAttribute("media-type") ?? "",
        ] as const;
      })
      .filter(
        (entry): entry is readonly [string, string] => Array.isArray(entry) && entry[0].length > 0,
      ),
  );

  const spineItemIds = Array.from(packageDoc.querySelectorAll("spine > itemref"))
    .map((item) => item.getAttribute("idref") ?? "")
    .filter(Boolean);

  if (spineItemIds.length === 0) {
    throw new Error("This EPUB does not contain readable spine items.");
  }

  const cleanupUrls: string[] = [];
  const stylesheetBlobCache = new Map<string, Promise<string | null>>();
  const assetBlobCache = new Map<string, Promise<string | null>>();
  const resolvedHeadEntries = new Map<string, string>();
  const packageBasePath = getBasePath(rootfilePath);

  const createBlobUrl = (buffer: ArrayBuffer | string, mimeType: string) => {
    const blobUrl = URL.createObjectURL(
      new Blob([buffer], { type: mimeType }),
    );
    cleanupUrls.push(blobUrl);
    return blobUrl;
  };

  const ensureAssetBlobUrl = async (
    assetPath: string,
    basePath: string,
    explicitMimeType?: string,
  ) => {
    if (!assetPath || isExternalAssetTarget(assetPath)) return assetPath;

    const fragment = assetPath.includes("#") ? `#${assetPath.split("#").slice(1).join("#")}` : "";
    const sanitizedAssetPath = sanitizeAssetTarget(assetPath);
    const resolvedPath = resolveEpubPath(basePath, sanitizedAssetPath);

    if (!assetBlobCache.has(resolvedPath)) {
      assetBlobCache.set(
        resolvedPath,
        (async () => {
          const assetFile = zip.file(resolvedPath);
          if (!assetFile) return null;

          const assetBuffer = await assetFile.async("arraybuffer");
          const mimeType =
            explicitMimeType || manifestByResolvedPath[resolvedPath] || getMimeType(resolvedPath);
          return createBlobUrl(assetBuffer, mimeType);
        })(),
      );
    }

    const blobUrl = await assetBlobCache.get(resolvedPath);
    return blobUrl ? `${blobUrl}${fragment}` : null;
  };

  const rewriteCssAssetUrls = async (cssText: string, cssPath: string) => {
    const cssBasePath = getBasePath(cssPath);
    const matches = Array.from(cssText.matchAll(/url\(([^)]+)\)/gi));
    const replacements = await Promise.all(
      matches.map(async (match) => {
        const rawTarget = match[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
        const nextTarget = await ensureAssetBlobUrl(rawTarget, cssBasePath);
        return {
          original: match[0],
          replacement:
            nextTarget && nextTarget !== rawTarget ? `url("${nextTarget}")` : match[0],
        };
      }),
    );

    return replacements.reduce(
      (nextCssText, replacement) =>
        nextCssText.replace(replacement.original, replacement.replacement),
      cssText,
    );
  };

  const ensureStylesheetBlobUrl = async (stylesheetPath: string, basePath: string) => {
    if (!stylesheetPath || isExternalAssetTarget(stylesheetPath)) return stylesheetPath;

    const sanitizedStylesheetPath = sanitizeAssetTarget(stylesheetPath);
    const resolvedPath = resolveEpubPath(basePath, sanitizedStylesheetPath);

    if (!stylesheetBlobCache.has(resolvedPath)) {
      stylesheetBlobCache.set(
        resolvedPath,
        (async () => {
          const stylesheetFile = zip.file(resolvedPath);
          if (!stylesheetFile) return null;

          const stylesheetText = await stylesheetFile.async("text");
          const rewrittenStylesheetText = await rewriteCssAssetUrls(
            stylesheetText,
            resolvedPath,
          );
          return createBlobUrl(rewrittenStylesheetText, "text/css");
        })(),
      );
    }

    return stylesheetBlobCache.get(resolvedPath) ?? null;
  };

  const collectedBlocks: string[] = [];

  for (const spineItemId of spineItemIds) {
    const manifestItem = manifestById[spineItemId];
    if (!manifestItem?.href) continue;

    const spineDocumentPath = resolveEpubPath(packageBasePath, manifestItem.href);
    const spineDocumentFile = zip.file(spineDocumentPath);
    if (!spineDocumentFile) continue;

    const spineDocumentMarkup = await spineDocumentFile.async("text");
    const chapterDoc = parser.parseFromString(spineDocumentMarkup, "text/html");
    const chapterBasePath = getBasePath(spineDocumentPath);
    const chapterHead = chapterDoc.head;
    const chapterBody = chapterDoc.body;

    if (!chapterBody) continue;

    const stylesheetLinks = Array.from(
      chapterHead?.querySelectorAll('link[rel~="stylesheet"][href]') ?? [],
    );
    await Promise.all(
      stylesheetLinks.map(async (link) => {
        const stylesheetTarget = link.getAttribute("href") ?? "";
        const stylesheetBlobUrl = await ensureStylesheetBlobUrl(
          stylesheetTarget,
          chapterBasePath,
        );
        if (stylesheetBlobUrl) {
          resolvedHeadEntries.set(
            `${chapterBasePath}:${stylesheetTarget}`,
            `<link rel="stylesheet" href="${stylesheetBlobUrl}" />`,
          );
        }
      }),
    );

    const inlineStyles = Array.from(chapterHead?.querySelectorAll("style") ?? []);
    const rewrittenInlineStyles = await Promise.all(
      inlineStyles.map(async (styleElement, styleIndex) => {
        const rewrittenCss = await rewriteCssAssetUrls(
          styleElement.textContent ?? "",
          spineDocumentPath,
        );
        resolvedHeadEntries.set(
          `${spineDocumentPath}:inline-style-${styleIndex}`,
          `<style>${rewrittenCss}</style>`,
        );
      }),
    );
    void rewrittenInlineStyles;

    const assetElements = Array.from(
      chapterBody.querySelectorAll<HTMLElement>(
        "img[src], source[src], video[poster], image[href], image[xlink\\:href]",
      ),
    );

    await Promise.all(
      assetElements.map(async (element) => {
        if (element instanceof HTMLImageElement) {
          const sourceTarget = element.getAttribute("src") ?? "";
          const blobUrl = await ensureAssetBlobUrl(sourceTarget, chapterBasePath);
          if (blobUrl) {
            element.setAttribute("src", blobUrl);
          }
          return;
        }

        const sourceTarget =
          element.getAttribute("src") ??
          element.getAttribute("poster") ??
          element.getAttribute("href") ??
          element.getAttribute("xlink:href") ??
          "";
        const blobUrl = await ensureAssetBlobUrl(sourceTarget, chapterBasePath);
        if (!blobUrl) return;

        if (element.hasAttribute("src")) {
          element.setAttribute("src", blobUrl);
        } else if (element.hasAttribute("poster")) {
          element.setAttribute("poster", blobUrl);
        } else if (element.hasAttribute("href")) {
          element.setAttribute("href", blobUrl);
        } else {
          element.setAttribute("xlink:href", blobUrl);
        }
      }),
    );

    const blockElements = collectReadablePreviewBlocks(chapterBody);

    if (blockElements.length === 0) {
      const bodyText = chapterBody.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!bodyText) continue;

      collectedBlocks.push(`<p>${bodyText}</p>`);
      continue;
    }

    for (const blockElement of blockElements) {
      const blockText = blockElement.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!blockText) continue;

      const normalizedBlockMarkup =
        blockElement.tagName === "IMG"
          ? `<figure>${blockElement.outerHTML}</figure>`
          : blockElement.outerHTML;

      collectedBlocks.push(normalizedBlockMarkup);
    }
  }

  const allPaginatedPages = await paginatePreviewBlocks(
    collectedBlocks,
    Array.from(resolvedHeadEntries.values()).join("\n"),
    skipPages + maxPages + 1,
  );
  const collectedPages = allPaginatedPages.slice(skipPages, skipPages + maxPages);
  const hasMore = allPaginatedPages.length > skipPages + maxPages;

  if (collectedPages.length === 0) {
    throw new Error("Unable to extract preview pages from this EPUB.");
  }

  const previewSpreads = Array.from(
    { length: Math.ceil(collectedPages.length / 2) },
    (_, spreadIndex) => {
      const leftPageMarkup = collectedPages[spreadIndex * 2] ?? "";
      const rightPageMarkup = collectedPages[spreadIndex * 2 + 1] ?? "";

      return `
        <section class="prism-fast-spread">
          <article class="prism-fast-page prism-fast-page-left">${leftPageMarkup}</article>
          <article class="prism-fast-page prism-fast-page-right">${rightPageMarkup}</article>
        </section>
      `;
    },
  );

  return {
    spreadsHtml: previewSpreads,
    cleanupUrls,
    spreadCount: Math.max(1, previewSpreads.length),
    pageCount: collectedPages.length,
    hasMore,
    headMarkup: Array.from(resolvedHeadEntries.values()).join("\n"),
  };
}

async function buildFastPreviewFromEpub(fileBuffer: ArrayBuffer): Promise<ReaderFastPreview> {
  const initialChunk = await extractFastPreviewChunkFromEpub(fileBuffer, {
    skipPages: 0,
    maxPages: 20,
  });
  const previewDocument = createFastPreviewDocument(
    initialChunk.spreadsHtml,
    initialChunk.headMarkup,
  );
  const previewUrl = URL.createObjectURL(new Blob([previewDocument], { type: "text/html" }));

  return {
    url: previewUrl,
    cleanupUrls: [...initialChunk.cleanupUrls, previewUrl],
    spreadCount: initialChunk.spreadCount,
    pageCount: initialChunk.pageCount,
  };
}

function UpdatesIcon({
  icon: Icon,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#d9ecff]">
      <Icon className="h-8 w-8 text-[#181818]" strokeWidth={1.9} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
    >
      <path
        d="M21.805 12.23c0-.7-.062-1.372-.178-2.017H12.25v3.817h5.36a4.59 4.59 0 0 1-1.992 3.013v2.5h3.223c1.886-1.736 2.964-4.294 2.964-7.313Z"
        fill="#4285F4"
      />
      <path
        d="M12.25 22c2.688 0 4.94-.892 6.586-2.42l-3.223-2.5c-.895.602-2.04.958-3.363.958-2.59 0-4.783-1.749-5.565-4.1H3.353v2.58A9.95 9.95 0 0 0 12.25 22Z"
        fill="#34A853"
      />
      <path
        d="M6.685 13.938A5.98 5.98 0 0 1 6.373 12c0-.673.116-1.326.312-1.938V7.482H3.353A9.95 9.95 0 0 0 2.25 12c0 1.602.384 3.117 1.103 4.518l3.332-2.58Z"
        fill="#FBBC04"
      />
      <path
        d="M12.25 5.962c1.463 0 2.776.503 3.81 1.49l2.857-2.857C17.186 2.99 14.934 2 12.25 2a9.95 9.95 0 0 0-8.897 5.482l3.332 2.58c.782-2.352 2.975-4.1 5.565-4.1Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState<PageView>("home");
  const [authStatus, setAuthStatus] = useState<AuthViewState>(
    firebaseAuth ? "loading" : "unauthenticated",
  );
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authActionError, setAuthActionError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [skipAuthOnLocalhost] = useState(() => {
    if (typeof window === "undefined") return false;
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  });
  const [selectedRange, setSelectedRange] =
    useState<(typeof timeRanges)[number]>("24h");
  const [comingSoonLabel, setComingSoonLabel] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [realReadingSessions, setRealReadingSessions] = useState<ReadingSession[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const storedSessions = window.localStorage.getItem(READING_SESSIONS_KEY);
      if (!storedSessions) return [];

      const parsedSessions = JSON.parse(storedSessions) as ReadingSession[];
      return Array.isArray(parsedSessions) ? parsedSessions : [];
    } catch (error) {
      console.error("Unable to parse stored reading sessions.", error);
      return [];
    }
  });
  const [openMenuBookId, setOpenMenuBookId] = useState<string | null>(null);
  const [storePromptBookId, setStorePromptBookId] = useState<string | null>(null);
  const [storeActionLoading, setStoreActionLoading] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [readerBookPreview, setReaderBookPreview] = useState<{
    title: string;
    coverUrl: string | null;
  } | null>(null);
  const [readerBookData, setReaderBookData] = useState<UploadedBookData | null>(null);
  const [readerStatus, setReaderStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [readerElapsedMs, setReaderElapsedMs] = useState(0);
  const [readerErrorMessage, setReaderErrorMessage] = useState<string | null>(null);
  const [readerAtStart, setReaderAtStart] = useState(true);
  const [readerAtEnd, setReaderAtEnd] = useState(false);
  const [readerFastPreviewUrl, setReaderFastPreviewUrl] = useState<string | null>(null);
  const [readerEngineReady, setReaderEngineReady] = useState(false);
  const [readerPreviewReady, setReaderPreviewReady] = useState(false);
  const [readerPreviewSpreadCount, setReaderPreviewSpreadCount] = useState(0);
  const [, setReaderPreviewSpreadIndex] = useState(0);
  const epubInputRef = useRef<HTMLInputElement | null>(null);
  const comingSoonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadedBookDataRef = useRef<Record<string, UploadedBookData>>({});
  const storeBookRecordPromisesRef = useRef<Record<string, Promise<UploadedBookData> | undefined>>(
    {},
  );
  const readerActiveBookIdRef = useRef<string | null>(null);
  const readerSessionStartedAtRef = useRef<number | null>(null);
  const readerSessionStartPageRef = useRef(0);
  const readerSessionCurrentPageRef = useRef(0);
  const readerSessionTotalPagesRef = useRef(0);
  const readerSessionProgressRef = useRef(0);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const readerViewportRef = useRef<HTMLDivElement | null>(null);
  const readerBookInstanceRef = useRef<EpubBookInstance | null>(null);
  const readerRenditionRef = useRef<EpubRenditionInstance | null>(null);
  const readerFastPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const readerTimerFrameRef = useRef<number | null>(null);
  const readerMountTokenRef = useRef(0);
  const readerPreviewMountTokenRef = useRef(0);
  const readerPreviewAppendTokenRef = useRef(0);
  const readerPreviewLoadedPagesRef = useRef(0);
  const readerWheelLockRef = useRef(0);
  const readerPreviewCleanupUrlsRef = useRef<string[]>([]);
  const readerPreviewSpreadIndexRef = useRef(0);
  const activeProgress = buildReadingProgress(selectedRange, books, realReadingSessions);
  const uploadedBooks = books.filter((book) => book.source === "upload");
  const addedBookIds = new Set(uploadedBooks.map((book) => book.id));
  const shouldRenderPreviewFrame = Boolean(readerFastPreviewUrl && !readerEngineReady);
  const isPreviewVisible = Boolean(
    shouldRenderPreviewFrame && readerPreviewReady,
  );
  const shouldSkipAuth = SHOULD_BYPASS_AUTH_IN_DEV || skipAuthOnLocalhost;
  const viewerName =
    authUser?.displayName?.trim() ||
    authUser?.email?.split("@")[0] ||
    cachedUser.name;
  const viewerBadge =
    viewerName
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || cachedUser.badge;
  const firstName =
    viewerName
      .split(/[.\s_-]+/)
      .filter(Boolean)[0]
      ?.replace(/^\w/, (char) => char.toUpperCase()) ?? "Reader";
  const progressPercent = Math.min(
    100,
    Math.round((activeProgress.minutes / activeProgress.goal) * 100),
  );
  const timelineChart = buildTimelineChart(selectedRange, activeProgress.bars);

  const showComingSoon = (label: string) => {
    setComingSoonLabel(label);

    if (comingSoonTimerRef.current) {
      clearTimeout(comingSoonTimerRef.current);
    }

    comingSoonTimerRef.current = setTimeout(() => {
      setComingSoonLabel(null);
    }, 1600);
  };

  const openEpubPicker = () => {
    epubInputRef.current?.click();
  };

  const resetReaderSessionTracking = useCallback(() => {
    readerActiveBookIdRef.current = null;
    readerSessionStartedAtRef.current = null;
    readerSessionStartPageRef.current = 0;
    readerSessionCurrentPageRef.current = 0;
    readerSessionTotalPagesRef.current = 0;
    readerSessionProgressRef.current = 0;
  }, []);

  const finalizeReaderSession = useCallback(() => {
    const activeBookId = readerActiveBookIdRef.current;
    const startedAt = readerSessionStartedAtRef.current;

    if (!activeBookId || startedAt === null) {
      resetReaderSessionTracking();
      return;
    }

    const elapsedMinutes = Math.floor((getHighResolutionTime() - startedAt) / 60000);
    const pagesRead = Math.max(
      0,
      readerSessionCurrentPageRef.current - readerSessionStartPageRef.current,
    );

    if (elapsedMinutes <= 0 && pagesRead <= 0) {
      resetReaderSessionTracking();
      return;
    }

    setRealReadingSessions((currentSessions) => {
      const nextSessions = [
        ...currentSessions,
        {
          bookId: activeBookId,
          date: new Date().toISOString(),
          minutes: Math.max(0, elapsedMinutes),
          pages: pagesRead,
        },
      ];

      return nextSessions.slice(-240);
    });

    resetReaderSessionTracking();
  }, [resetReaderSessionTracking]);

  const destroyReaderInstance = useCallback(() => {
    finalizeReaderSession();
    readerMountTokenRef.current += 1;
    readerPreviewMountTokenRef.current += 1;
    readerPreviewAppendTokenRef.current += 1;

    if (readerTimerFrameRef.current) {
      window.cancelAnimationFrame(readerTimerFrameRef.current);
      readerTimerFrameRef.current = null;
    }

    readerRenditionRef.current?.destroy();
    readerBookInstanceRef.current?.destroy();
    readerRenditionRef.current = null;
    readerBookInstanceRef.current = null;
    readerPreviewCleanupUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    readerPreviewCleanupUrlsRef.current = [];
  }, [finalizeReaderSession]);

  const closeReaderOverlay = useCallback(() => {
    destroyReaderInstance();
    setReaderBookPreview(null);
    setReaderBookData(null);
    setReaderElapsedMs(0);
    setReaderErrorMessage(null);
    setReaderAtStart(true);
    setReaderAtEnd(false);
    setReaderFastPreviewUrl(null);
    setReaderEngineReady(false);
    setReaderPreviewReady(false);
    setReaderPreviewSpreadCount(0);
    setReaderPreviewSpreadIndex(0);
    readerPreviewSpreadIndexRef.current = 0;
    setReaderStatus("idle");
  }, [destroyReaderInstance]);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthActionError(null);

    if (!firebaseAuth) {
      setAuthActionError("Firebase sign-in is not configured for this environment.");
      return;
    }

    setIsSigningIn(true);

    try {
      await signInWithPopup(firebaseAuth, googleAuthProvider);
    } catch (error) {
      const authError = error as { code?: string; message?: string };

      if (
        authError.code === "auth/popup-blocked" ||
        authError.code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(firebaseAuth, googleAuthProvider);
          return;
        } catch (redirectError) {
          console.error("Unable to redirect to Google sign-in.", redirectError);
        }
      }

      if (authError.code === "auth/popup-closed-by-user") {
        setIsSigningIn(false);
        return;
      }

      if (authError.code === "auth/unauthorized-domain") {
        setAuthActionError(
          "Add this local domain to Firebase Authentication authorized domains, then try again.",
        );
      } else {
        setAuthActionError("Unable to sign in with Google right now.");
      }

      console.error("Unable to sign in with Google.", error);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsProfileMenuOpen(false);
    setOpenMenuBookId(null);
    setStorePromptBookId(null);
    setSelectedRange("24h");
    setCurrentPage("home");
    closeReaderOverlay();
    setAuthActionError(null);
    setIsSigningOut(true);

    try {
      if (firebaseAuth) {
        await signOut(firebaseAuth);
      }
    } catch (error) {
      console.error("Unable to sign out.", error);
    } finally {
      setIsSigningOut(false);
    }
  }, [closeReaderOverlay]);

  const ensureStoreBookRecord = useCallback(async (storeBookId: string) => {
    const storeBook = storeBooks.find((book) => book.id === storeBookId);
    if (!storeBook) {
      throw new Error("This bundled bookstore book is unavailable.");
    }

    const cachedRecord =
      uploadedBookDataRef.current[storeBookId] ?? (await loadUploadedBookRecord(storeBookId));
    if (cachedRecord) {
      const normalizedRecord: UploadedBookData = {
        ...cachedRecord,
        title: storeBook.title,
        author: storeBook.author,
        coverUrl: storeBook.coverUrl,
        fileName: storeBook.fileName,
        fileSize: cachedRecord.fileSize || storeBook.fileSize,
        spine: cachedRecord.spine.length > 0 ? cachedRecord.spine : [...storeBook.spine],
      };

      uploadedBookDataRef.current[storeBookId] = normalizedRecord;
      if (
        cachedRecord.title !== normalizedRecord.title ||
        cachedRecord.author !== normalizedRecord.author ||
        cachedRecord.coverUrl !== normalizedRecord.coverUrl ||
        cachedRecord.fileName !== normalizedRecord.fileName ||
        cachedRecord.fileSize !== normalizedRecord.fileSize ||
        cachedRecord.spine.length !== normalizedRecord.spine.length
      ) {
        await saveUploadedBookRecord(normalizedRecord);
      }

      return normalizedRecord;
    }

    const existingPromise = storeBookRecordPromisesRef.current[storeBookId];
    if (existingPromise) {
      return existingPromise;
    }

    const nextPromise = (async () => {
      const response = await fetch(storeBook.path);
      if (!response.ok) {
        throw new Error("Unable to fetch the bundled EPUB.");
      }

      const rawFile = await response.arrayBuffer();
      const storedRecord: UploadedBookData = {
        bookId: storeBook.id,
        title: storeBook.title,
        author: storeBook.author,
        coverUrl: storeBook.coverUrl,
        fileName: storeBook.fileName,
        fileSize: storeBook.fileSize || rawFile.byteLength,
        uploadedAt: new Date().toISOString(),
        rawFile,
        spine: [...storeBook.spine],
      };

      uploadedBookDataRef.current[storeBook.id] = storedRecord;
      await saveUploadedBookRecord(storedRecord);
      return storedRecord;
    })();

    storeBookRecordPromisesRef.current[storeBookId] = nextPromise;

    try {
      return await nextPromise;
    } finally {
      delete storeBookRecordPromisesRef.current[storeBookId];
    }
  }, []);

  const syncPreviewNavigationState = useCallback(
    (iframeElement?: HTMLIFrameElement | null) => {
      const previewIframe = iframeElement ?? readerFastPreviewIframeRef.current;
      const previewWindow = previewIframe?.contentWindow;
      const previewDocument = previewWindow?.document;
      if (!previewWindow || !previewDocument) return;

      const previewTrack = previewDocument.getElementById("prism-preview-track");
      const scrollingElement =
        previewTrack ??
        previewDocument.scrollingElement ??
        previewDocument.documentElement ??
        previewDocument.body;
      const viewportWidth =
        previewTrack?.clientWidth || previewWindow.innerWidth || previewIframe?.clientWidth || 1;
      const totalSpreads = Math.max(
        1,
        Math.round((scrollingElement.scrollWidth || viewportWidth) / viewportWidth),
      );
      const currentIndex = Math.max(
        0,
        Math.min(
          totalSpreads - 1,
          Math.round((scrollingElement.scrollLeft || previewWindow.scrollX || 0) / viewportWidth),
        ),
      );

      readerPreviewSpreadIndexRef.current = currentIndex;
      setReaderPreviewSpreadCount(totalSpreads);
      setReaderPreviewSpreadIndex(currentIndex);
      setReaderAtStart(currentIndex === 0);
      setReaderAtEnd(currentIndex >= totalSpreads - 1);
    },
    [],
  );

  const goToPreviewSpread = useCallback(
    (targetIndex: number) => {
      const previewIframe = readerFastPreviewIframeRef.current;
      const previewWindow = previewIframe?.contentWindow;
      const previewDocument = previewWindow?.document;
      if (!previewIframe || !previewWindow || !previewDocument) return;

      const previewTrack = previewDocument.getElementById("prism-preview-track");
      const scrollingElement =
        previewTrack ??
        previewDocument.scrollingElement ??
        previewDocument.documentElement ??
        previewDocument.body;
      const viewportWidth =
        previewTrack?.clientWidth || previewWindow.innerWidth || previewIframe.clientWidth || 1;
      const totalSpreads =
        readerPreviewSpreadCount ||
        Math.max(1, Math.round((scrollingElement.scrollWidth || viewportWidth) / viewportWidth));
      const nextIndex = Math.max(0, Math.min(totalSpreads - 1, targetIndex));

      scrollingElement.scrollTo({
        left: nextIndex * viewportWidth,
        top: 0,
        behavior: "smooth",
      });

      window.setTimeout(() => {
        syncPreviewNavigationState(previewIframe);
      }, 220);
    },
    [readerPreviewSpreadCount, syncPreviewNavigationState],
  );

  const goToPreviousReaderSpread = useCallback(async () => {
    if (isPreviewVisible) {
      goToPreviewSpread(readerPreviewSpreadIndexRef.current - 1);
      return;
    }

    try {
      const rendition = readerRenditionRef.current;
      if (!rendition || typeof rendition.prev !== "function") return;
      await rendition.prev();
    } catch (error) {
      console.error("Unable to go to previous EPUB page.", error);
    }
  }, [goToPreviewSpread, isPreviewVisible]);

  const goToNextReaderSpread = useCallback(async () => {
    if (isPreviewVisible) {
      goToPreviewSpread(readerPreviewSpreadIndexRef.current + 1);
      return;
    }

    try {
      const rendition = readerRenditionRef.current;
      if (!rendition || typeof rendition.next !== "function") return;
      await rendition.next();
    } catch (error) {
      console.error("Unable to go to next EPUB page.", error);
    }
  }, [goToPreviewSpread, isPreviewVisible]);

  const handleReaderWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 28) {
      return;
    }

    event.preventDefault();

    const now = window.performance.now();
    if (now - readerWheelLockRef.current < 420) return;
    readerWheelLockRef.current = now;

    if (event.deltaX > 0) {
      void goToNextReaderSpread();
    } else {
      void goToPreviousReaderSpread();
    }
  };

  const updateReaderLocation = (location: EpubLocation | null | undefined) => {
    if (!location) return;

    setReaderAtStart(Boolean(location.atStart));
    setReaderAtEnd(Boolean(location.atEnd));

    const activeBookId = readerActiveBookIdRef.current;
    if (!activeBookId) return;

    const readerBook = readerBookInstanceRef.current as
      | (EpubBookInstance & {
          locations?: {
            total?: number;
            length?: () => number;
          };
        })
      | null;
    const totalPages =
      (typeof readerBook?.locations?.total === "number" ? readerBook.locations.total : 0) ||
      (typeof readerBook?.locations?.length === "function" ? readerBook.locations.length() : 0) ||
      0;
    const locationIndex =
      typeof location.start?.location === "number"
        ? location.start.location
        : typeof location.end?.location === "number"
          ? location.end.location
          : -1;
    const displayedPage =
      typeof location.start?.displayed?.page === "number" ? location.start.displayed.page : 0;
    const nextCurrentPage =
      locationIndex >= 0
        ? locationIndex + 1
        : displayedPage > 0
          ? displayedPage
          : readerSessionCurrentPageRef.current;
    const nextTotalPages =
      totalPages > 0
        ? totalPages
        : typeof location.start?.displayed?.total === "number"
          ? location.start.displayed.total
          : readerSessionTotalPagesRef.current;
    const nextProgress =
      nextTotalPages > 0
        ? Math.max(0, Math.min(100, Math.round((nextCurrentPage / nextTotalPages) * 100)))
        : readerSessionProgressRef.current;

    readerSessionCurrentPageRef.current = nextCurrentPage;
    readerSessionTotalPagesRef.current = nextTotalPages;
    readerSessionProgressRef.current = nextProgress;

    setBooks((currentBooks) =>
      currentBooks.map((book) =>
        book.id === activeBookId
          ? {
              ...book,
              currentPage: nextCurrentPage,
              totalPages: nextTotalPages,
              progress: nextProgress,
              status: nextProgress >= 100 ? "finished" : "reading",
            }
          : book,
      ),
    );
  };

  const openBookReader = async (book: Book) => {
    if (book.uploadStatus !== "ready") return;

    destroyReaderInstance();
    const loadStartedAt = getHighResolutionTime();
    const preview = {
      title: book.title,
      coverUrl: book.coverUrl ?? null,
    };

    setOpenMenuBookId(null);
    setReaderBookPreview(preview);
    setReaderBookData(null);
    setReaderElapsedMs(0);
    setReaderErrorMessage(null);
    setReaderAtStart(true);
    setReaderAtEnd(false);
    setReaderFastPreviewUrl(null);
    setReaderEngineReady(false);
    setReaderPreviewReady(false);
    setReaderPreviewSpreadCount(0);
    setReaderPreviewSpreadIndex(0);
    readerPreviewSpreadIndexRef.current = 0;
    readerPreviewLoadedPagesRef.current = 0;
    readerActiveBookIdRef.current = book.id;
    readerSessionStartedAtRef.current = getHighResolutionTime();
    readerSessionStartPageRef.current = book.currentPage;
    readerSessionCurrentPageRef.current = book.currentPage;
    readerSessionTotalPagesRef.current = book.totalPages;
    readerSessionProgressRef.current = book.progress;
    setReaderStatus("loading");

    const tickElapsed = () => {
      setReaderElapsedMs(getHighResolutionTime() - loadStartedAt);
      readerTimerFrameRef.current = window.requestAnimationFrame(tickElapsed);
    };

    readerTimerFrameRef.current = window.requestAnimationFrame(tickElapsed);

    try {
      const uploadedRecord =
        uploadedBookDataRef.current[book.id] ??
        (await loadUploadedBookRecord(book.id)) ??
        (storeBooks.some((storeBook) => storeBook.id === book.id)
          ? await ensureStoreBookRecord(book.id)
          : null);

      if (!uploadedRecord) {
        throw new Error("This book is no longer available in local storage.");
      }

      uploadedBookDataRef.current[book.id] = uploadedRecord;
      setReaderBookPreview({
        title: uploadedRecord.title,
        coverUrl: uploadedRecord.coverUrl,
      });
      setReaderBookData(uploadedRecord);
    } catch (error) {
      resetReaderSessionTracking();
      if (readerTimerFrameRef.current) {
        window.cancelAnimationFrame(readerTimerFrameRef.current);
        readerTimerFrameRef.current = null;
      }

      setReaderStatus("error");
      setReaderErrorMessage(
        error instanceof Error ? error.message : "Unable to open this book right now.",
      );
    }
  };

  const removeUploadedBook = async (bookId: string) => {
    setBooks((currentBooks) => currentBooks.filter((book) => book.id !== bookId));
    delete uploadedBookDataRef.current[bookId];
    setOpenMenuBookId(null);

    try {
      await removeUploadedBookRecord(bookId);
    } catch (error) {
      console.error("Unable to remove uploaded book from local storage.", error);
    }
  };

  const addStoreBookToReadingList = async (storeBookId: string) => {
    if (storeActionLoading) return;

    const selectedStoreBook = storeBooks.find((book) => book.id === storeBookId);
    if (!selectedStoreBook) return;

    const existingBook = books.find((book) => book.id === selectedStoreBook.id);
    if (existingBook) {
      setStorePromptBookId(null);
      setCurrentPage("read");
      void ensureStoreBookRecord(selectedStoreBook.id).catch((error) => {
        console.error("Unable to warm bundled bookstore book.", error);
      });
      return;
    }

    setStoreActionLoading(storeBookId);

    try {
      setBooks((currentBooks) =>
        mergeBooks(currentBooks, [
          {
            id: selectedStoreBook.id,
            title: selectedStoreBook.title,
            author: selectedStoreBook.author,
            progress: 0,
            totalPages: selectedStoreBook.spine.length,
            currentPage: 0,
            status: "reading",
            coverUrl: selectedStoreBook.coverUrl,
            source: "upload",
            uploadStatus: "ready",
            uploadProgress: 100,
            uploadLoadedBytes: selectedStoreBook.fileSize,
            uploadTotalBytes: selectedStoreBook.fileSize,
            errorMessage: null,
          },
        ]),
      );

      setStorePromptBookId(null);
      setCurrentPage("read");
      void ensureStoreBookRecord(selectedStoreBook.id).catch((error) => {
        console.error("Unable to save bundled bookstore book.", error);
      });
    } catch (error) {
      console.error("Unable to add bundled bookstore book.", error);
    } finally {
      setStoreActionLoading(null);
    }
  };

  const handleEpubSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const bookId = createUploadedBookId(file.name);

    setBooks((currentBooks) => [
      {
        id: bookId,
        title: file.name.replace(/\.epub$/i, ""),
        author: "Preparing upload...",
        progress: 0,
        totalPages: 0,
        currentPage: 0,
        status: "reading",
        source: "upload",
        uploadStatus: "uploading",
        uploadProgress: 0,
        uploadLoadedBytes: 0,
        uploadTotalBytes: file.size,
        errorMessage: null,
      },
      ...currentBooks,
    ]);

    try {
      const fileBuffer = await readFileWithProgress(file, (loadedBytes, totalBytes) => {
        const nextProgress = Math.min(98, Math.round((loadedBytes / totalBytes) * 100));

        setBooks((currentBooks) =>
          currentBooks.map((book) =>
            book.id === bookId
              ? {
                  ...book,
                  uploadStatus: "uploading",
                  uploadProgress: nextProgress,
                  uploadLoadedBytes: loadedBytes,
                  uploadTotalBytes: totalBytes,
                }
              : book,
          ),
        );
      });

      const parsedBook = await parseEpubFile(file, fileBuffer);

      const uploadedBookRecord: UploadedBookData = {
        bookId,
        title: parsedBook.title,
        author: parsedBook.author,
        coverUrl: parsedBook.coverUrl,
        fileName: parsedBook.fileName,
        fileSize: parsedBook.fileSize,
        uploadedAt: parsedBook.uploadedAt,
        rawFile: parsedBook.rawFile,
        spine: parsedBook.spine,
      };
      uploadedBookDataRef.current[bookId] = uploadedBookRecord;
      await saveUploadedBookRecord(uploadedBookRecord);

      setBooks((currentBooks) =>
        currentBooks.map((book) =>
          book.id === bookId
            ? {
                ...book,
                title: parsedBook.title,
                author: parsedBook.author,
                coverUrl: parsedBook.coverUrl,
                uploadStatus: "ready",
                uploadProgress: 100,
                uploadLoadedBytes: file.size,
                uploadTotalBytes: file.size,
                errorMessage: null,
              }
            : book,
        ),
      );
    } catch (error) {
      console.error(error);

      setBooks((currentBooks) =>
        currentBooks.map((book) =>
          book.id === bookId
            ? {
                ...book,
                uploadStatus: "error",
                errorMessage: "Upload failed",
              }
            : book,
        ),
      );
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    void loadFirebaseAnalytics();

    if (!firebaseAuth) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setAuthUser(nextUser);
      setAuthStatus(nextUser ? "authenticated" : "unauthenticated");
      setIsSigningIn(false);
      setIsSigningOut(false);
      setAuthActionError(null);
      setIsProfileMenuOpen(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!shouldSkipAuth && authStatus !== "authenticated") return;

    storeBooks.forEach((storeBook) => {
      void ensureStoreBookRecord(storeBook.id).catch((error) => {
        console.error("Unable to pre-cache bundled bookstore book.", error);
      });
    });
  }, [authStatus, ensureStoreBookRecord, shouldSkipAuth]);

  useEffect(() => {
    const storedSummaries = window.localStorage.getItem(UPLOADED_BOOK_SUMMARIES_KEY);
    if (storedSummaries) {
      try {
        const parsedSummaries = JSON.parse(storedSummaries) as Book[];
        window.requestAnimationFrame(() => {
          setBooks((currentBooks) => mergeBooks(currentBooks, parsedSummaries));
        });
      } catch (error) {
        console.error("Unable to parse stored book summaries.", error);
      }
    }

    loadUploadedBookRecords()
      .then((records) => {
        const normalizedRecords = records.map((record) => ({
          bookId: record.bookId,
          title: record.title,
          author: record.author,
          coverUrl: record.coverUrl,
          fileName: record.fileName,
          fileSize: record.fileSize,
          uploadedAt: record.uploadedAt,
          rawFile: record.rawFile,
          spine: record.spine,
        }));
        const uploadedBooksFromStorage: Book[] = records.map((record) => ({
          id: record.bookId,
          title: storeBooks.find((storeBook) => storeBook.id === record.bookId)?.title ?? record.title,
          author:
            storeBooks.find((storeBook) => storeBook.id === record.bookId)?.author ??
            record.author,
          progress: 0,
          totalPages:
            storeBooks.find((storeBook) => storeBook.id === record.bookId)?.spine.length ??
            record.spine.length,
          currentPage: 0,
          status: "reading",
          coverUrl:
            storeBooks.find((storeBook) => storeBook.id === record.bookId)?.coverUrl ??
            record.coverUrl,
          source: "upload",
          uploadStatus: "ready",
          uploadProgress: 100,
          uploadLoadedBytes:
            storeBooks.find((storeBook) => storeBook.id === record.bookId)?.fileSize ??
            record.fileSize,
          uploadTotalBytes:
            storeBooks.find((storeBook) => storeBook.id === record.bookId)?.fileSize ??
            record.fileSize,
          errorMessage: null,
        }));

        uploadedBookDataRef.current = Object.fromEntries(
          normalizedRecords.map((record) => [record.bookId, record]),
        );
        setBooks((currentBooks) => mergeBooks(currentBooks, uploadedBooksFromStorage));

        void Promise.all(
          normalizedRecords.map((record) => saveUploadedBookRecord(record)),
        ).catch((error) => {
          console.error("Unable to normalize stored uploaded books.", error);
        });
      })
      .catch((error) => {
        console.error("Unable to restore uploaded books.", error);
      });
  }, []);

  useEffect(() => {
    const uploadedSummaries = books.filter(
      (book) => book.source === "upload" && book.uploadStatus === "ready",
    );

    window.localStorage.setItem(
      UPLOADED_BOOK_SUMMARIES_KEY,
      JSON.stringify(uploadedSummaries),
    );
  }, [books]);

  useEffect(() => {
    window.localStorage.setItem(
      READING_SESSIONS_KEY,
      JSON.stringify(realReadingSessions),
    );
  }, [realReadingSessions]);

  useEffect(() => {
    return () => {
      if (comingSoonTimerRef.current) {
        clearTimeout(comingSoonTimerRef.current);
      }
      destroyReaderInstance();
    };
  }, [destroyReaderInstance]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (profileMenuRef.current?.contains(event.target as Node)) return;
      setIsProfileMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (readerStatus !== "loading" || !readerBookData) return;

    const mountToken = readerPreviewMountTokenRef.current + 1;
    readerPreviewMountTokenRef.current = mountToken;

    void (async () => {
      try {
        const preview = await buildFastPreviewFromEpub(readerBookData.rawFile);
        if (readerPreviewMountTokenRef.current !== mountToken) {
          preview.cleanupUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        readerPreviewCleanupUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        readerPreviewCleanupUrlsRef.current = preview.cleanupUrls;
        setReaderFastPreviewUrl(preview.url);
        setReaderPreviewReady(false);
        setReaderPreviewSpreadCount(preview.spreadCount);
        setReaderPreviewSpreadIndex(0);
        readerPreviewSpreadIndexRef.current = 0;
        readerPreviewLoadedPagesRef.current = preview.pageCount;
        setReaderAtStart(true);
        setReaderAtEnd(preview.spreadCount <= 1);

        if (readerTimerFrameRef.current) {
          window.cancelAnimationFrame(readerTimerFrameRef.current);
          readerTimerFrameRef.current = null;
        }

        setReaderStatus("ready");
      } catch (error) {
        console.error("Unable to prepare the fast EPUB preview.", error);
      }
    })();
  }, [readerBookData, readerStatus]);

  useEffect(() => {
    if (!readerBookData || !readerFastPreviewUrl || !readerPreviewReady) return;

    const appendToken = readerPreviewAppendTokenRef.current + 1;
    readerPreviewAppendTokenRef.current = appendToken;
    let cancelled = false;

    const appendNextPreviewChunk = async () => {
      try {
        const nextChunk = await extractFastPreviewChunkFromEpub(readerBookData.rawFile, {
          skipPages: readerPreviewLoadedPagesRef.current,
          maxPages: 4,
        });

        if (cancelled || readerPreviewAppendTokenRef.current !== appendToken) {
          nextChunk.cleanupUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        if (nextChunk.pageCount === 0) {
          nextChunk.cleanupUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        readerPreviewCleanupUrlsRef.current.push(...nextChunk.cleanupUrls);
        readerPreviewLoadedPagesRef.current += nextChunk.pageCount;

        const previewTrack =
          readerFastPreviewIframeRef.current?.contentDocument?.getElementById("prism-preview-track");
        const previewHead = readerFastPreviewIframeRef.current?.contentDocument?.head;
        if (previewHead && nextChunk.headMarkup) {
          previewHead.insertAdjacentHTML("beforeend", nextChunk.headMarkup);
        }

        if (previewTrack) {
          previewTrack.insertAdjacentHTML("beforeend", nextChunk.spreadsHtml.join("\n"));
        }

        setReaderPreviewSpreadCount((currentCount) => {
          const nextCount = currentCount + nextChunk.spreadCount;
          const currentIndex = readerPreviewSpreadIndexRef.current;
          setReaderAtEnd(currentIndex >= nextCount - 1);
          return nextCount;
        });

        if (nextChunk.hasMore) {
          window.setTimeout(() => {
            void appendNextPreviewChunk();
          }, 0);
        }
      } catch (error) {
        if (cancelled || readerPreviewAppendTokenRef.current !== appendToken) return;
        console.error("Unable to extend fast EPUB preview in the background.", error);
      }
    };

    void appendNextPreviewChunk();

    return () => {
      cancelled = true;
    };
  }, [readerBookData, readerFastPreviewUrl, readerPreviewReady]);

  useEffect(() => {
    if (!readerBookData || !readerViewportRef.current) {
      return;
    }

    const viewportElement = readerViewportRef.current;
    const mountToken = readerMountTokenRef.current + 1;
    readerMountTokenRef.current = mountToken;

    void (async () => {
      try {
        const epubModule = await import("epubjs/lib/index.js");
        if (readerMountTokenRef.current !== mountToken || !viewportElement) return;
        let initialSpreadIsVisible = false;

        const ePubFactory = epubModule.default;
        const book = ePubFactory(readerBookData.rawFile, {
          encoding: "binary",
          openAs: "epub",
          replacements: "blobUrl",
        });

        readerBookInstanceRef.current = book;

        const rendition = book.renderTo(viewportElement, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "always",
          minSpreadWidth: 960,
        });

        readerRenditionRef.current = rendition;
        viewportElement.style.width = "100%";
        viewportElement.style.height = "100%";
        viewportElement.style.overflow = "hidden";

        const revealReader = () => {
          if (initialSpreadIsVisible || readerMountTokenRef.current !== mountToken) return;

          initialSpreadIsVisible = true;
          const syncAndReveal = async () => {
            const previewSpreadIndex = readerPreviewSpreadIndexRef.current;
            if (previewSpreadIndex > 0) {
              for (let step = 0; step < previewSpreadIndex; step += 1) {
                // Keep engine position aligned with the preview before revealing it.
                // This avoids snapping back to the opening spread when the background engine finishes.
                await rendition.next();
              }
            }

            if (readerMountTokenRef.current !== mountToken) return;
            setReaderEngineReady(true);
          };

          void syncAndReveal().catch((error) => {
            console.error("Unable to align EPUB rendition with preview spread.", error);
            if (readerMountTokenRef.current !== mountToken) return;
            setReaderEngineReady(true);
          });

          if (readerTimerFrameRef.current) {
            window.cancelAnimationFrame(readerTimerFrameRef.current);
            readerTimerFrameRef.current = null;
          }

          setReaderStatus("ready");
        };

        rendition.themes.default({
          body: {
            background: "#ffffff",
            margin: "0",
            "padding-top": "28px",
            "padding-bottom": "32px",
            "padding-left": "48px",
            "padding-right": "48px",
            "box-sizing": "border-box",
          },
        });

        rendition.on("relocated", (location: EpubLocation) => {
          updateReaderLocation(location);
          revealReader();
        });

        rendition.on("rendered", () => {
          revealReader();
        });

        rendition.hooks.content.register((contents: { document: Document }) => {
          contents.document.documentElement.style.background = "#ffffff";
          contents.document.documentElement.style.maxWidth = "100%";
          contents.document.documentElement.style.overflowX = "hidden";
          contents.document.documentElement.style.boxSizing = "border-box";
          contents.document.body.style.background = "#ffffff";
          contents.document.body.style.maxWidth = "100%";
          contents.document.body.style.overflowX = "hidden";
          contents.document.body.style.boxSizing = "border-box";

          const existingStyle = contents.document.getElementById("prism-reader-fit-style");
          existingStyle?.remove();

          const fitStyle = contents.document.createElement("style");
          fitStyle.id = "prism-reader-fit-style";
          fitStyle.textContent = `
            *, *::before, *::after {
              box-sizing: border-box !important;
            }

            html, body {
              max-width: 100%;
              overflow-x: hidden;
              background: #ffffff;
            }

            :where(body) {
              color: #1c1b19;
              font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
              font-size: 17px;
              line-height: 1.4;
              letter-spacing: 0;
              text-rendering: optimizeLegibility;
              -webkit-font-smoothing: antialiased;
              hyphens: auto;
              -webkit-hyphens: auto;
            }

            :where(img, svg, video, canvas, table, pre, iframe) {
              max-width: 100% !important;
            }

            :where(table, pre) {
              overflow-x: hidden;
            }

            :where(p) {
              margin: 0 0 0.72em;
              text-wrap: pretty;
              orphans: 2;
              widows: 2;
            }

            :where(figure) {
              margin: 0.15em 0 1em;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            :where(.prism-fast-page-media) {
              display: grid;
              grid-template-rows: minmax(0, 1fr) auto;
              align-items: center;
              max-height: 100%;
              height: 100%;
              min-height: 0;
              overflow: hidden;
              margin: 0.1em 0 0.8em;
            }

            :where(figcaption) {
              margin-top: 0.72em;
              font-size: 0.84em;
              line-height: 1.35;
              text-align: center;
              color: #7d7d80;
              font-style: italic;
            }

            :where(.prism-fast-page-media > img, .prism-fast-page-media > svg, .prism-fast-page-media > video, .prism-fast-page-media > canvas) {
              width: 100%;
              max-height: 100%;
              min-height: 0;
            }

            :where(.prism-fast-page-media img, .prism-fast-page-media svg, .prism-fast-page-media video, .prism-fast-page-media canvas) {
              max-height: min(100%, 30vh);
            }

            :where(.prism-fast-page-media figcaption) {
              margin-top: 0.5em;
            }

            :where(img, svg, video, canvas) {
              max-height: 34vh;
              height: auto;
              object-fit: contain;
              display: block;
              margin: 0 auto;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            :where(blockquote, ul, ol, pre, table) {
              margin: 0.15em 0 0.95em;
              max-width: 100%;
            }

            :where(blockquote) {
              padding-left: 1em;
              border-left: 1px solid rgba(28, 27, 25, 0.16);
              font-style: italic;
            }

            :where(ul, ol) {
              padding-left: 1.1em;
            }

            :where(pre, code) {
              white-space: pre-wrap !important;
              word-break: break-word !important;
            }

            :where(h1, h2, h3, h4, h5, h6) {
              margin-top: 0;
              margin-bottom: 0.7em;
              line-height: 1.14;
              letter-spacing: -0.01em;
              text-wrap: balance;
            }

            :where(h1) {
              font-size: 2.4em;
            }

            :where(h2) {
              font-size: 1.9em;
            }

            :where(h3) {
              font-size: 1.4em;
            }

            :where(a) {
              color: inherit;
              text-decoration-color: rgba(28, 27, 25, 0.28);
              text-underline-offset: 0.15em;
            }

            :where(hr) {
              margin: 1.35em auto;
              width: 22%;
              border: 0;
              border-top: 1px solid rgba(28, 27, 25, 0.12);
            }

            ::selection {
              background: rgba(255, 221, 87, 0.72);
            }
          `;

          contents.document.head.appendChild(fitStyle);
        });

        await rendition.display();
        if (readerMountTokenRef.current !== mountToken) return;
        revealReader();

        window.setTimeout(() => {
          void book.locations
            .generate(1400)
            .then(() => {
              if (readerMountTokenRef.current !== mountToken) return;
              const currentLocation = rendition.location;
              if (currentLocation) {
                updateReaderLocation(currentLocation);
              }
            })
            .catch((error: unknown) => {
              console.error("Unable to generate EPUB locations.", error);
            });
        }, 0);
      } catch (error) {
        if (readerMountTokenRef.current !== mountToken) return;

        if (readerTimerFrameRef.current) {
          window.cancelAnimationFrame(readerTimerFrameRef.current);
          readerTimerFrameRef.current = null;
        }

        setReaderStatus("error");
        setReaderErrorMessage(
          error instanceof Error ? error.message : "Unable to render this EPUB right now.",
        );
      }
    })();

    return () => {
      if (readerMountTokenRef.current === mountToken) {
        destroyReaderInstance();
      }
    };
  }, [readerBookData, destroyReaderInstance]);

  useEffect(() => {
    if (readerStatus === "idle") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReaderOverlay();
        return;
      }

      if (readerStatus !== "ready") return;

      if (event.key === "ArrowRight") {
        void goToNextReaderSpread();
      }

      if (event.key === "ArrowLeft") {
        void goToPreviousReaderSpread();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readerStatus, closeReaderOverlay, goToNextReaderSpread, goToPreviousReaderSpread]);

  if (!shouldSkipAuth && authStatus !== "authenticated") {
    const isCheckingSession = authStatus === "loading";

    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="flex w-full max-w-[360px] flex-col items-center text-center">
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={isCheckingSession || isSigningIn}
            className="flex min-h-11 w-full items-center justify-center gap-3 rounded-[1rem] border border-[#dbdbde] bg-white px-4 py-3 text-[0.92rem] font-medium tracking-[-0.02em] text-[#171717] transition-colors hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingSession || isSigningIn ? (
              <LoaderCircle className="h-5 w-5 animate-spin" strokeWidth={1.9} />
            ) : (
              <GoogleIcon />
            )}
            <span>
              {isCheckingSession
                ? "Loading..."
                : isSigningIn
                  ? "Signing in..."
                  : "Sign in with Google"}
            </span>
          </button>

          {authActionError ? (
            <p className="mt-4 text-[0.82rem] font-medium tracking-[-0.01em] text-[#b55151]">
              {authActionError}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f5f5f3] text-[#151515]">
      <div className="grid h-screen w-full grid-cols-[192px_minmax(0,1fr)]">
        <aside className="flex h-screen flex-col overflow-hidden bg-[#f3f3f1]">
          <div className="px-5 pb-6 pt-5">
            <h1 className="text-[1.82rem] font-semibold tracking-[-0.075em] text-[#111111]">
              Prism
            </h1>
          </div>

          <div className="visible-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5">
              <nav aria-label="Sidebar" className="space-y-2">
                <div>
                  <SidebarButton
                    label="Home"
                    active={currentPage === "home"}
                    icon={Home}
                    onClick={() => setCurrentPage("home")}
                  />
                </div>

                <div>
                  <SidebarButton
                    label="Books Store"
                    active={currentPage === "store"}
                    icon={Store}
                    onClick={() => setCurrentPage("store")}
                  />
                </div>

                <div className="space-y-0.5">
                  <p className="px-4 pb-0.5 text-[0.76rem] font-medium text-[#999999]">
                    Library
                  </p>
                  {libraryItems.map(({ label, icon }) => (
                    <SidebarButton
                      key={label}
                      label={label}
                      icon={icon}
                      active={
                        currentPage === "read" && label === "Read"
                      }
                      onClick={
                        label === "Read"
                          ? () => setCurrentPage("read")
                          : () => showComingSoon(label)
                      }
                      badge={comingSoonLabel === label ? "Coming soon" : null}
                    />
                  ))}
                </div>

                <div className="space-y-0.5">
                  <p className="px-4 pb-0.5 text-[0.76rem] font-medium text-[#999999]">
                    My Collections
                  </p>
                  {uploadedBooks.length > 0 ? (
                    <div className="space-y-2">
                      {uploadedBooks.map((book) => (
                          <div
                            key={book.id}
                            className={`rounded-[1rem] border px-4 py-3 transition-colors ${
                              book.uploadStatus === "ready"
                                ? "cursor-pointer border-[#dfdfdb] bg-white/60 hover:bg-white"
                                : "border-[#dfdfdb] bg-white/60"
                            }`}
                            onClick={
                              book.uploadStatus === "ready"
                                ? () => void openBookReader(book)
                                : undefined
                            }
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem] bg-[#ececea]">
                                {book.coverUrl ? (
                                  <Image
                                    src={book.coverUrl}
                                    alt={`${book.title} cover`}
                                    width={40}
                                    height={48}
                                    unoptimized
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <BookOpen
                                    className="h-4.5 w-4.5 text-[#2c2c2c]"
                                    strokeWidth={2}
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[0.8rem] font-medium text-[#1e1e1e]">
                                  {book.title}
                                </p>
                                {book.uploadStatus === "uploading" ? (
                                  <div className="mt-1">
                                    <p className="text-[0.72rem] text-[#7b7b7b]">
                                      Uploading...
                                    </p>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ececea]">
                                      <div
                                        className="h-full rounded-full bg-[#7f56d9] transition-all duration-200"
                                        style={{ width: `${book.uploadProgress ?? 0}%` }}
                                      />
                                    </div>
                                    <p className="mt-1 text-[0.68rem] text-[#9a9a9a]">
                                      {formatStorageProgress(
                                        book.uploadLoadedBytes,
                                        book.uploadTotalBytes,
                                      )}
                                    </p>
                                  </div>
                                ) : book.uploadStatus === "error" ? (
                                  <p className="mt-1 text-[0.72rem] text-[#b55151]">
                                    {book.errorMessage}
                                  </p>
                                ) : (
                                  <>
                                    <p className="mt-1 text-[0.72rem] text-[#7b7b7b]">
                                      Added to collection
                                    </p>
                                    <p className="mt-0.5 text-[0.72rem] text-[#9a9a9a]">
                                      {book.author}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
              </nav>
          </div>

          <div className="px-4 py-3">
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                aria-expanded={isProfileMenuOpen}
                aria-controls="sidebar-profile-menu"
                onClick={() => setIsProfileMenuOpen((currentValue) => !currentValue)}
                className="flex min-h-10 w-full items-center gap-2 rounded-[1rem] px-2 text-left transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              >
                <div className="relative h-9 w-9 shrink-0 rounded-full border border-[#d3d3cf] bg-[radial-gradient(circle_at_30%_30%,#4f7dc0,transparent_38%),linear-gradient(180deg,#e8dcc4_0%,#c78d52_40%,#3a2d27_75%,#1d1d1d_100%)]">
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#1d1d1d] px-1.5 py-[1px] text-[0.5rem] font-semibold uppercase tracking-[0.02em] text-white">
                    {viewerBadge}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-[0.82rem] font-medium tracking-[-0.02em] text-[#4b4b4b]">
                    {viewerName}
                  </span>
                </div>
              </button>

              <div
                id="sidebar-profile-menu"
                className={`overflow-hidden transition-[max-height,opacity,transform,margin] duration-200 ease-out ${
                  isProfileMenuOpen
                    ? "mt-2 max-h-20 translate-y-0 opacity-100"
                    : "pointer-events-none mt-0 max-h-0 translate-y-2 opacity-0"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isSigningOut}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[1rem] bg-[#191919] px-3 py-2.5 text-[0.82rem] font-medium tracking-[-0.02em] text-white transition-[transform,background-color,box-shadow] duration-150 hover:bg-black active:scale-[0.99] active:bg-[#0f0f10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f3f1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.9} />
                  ) : (
                    <LogOut className="h-4 w-4" strokeWidth={1.9} />
                  )}
                  <span>{isSigningOut ? "Logging out..." : "Logout"}</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex h-screen min-w-0 flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 pb-3 pt-3">
            <div />
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="text-[0.82rem] font-medium tracking-[-0.02em] text-[#757575] transition-colors hover:text-[#3a3a3a]"
              >
                Read Docs
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage("read")}
                className="rounded-[0.9rem] bg-[#191919] px-4 py-2.5 text-[0.84rem] font-medium tracking-[-0.02em] text-white transition-[transform,background-color,box-shadow] duration-150 hover:bg-black active:scale-[0.98] active:bg-[#0f0f10] active:shadow-[inset_0_1px_2px_rgba(255,255,255,0.06)]"
              >
                Start Reading
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 px-2 pb-2 pr-3">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.1rem] border border-[#dfdfdb] bg-white">
              <div className="px-5 pb-3 pt-5">
                <div className="flex items-start justify-between gap-5">
                  {currentPage === "home" ? (
                    <h2 className="text-[1.72rem] font-semibold tracking-[-0.065em] text-[#171717]">
                      Home
                    </h2>
                  ) : currentPage === "store" ? (
                    <h2 className="text-[1.72rem] font-semibold tracking-[-0.065em] text-[#171717]">
                      Books Store
                    </h2>
                  ) : (
                    <div />
                  )}

                  {currentPage === "home" ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-full bg-[#ececea] p-1">
                        {timeRanges.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setSelectedRange(item)}
                            className={`rounded-full px-4 py-1.5 text-[0.82rem] font-semibold tracking-[-0.02em] ${
                              selectedRange === item
                                ? "bg-white text-[#181818] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                                : "text-[#666666]"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {currentPage === "read" ? (
                  <p className="mt-1.5 text-[1rem] font-medium tracking-[-0.035em] text-[#73737f] md:text-[1.18rem] lg:text-[1.34rem]">
                    Welcome, <span className="font-semibold text-[#1f1f24]">{firstName}</span>. What
                    are we going to read today?
                  </p>
                ) : currentPage === "store" ? (
                  <p className="mt-1.5 text-[0.9rem] font-medium tracking-[-0.02em] text-[#7c7c84]">
                    Add curated books to your reading list.
                  </p>
                ) : null}
              </div>

              <div className="visible-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {currentPage === "home" ? (
              <>
              <section className="overflow-hidden rounded-[1.1rem] border border-[#dfdfdb]">
                <div className="grid gap-0 lg:grid-cols-[1.5fr_0.9fr]">
                  <article className="border-b border-[#dfdfdb] px-4 py-4 lg:border-b-0 lg:border-r">
                    <div className="text-[0.86rem] font-medium tracking-[-0.02em] text-[#565656]">
                      <span>Time spent reading</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[1.56rem] font-semibold tracking-[-0.055em] text-[#272727]">
                          {activeProgress.timeSpent}
                        </p>
                        <p className="mt-1 text-[0.8rem] font-medium tracking-[-0.01em] text-[#878787]">
                          {activeProgress.label} goal: {Math.floor(activeProgress.goal / 60)}h{" "}
                          {activeProgress.goal % 60}m
                        </p>
                      </div>
                      <div className="max-w-[210px] rounded-full bg-[#f1f0ed] px-3 py-1 text-[0.76rem] font-medium tracking-[-0.01em] text-[#757575]">
                        <span className="block truncate">
                          {activeProgress.topBook.title}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="h-3 rounded-full bg-[#ececea]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#7f56d9_0%,#8d63e3_100%)] transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[0.76rem] font-medium tracking-[-0.01em] text-[#929292]">
                        <span>{activeProgress.minutes} mins logged</span>
                        <span>{activeProgress.topBook.progress}% complete</span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-12 gap-2">
                      {activeProgress.bars.map((height, index) => (
                        <div
                          key={`${selectedRange}-${index}`}
                          className="flex h-20 items-end rounded-full bg-[#f3f2ef] px-[3px] py-[4px]"
                        >
                          <div
                            className="w-full rounded-full bg-[linear-gradient(180deg,#8d63e3_0%,#7f56d9_100%)]"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="px-4 py-4">
                    <div className="text-[0.86rem] font-medium tracking-[-0.02em] text-[#565656]">
                      <span>Reading progress</span>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="rounded-[1rem] bg-[#f6f5f2] px-4 py-3">
                        <p className="text-[0.76rem] font-medium uppercase tracking-[0.08em] text-[#8b8b8b]">
                          Pages read
                        </p>
                        <p className="mt-1 text-[1.56rem] font-semibold tracking-[-0.055em] text-[#272727]">
                          {activeProgress.pagesRead}
                        </p>
                      </div>

                      <div className="rounded-[1rem] bg-[#f6f5f2] px-4 py-3">
                        <p className="text-[0.76rem] font-medium uppercase tracking-[0.08em] text-[#8b8b8b]">
                          Consistency
                        </p>
                        <p className="mt-1 text-[0.98rem] font-semibold tracking-[-0.03em] text-[#2f2f2f]">
                          {activeProgress.streak}
                        </p>
                      </div>

                      <div className="rounded-[1rem] border border-[#e5e4df] px-4 py-3">
                        <p className="text-[0.76rem] font-medium uppercase tracking-[0.08em] text-[#8b8b8b]">
                          Current book
                        </p>
                        <p className="mt-1 text-[0.98rem] font-semibold tracking-[-0.03em] text-[#2f2f2f]">
                          {activeProgress.currentBook}
                        </p>
                        <p className="mt-1 text-[0.8rem] font-medium tracking-[-0.01em] text-[#7a7a7a]">
                          {activeProgress.chapter}
                        </p>
                        <p className="mt-1 text-[0.78rem] font-medium tracking-[-0.01em] text-[#9a9a9a]">
                          {activeProgress.currentAuthor}
                        </p>
                      </div>
                    </div>
                  </article>
                </div>

                <article className="border-t border-[#dfdfdb] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.86rem] font-medium tracking-[-0.02em] text-[#565656]">
                        Session timeline
                      </p>
                      <p className="mt-1 text-[0.78rem] font-medium tracking-[-0.01em] text-[#898989]">
                        Your reading time across the selected range
                      </p>
                    </div>
                    <div className="rounded-full bg-[#f1f0ed] px-3 py-1 text-[0.76rem] font-medium tracking-[-0.01em] text-[#757575]">
                      {selectedRange}
                    </div>
                  </div>

                  <svg
                    className="mt-4 h-[92px] w-full"
                    viewBox={`0 0 ${timelineChart.width} ${timelineChart.height}`}
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d={`M20 ${timelineChart.baselineY}H1100`}
                      stroke={timelineChart.color}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <path
                      d={timelineChart.linePath}
                      stroke={timelineChart.color}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={timelineChart.lastPoint.x}
                      cy={timelineChart.lastPoint.y}
                      r="9"
                      fill="white"
                      stroke={timelineChart.color}
                      strokeWidth="4"
                    />
                  </svg>
                </article>
              </section>

              <section className="mt-9">
                <h3 className="text-[1.72rem] font-semibold tracking-[-0.065em] text-[#171717]">
                  Updates
                </h3>

                <div className="mt-5 space-y-6">
                  {updates.map(({ title, time, description, icon }) => (
                    <article key={title} className="flex items-start gap-4">
                      <UpdatesIcon icon={icon} />
                      <div className="max-w-4xl">
                        <p className="text-[0.82rem] font-medium tracking-[-0.01em] text-[#7b7b7b]">{time}</p>
                        <h4 className="mt-1 text-[0.96rem] font-medium tracking-[-0.025em] text-[#2a2a2a]">
                          {title}
                        </h4>
                        <p className="mt-2 text-[0.86rem] leading-6 tracking-[-0.01em] text-[#787878]">
                          {description}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              </>
              ) : currentPage === "read" ? (
              <section className="min-h-full pt-2">
                  <input
                    ref={epubInputRef}
                    type="file"
                    accept=".epub,application/epub+zip"
                    className="hidden"
                    onChange={handleEpubSelect}
                  />

                  <div className="visible-scrollbar flex w-full gap-4 overflow-x-auto pb-2">
                    <button
                      type="button"
                      onClick={openEpubPicker}
                      className="flex min-h-[190px] w-full max-w-[420px] min-w-[340px] items-center justify-center rounded-[1.05rem] border border-dashed border-[#d8d8de] bg-[#fcfcfd] text-[#7c7c89] transition-colors hover:bg-[#f7f7f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                    >
                      <span className="flex items-center gap-2.5 text-[0.92rem] font-medium tracking-[-0.025em]">
                        <Plus className="h-5 w-5" strokeWidth={1.8} />
                        <span>Upload Book</span>
                      </span>
                    </button>

                    {uploadedBooks.map((book) => (
                      <article
                        key={`read-cover-${book.id}`}
                        className="w-[188px] min-w-[188px] shrink-0 rounded-[1.05rem] border border-[#e1e1dc] bg-white p-3 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
                      >
                        <div
                          className={`w-full ${
                            book.uploadStatus === "ready" ? "cursor-pointer" : ""
                          }`}
                          onClick={
                            book.uploadStatus === "ready"
                              ? () => void openBookReader(book)
                              : undefined
                          }
                        >
                          <div className="relative h-[250px] overflow-hidden rounded-[0.9rem] bg-[#efefed]">
                            {book.coverUrl ? (
                              <Image
                                src={book.coverUrl}
                                alt={`${book.title} cover`}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <BookOpen
                                  className="h-10 w-10 text-[#85858d]"
                                  strokeWidth={1.8}
                                />
                              </div>
                            )}
                          </div>

                          <div className="mt-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-[0.9rem] font-medium tracking-[-0.025em] text-[#2b2b30]">
                                {book.title}
                              </p>
                              {book.uploadStatus === "ready" ? (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setOpenMenuBookId((currentId) =>
                                        currentId === book.id ? null : book.id,
                                      );
                                    }}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#7f7f86] transition-colors hover:bg-[#ececea] hover:text-[#25252a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                                  >
                                    <Ellipsis className="h-4.5 w-4.5" strokeWidth={2} />
                                  </button>

                                  {openMenuBookId === book.id ? (
                                    <div
                                      className="absolute right-0 top-8 z-20 min-w-[92px] rounded-[0.8rem] border border-[#dfdfdb] bg-white p-1 shadow-[0_12px_30px_rgba(17,17,17,0.08)]"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void removeUploadedBook(book.id);
                                        }}
                                        className="w-full rounded-[0.6rem] px-3 py-2 text-left text-[0.76rem] font-medium text-[#aa4e4e] transition-colors hover:bg-[#f8f2f2]"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            {book.uploadStatus === "uploading" ? (
                              <div className="mt-2">
                                <p className="truncate text-[0.76rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
                                  Uploading book...
                                </p>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ececea]">
                                  <div
                                    className="h-full rounded-full bg-[#7f56d9] transition-all duration-200"
                                    style={{ width: `${book.uploadProgress ?? 0}%` }}
                                  />
                                </div>
                                <p className="mt-2 text-[0.74rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
                                  {formatStorageProgress(
                                    book.uploadLoadedBytes,
                                    book.uploadTotalBytes,
                                  )}
                                </p>
                              </div>
                            ) : book.uploadStatus === "error" ? (
                              <p className="mt-2 text-[0.76rem] font-medium tracking-[-0.01em] text-[#b55151]">
                                {book.errorMessage}
                              </p>
                            ) : (
                              <>
                                <p className="mt-1 truncate text-[0.76rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
                                  {book.author}
                                </p>
                                <p className="mt-2 text-[0.76rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
                                  {book.progress}% read
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
              </section>
              ) : (
              <section className="min-h-full pt-2">
                <div className="grid justify-items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {storeBooks.map((book) => {
                    const readingListBook = books.find((existingBook) => existingBook.id === book.id);
                    const displayTitle = readingListBook?.title ?? book.title;
                    const displayAuthor = readingListBook?.author ?? book.author;
                    const displayCoverUrl = readingListBook?.coverUrl ?? book.coverUrl ?? null;

                    return (
                      <article
                        key={book.id}
                        className="w-full max-w-[272px] justify-self-start rounded-[1.2rem] border border-[#e1e1dc] bg-white p-4 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
                      >
                        <button
                          type="button"
                          onClick={() => setStorePromptBookId(book.id)}
                          className="w-full text-left"
                        >
                          <div className="relative mx-auto aspect-[0.68] w-full max-w-[216px] overflow-hidden rounded-[1rem] bg-[#efefed]">
                            {displayCoverUrl ? (
                              <Image
                                src={displayCoverUrl}
                                alt={`${displayTitle} cover`}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <BookOpen className="h-14 w-14 text-[#85858d]" strokeWidth={1.8} />
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <p className="truncate text-[0.94rem] font-medium tracking-[-0.03em] text-[#2b2b30]">
                              {displayTitle}
                            </p>
                            <p className="mt-1.5 text-[0.82rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
                              {displayAuthor}
                            </p>
                            <p className="mt-2.5 text-[0.82rem] font-medium tracking-[-0.01em] text-[#8a8a93]">
                              {addedBookIds.has(book.id) ? "Added to reading list" : "Add to reading list"}
                            </p>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
              )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {storePromptBookId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-[420px] rounded-[1.25rem] border border-[#dfdfdb] bg-white p-6 shadow-[0_24px_60px_rgba(17,17,17,0.14)]">
            <h3 className="text-[1.08rem] font-semibold tracking-[-0.04em] text-[#191919]">
              Add this book to your reading list?
            </h3>
            <p className="mt-2 text-[0.88rem] leading-6 tracking-[-0.01em] text-[#73737f]">
              It will appear on your Read page and in My Collections.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStorePromptBookId(null)}
                className="rounded-[0.85rem] px-4 py-2 text-[0.84rem] font-medium tracking-[-0.02em] text-[#666666] transition-colors hover:bg-[#f3f3f1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addStoreBookToReadingList(storePromptBookId)}
                disabled={storeActionLoading === storePromptBookId}
                className="rounded-[0.85rem] bg-[#191919] px-4 py-2 text-[0.84rem] font-medium tracking-[-0.02em] text-white transition-colors hover:bg-black disabled:opacity-60"
              >
                {storeActionLoading === storePromptBookId ? "Adding..." : "Add book"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {readerStatus !== "idle" ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="relative flex h-full min-h-0 flex-col bg-white">
            {readerStatus === "error" ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6">
                <div className="rounded-[1.2rem] border border-[#dfdfdb] bg-white px-8 py-7 text-center shadow-[0_18px_40px_rgba(17,17,17,0.06)]">
                  <p className="text-[1rem] font-medium tracking-[-0.03em] text-[#2a2a2f]">
                    {readerErrorMessage ?? "We couldn’t open this book."}
                  </p>
                  <button
                    type="button"
                    onClick={closeReaderOverlay}
                    className="mt-4 rounded-full bg-[#191919] px-4 py-2 text-[0.82rem] font-medium text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 px-0 pb-0">
                  <div className="relative flex h-full min-h-0 flex-col">
                    {readerStatus !== "loading"
                      ? readerExitHintPositions.map(
                          ({ id, wrapperClassName, badgeClassName }) => (
                            <div
                              key={id}
                              className={`group pointer-events-auto absolute z-20 flex h-24 w-24 ${wrapperClassName}`}
                            >
                              <div
                                className={`pointer-events-none rounded-full border border-[#e5e4df] bg-white/94 px-3 py-1.5 text-[0.72rem] font-medium tracking-[-0.02em] text-[#6f6f78] opacity-0 shadow-[0_10px_24px_rgba(17,17,17,0.06)] transition duration-200 group-hover:scale-100 group-hover:opacity-100 ${badgeClassName} scale-95`}
                              >
                                Esc to exit
                              </div>
                            </div>
                          ),
                        )
                      : null}

                    <button
                      type="button"
                      onClick={goToPreviousReaderSpread}
                      disabled={(!readerEngineReady && !readerPreviewReady) || readerAtStart}
                      className="absolute left-2 top-1/2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#2f2f35] shadow-[0_10px_30px_rgba(17,17,17,0.08)] transition disabled:opacity-30 md:left-3"
                    >
                      <ChevronLeft className="h-7 w-7" strokeWidth={1.8} />
                    </button>

                    <button
                      type="button"
                      onClick={goToNextReaderSpread}
                      disabled={(!readerEngineReady && !readerPreviewReady) || readerAtEnd}
                      className="absolute right-2 top-1/2 z-10 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#2f2f35] shadow-[0_10px_30px_rgba(17,17,17,0.08)] transition disabled:opacity-30 md:right-3"
                    >
                      <ChevronRight className="h-7 w-7" strokeWidth={1.8} />
                    </button>

                    <div
                      className="min-h-0 flex-1 overflow-hidden bg-white"
                      onWheel={handleReaderWheel}
                      >
                        <div className="h-full min-h-0 bg-white">
                        {shouldRenderPreviewFrame ? (
                          <iframe
                            ref={readerFastPreviewIframeRef}
                            title={`${readerBookPreview?.title ?? "Book"} preview`}
                            src={readerFastPreviewUrl ?? undefined}
                            className="h-full w-full border-0"
                            onLoad={(event) => {
                              const iframeElement = event.currentTarget;
                              const previewWindow = iframeElement.contentWindow;
                              const previewDocument = previewWindow?.document;
                              const previewTrack =
                                previewDocument?.getElementById("prism-preview-track");

                              setReaderPreviewReady(true);

                              const syncState = () => syncPreviewNavigationState(iframeElement);

                              previewTrack?.addEventListener("scroll", syncState, {
                                passive: true,
                              });
                              previewWindow?.addEventListener("resize", syncState);

                              window.setTimeout(syncState, 0);
                            }}
                          />
                        ) : null}
                        <div
                          className={`h-full w-full ${
                            readerEngineReady && !isPreviewVisible
                              ? "block"
                              : "pointer-events-none invisible absolute inset-0"
                          }`}
                          ref={readerViewportRef}
                        />
                      </div>
                    </div>

                    {readerStatus === "loading" ||
                    (shouldRenderPreviewFrame && !readerPreviewReady && !readerEngineReady) ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <div className="flex flex-col items-center px-6 py-8">
                          <div className="relative h-[420px] w-[260px] overflow-hidden rounded-[1rem] bg-[#efefed] shadow-[0_30px_70px_rgba(17,17,17,0.14)] md:h-[520px] md:w-[320px]">
                            {readerBookPreview?.coverUrl ? (
                              <Image
                                src={readerBookPreview.coverUrl}
                                alt={`${readerBookPreview.title} cover`}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <BookOpen className="h-16 w-16 text-[#85858d]" strokeWidth={1.8} />
                              </div>
                            )}
                          </div>
                          <p className="mt-6 text-[0.95rem] font-medium tracking-[-0.02em] text-[#7a7a84]">
                            Loading book...
                          </p>
                          <p className="mt-1 text-[0.8rem] font-medium tracking-[-0.01em] text-[#9c9ca5]">
                            {formatLoadTime(readerElapsedMs)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
