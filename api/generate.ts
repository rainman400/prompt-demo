// api/generate.ts
export const runtime = "edge";
export const maxDuration = 300;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // POC: wide open; lock this down later
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default async function handler(req: Request) {
  // ✅ Return preflight immediately—no other code runs first
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Optional: quick ping for GET debugging
  if (req.method === "GET") {
    return json({ ok: true, hint: "Use POST with { prompt }" }, 200);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const reqId = crypto.randomUUID();
  try {
    const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
    if (!prompt) return json({ error: "Missing prompt", reqId }, 400);

    // ⚠️ Read env inside the handler (after OPTIONS) so preflight never trips over it
    const OPENAI_API_KEY = (globalThis as any).process?.env?.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return json({ error: "Server missing OPENAI_API_KEY", reqId }, 500);

    // ⏱ hard timeout so request never hangs forever
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o-mini", input: prompt }),
    }).finally(() => clearTimeout(timeout));

    if (!r.ok) {
      const errText = await r.text();
      return json({ error: errText.slice(0, 2000), reqId }, 500);
    }

    const data = await r.json();
    const output =
      data.output_text ??
      data.output?.[0]?.content?.[0]?.text ??
      JSON.stringify(data);

    return json({ output, reqId }, 200);
  } catch (e: any) {
    const name = e?.name || "Error";
    const msg = e?.message || String(e);
    const status = name === "AbortError" ? 504 : 500;
    return json({ error: `${name}: ${msg}`, reqId }, status);
  }
}
