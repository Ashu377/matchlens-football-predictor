(() => {
  const cfg = window.MATCHLENS_CONFIG || {};
  const $ = (sel) => document.querySelector(sel);
  const providers = [
    { key: 'dollarsport', name: 'DollarSport', detail: 'Provider endpoint/auth mapping pending confirmation.' },
    { key: 'sortsai', name: 'Sortsai', detail: 'Provider endpoint/auth mapping pending confirmation.' },
    { key: 'footballData', name: 'football-data.org', detail: 'Football fixtures and results connector.' },
    { key: 'sportmonks', name: 'Sportmonks', detail: 'Football fixtures connector.' }
  ];
  let currentMatches = [];
  let demoMode = false;
  const demoMatches = [
    { id:'demo-1', home:'Northbridge FC', away:'Riverside United', competition:'Example Premier League', kickoff:'2026-10-20T16:00:00Z', source:'DEMO', prediction:{home:54,draw:26,away:20,confidence:'Low · demo ratings'} },
    { id:'demo-2', home:'Harbor Athletic', away:'Mountain Rovers', competition:'Example Premier League', kickoff:'2026-10-20T19:30:00Z', source:'DEMO', prediction:{home:38,draw:29,away:33,confidence:'Low · demo ratings'} },
    { id:'demo-3', home:'Capital Town', away:'Eastfield City', competition:'Example Cup', kickoff:'2026-10-21T18:00:00Z', source:'DEMO', prediction:{home:24,draw:25,away:51,confidence:'Low · demo ratings'} }
  ];

  function fmtDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Kickoff time unavailable';
    return new Intl.DateTimeFormat(undefined, { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(date);
  }
  function setNotice(text, type='') {
    const notice = $('#notice'); notice.textContent = text; notice.className = `notice ${type}`.trim();
  }
  function normalizeMatch(m) {
    const p = m.prediction || {};
    return {
      id: String(m.id || `${m.homeTeam || m.home || 'h'}-${m.awayTeam || m.away || 'a'}-${m.kickoff || ''}`),
      home: m.homeTeam || m.home || 'Home team', away: m.awayTeam || m.away || 'Away team',
      competition: m.competition || 'Football', kickoff: m.kickoff || m.utcDate || '', source: m.source || 'Provider',
      prediction: { home:Number(p.home ?? 33), draw:Number(p.draw ?? 34), away:Number(p.away ?? 33), confidence:p.confidence || 'Limited history' }
    };
  }
  function renderMatches() {
    const list = $('#match-list');
    const selected = $('#league-filter').value;
    const matches = currentMatches.filter(m => selected === 'all' || m.competition === selected);
    $('#stat-matches').textContent = String(matches.length);
    $('#demo-tag').hidden = !demoMode;
    if (!matches.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-ball">⚽</div><strong>No upcoming fixtures found</strong><p>Try another competition or refresh the provider feed.</p></div>';
      renderChart([]); renderInsights([]); return;
    }
    list.innerHTML = matches.map(m => {
      const p = m.prediction;
      return `<article class="match-card"><div class="match-meta"><span class="competition">${escapeHtml(m.competition)}</span><span>${escapeHtml(fmtDate(m.kickoff))}</span></div><div class="match-teams"><div class="team">${escapeHtml(m.home)}</div><span class="versus">VS</span><div class="team away">${escapeHtml(m.away)}</div></div><div class="prob-labels"><span>HOME ${p.home}%</span><span>DRAW ${p.draw}%</span><span>AWAY ${p.away}%</span></div><div class="prob-bar" role="img" aria-label="Home ${p.home} percent, draw ${p.draw} percent, away ${p.away} percent"><i class="prob-home" style="width:${p.home}%"></i><i class="prob-draw" style="width:${p.draw}%"></i><i class="prob-away" style="width:${p.away}%"></i></div><div class="match-foot"><span>Data: ${escapeHtml(m.source)}</span><span class="confidence">${escapeHtml(p.confidence)}</span></div></article>`;
    }).join('');
    renderChart(matches); renderInsights(matches);
  }
  function renderChart(matches) {
    const chart = $('#outcome-chart');
    if (!matches.length) { chart.innerHTML = '<div class="chart-empty">Load matches to see the forecast distribution.</div>'; return; }
    const avg = ['home','draw','away'].map(k => Math.round(matches.reduce((s,m)=>s+m.prediction[k],0)/matches.length));
    chart.innerHTML = `<div class="chart-column"><strong>${avg[0]}%</strong><span style="height:${Math.max(5,avg[0])}%;background:var(--green)"></span><small>Home</small></div><div class="chart-column"><strong>${avg[1]}%</strong><span style="height:${Math.max(5,avg[1])}%;background:#75879f"></span><small>Draw</small></div><div class="chart-column"><strong>${avg[2]}%</strong><span style="height:${Math.max(5,avg[2])}%;background:#83baff"></span><small>Away</small></div>`;
  }
  function renderInsights(matches) {
    const root = $('#insight-content');
    if (!matches.length) { root.innerHTML = '<div class="insight-placeholder">Load match data and I’ll summarize the strongest probability signals and data gaps.</div>'; return; }
    const top = [...matches].sort((a,b)=>Math.max(b.prediction.home,b.prediction.away)-Math.max(a.prediction.home,a.prediction.away))[0];
    const fav = top.prediction.home >= top.prediction.away ? top.home : top.away;
    const margin = Math.abs(top.prediction.home-top.prediction.away);
    const drawHeavy = matches.filter(m=>m.prediction.draw>=30).length;
    const statements = [
      `${escapeHtml(fav)} has the strongest single-side probability in the current feed (${Math.max(top.prediction.home,top.prediction.away)}%) against ${escapeHtml(top.home===fav?top.away:top.home)}.`,
      `${drawHeavy} of ${matches.length} listed match${matches.length===1?'':'es'} have draw probability of 30% or higher.`,
      margin < 12 ? 'The leading match forecast is close; treat the difference as weak evidence, not a confident call.' : 'Forecasts use a simple Elo-style baseline; recent form, lineup news and injuries are not yet included.'
    ];
    root.innerHTML = statements.map(s=>`<div class="insight-item"><span class="insight-bullet">✦</span><span>${s}</span></div>`).join('');
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function updateProviders(items=[]) {
    const statusMap = new Map((items || []).map(p => [p.key,p]));
    const root = $('#provider-list');
    root.innerHTML = providers.map(p => {
      const item = statusMap.get(p.key) || {};
      const connected = item.status === 'connected' || item.status === 'ok';
      const status = item.status === 'needs_setup' ? 'Needs setup' : item.status === 'error' ? 'Error' : connected ? 'Connected' : 'Not configured';
      return `<article class="provider-card"><div class="provider-row"><span class="provider-name">${escapeHtml(p.name)}</span><span class="provider-status ${connected?'connected':''}">${escapeHtml(status)}</span></div><div class="provider-detail">${escapeHtml(item.message || p.detail)}</div></article>`;
    }).join('');
    const connectedCount = providers.filter(p => ['connected','ok'].includes((statusMap.get(p.key)||{}).status)).length;
    $('#stat-sources').innerHTML = `${connectedCount} <em>/ 4</em>`;
  }
  async function refresh() {
    const url = cfg.supabaseUrl && cfg.functionName ? `${cfg.supabaseUrl.replace(/\/$/,'')}/functions/v1/${encodeURIComponent(cfg.functionName)}` : '';
    if (!url) {
      setNotice('Backend not configured yet. Demo mode works now; API credentials must be added to the secure server environment.', '');
      updateProviders(); return;
    }
    const btn = $('#refresh-btn'); btn.disabled = true; btn.textContent = 'Loading…';
    setNotice('Requesting fixtures and results from the secure backend…');
    try {
      const headers = { 'Content-Type':'application/json' };
      if (cfg.supabaseAnonKey) { headers.apikey = cfg.supabaseAnonKey; headers.Authorization = `Bearer ${cfg.supabaseAnonKey}`; }
      const response = await fetch(url, { method:'POST', headers, body:JSON.stringify({ daysAhead:14, historyDays:120 }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Backend returned ${response.status}`);
      currentMatches = (payload.matches || []).map(normalizeMatch); demoMode = false;
      updateProviders(payload.providers || []);
      $('#stat-updated').textContent = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date());
      populateLeagues();
      setNotice(payload.matches?.length ? `Loaded ${payload.matches.length} fixtures. ${payload.note || ''}` : (payload.note || 'No fixtures returned by connected providers.'), payload.matches?.length ? 'success' : '');
      renderMatches();
    } catch (err) {
      setNotice(`Could not load provider data: ${err.message}. Check backend deployment and provider secrets.`, 'error');
    } finally { btn.disabled = false; btn.textContent = '↻ Refresh data'; }
  }
  function loadDemo() {
    currentMatches = demoMatches.map(normalizeMatch); demoMode = true;
    $('#stat-updated').textContent = 'Demo'; $('#league-filter').innerHTML = '<option value="all">All competitions</option>';
    updateProviders(); setNotice('Demo fixtures loaded. These are fictional examples—not real matches or API data.', 'success'); renderMatches();
  }
  function populateLeagues() {
    const options = [...new Set(currentMatches.map(m=>m.competition))];
    $('#league-filter').innerHTML = '<option value="all">All competitions</option>'+options.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  }
  $('#today-label').textContent = new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(new Date());
  $('#refresh-btn').addEventListener('click', refresh);
  $('#demo-btn').addEventListener('click', loadDemo);
  $('#league-filter').addEventListener('change', renderMatches);

  const chatPanel = $('#chat-panel');
  const chatToggle = $('#chat-toggle');
  const chatLog = $('#chat-log');
  const chatInput = $('#chat-input');
  const chatHistory = [];
  function addChatMessage(role, text, extra='') {
    const el=document.createElement('div'); el.className=`chat-message ${role} ${extra}`.trim(); el.textContent=text; chatLog.appendChild(el); chatLog.scrollTop=chatLog.scrollHeight; return el;
  }
  function toggleChat(show) {
    chatPanel.hidden=!show; chatToggle.setAttribute('aria-expanded',String(show));
    if (show) chatInput.focus(); else chatToggle.focus();
  }
  chatToggle.addEventListener('click',()=>toggleChat(chatPanel.hidden));
  $('#chat-close').addEventListener('click',()=>toggleChat(false));
  document.querySelectorAll('.chat-prompt').forEach(button=>button.addEventListener('click',()=>{chatInput.value=button.textContent;$('#chat-form').requestSubmit();}));
  $('#chat-form').addEventListener('submit', async (event)=>{
    event.preventDefault(); const message=chatInput.value.trim(); if(!message)return;
    addChatMessage('user',message); chatInput.value=''; chatHistory.push({role:'user',content:message});
    const waiting=addChatMessage('assistant','Thinking…','pending'); $('#chat-send').disabled=true;
    const url=cfg.supabaseUrl?`${cfg.supabaseUrl.replace(/\/$/,'')}/functions/v1/${encodeURIComponent(cfg.chatFunctionName||'chat')}`:'';
    if(!url){waiting.remove();addChatMessage('assistant','The secure chat backend is not configured yet.');$('#chat-send').disabled=false;return;}
    try{
      const headers={'Content-Type':'application/json'};
      if(cfg.supabaseAnonKey){headers.apikey=cfg.supabaseAnonKey;headers.Authorization=`Bearer ${cfg.supabaseAnonKey}`;}
      const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({message,history:chatHistory.slice(0,-1).slice(-8),matches:currentMatches.slice(0,20).map(m=>({home:m.home,away:m.away,competition:m.competition,kickoff:m.kickoff,source:m.source,prediction:m.prediction})),demoMode})});
      const payload=await response.json(); if(!response.ok)throw new Error(payload.error||`Chat service returned ${response.status}`);
      waiting.remove(); const reply=String(payload.reply||'I could not form a reply just now.'); addChatMessage('assistant',reply); chatHistory.push({role:'assistant',content:reply}); if(chatHistory.length>16)chatHistory.splice(0,chatHistory.length-16);
    }catch(err){waiting.remove();addChatMessage('assistant',`I couldn't reach the chat service: ${err.message}. Try again in a moment.`);}
    finally{$('#chat-send').disabled=false;chatInput.focus();}
  });

  updateProviders();
  if (cfg.supabaseUrl) refresh();
})();
