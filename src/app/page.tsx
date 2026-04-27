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
