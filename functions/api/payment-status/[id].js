export async function onRequestGet(context) {
  try {
    const apiKey = context.env.BRAVOPAY_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Pagamento não configurado." }, { status: 500 });
    }

    const id = context.params.id;
    const response = await fetch(
      `https://bravopay.club/api/v1/transactions/${encodeURIComponent(id)}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        error: data?.error?.message || "Não foi possível consultar o pagamento."
      }, { status: response.status });
    }

    return Response.json({ status: data.status });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro ao consultar pagamento." }, { status: 500 });
  }
}
