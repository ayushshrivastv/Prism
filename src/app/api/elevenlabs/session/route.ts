import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json({
      configured: false,
      voiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "jqcCZkN6Knx8BJ5TBdYR",
    });
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(
      agentId,
    )}`,
    {
      headers: {
        "xi-api-key": apiKey,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      {
        configured: true,
        error: "Unable to create ElevenLabs conversation session.",
        detail: errorText.slice(0, 600),
      },
      { status: 502 },
    );
  }

  const session = (await response.json()) as { signed_url?: string };

  return NextResponse.json({
    configured: true,
    signedUrl: session.signed_url,
    voiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "jqcCZkN6Knx8BJ5TBdYR",
  });
}
