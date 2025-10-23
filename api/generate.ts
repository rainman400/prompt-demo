// api/generate.ts
export const runtime = "edge";      // run on Edge (no Pro plan required)
export const maxDuration = 300;     // up to 300s

export default async function handler(req: Request) {
  // CORS for your browser demo (tighten later)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    const { prompt } = await req.json() as { prompt?: string };
    if (!prompt) {
      return json({ error: "Missing prompt" }, 400);
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",     // pick any model you like
        input: prompt,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return json({ error: errText }, 500);
    }

    const data = await r.json();
    // Responses API: safest text extraction fallback chain
    const output =
      data.output_text ??
      data.output?.[0]?.content?.[0]?.text ??
      JSON.stringify(data);

    return json({ output }, 200);
  } catch (e: any) {
    return json({ error: String(e) }, 500);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
