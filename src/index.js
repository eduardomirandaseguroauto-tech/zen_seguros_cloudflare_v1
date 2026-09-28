function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function handleQuote(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Método não permitido.' }, 405);
  }

  const appsScriptUrl = env.APPS_SCRIPT_URL;
  const apiSecret = env.APPS_SCRIPT_SECRET;

  if (!appsScriptUrl || !apiSecret) {
    return json({ ok: false, message: 'Integração ainda não configurada no servidor.' }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, message: 'Dados inválidos.' }, 400);
  }

  if (String(data.company || '').trim()) {
    return json({ ok: false, message: 'Envio inválido.' }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, secret: apiSecret }),
      redirect: 'follow',
      signal: controller.signal
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return json({ ok: false, message: 'Resposta inválida do serviço de cotações.' }, 502);
    }

    if (!response.ok || !payload.ok) {
      return json({ ok: false, message: payload.message || 'Não foi possível concluir o envio.' }, 400);
    }

    return json(payload, 200);
  } catch (err) {
    const message = err && err.name === 'AbortError'
      ? 'O envio demorou mais que o esperado. Tente novamente.'
      : 'Não foi possível enviar sua cotação agora. Tente novamente em instantes.';
    return json({ ok: false, message }, 502);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/cotacao') {
      return handleQuote(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
