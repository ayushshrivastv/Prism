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
