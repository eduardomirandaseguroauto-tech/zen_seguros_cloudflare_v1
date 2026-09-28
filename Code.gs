const CONFIG = {
  SHEET_NAME: 'Leads',
  DASHBOARD_SHEET: 'Dashboard',
  NOTIFY_EMAIL: 'eduardomiranda.seguroauto@gmail.com',
  CONSULTANT_NAME: 'Eduardo Miranda',
  PRIMARY_WHATSAPP: '5521965761981',
  SECONDARY_WHATSAPP: '5521997329442',
  DIRECT_CALL_PHONE: '5521965761981',
  PHONE_DISPLAY_1: '(21) 96576-1981',
  PHONE_DISPLAY_2: '(21) 99732-9442',
  STATUS: ['Novo Lead','Contato iniciado','Aguardando dados','Cotação em andamento','Cotação enviada','Fechado','Perdido']
};

function doGet() {
  return jsonOutput_({ok:true,service:'ZEN Seguros • Cotações',status:'online'});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    if (!expected || body.secret !== expected) return jsonOutput_({ok:false,message:'Acesso não autorizado.'});
    delete body.secret;
    return jsonOutput_(submitLead_(body));
  } catch (err) {
    return jsonOutput_({ok:false,message:err && err.message ? err.message : 'Erro interno.'});
  }
}

function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra este Apps Script a partir de uma Planilha Google e execute setupSystem novamente.');

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  if (!props.getProperty('API_SECRET')) props.setProperty('API_SECRET', Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''));
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  const headers = ['ID','Data/Hora','Nome','Placa','Telefone','Bairro','Uso em APP','E-mail','Status','Último contato','Próximo retorno','Observações','Origem/UTM','Página','WhatsApp'];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#06152c').setFontColor('#ffffff').setHorizontalAlignment('center');

  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.STATUS,true).setAllowInvalid(false).build();
  sheet.getRange('I2:I').setDataValidation(statusRule);

  const statusRange = sheet.getRange('I2:I');
  const styles = [
    ['Novo Lead','#dbeafe','#1e3a8a'],['Contato iniciado','#fef3c7','#92400e'],['Aguardando dados','#fde68a','#78350f'],
    ['Cotação em andamento','#fed7aa','#9a3412'],['Cotação enviada','#e9d5ff','#6b21a8'],['Fechado','#bbf7d0','#166534'],['Perdido','#e5e7eb','#374151']
  ];
  sheet.setConditionalFormatRules(styles.map(([text,bg,fg]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(bg).setFontColor(fg).setRanges([statusRange]).build()));

  sheet.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
  sheet.getRange('J:K').setNumberFormat('dd/MM/yyyy HH:mm');
  [100,150,190,100,150,150,105,220,180,150,150,280,260,260,120].forEach((w,i)=>sheet.setColumnWidth(i+1,w));
  if (!sheet.getFilter()) sheet.getRange(1,1,Math.max(sheet.getMaxRows(),2),headers.length).createFilter();
  setupDashboard_(ss);
  Logger.log('APPS_SCRIPT_SECRET=' + props.getProperty('API_SECRET'));
  return 'Sistema configurado com sucesso.';
}

function showApiSecret() {
  const secret = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (!secret) throw new Error('Execute setupSystem primeiro.');
  Logger.log('APPS_SCRIPT_SECRET=' + secret);
  return secret;
}

function setupDashboard_(ss) {
  let d = ss.getSheetByName(CONFIG.DASHBOARD_SHEET);
  if (!d) d = ss.insertSheet(CONFIG.DASHBOARD_SHEET);
  d.clear();
  d.getRange('A1:D1').merge().setValue('PAINEL DE LEADS • ZEN SEGUROS').setFontWeight('bold').setFontSize(17).setBackground('#06152c').setFontColor('#ffffff').setHorizontalAlignment('center');
  d.getRange('A2:D2').merge().setValue('Eduardo Miranda • acompanhamento comercial').setBackground('#0b2347').setFontColor('#bfdbfe').setHorizontalAlignment('center');
  const cards = [
    ['Leads recebidos','=COUNTA(Leads!B2:B)'],['Novos leads','=COUNTIF(Leads!I2:I,"Novo Lead")'],
    ['Em atendimento','=COUNTIF(Leads!I2:I,"Contato iniciado")+COUNTIF(Leads!I2:I,"Aguardando dados")+COUNTIF(Leads!I2:I,"Cotação em andamento")'],
    ['Cotações enviadas','=COUNTIF(Leads!I2:I,"Cotação enviada")'],['Fechados','=COUNTIF(Leads!I2:I,"Fechado")'],
    ['Perdidos','=COUNTIF(Leads!I2:I,"Perdido")'],['Taxa de conversão','=IF(B4=0,0,B8/B4)'],
    ['Leads hoje','=COUNTIFS(Leads!B2:B,">="&TODAY(),Leads!B2:B,"<"&TODAY()+1)']
  ];
  d.getRange(4,1,cards.length,1).setValues(cards.map(r=>[r[0]])).setFontWeight('bold');
  cards.forEach((r,i)=>d.getRange(i+4,2).setFormula(r[1]));
  d.getRange('B10').setNumberFormat('0.0%');
  d.setColumnWidth(1,220); d.setColumnWidth(2,135);
}

