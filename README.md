# Prism

Prism lets you upload any EPUB and instantly turn it into a clean, distraction free reading experience in your browser. It preserves formatting, handles large books smoothly, and gives you full control over how you read font, layout, and navigation without needing any external apps or downloads.

Beyond reading, Prism transforms books into natural sounding audiobooks using ElevenLabs, while an AI companion helps you understand what you read. You can ask questions, get summaries, and explore ideas in real time, making reading more interactive, accessible, and deeply engaging.

Built using the open source IDE [Zed](https://zed.dev/) and voice technology from [ElevenLabs](https://elevenlabs.io/).

<img width="1166" height="793" alt="Screenshot 2026-04-30 at 9 43 30 PM" src="https://github.com/user-attachments/assets/e75f7598-4209-4931-aeb3-bba5892a0bac" />



<img width="1165" height="786" alt="Screenshot 2026-04-30 at 9 44 10 PM" src="https://github.com/user-attachments/assets/3f286c2a-07bf-453a-92db-649dc07d8aef" />



<img width="1165" height="789" alt="Screenshot 2026-04-30 at 9 44 27 PM" src="https://github.com/user-attachments/assets/4c512b12-0a33-46bb-8943-56fd2e73e217" />

## What Prism Does

- Opens EPUB files with a fast preview path so the first readable pages appear before the full book finishes loading.
- Renders books in a paginated, two-page reading view with keyboard navigation and progress tracking.
- Stores uploaded and bundled bookstore books locally so returning to a book feels near-instant.
- Shows reading analytics for recent sessions, pages read, current book, and session timelines.
- Lets users sign in with Google through Firebase Authentication, with localhost auth bypass for local development.
- Provides a voice companion in the reader that captures the visible page context and answers questions about that page.
- Uses OpenAI for page-aware companion responses and ElevenLabs for voice output.
- Includes an audiobook flow with Zara voice preview and conversion for the bundled bookstore book.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- EPUB.js
- JSZip
- Firebase Authentication
- OpenAI API
- ElevenLabs API
- Three.js and React Three Fiber for the assistant orb
- Zed as the open source IDE used to build the project

## Getting Started Locally

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp firebase.env.example .env.local
```

Fill `.env.local` with your Firebase, OpenAI, and ElevenLabs values. The `.env.local` file is ignored by Git and should not be committed.

Start the development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

The app also allows auth bypass on localhost, so local testing can continue even before Firebase sign-in is fully configured.

## Environment Variables

Prism reads these values from `.env.local` or from your hosting provider environment settings:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

OPENAI_API_KEY=
OPENAI_READER_MODEL=gpt-4o-mini
OPENAI_ENABLE_WEB_SEARCH=false

ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_DEFAULT_VOICE_ID=jqcCZkN6Knx8BJ5TBdYR
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
```

For deployment on Vercel, add the same values in Project Settings > Environment Variables.

## Available Scripts

Run the local dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run the production build locally:

```bash
npm run start
```

Run lint checks:

```bash
npm run lint
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

## Project Structure

```text
src/app/page.tsx                  Main app shell, reader, bookstore, audiobooks, and dashboard
src/app/api/reader/context        Stores current visible page context for the companion
src/app/api/reader/companion      Generates page-aware companion answers with OpenAI
src/app/api/elevenlabs/speech     Generates ElevenLabs speech audio
src/app/api/elevenlabs/session    Creates ElevenLabs conversation session data
src/components/ui/orb.tsx         Animated assistant orb
src/lib/firebase.ts               Firebase client configuration
public/books                      Bundled bookstore EPUB and metadata
public/audio                      Local Zara fallback audio sample
```

## Reader Flow

When a book opens, Prism builds a fast preview from the EPUB archive by resolving the first readable content and its assets into in-memory blob URLs. The full EPUB rendition initializes in the background, then replaces the preview when ready.

While the user reads, Prism tracks the visible page or spread and sends that page context to the companion API. The companion can then answer questions about the current page, explain wording, summarize meaning, or turn the page into a more conversational explanation.

## Voice Companion Flow

1. The user opens the assistant orb on the book page.
2. The browser captures speech and converts it to text.
3. Prism sends the user question plus current visible page text to the reader companion API.
4. OpenAI generates a page-aware answer.
5. ElevenLabs converts the answer to voice audio.
6. The assistant shows only the AI response text in the expanded orb panel.

If ElevenLabs is unavailable, the app can fall back to browser speech synthesis for local testing.

## Audiobooks

The Audiobooks page currently focuses on Zara voice. Users can listen to a short Zara sample and convert the bundled bookstore title into an audiobook entry. The current first pass prepares the provided Steve Jobs excerpt and uses the local Zara recording as the ready audio.

## Deployment

Recommended Vercel settings:

```text
Root Directory: ./
Install Command: npm install
Build Command: npm run build
Output Directory: Next.js default
```

Add the environment variables listed above in Vercel before testing Google sign-in, OpenAI companion answers, or ElevenLabs voice playback.

## Notes

- Do not commit `.env.local` or any real API keys.
- Local book data is stored in the browser through IndexedDB and localStorage.
- The bundled bookstore EPUB is stored under `public/books`.
- The app is optimized for desktop reading first, with responsive behavior for smaller screens.

