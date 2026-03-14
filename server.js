/**
 * NEXUS DATING APP — SERVER v4
 * Supabase-powered backend
 * Run: node server.js
 * Admin: http://localhost:3000/admin (pass: nexus_admin_2025)
 *
 * SUPABASE SETUP:
 * Set environment variables:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_ANON_KEY=your-anon-key
 *   SUPABASE_SERVICE_KEY=your-service-role-key (for admin operations)
 *
 * Run the SQL in supabase-schema.sql in your Supabase SQL editor first.
 */
'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const crypto = require('crypto');

const PORT       = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'nexus_admin_2025';
const PUBLIC     = path.join(__dirname, 'public');

// Supabase config — set via env vars
const SUPABASE_URL         = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// ── Helpers ─────────────────────────────────────────────────────
function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now()      { return new Date().toISOString(); }
function formatTime(){ const d=new Date(),h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0'),a=h>=12?'PM':'AM'; return `${h%12||12}:${m} ${a}`; }

// ── Supabase REST helper ─────────────────────────────────────────
async function sbFetch(path, options = {}, useServiceKey = false) {
  if (!SUPABASE_ENABLED) return null;
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Supabase error]', path, err);
    return null;
  }
  const ct = res.headers.get('content-type');
  return ct && ct.includes('json') ? res.json() : null;
}

// ── In-memory fallback stores (used when Supabase not configured) ─
const accounts   = {};
const sessions   = {};
const otpStore   = {};
const adminSessions = {};
const profiles   = {};
const matchesDB  = {};
const msgsDB     = {};
const blockedDB  = {};

// Demo users for discover queue
const demoUsers = [
  { id:'u1', name:'Sofia A.',  age:26, location:'Cape Town', init:'SA', color:'#E8604C', mutuals:3, online:true,  interests:['Hiking','Design','Coffee','Books'],      lookingFor:'something-serious',  prompt1:"I'm happiest when I'm…",  ans1:"hiking up Table Mountain with a podcast",                    photos:[], bio:'' },
  { id:'u2', name:'Jamie K.',  age:29, location:'Cape Town', init:'JK', color:'#2ECC71', mutuals:2, online:false, interests:['Food','Photography','Wine','Travel'],    lookingFor:'casual',             prompt1:"A perfect Sunday looks like…",ans1:"farmer's market, long brunch, accidental afternoon nap",     photos:[], bio:'' },
  { id:'u3', name:'Marco R.',  age:31, location:'Cape Town', init:'MR', color:'#3B82F6', mutuals:4, online:true,  interests:['Running','Tech','Guitar','Cooking'],     lookingFor:'something-serious',  prompt1:"The way to my heart is…",  ans1:"a great playlist and actually showing up on time",           photos:[], bio:'' },
  { id:'u4', name:'Anya L.',   age:27, location:'Cape Town', init:'AL', color:'#8B5CF6', mutuals:1, online:true,  interests:['Architecture','Sustainability','Travel'], lookingFor:'open-to-anything',  prompt1:"I geek out about…",        ans1:"sustainable materials — rammed earth, specifically",         photos:[], bio:'' },
  { id:'u5', name:'Dev P.',    age:30, location:'Cape Town', init:'DP', color:'#F59E0B', mutuals:2, online:false, interests:['Music','Vinyl','Film','Basketball'],      lookingFor:'casual',             prompt1:"My soundtrack right now…", ans1:"somewhere between lo-fi and jazz",                           photos:[], bio:'' },
  { id:'u6', name:'Kai L.',    age:28, location:'Cape Town', init:'KL', color:'#06B6D4', mutuals:3, online:true,  interests:['Running','Wellness','Surfing','Cooking'], lookingFor:'something-serious', prompt1:"Non-negotiable for me…",   ans1:"morning movement of some kind — even just a walk counts",    photos:[], bio:'' },
  { id:'u7', name:'Priya R.',  age:25, location:'Cape Town', init:'PR', color:'#EC4899', mutuals:2, online:false, interests:['Reading','Travel','Wine','Art'],          lookingFor:'open-to-anything',  prompt1:"Hot take…",                ans1:"a great book is always better than the movie, no exceptions", photos:[], bio:'' },
  { id:'u8', name:'Theo N.',   age:32, location:'Cape Town', init:'TN', color:'#10B981', mutuals:5, online:true,  interests:['Cooking','Wine','Travel','Markets'],      lookingFor:'something-serious', prompt1:"Love at first bite…",       ans1:"yes — food is how I communicate affection",                  photos:[], bio:'' },
];

