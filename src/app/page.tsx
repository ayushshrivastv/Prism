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

const UPLOADED_BOOK_SUMMARIES_KEY = "prism-uploaded-book-summaries-v1";
const READING_SESSIONS_KEY = "prism-reading-sessions-v1";
const LIBRARY_DB_NAME = "prism-library";
const LIBRARY_DB_VERSION = 1;
const LIBRARY_STORE_NAME = "uploaded-books";
const STORE_BOOK_ID = "store-make-something-wonderful";
const STORE_BOOK_PATH = "/books/make-something-wonderful.epub";
const SHOULD_BYPASS_AUTH_IN_DEV = process.env.NODE_ENV === "development";

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
    id: STORE_BOOK_ID,
    title: "Make Something Wonderful",
    author: "Steve Jobs",
    fileName: "make-something-wonderful.epub",
    path: STORE_BOOK_PATH,
    coverUrl: "/books/make-something-wonderful-cover.jpg",
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

function buildTimelineChart(values: number[]) {
  const width = 1120;
  const height = 100;
  const baselineY = 78;
  const paddingX = 20;
  const maxRise = 52;
  const clampedValues = values.length > 0 ? values : [0];
  const innerWidth = width - paddingX * 2;
  const step = clampedValues.length > 1 ? innerWidth / (clampedValues.length - 1) : 0;

  const points = clampedValues.map((value, index) => {
    const normalizedValue = Math.max(0, Math.min(100, value));
    return {
      x: paddingX + index * step,
      y: baselineY - (normalizedValue / 100) * maxRise,
    };
  });

  const linePath = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  const lastPoint = points[points.length - 1] ?? { x: width - paddingX, y: baselineY };
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${baselineY} L ${points[0]?.x.toFixed(2) ?? paddingX} ${baselineY} Z`;

  return {
    width,
    height,
    baselineY,
    linePath,
    areaPath,
    lastPoint,
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
