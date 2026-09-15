const ELEVEN_API = "https://api.elevenlabs.io/v1/music";

export default async (req) => {
  // Free health check — does not generate music
  if (req.method === "GET") {
    const configured = Boolean(Netlify.env.get("ELEVENLABS_API_KEY"));

    return Response.json({
      ok: true,
      function: "music",
      configured,
      message: configured
        ? "G.C.D Music function is online and ElevenLabs key is available."
        : "G.C.D Music function is online, but ELEVENLABS_API_KEY is missing."
    });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method Not Allowed" },
      { status: 405 }
    );
  }

  const apiKey = Netlify.env.get("ELEVENLABS_API_KEY");

  if (!apiKey) {
    return Response.json(
      {
        error: "ELEVENLABS_API_KEY is not available to the production function.",
        code: "MISSING_API_KEY"
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || "").trim();

    const durationSeconds = Math.min(
      Math.max(Number(body.duration) || 60, 3),
      300
    );

    if (!prompt) {
      return Response.json(
        {
          error: "Enter a music idea first.",
          code: "EMPTY_PROMPT"
        },
        { status: 400 }
      );
    }

    const upstream = await fetch(
      `${ELEVEN_API}?output_format=mp3_48000_192`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          prompt: prompt.slice(0, 4100),
          music_length_ms: Math.round(durationSeconds * 1000),
          model_id: "music_v2_5"
        })
      }
    );

    if (!upstream.ok) {
      const contentType =
        upstream.headers.get("content-type") || "";

      let message =
        `ElevenLabs returned HTTP ${upstream.status}.`;

      if (contentType.includes("application/json")) {
        const data = await upstream.json().catch(() => ({}));

        message =
          data?.detail?.message ||
          data?.detail?.data?.message ||
          data?.detail ||
          data?.message ||
          message;

        if (typeof message !== "string") {
          message = JSON.stringify(message);
        }
      } else {
        const text = await upstream.text().catch(() => "");
        if (text) message = text.slice(0, 1200);
      }

      return Response.json(
        {
          error: message,
          code: "ELEVENLABS_ERROR",
          provider_status: upstream.status
        },
        { status: 502 }
      );
    }

    const audio = await upstream.arrayBuffer();

    if (!audio.byteLength) {
      return Response.json(
        {
          error: "ElevenLabs returned an empty audio file.",
          code: "EMPTY_AUDIO"
        },
        { status: 502 }
      );
    }

    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "audio/mpeg",
        "Content-Disposition":
          'inline; filename="gcd-studio-ai-music.mp3"',
        "Cache-Control": "private, no-store"
      }
    });

  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Music function failed.",
        code: "FUNCTION_ERROR"
      },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/.netlify/functions/music"
};
