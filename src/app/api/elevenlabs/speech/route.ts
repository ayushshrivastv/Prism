import { NextResponse } from "next/server";

type SpeechRequest = {
  text?: string;
  voiceId?: string;
};

export async function POST(request: Request) {
  const { text, voiceId } = (await request.json()) as SpeechRequest;
  const cleanText = text?.replace(/\s+/g, " ").trim();

  if (!cleanText) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const selectedVoiceId =
    voiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "jqcCZkN6Knx8BJ5TBdYR";

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      voiceId: selectedVoiceId,
    });
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      selectedVoiceId,
    )}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.82,
          style: 0.18,
          use_speaker_boost: true,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: "ElevenLabs speech generation failed.",
        detail: errorText.slice(0, 600),
      },
      { status: 502 },
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return NextResponse.json({
    configured: true,
    voiceId: selectedVoiceId,
    mimeType: response.headers.get("content-type") ?? "audio/mpeg",
    audioBase64: audioBuffer.toString("base64"),
  });
}