function submitLead_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(12000);
  try {
    validateLead_(data);
    if (String(data.company || '').trim()) throw new Error('Envio inválido.');

    const phoneDigits = normalizePhone_(data.telefone);
    const cache = CacheService.getScriptCache();
    const cacheKey = 'lead_' + phoneDigits;
    if (cache.get(cacheKey)) throw new Error('Sua solicitação já foi recebida. Aguarde alguns instantes antes de enviar novamente.');
    cache.put(cacheKey,'1',120);

    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error('A aba Leads não foi encontrada. Execute setupSystem novamente.');

    const now = new Date();
    const id = Utilities.getUuid().split('-')[0].toUpperCase();
    const lead = {
      id,
      nome: clean_(data.nome,100), placa: normalizePlate_(data.placa), telefone: formatPhoneBR_(phoneDigits), phoneDigits,
      bairro: clean_(data.bairro,100), app: String(data.app)==='Sim' ? 'Sim' : 'Não', email: clean_(data.email,150).toLowerCase(),
      origem: clean_(data.origem || 'Direto',300), pagina: clean_(data.pagina || '',500)
    };

    const clientWa = whatsappUrlFor_(lead.phoneDigits,'Olá ' + lead.nome + ', aqui é o Eduardo Miranda da ZEN Seguros. Recebi sua solicitação de cotação.');
    sheet.appendRow([lead.id,now,lead.nome,lead.placa,lead.telefone,lead.bairro,lead.app,lead.email,'Novo Lead','','','',lead.origem,lead.pagina,'Abrir WhatsApp']);
    const row = sheet.getLastRow();
    sheet.getRange(row,15).setFormula('=HYPERLINK("' + clientWa.replace(/"/g,'""') + '","Abrir WhatsApp")');

    sendInternalEmail_(lead);
    sendClientEmail_(lead);

    return {
      ok:true,
      id:lead.id,
      message:'Solicitação enviada com sucesso!',
      whatsapp1: whatsappUrlFor_(CONFIG.PRIMARY_WHATSAPP,'Olá Eduardo! Acabei de preencher a cotação no site. Meu nome é ' + lead.nome + ' e a placa é ' + lead.placa + '.'),
      whatsapp2: whatsappUrlFor_(CONFIG.SECONDARY_WHATSAPP,'Olá Eduardo! Acabei de preencher a cotação no site. Meu nome é ' + lead.nome + ' e a placa é ' + lead.placa + '.'),
      phoneDirect:'tel:+' + CONFIG.DIRECT_CALL_PHONE
    };
  } finally { lock.releaseLock(); }
}

