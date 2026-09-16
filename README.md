# Letícia Vieira + BravoPay

Site com frontend e backend. A chave BravoPay fica somente no servidor.

## Rodar no computador
1. Instale Node.js 18+.
2. Abra o terminal nesta pasta.
3. Rode `npm install`.
4. Defina `BRAVOPAY_API_KEY` no ambiente.
5. Rode `npm start`.
6. Abra `http://localhost:3000`.

## Importante
Nunca coloque a chave `bp_live_...` dentro do `public/index.html` ou em JavaScript que roda no navegador.

## Produção
No hosting, configure:
- `BRAVOPAY_API_KEY` = sua chave secreta da BravoPay
- `BRAVOPAY_WEBHOOK_SECRET` = segredo gerado ao cadastrar o webhook

Webhook: `https://SEU-DOMINIO/api/webhook/bravopay`
