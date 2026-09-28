(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const form = $('#quoteForm');
  const submitBtn = $('#submitBtn');
  const errorBox = $('#formError');
  const formArea = $('#formArea');
  const successArea = $('#successArea');
  const plateInput = $('#placa');
  const phoneInput = $('#telefone');

  const normalizePlate = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

  plateInput.addEventListener('input', e => { e.target.value = normalizePlate(e.target.value); });
  plateInput.addEventListener('blur', e => { e.target.value = normalizePlate(e.target.value); });

  phoneInput.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d+)/, '($1) $2');
    e.target.value = v;
  });

  const query = new URLSearchParams(location.search);
  const origem = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']
    .map(k => query.get(k) ? `${k}=${query.get(k)}` : '')
    .filter(Boolean).join(' | ') || document.referrer || 'Direto';

  const setError = msg => { errorBox.textContent = msg || ''; errorBox.classList.toggle('active', Boolean(msg)); };
  const setLoading = on => { submitBtn.disabled = on; submitBtn.classList.toggle('loading', on); };

  const validate = data => {
    if (data.company) return 'Envio inválido.';
    if (!data.nome || data.nome.length < 3) return 'Informe seu nome completo.';
    if (normalizePlate(data.placa).length !== 7) return 'Digite os 7 caracteres da placa. Exemplo: ABC1D23.';
    if (data.telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone válido com DDD.';
    if (!data.bairro) return 'Informe seu bairro.';
    if (!['Sim','Não'].includes(data.app)) return 'Informe se o veículo é usado em Uber/99.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Informe um e-mail válido.';
    if (!data.consent) return 'Autorize o uso dos dados para prosseguir.';
    return '';
  };

  form.addEventListener('submit', async e => {
    e.preventDefault(); setError('');
    const data = {
      nome: $('#nome').value.trim(), placa: normalizePlate(plateInput.value), telefone: phoneInput.value.trim(),
      bairro: $('#bairro').value.trim(), app: $('#app').value, email: $('#email').value.trim(),
      consent: $('#consent').checked, company: $('#company').value.trim(), origem, pagina: location.href
    };
    const validationError = validate(data);
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      const response = await fetch('/api/cotacao', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'Não foi possível enviar a solicitação.');
      formArea.style.display = 'none'; successArea.classList.add('active');
      $('#protocol').textContent = result.id ? `Protocolo: ${result.id}` : '';
      if (result.whatsapp1) $('#successWhatsapp').href = result.whatsapp1;
      $('#successPhone').href = result.phoneDirect || 'tel:+5521965761981';
      document.querySelector('#cotacao').scrollIntoView({behavior:'smooth',block:'start'});
    } catch (err) { setError(err?.message || 'Erro no envio. Tente novamente em instantes.'); }
    finally { setLoading(false); }
  });

  $('#newQuoteBtn').addEventListener('click', () => {
    form.reset(); setError(''); successArea.classList.remove('active'); formArea.style.display = 'block';
  });
})();
