const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.BRAVOPAY_API_KEY;

if (!API_KEY) {
  console.warn("AVISO: BRAVOPAY_API_KEY não configurada. O site abrirá, mas os pagamentos não serão gerados.");
}

app.use(express.static(path.join(__dirname, "public")));

// Endpoint opcional para o webhook da BravoPay.
// Configure a URL /api/webhook/bravopay no painel da BravoPay.
// O processamento definitivo pode ser ampliado depois.
app.post("/api/webhook/bravopay", express.raw({type:"application/json"}), (req, res) => {
  const secret = process.env.BRAVOPAY_WEBHOOK_SECRET;
  const signature = req.get("BravoPay-Signature") || req.get("X-Bravopay-Signature");
  const rawBody = req.body.toString("utf8");

  if (!secret || !signature) return res.status(400).send("Webhook não configurado.");

  try {
    const parts = Object.fromEntries(signature.split(",").map(part => part.split("=")));
    const timestamp = Number(parts.t);
    const received = parts.v1;
    if (!timestamp || !received) return res.status(400).send("Assinatura inválida.");

    if (Math.abs(Date.now()/1000 - timestamp) > 300) {
      return res.status(400).send("Webhook expirado.");
    }

    const expected = crypto.createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const valid = expected.length === received.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));

    if (!valid) return res.status(400).send("Assinatura inválida.");

    const event = JSON.parse(rawBody);
    console.log("BravoPay webhook:", event.type, event.data?.id, event.data?.status);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(400).send("Webhook inválido.");
  }
});

// Parse JSON bodies for the payment API routes.
app.use(express.json());

const gifts = {
  "Café": 500,
  "Uma Flor": 1000,
  "Presente Especial": 2500,
  "Presente VIP": 5000
};

function makeIdempotencyKey() {
  return crypto.randomUUID();
}

app.post("/api/create-pix", async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({error: "Pagamento ainda não configurado no servidor."});

    const gift = String(req.body?.gift || "");
    const amountCents = Number(req.body?.amount_cents);

    if (!gifts[gift] || gifts[gift] !== amountCents) {
      return res.status(400).json({error: "Presente ou valor inválido."});
    }

    const externalReference = `leticia_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const response = await fetch("https://bravopay.club/api/v1/transactions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": makeIdempotencyKey()
      },
      body: JSON.stringify({
        amount_cents: amountCents,
        method: "pix",
        anti_desvio: true,
        description: `Presente Letícia Vieira - ${gift}`,
        external_reference: externalReference,
        metadata: {
          site: "leticia-vieira",
          gift
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("BravoPay error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "A BravoPay recusou a cobrança."
      });
    }

    if (!data?.id || !data?.pix?.copy_paste) {
      console.error("Resposta inesperada da BravoPay:", data);
      return res.status(502).json({error: "A BravoPay não retornou os dados do Pix esperados."});
    }

    res.json({
      id: data.id,
      copy_paste: data.pix.copy_paste,
      expires_at: data.pix.expires_at || null,
      anti_desvio: data.anti_desvio || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Erro interno ao gerar o Pix."});
  }
});

app.get("/api/payment-status/:id", async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({error: "Pagamento não configurado."});

    const response = await fetch(
      `https://bravopay.club/api/v1/transactions/${encodeURIComponent(req.params.id)}`,
      {headers: {"Authorization": `Bearer ${API_KEY}`}}
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({error: data?.error?.message || "Não foi possível consultar o pagamento."});
    }

    res.json({status: data.status});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Erro ao consultar pagamento."});
  }
});


app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Letícia Vieira rodando na porta ${PORT}`));
