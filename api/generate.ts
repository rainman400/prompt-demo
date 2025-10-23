declare const process: any; // <-- add this line
export const runtime = "edge";
export const maxDuration = 300;

// Edge runtime doesn’t have `process`, but Vercel injects env automatically.
// For local testing, fall back to import.meta.env or a global polyfill.

const OPENAI_KEY = process?.env?.OPENAI_API_KEY;

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt) return json({ error: "Missing prompt" }, 400);

    if (!OPENAI_KEY) {
      return json({ error: "Missing OPENAI_API_KEY in env" }, 500);
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o-mini", input: prompt }),
    });

    if (!r.ok) {
      const text = await r.text();
      return json({ error: text }, 500);
    }

    const data = await r.json();
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
