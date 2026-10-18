const allowedOrigins = new Set([
  "https://ashu377.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
const recentRequests = new Map<string, number[]>();
function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://ashu377.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type":"application/json" } });
}
function cleanMatches(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,20).map((m:any)=>({
    home:String(m.home||"").slice(0,80), away:String(m.away||"").slice(0,80),
    competition:String(m.competition||"").slice(0,80), kickoff:String(m.kickoff||"").slice(0,40),
    source:String(m.source||"").slice(0,40),
    prediction:m.prediction?{home:Number(m.prediction.home)||0,draw:Number(m.prediction.draw)||0,away:Number(m.prediction.away)||0,confidence:String(m.prediction.confidence||"").slice(0,100)}:null,
  }));
}
function rateLimited(ip: string) {
  const now=Date.now(); const recent=(recentRequests.get(ip)||[]).filter(t=>now-t<60_000);
  if(recent.length>=8){recentRequests.set(ip,recent);return true;}
  recent.push(now);recentRequests.set(ip,recent);return false;
}
Deno.serve(async (req) => {
  const origin=req.headers.get("origin");
  if(origin && !allowedOrigins.has(origin)) return json({error:"Origin not allowed."},403,origin);
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors(origin)});
  if(req.method!=="POST") return json({error:"Use POST."},405,origin);
  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim();
  if(rateLimited(ip)) return json({error:"Too many chat requests from this connection. Please wait a minute and try again."},429,origin);
  const key=Deno.env.get("OPENROUTER_API_KEY");
  if(!key) return json({error:"OpenRouter is not configured on the secure backend yet."},503,origin);
  let body:any; try{body=await req.json();}catch{return json({error:"Invalid JSON request."},400,origin);}
  const message=typeof body.message==="string"?body.message.trim():"";
  if(!message || message.length>1200) return json({error:"Message must be between 1 and 1,200 characters."},400,origin);
  const history=Array.isArray(body.history)?body.history.slice(-8).filter((m:any)=>["user","assistant"].includes(m?.role)&&typeof m?.content==="string").map((m:any)=>({role:m.role,content:m.content.slice(0,1200)})):[];
  const matches=cleanMatches(body.matches);
  const dataContext=matches.length?JSON.stringify(matches):"No fixture records are currently loaded.";
  const demoNote=body.demoMode?"The app is currently in DEMO mode. All fixtures and probabilities are fictional examples; never present them as real matches.":"Use the supplied records for claims about current fixtures and predictions. They may be incomplete or stale; state their source and kickoff when relevant.";
  const system=`You are MatchLens Chat, a friendly assistant inside a sports analysis website. Respond helpfully to the user's message, including general questions. For live sports facts, use only the fixture context supplied below; do not invent live scores, odds, injuries, lineups, or results, and say when data is missing. ${demoNote} Explain probability as uncertainty, never guarantee outcomes, and do not encourage gambling or claim a prediction is a sure bet. Keep answers concise and readable. If the user asks you to search the web or another platform, be transparent that external web search is not connected yet. Fixture context JSON: ${dataContext}`;
  try{
    const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json","HTTP-Referer":"https://ashu377.github.io/matchlens-football-predictor/","X-OpenRouter-Title":"MatchLens"},
      body:JSON.stringify({model:"openrouter/free",messages:[{role:"system",content:system},...history,{role:"user",content:message}],max_tokens:500,temperature:0.35}),
      signal:AbortSignal.timeout(25_000),
    });
    const data=await response.json();
    if(!response.ok) return json({error:response.status===429?"Free model is busy or rate-limited. Try again shortly.":"The free AI provider could not complete that request."},response.status===429?429:502,origin);
    const content=data.choices?.[0]?.message?.content;
    const reply=typeof content==="string"?content:Array.isArray(content)?content.map((x:any)=>x.text||"").join(""):"";
    if(!reply.trim()) return json({error:"The AI returned an empty reply. Try again."},502,origin);
    return json({reply:reply.trim(),model:"openrouter/free"},200,origin);
  }catch(_e){return json({error:"The AI service is temporarily unreachable. Please try again."},502,origin);}
});
