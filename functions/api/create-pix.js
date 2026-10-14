const GIFTS = {
  "30 Dias": 990,
  "Acesso Vitalício": 1490,
  "Super Combo Exclusivo": 2590
};

const ALIASES = {
  "30 dias": "30 Dias",
  "mensal": "30 Dias",
  "acesso vitalicio": "Acesso Vitalício",
  "vitalicio": "Acesso Vitalício",
  "super combo exclusivo": "Super Combo Exclusivo",
  "super combo": "Super Combo Exclusivo",
  "combo exclusivo": "Super Combo Exclusivo"
};

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.BRAVOPAY_API_KEY) return json({ error: "Pagamento ainda não configurado no servidor." }, 500);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

    const requestedGift = String(body?.gift || "").trim();
    const normalized = normalize(requestedGift);
    let gift = Object.prototype.hasOwnProperty.call(GIFTS, requestedGift) ? requestedGift : ALIASES[normalized];
    const requestedAmount = Number(body?.amount_cents);
    if (!gift && Number.isInteger(requestedAmount)) gift = Object.keys(GIFTS).find(name => GIFTS[name] === requestedAmount);
    if (!gift || !Object.prototype.hasOwnProperty.call(GIFTS, gift)) return json({ error: "Plano não reconhecido. Atualize a página e selecione um dos planos disponíveis novamente." }, 400);

    const response = await fetch("https://bravopay.club/api/v1/transactions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.BRAVOPAY_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        amount_cents: GIFTS[gift], method: "pix", anti_desvio: true,
        description: `Presente Letícia Vieira - ${gift}`,
        external_reference: `leticia_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        metadata: { site: "leticia-vieira", gift }
      })
    });
    let data;
    try { data = await response.json(); } catch { return json({ error: "Resposta inválida do provedor de pagamento." }, 502); }
    if (!response.ok) {
      console.error("BravoPay error", response.status, JSON.stringify(data));
      return json({ error: data?.error?.message || "A BravoPay recusou a cobrança." }, response.status);
    }
    if (!data?.id || !data?.pix?.copy_paste) {
      console.error("Resposta inesperada da BravoPay", JSON.stringify(data));
      return json({ error: "A BravoPay não retornou os dados do Pix esperados." }, 502);
    }
    return json({ id: data.id, copy_paste: data.pix.copy_paste, expires_at: data.pix.expires_at || null, anti_desvio: data.anti_desvio || null });
  } catch (error) {
    console.error("Erro ao criar Pix", error);
    return json({ error: "Erro interno ao gerar o Pix." }, 500);
  }
}
