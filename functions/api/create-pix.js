const gifts = {
  "Café": 500,
  "Flor": 1000,
  "Presente Especial": 2500,
  "Presente VIP": 5000
};

export async function onRequestPost(context) {
  try {
    const apiKey = context.env.BRAVOPAY_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Pagamento ainda não configurado no servidor." }, { status: 500 });
    }

    const body = await context.request.json();
    const gift = String(body?.gift || "");
    const amountCents = Number(body?.amount_cents);

    if (!gifts[gift] || gifts[gift] !== amountCents) {
      return Response.json({ error: "Presente ou valor inválido." }, { status: 400 });
    }

    const externalReference = `leticia_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const response = await fetch("https://bravopay.club/api/v1/transactions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID()
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
      return Response.json({
        error: data?.error?.message || "A BravoPay recusou a cobrança."
      }, { status: response.status });
    }

    if (!data?.id || !data?.pix?.copy_paste) {
      console.error("Resposta inesperada da BravoPay:", data);
      return Response.json({
        error: "A BravoPay não retornou os dados do Pix esperados."
      }, { status: 502 });
    }

    return Response.json({
      id: data.id,
      copy_paste: data.pix.copy_paste,
      expires_at: data.pix.expires_at || null,
      anti_desvio: data.anti_desvio || null
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro interno ao gerar o Pix." }, { status: 500 });
  }
}
