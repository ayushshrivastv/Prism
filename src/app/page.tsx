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