// ── In-memory helpers ─────────────────────────────────────────────
function createSession(phone) { const t=uid()+uid(); sessions[t]=phone; return t; }
function getSession(req) { const h=req.headers['x-session-token']||''; return sessions[h]?{token:h,phone:sessions[h]}:null; }
function createAdminSession() { const t='adm_'+uid()+uid(); adminSessions[t]=true; return t; }
function isAdmin(req) { const h=req.headers['x-session-token']||''; return !!adminSessions[h]; }
function getProfile(phone) {
  if (!profiles[phone]) profiles[phone] = {
    phone, name:'', age:'', location:'', gender:'', interestedIn:'Everyone',
    interests:[], lookingFor:'', lookingForCustom:'',
    prompt1:"I'm happiest when I'm…", ans1:'',
    photos:[], bio:'', importedFrom:null,
    loginMethod:'phone', joinedAt:now(), lastSeen:now(),
  };
  return profiles[phone];
}
function getMatches(phone) { if(!matchesDB[phone]) matchesDB[phone]=[]; return matchesDB[phone]; }
function getMsgs(phone,mid) { if(!msgsDB[phone]) msgsDB[phone]={}; if(!msgsDB[phone][mid]) msgsDB[phone][mid]=[]; return msgsDB[phone][mid]; }
function getBlocked(phone) { if(!blockedDB[phone]) blockedDB[phone]=new Set(); return blockedDB[phone]; }

// ── MIME ──────────────────────────────────────────────────────────
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp' };

function jsonRes(res,status,data) {
  res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Session-Token'});
  res.end(JSON.stringify(data));
}
function parseBody(req) {
  return new Promise(resolve=>{let body='';req.on('data',c=>{body+=c;if(body.length>10_000_000)body=body.slice(0,10_000_000);});req.on('end',()=>{try{resolve(JSON.parse(body));}catch{resolve({});}});});
}
function serveStatic(res,filePath) {
  fs.readFile(filePath,(err,data)=>{if(err){jsonRes(res,404,{error:'Not found'});return;}res.writeHead(200,{'Content-Type':MIME[path.extname(filePath)]||'text/plain'});res.end(data);});
}

