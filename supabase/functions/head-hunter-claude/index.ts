import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://head-hunter-fawn.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("HEAD_HUNTER");
  if (!apiKey) {
    console.error("Server misconfiguration: HEAD_HUNTER secret not set");
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { model, max_tokens, messages, masterCV } = body;

    // When masterCV is provided separately, restructure messages to enable
    // prompt caching. The master CV is stable across the 3-call pipeline,
    // so marking it cacheable saves ~90% of its input token cost on calls 2+3.
    let finalMessages = messages;
    if (masterCV && messages?.length === 1 && typeof messages[0].content === "string") {
      finalMessages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: masterCV,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: messages[0].content,
            },
          ],
        },
      ];
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens, messages: finalMessages }),
    });

    const responseBody = await res.text();
    return new Response(responseBody, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Generation failed:", e);
    return new Response(
      JSON.stringify({ error: "Generation failed. Try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