function validateLead_(data) {
  if (!data) throw new Error('Dados não recebidos.');
  ['nome','placa','telefone','bairro','app','email'].forEach(k => { if (!String(data[k] || '').trim()) throw new Error('Preencha todos os campos obrigatórios.'); });
  if (String(data.nome).trim().length < 3) throw new Error('Informe seu nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) throw new Error('Informe um e-mail válido.');
  const digits = normalizePhone_(data.telefone);
  if (![10,11,12,13].includes(digits.length)) throw new Error('Informe um telefone válido com DDD.');
  const placa = normalizePlate_(data.placa);
  if (!/^[A-Z0-9]{7}$/.test(placa)) throw new Error('Confira a placa informada. Digite os 7 caracteres, por exemplo ABC1D23.');
  if (!['Sim','Não'].includes(String(data.app))) throw new Error('Informe se o veículo é usado em aplicativo.');
  if (data.consent !== true && data.consent !== 'true') throw new Error('É necessário autorizar o uso dos dados para a cotação.');
}

function sendInternalEmail_(lead) {
  const clientWa = whatsappUrlFor_(lead.phoneDigits,'Olá ' + lead.nome + ', aqui é o Eduardo Miranda da ZEN Seguros. Recebi sua solicitação de cotação.');
  const subject = '🔔 Novo lead #' + lead.id + ' • ' + lead.nome + ' • ' + lead.placa;
  const html = emailShell_('Nova solicitação de cotação',
    emailDataRow_('ID',lead.id)+emailDataRow_('Nome',lead.nome)+emailDataRow_('Placa',lead.placa)+emailDataRow_('Telefone',lead.telefone)+emailDataRow_('Bairro',lead.bairro)+emailDataRow_('Uso em APP',lead.app)+emailDataRow_('E-mail',lead.email)+emailDataRow_('Origem',lead.origem)+
    '<p style="margin:24px 0 0"><a href="'+clientWa+'" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">Chamar cliente no WhatsApp</a></p>'
  );
  MailApp.sendEmail({to:CONFIG.NOTIFY_EMAIL,subject,htmlBody:html,replyTo:lead.email,name:'ZEN Seguros • Novos Leads'});
}

function sendClientEmail_(lead) {
  const wa = whatsappUrlFor_(CONFIG.PRIMARY_WHATSAPP,'Olá Eduardo! Acabei de preencher a cotação no site. Meu nome é ' + lead.nome + ' e a placa é ' + lead.placa + '.');
  const tel = 'tel:+' + CONFIG.DIRECT_CALL_PHONE;
  const html = emailShell_('Cotação recebida com sucesso',
    '<p>Olá, <b>'+escapeHtml_(lead.nome)+'</b>!</p><p>Recebemos sua solicitação para o veículo de placa <b>'+escapeHtml_(lead.placa)+'</b>.</p><p>Eduardo Miranda dará continuidade ao atendimento. Seu protocolo é <b>'+escapeHtml_(lead.id)+'</b>.</p>' +
    '<div style="margin-top:24px"><a href="'+wa+'" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700;margin:0 8px 8px 0">Chamar no WhatsApp</a><a href="'+tel+'" style="display:inline-block;background:#1476ff;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">Ligar agora</a></div>'
  );
  MailApp.sendEmail({to:lead.email,subject:'Recebemos sua cotação • ZEN Seguros',htmlBody:html,name:'Eduardo Miranda | ZEN Seguros'});
}

function getSpreadsheet_(){ const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); if (!id) throw new Error('Sistema ainda não configurado. Execute setupSystem.'); return SpreadsheetApp.openById(id); }
function jsonOutput_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function whatsappUrlFor_(digits,message){ let n=normalizePhone_(digits); if(n.length===10||n.length===11)n='55'+n; return 'https://wa.me/'+n+'?text='+encodeURIComponent(message||''); }
function normalizePlate_(value){ return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7); }
function normalizePhone_(value){ return String(value||'').replace(/\D/g,''); }
function formatPhoneBR_(digits){ let n=normalizePhone_(digits); if(n.startsWith('55')&&(n.length===12||n.length===13))n=n.slice(2); if(n.length===11)return '('+n.slice(0,2)+') '+n.slice(2,7)+'-'+n.slice(7); if(n.length===10)return '('+n.slice(0,2)+') '+n.slice(2,6)+'-'+n.slice(6); return digits; }
function clean_(value,maxLen){ return String(value||'').replace(/[<>]/g,'').trim().slice(0,maxLen||500); }
function escapeHtml_(value){ return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function emailDataRow_(label,value){ return '<div style="padding:10px 0;border-bottom:1px solid #e2e8f0"><span style="display:inline-block;width:115px;color:#64748b">'+escapeHtml_(label)+'</span><b style="color:#0f172a">'+escapeHtml_(value)+'</b></div>'; }
function emailShell_(title,body){ return '<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px"><div style="max-width:640px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbeafe"><div style="padding:22px 26px;background:linear-gradient(135deg,#04152f,#0b4fa5);color:#fff"><div style="font-size:13px;letter-spacing:2px;color:#93c5fd">ZEN SEGUROS</div><h2 style="margin:7px 0 0;font-size:22px">'+escapeHtml_(title)+'</h2></div><div style="padding:26px;color:#334155;line-height:1.55">'+body+'</div></div></div>'; }
