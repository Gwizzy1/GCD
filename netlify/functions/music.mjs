const ELEVEN_API = 'https://api.elevenlabs.io/v1/music';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = Netlify.env.get('ELEVENLABS_API_KEY');

  if (!apiKey) {
    return Response.json(
      {
        error:
          'Music engine is not configured yet. Add ELEVENLABS_API_KEY in Netlify environment variables.'
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const prompt = String(body.prompt || '').trim();

    const durationSeconds = Math.min(
      Math.max(Number(body.duration) || 60, 3),
      600
    );

    if (!prompt) {
      return Response.json(
        { error: 'Enter a music idea first.' },
        { status: 400 }
      );
    }

    const upstream = await fetch(ELEVEN_API, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg'
      },

      body: JSON.stringify({
        prompt: prompt.slice(0, 4100),
        music_length_ms: Math.round(durationSeconds * 1000),
        model_id: 'music_v2_5',
        output_format: 'mp3_48000_192'
      })
    });

    if (!upstream.ok) {
      const contentType =
        upstream.headers.get('content-type') || '';

      let message =
        `Music provider returned ${upstream.status}.`;

      if (contentType.includes('application/json')) {
        const data = await upstream.json().catch(() => ({}));

        message =
          data?.detail?.message ||
          data?.detail ||
          data?.message ||
          message;

        if (typeof message !== 'string') {
          message = JSON.stringify(message);
        }
      } else {
        const text = await upstream.text().catch(() => '');

        if (text) {
          message = text.slice(0, 1000);
        }
      }

      return Response.json(
        { error: message },
        { status: upstream.status }
      );
    }

    const audio = await upstream.arrayBuffer();

    if (!audio.byteLength) {
      return Response.json(
        {
          error:
            'Music provider returned an empty audio file.'
        },
        { status: 502 }
      );
    }

    return new Response(audio, {
      status: 200,

      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ||
          'audio/mpeg',

        'Content-Disposition':
          'inline; filename="gcd-studio-ai-music.mp3"',

        'Cache-Control':
          'private, no-store',

        ...(upstream.headers.get('song-id')
          ? {
              'X-Song-Id':
                upstream.headers.get('song-id')
            }
          : {})
      }
    });
  } catch (e) {
    console.error(e);

    return Response.json(
      {
        error:
          e?.message ||
          'Music generation failed.'
      },
      { status: 500 }
    );
  }
};

export const config = {
  path: '/api/music'
};