// ── Server ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const p=url.parse(req.url,true); const pn=p.pathname; const m=req.method;
  if(m==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Session-Token'});res.end();return;}

  // ── AUTH ─────────────────────────────────────────────────────────
  if (pn==='/api/auth/otp/send' && m==='POST') {
    const b=await parseBody(req);
    const phone=(b.phone||'').replace(/\s/g,'');
    if(!phone||phone.length<7) return jsonRes(res,400,{error:'Invalid phone number'});
    const code=String(Math.floor(100000+Math.random()*900000));
    otpStore[phone]={code,expires:Date.now()+10*60*1000};
    // console.log(`[OTP] ${phone} → ${code}`);
    return jsonRes(res,200,{success:true,message:'OTP sent',_dev_code:code});
  }

  if (pn==='/api/auth/otp/verify' && m==='POST') {
    const b=await parseBody(req);
    const phone=(b.phone||'').replace(/\s/g,'');
    const entry=otpStore[phone];
    if(!entry) return jsonRes(res,400,{error:'No OTP requested'});
    if(Date.now()>entry.expires){delete otpStore[phone];return jsonRes(res,400,{error:'OTP expired'});}
    if(b.code!==entry.code) return jsonRes(res,401,{error:'Incorrect code'});
    delete otpStore[phone];
    if(!accounts[phone]){accounts[phone]={phone,createdAt:now(),loginMethod:'phone'};}
    accounts[phone].lastSeen=now();
    const token=createSession(phone);
    return jsonRes(res,200,{success:true,token,isNewUser:!profiles[phone]?.name,profile:getProfile(phone)});
  }

  if (pn==='/api/auth/social' && m==='POST') {
    const b=await parseBody(req);
    if(!b.provider||!b.token) return jsonRes(res,400,{error:'provider and token required'});
    const socialId=`${b.provider}_${b.token}`;
    if(!accounts[socialId]){accounts[socialId]={phone:socialId,createdAt:now(),loginMethod:b.provider};const prof=getProfile(socialId);prof.name=b.name||'';prof.loginMethod=b.provider;if(b.avatar)prof.photos=[{type:'url',src:b.avatar}];}
    accounts[socialId].lastSeen=now();
    const token=createSession(socialId);
    return jsonRes(res,200,{success:true,token,isNewUser:!profiles[socialId]?.name,profile:getProfile(socialId)});
  }

  if (pn==='/api/auth/logout' && m==='POST') {
    const sess=getSession(req); if(sess) delete sessions[sess.token];
    return jsonRes(res,200,{success:true});
  }

  if (pn==='/api/auth/me' && m==='GET') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    return jsonRes(res,200,{success:true,profile:getProfile(sess.phone)});
  }

  // ── SUPABASE CONFIG (for client) ─────────────────────────────────
  if (pn==='/api/config' && m==='GET') {
    return jsonRes(res,200,{success:true,supabase:{url:SUPABASE_URL,anonKey:SUPABASE_ANON_KEY,enabled:SUPABASE_ENABLED}});
  }

  // ── ADMIN ─────────────────────────────────────────────────────────
  if (pn==='/api/admin/login' && m==='POST') {
    const b=await parseBody(req);
    if(b.password!==ADMIN_PASS) return jsonRes(res,401,{error:'Wrong password'});
    const token=createAdminSession();
    return jsonRes(res,200,{success:true,token});
  }

  if (pn==='/api/admin/stats' && m==='GET') {
    if(!isAdmin(req)) return jsonRes(res,401,{error:'Admin only'});
    const allPhones=Object.keys(accounts);
    const totalUsers=allPhones.length;
    const totalMatches=Object.values(matchesDB).reduce((n,arr)=>n+arr.length,0);
    const totalMessages=Object.values(msgsDB).reduce((n,obj)=>n+Object.values(obj).reduce((a,arr)=>a+arr.length,0),0);
    const onlineNow=Object.values(accounts).filter(a=>a.lastSeen&&(Date.now()-new Date(a.lastSeen).getTime())<5*60*1000).length;
    const byMethod=allPhones.reduce((o,ph)=>{const lm=accounts[ph].loginMethod||'phone';o[lm]=(o[lm]||0)+1;return o;},{});
    const recent7=allPhones.filter(ph=>accounts[ph].createdAt&&(Date.now()-new Date(accounts[ph].createdAt).getTime())<7*24*3600*1000).length;
    return jsonRes(res,200,{success:true,data:{totalUsers,totalMatches,totalMessages,onlineNow,byMethod,recent7,supabaseEnabled:SUPABASE_ENABLED}});
  }

  if (pn==='/api/admin/users' && m==='GET') {
    if(!isAdmin(req)) return jsonRes(res,401,{error:'Admin only'});
    const list=Object.keys(accounts).map(ph=>{
      const prof=profiles[ph]||{};
      const mats=matchesDB[ph]||[];
      return {id:ph,phone:accounts[ph].loginMethod==='phone'?ph:'—',name:prof.name||'(no name)',age:prof.age,location:prof.location,gender:prof.gender,interests:prof.interests||[],loginMethod:accounts[ph].loginMethod||'phone',joinedAt:accounts[ph].createdAt,lastSeen:accounts[ph].lastSeen,matchCount:mats.length,photoCount:(prof.photos||[]).length};
    });
    return jsonRes(res,200,{success:true,data:list});
  }

  if (/^\/api\/admin\/users\//.test(pn) && m==='DELETE') {
    if(!isAdmin(req)) return jsonRes(res,401,{error:'Admin only'});
    const userId=decodeURIComponent(pn.split('/api/admin/users/')[1]);
    delete accounts[userId];delete profiles[userId];delete matchesDB[userId];delete msgsDB[userId];delete blockedDB[userId];
    delete sessions[Object.keys(sessions).find(t=>sessions[t]===userId)||''];
    return jsonRes(res,200,{success:true,message:'User deleted'});
  }

  // ── PROFILE ────────────────────────────────────────────────────────
  if (pn==='/api/profile' && m==='GET') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    return jsonRes(res,200,{success:true,data:getProfile(sess.phone)});
  }

  if (pn==='/api/profile' && m==='PUT') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const b=await parseBody(req);
    const prof=getProfile(sess.phone);
    const allowed=['name','age','location','gender','interestedIn','interests','lookingFor','lookingForCustom','prompt1','ans1','bio','importedFrom'];
    allowed.forEach(k=>{if(b[k]!==undefined)prof[k]=b[k];});
    if(b.photos!==undefined)prof.photos=b.photos;
    accounts[sess.phone].lastSeen=now();
    return jsonRes(res,200,{success:true,data:prof});
  }

  if (pn==='/api/profile/photo' && m==='POST') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const b=await parseBody(req);
    if(!b.dataUrl) return jsonRes(res,400,{error:'dataUrl required'});
    const prof=getProfile(sess.phone);
    if(!prof.photos) prof.photos=[];
    const photo={type:'base64',src:b.dataUrl,addedAt:now()};
    if(typeof b.index==='number'&&b.index<6){prof.photos[b.index]=photo;}
    else{if(prof.photos.length>=6)return jsonRes(res,400,{error:'Max 6 photos'});prof.photos.push(photo);}
    return jsonRes(res,200,{success:true,data:prof.photos});
  }

  if (/^\/api\/profile\/photo\/\d+$/.test(pn) && m==='DELETE') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const idx=parseInt(pn.split('/').pop());
    const prof=getProfile(sess.phone);
    if(prof.photos) prof.photos.splice(idx,1);
    return jsonRes(res,200,{success:true,data:prof.photos});
  }

  // ── DISCOVER ─────────────────────────────────────────────────────
  if (pn==='/api/discover' && m==='GET') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const matches=getMatches(sess.phone);
    const matchedIds=new Set(matches.map(m=>m.userId));
    const blocked=getBlocked(sess.phone);
    const list=demoUsers.filter(u=>!matchedIds.has(u.id)&&!blocked.has(u.id));
    return jsonRes(res,200,{success:true,data:list});
  }

  if (pn==='/api/users' && m==='GET') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const blocked=getBlocked(sess.phone);
    return jsonRes(res,200,{success:true,data:demoUsers.filter(u=>!blocked.has(u.id))});
  }

  // ── MATCHES ────────────────────────────────────────────────────────
  if (pn==='/api/matches' && m==='GET') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const list=getMatches(sess.phone).map(mt=>({...mt,user:demoUsers.find(u=>u.id===mt.userId)}));
    return jsonRes(res,200,{success:true,data:list});
  }

  if (pn==='/api/matches' && m==='POST') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const b=await parseBody(req);
    const user=demoUsers.find(u=>u.id===b.userId);
    if(!user) return jsonRes(res,404,{error:'User not found'});
    const mats=getMatches(sess.phone);
    const exists=mats.find(mt=>mt.userId===b.userId);
    if(exists) return jsonRes(res,200,{success:true,data:{...exists,user},alreadyMatched:true});
    const nm={id:uid(),userId:b.userId,matchedAt:now(),lastMessage:'',unread:0};
    mats.push(nm);
    return jsonRes(res,201,{success:true,data:{...nm,user}});
  }

  if (/^\/api\/matches\/[^/]+$/.test(pn) && m==='DELETE') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const matchId=pn.split('/api/matches/')[1];
    const mats=getMatches(sess.phone);
    const idx=mats.findIndex(mt=>mt.id===matchId);
    if(idx===-1) return jsonRes(res,404,{error:'Match not found'});
    mats.splice(idx,1);
    if(msgsDB[sess.phone]) delete msgsDB[sess.phone][matchId];
    return jsonRes(res,200,{success:true});
  }

  // ── MESSAGES ───────────────────────────────────────────────────────
  if (/^\/api\/messages\/[^/]+$/.test(pn) && m==='GET') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const matchId=pn.split('/api/messages/')[1];
    const mats=getMatches(sess.phone);
    const match=mats.find(mt=>mt.id===matchId);
    if(match) match.unread=0;
    return jsonRes(res,200,{success:true,data:getMsgs(sess.phone,matchId)});
  }

  if (/^\/api\/messages\/[^/]+$/.test(pn) && m==='POST') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const matchId=pn.split('/api/messages/')[1];
    const b=await parseBody(req);
    if(!b.text?.trim()) return jsonRes(res,400,{error:'Text required'});
    const msgs=getMsgs(sess.phone,matchId);
    const msg={id:uid(),from:'me',text:b.text.trim(),time:formatTime()};
    msgs.push(msg);
    const match=getMatches(sess.phone).find(mt=>mt.id===matchId);
    if(match){match.lastMessage=msg.text;match.unread=0;}
    return jsonRes(res,201,{success:true,data:msg});
  }

  // ── BLOCK ──────────────────────────────────────────────────────────
  if (pn==='/api/block' && m==='POST') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    const b=await parseBody(req);
    if(!b.userId) return jsonRes(res,400,{error:'userId required'});
    getBlocked(sess.phone).add(b.userId);
    const mats=getMatches(sess.phone);
    const idx=mats.findIndex(mt=>mt.userId===b.userId);
    if(idx!==-1){const mid=mats[idx].id;mats.splice(idx,1);if(msgsDB[sess.phone])delete msgsDB[sess.phone][mid];}
    return jsonRes(res,200,{success:true});
  }

  if (/^\/api\/block\/[^/]+$/.test(pn) && m==='DELETE') {
    const sess=getSession(req); if(!sess) return jsonRes(res,401,{error:'Not authenticated'});
    getBlocked(sess.phone).delete(pn.split('/api/block/')[1]);
    return jsonRes(res,200,{success:true});
  }

  // ── HEALTH ─────────────────────────────────────────────────────────
  if (pn==='/api/health' && m==='GET') {
    return jsonRes(res,200,{success:true,status:'ok',uptime:process.uptime(),users:Object.keys(accounts).length,supabaseEnabled:SUPABASE_ENABLED});
  }

  // ── STATIC ─────────────────────────────────────────────────────────
  if(pn==='/') return serveStatic(res,path.join(PUBLIC,'index.html'));
  const sp=path.join(PUBLIC,pn);
  if(fs.existsSync(sp)&&fs.statSync(sp).isFile()) return serveStatic(res,sp);
  return serveStatic(res,path.join(PUBLIC,'index.html'));
});

server.listen(PORT,()=>{
  console.log(`\n┌─────────────────────────────────────────────────────┐`);
  console.log(`│           NEXUS DATING APP — SERVER v4              │`);
  console.log(`├─────────────────────────────────────────────────────┤`);
  console.log(`│  🌐  App:    http://localhost:${PORT}                │`);
  console.log(`│  🔐  Admin password: ${ADMIN_PASS.padEnd(28)}│`);
  console.log(`├─────────────────────────────────────────────────────┤`);
  console.log(`│  Supabase: ${SUPABASE_ENABLED ? '✅ Connected — '+SUPABASE_URL.slice(0,30) : '⚠️  Not configured (set SUPABASE_URL + SUPABASE_ANON_KEY)'}${' '.repeat(Math.max(0, 43 - (SUPABASE_ENABLED ? SUPABASE_URL.slice(0,30).length + 16 : 46)))}│`);
  console.log(`│  OTP codes are logged to this console (dev mode)     │`);
  console.log(`└─────────────────────────────────────────────────────┘\n`);
});
