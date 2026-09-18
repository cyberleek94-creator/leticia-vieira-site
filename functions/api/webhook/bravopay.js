function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeStringEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

export async function onRequestPost(context) {
  const secret = context.env.BRAVOPAY_WEBHOOK_SECRET;
  const signature =
    context.request.headers.get("BravoPay-Signature") ||
    context.request.headers.get("X-Bravopay-Signature");

  if (!secret || !signature) {
    return new Response("Webhook não configurado.", { status: 400 });
  }

  try {
    const rawBody = await context.request.text();
    const parts = Object.fromEntries(
      signature.split(",").map(part => {
        const index = part.indexOf("=");
        return index === -1
          ? [part.trim(), ""]
          : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
      })
    );

    const timestamp = Number(parts.t);
    const received = parts.v1;

    if (!timestamp || !received) {
      return new Response("Assinatura inválida.", { status: 400 });
    }

    if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return new Response("Webhook expirado.", { status: 400 });
    }

    const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);

    if (!timingSafeStringEqual(expected, received)) {
      return new Response("Assinatura inválida.", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log(
      "BravoPay webhook:",
      event?.type,
      event?.data?.id,
      event?.data?.status
    );

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook inválido.", { status: 400 });
  }
}
