import OpenAI from 'openai';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { tool = 'AI Lyrics', prompt = '', style = '' } = await req.json();

    if (!prompt.trim()) {
      return Response.json(
        { error: 'Enter an idea first.' },
        { status: 400 }
      );
    }

    const instructions = {
      'AI Lyrics':
        'Write original song lyrics with Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Bridge and Outro. Keep it catchy, singable and avoid copying any existing song or artist.',

      'AI Song':
        'Create a professional original song blueprint: title, concept, BPM, key suggestion, genre, intro, verse, pre-chorus, chorus, bridge, outro, instrumentation and vocal direction. Do not imitate a living artist.',

      'AI Video':
        'Create a detailed original music-video treatment with 8 cinematic scenes, locations, camera movement, lighting and performance direction.',

      'Cover Art':
        'Create a polished album-cover concept including title treatment, composition, subject, lighting, typography direction and an image-generation prompt.',

      'Remix':
        'Create an original remix blueprint including BPM, drum groove, bass, chords, arrangement changes, transitions and effects.',

      'My Voice':
        'Create a safe voice-profile production brief covering vocal character, recording setup, performance direction and mixing notes. Do not claim to clone a real person without authorization.'
    };

    const task = instructions[tool] || instructions['AI Song'];

    // Real cover-art generation through Netlify AI Gateway.
    // Netlify supplies the provider credentials server-side when AI Gateway is enabled.
    if (
      tool === 'Cover Art' &&
      req.headers.get('x-gcd-mode') === 'image'
    ) {
      const image = await client.images.generate({
        model: 'gpt-image-2',
        prompt: `${prompt}. ${style || ''}. Create original professional album cover artwork. No logos, no copyrighted characters, no imitation of a living artist.`,
        size: '1024x1024'
      });

      const item = image.data?.[0];

      return Response.json({
        ok: true,
        tool,
        result: item?.b64_json
          ? `data:image/png;base64,${item.b64_json}`
          : (item?.url || ''),
        image: true
      });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the creative AI inside G.C.D Studio. ${task} Return clean production-ready text. The user's requested style is ${style || 'not specified'}.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.85
    });

    return Response.json({
      ok: true,
      tool,
      result: completion.choices?.[0]?.message?.content || ''
    });

  } catch (e) {
    console.error(e);

    return Response.json({
      error: e?.message || 'AI generation failed.'
    }, { status: 500 });
  }
};

export const config = {
  path: '/api/ai',
  method: 'POST'
};
