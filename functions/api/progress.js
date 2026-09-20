const ALLOWED = new Set(["ting", "tao"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const whoOf = (request) => {
  try {
    return new URL(request.url).searchParams.get("who");
  } catch {
    return null;
  }
};

export async function onRequestGet(context) {
  const who = whoOf(context.request);
  if (!ALLOWED.has(who)) return json({ error: "invalid who" }, 400);
  if (!context.env.PROGRESS) return json({ error: "missing PROGRESS kv binding" }, 503);

  const raw = await context.env.PROGRESS.get(`checks:${who}`);
  if (!raw) return json({});
  try {
    return json(JSON.parse(raw));
  } catch {
    return json({});
  }
}

export async function onRequestPut(context) {
  const who = whoOf(context.request);
  if (!ALLOWED.has(who)) return json({ error: "invalid who" }, 400);
  if (!context.env.PROGRESS) return json({ error: "missing PROGRESS kv binding" }, 503);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "bad body" }, 400);
  }

  const clean = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof key === "string" && key.length > 0 && key.length < 80 && value === true) {
      clean[key] = true;
    }
  }

  await context.env.PROGRESS.put(`checks:${who}`, JSON.stringify(clean));
  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "GET, PUT, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}
