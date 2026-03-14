/* ============================================================
   NEXUS DATING APP — v4
   Tinder-style Discover · Supabase · No API Docs · No Pause Profile · No Daily Match Notif
   ============================================================ */
'use strict';

// ── STATE ──────────────────────────────────────────────────────
const State = {
  theme:        localStorage.getItem('nexus_theme') || 'dark',
  sessionToken: localStorage.getItem('nexus_token') || null,
  adminToken:   sessionStorage.getItem('nexus_admin_token') || null,
  page:         'home',
  myProfile:    null,
  discoverQueue:[],
  matches:      [],
  currentConvo: null,
  messages:     {},
  likedIds:     new Set(),
  mobileChatOpen: false,
  authStep:     'method',
  pendingPhone: '',
  supabase:     null,
  supabaseEnabled: false,
};

// ── API ────────────────────────────────────────────────────────
const API = {
  base: '/api',
  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (State.sessionToken) h['X-Session-Token'] = State.sessionToken;
    if (State.adminToken)   h['X-Session-Token'] = State.adminToken;
    return h;
  },
  async get(path) { try { const r=await fetch(this.base+path,{headers:this.headers()}); return r.json(); } catch { return {success:false,error:'Network error'}; } },
  async post(path,body) { try { const r=await fetch(this.base+path,{method:'POST',headers:this.headers(),body:JSON.stringify(body)}); return r.json(); } catch { return {success:false,error:'Network error'}; } },
  async put(path,body)  { try { const r=await fetch(this.base+path,{method:'PUT',headers:this.headers(),body:JSON.stringify(body)}); return r.json(); } catch { return {success:false,error:'Network error'}; } },
  async del(path)       { try { const r=await fetch(this.base+path,{method:'DELETE',headers:this.headers()}); return r.json(); } catch { return {success:false,error:'Network error'}; } },
};

// ── SUPABASE ──────────────────────────────────────────────────
async function initSupabase() {
  try {
    const config = await API.get('/config');
    if (config.success && config.supabase?.enabled) {
      State.supabaseEnabled = true;
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        State.supabase = supabase.createClient(config.supabase.url, config.supabase.anonKey);
        console.log('[Nexus] Supabase connected ✓');
      }
    }
  } catch(e) { console.log('[Nexus] Supabase not configured, using in-memory fallback'); }
}

async function sbSaveProfile(profile) {
  if (!State.supabase) return;
  try {
    const { error } = await State.supabase.from('profiles').upsert({
      user_id: State.sessionToken,
      name: profile.name, age: profile.age, location: profile.location,
      gender: profile.gender, interested_in: profile.interestedIn,
      interests: profile.interests, looking_for: profile.lookingFor,
      looking_for_custom: profile.lookingForCustom,
      prompt1: profile.prompt1, ans1: profile.ans1, bio: profile.bio,
      photos: profile.photos, last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.error('[Supabase] Profile save error:', error);
  } catch(e) { console.error('[Supabase] Profile save exception:', e); }
}

async function sbGetProfiles() {
  if (!State.supabase) return null;
  try {
    const { data, error } = await State.supabase
      .from('profiles')
      .select('*')
      .neq('user_id', State.sessionToken)
      .eq('is_active', true)
      .limit(20);
    if (error) return null;
    return data;
  } catch { return null; }
}

async function sbSaveLike(likedUserId, action) {
  if (!State.supabase) return;
  try {
    await State.supabase.from('likes').upsert({
      liker_id: State.sessionToken, liked_id: likedUserId, action,
    }, { onConflict: 'liker_id,liked_id' });
  } catch(e) { console.error('[Supabase] Like save error:', e); }
}

async function sbSaveMatch(matchData) {
  if (!State.supabase) return;
  try {
    await State.supabase.from('matches').upsert({
      user_id: State.sessionToken, matched_user_id: matchData.userId,
    }, { onConflict: 'user_id,matched_user_id' });
  } catch(e) { console.error('[Supabase] Match save error:', e); }
}

async function sbSaveMessage(matchId, text) {
  if (!State.supabase) return;
  try {
    await State.supabase.from('messages').insert({
      match_id: matchId, from_user: State.sessionToken, text,
    });
  } catch(e) { console.error('[Supabase] Message save error:', e); }
}

// ── ICONS ──────────────────────────────────────────────────────
const Icon = {
  home:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`,
  compass:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  heart:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  heartFill: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  star:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFill:  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  msg:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  user:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  settings:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  moon:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
  sun:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  bell:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  x:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chevronR:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  chevronL:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronD:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronU:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  send:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  search:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  lock:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  users:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  shield:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  zap:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  eye:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  map:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
  trash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
  camera:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  plus:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  facebook:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>`,
  phone:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.01 2.18 2 2 0 012 .01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>`,
  check:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  logout:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  slash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  info:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  target:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  pin:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  android:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L4 20H2"/><path d="M6 6L4 4H2"/><path d="M18 18l2 2h2"/><path d="M18 6l2-2h2"/><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
  apple:     `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
  download:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
};

// ── UTILS ──────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function toast(msg, type='default') {
  let wrap=document.getElementById('toastWrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='toastWrap';wrap.className='toast-wrap';document.body.appendChild(wrap);}
  const t=document.createElement('div');
  const icon=type==='success'?Icon.check:type==='error'?Icon.x:Icon.bell;
  const color=type==='success'?'var(--green)':type==='error'?'var(--accent)':'var(--fg-2)';
  t.className=`toast ${type}`;
  t.innerHTML=`<span style="color:${color}">${icon}</span>${esc(msg)}`;
  wrap.appendChild(t);
  setTimeout(()=>{t.style.animation='slideOut 0.3s ease both';setTimeout(()=>t.remove(),300);},3200);
}

function showConfirm(msg, onYes) {
  const ov=document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML=`<div class="modal-box"><p class="modal-msg">${esc(msg)}</p><div class="modal-btns"><button class="modal-btn-cancel" id="mCancel">Cancel</button><button class="modal-btn-confirm" id="mConfirm">Confirm</button></div></div>`;
  document.body.appendChild(ov);
  document.getElementById('mCancel').onclick=()=>ov.remove();
  document.getElementById('mConfirm').onclick=()=>{ov.remove();onYes();};
}

function setLoading(btnId, loading, label='') {
  const b=document.getElementById(btnId); if(!b)return;
  b.disabled=loading;
  b.innerHTML=loading?'<span class="btn-spinner"></span>':label;
}

function applyTheme(t){
  State.theme=t; document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('nexus_theme',t);
  const btn=document.getElementById('themeBtn'); if(btn) btn.innerHTML=t==='dark'?Icon.moon:Icon.sun;
}
function toggleTheme(){ applyTheme(State.theme==='dark'?'light':'dark'); }

function updateUnreadBadge(){
  const total=State.matches.reduce((n,m)=>n+(m.unread||0),0);
  document.querySelectorAll('.nav-badge-msg').forEach(el=>{el.textContent=total;el.style.display=total>0?'flex':'none';});
  document.querySelectorAll('.bnav-dot-msg').forEach(el=>{el.style.display=total>0?'block':'none';});
  document.querySelectorAll('[data-msg-badge]').forEach(el=>{el.textContent=total>0?total:'';el.style.display=total>0?'flex':'none';});
}

const LOOKING_FOR_LABELS = {
  'something-serious': { emoji:'💍', label:'Something serious', desc:'Long-term relationship' },
  'casual':            { emoji:'✨', label:'Casual dating',      desc:'No pressure, just vibes' },
  'open-to-anything':  { emoji:'🌊', label:'Open to anything',   desc:"Let's see where it goes" },
  'friends-first':     { emoji:'☕', label:'Friends first',      desc:'Build a connection slowly' },
};

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════
function showAuth() {
  document.body.innerHTML = '';
  document.body.style.background = 'var(--bg)';
  renderAuthScreen('method');
}

function renderAuthScreen(step) {
  State.authStep = step;
  let inner = '';

  if (step === 'method') {
    inner = `
      <div class="auth-logo">
        <div class="auth-logo-icon">${Icon.heart}</div>
        <div class="auth-logo-word">nexus</div>
      </div>
      <h1 class="auth-title">Date <em>mutuals,</em><br>not strangers.</h1>
      <p class="auth-sub">Sign in or create your account to start meeting people through your real-world circle.</p>
      <div class="auth-methods">
        <button class="auth-method-btn phone-btn" onclick="renderAuthScreen('phone')">
          <span class="auth-method-icon">${Icon.phone}</span>
          <span class="auth-method-label">Continue with Phone Number</span>
          ${Icon.chevronR}
        </button>
        <button class="auth-method-btn facebook-btn" onclick="socialLogin('facebook')">
          <span class="auth-method-icon fb-icon">${Icon.facebook}</span>
          <span class="auth-method-label">Continue with Facebook</span>
          ${Icon.chevronR}
        </button>
        <button class="auth-method-btn instagram-btn" onclick="socialLogin('instagram')">
          <span class="auth-method-icon ig-icon">${Icon.instagram}</span>
          <span class="auth-method-label">Continue with Instagram</span>
          ${Icon.chevronR}
        </button>
      </div>
      <p class="auth-terms">By continuing you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p>
      <div class="auth-admin-link"><button onclick="showAdminLogin()" class="auth-admin-btn">${Icon.dashboard} Admin</button></div>
    `;
  } else if (step === 'phone') {
    inner = `
      <button class="auth-back" onclick="renderAuthScreen('method')">${Icon.chevronL} Back</button>
      <div class="auth-logo"><div class="auth-logo-icon">${Icon.phone}</div></div>
      <h1 class="auth-title" style="font-size:1.8rem">Enter your number</h1>
      <p class="auth-sub">We'll send a 6-digit code to verify your number.</p>
      <div class="auth-form">
        <div class="phone-input-wrap">
          <select class="auth-country-code" id="countryCode">
            <option value="+27">🇿🇦 +27</option><option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option><option value="+61">🇦🇺 +61</option>
            <option value="+91">🇮🇳 +91</option><option value="+234">🇳🇬 +234</option>
            <option value="+254">🇰🇪 +254</option><option value="+49">🇩🇪 +49</option>
            <option value="+33">🇫🇷 +33</option><option value="+55">🇧🇷 +55</option>
          </select>
          <input class="auth-phone-input input" id="phoneInput" type="tel" placeholder="Phone number" maxlength="15"
            onkeydown="if(event.key==='Enter')sendOTP()">
        </div>
        <button class="auth-submit-btn" id="sendOtpBtn" onclick="sendOTP()">Send Code</button>
      </div>
      <p class="auth-note">Standard messaging rates may apply.</p>
    `;
  } else if (step === 'otp') {
    inner = `
      <button class="auth-back" onclick="renderAuthScreen('phone')">${Icon.chevronL} Back</button>
      <div class="auth-logo"><div class="auth-logo-icon" style="background:var(--green)">${Icon.check}</div></div>
      <h1 class="auth-title" style="font-size:1.8rem">Check your messages</h1>
      <p class="auth-sub">Enter the 6-digit code sent to<br><strong style="color:var(--fg)">${esc(State.pendingPhone)}</strong></p>
      <div class="auth-form">
        <div class="otp-inputs" id="otpInputs">
          ${[0,1,2,3,4,5].map(i=>`<input class="otp-box" id="otp${i}" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" onkeyup="otpKeyup(event,${i})" oninput="otpInput(event,${i})">`).join('')}
        </div>
        <button class="auth-submit-btn" id="verifyOtpBtn" onclick="verifyOTP()">Verify</button>
        <button class="auth-resend-btn" onclick="sendOTP(true)">Resend code</button>
      </div>
      <div class="otp-dev-hint" id="otpDevHint" style="display:none"></div>
    `;
  }

  const wrap = document.createElement('div');
  wrap.className = 'auth-screen';
  wrap.innerHTML = `<div class="auth-card">${inner}</div>`;
  document.body.innerHTML = '';
  document.body.appendChild(wrap);
  applyTheme(State.theme);
  if (step === 'otp')   setTimeout(()=>document.getElementById('otp0')?.focus(), 100);
  if (step === 'phone') setTimeout(()=>document.getElementById('phoneInput')?.focus(), 100);
}

function otpInput(e, i) {
  const v = e.target.value.replace(/\D/g,'');
  e.target.value = v ? v[0] : '';
  if (v && i < 5) document.getElementById(`otp${i+1}`)?.focus();
  const code = [0,1,2,3,4,5].map(n=>document.getElementById(`otp${n}`)?.value||'').join('');
  if (code.length === 6) verifyOTP();
}
function otpKeyup(e, i) {
  if (e.key==='Backspace' && !e.target.value && i>0) document.getElementById(`otp${i-1}`)?.focus();
}

async function sendOTP(resend=false) {
  const cc  = document.getElementById('countryCode')?.value || '+27';
  const num = (document.getElementById('phoneInput')?.value || '').trim();
  if (!num) { toast('Enter your phone number', 'error'); return; }
  const phone = cc + num;
  State.pendingPhone = phone;
  setLoading('sendOtpBtn', true, 'Send Code');
  const res = await API.post('/auth/otp/send', { phone });
  setLoading('sendOtpBtn', false, 'Send Code');
  if (!res.success) { toast(res.error || 'Failed to send code', 'error'); return; }
  if (resend) { toast('New code sent!', 'success'); return; }
  renderAuthScreen('otp');
  if (res._dev_code) {
    const hint = document.getElementById('otpDevHint');
    if (hint) { hint.style.display='block'; hint.textContent=`Dev mode — code: ${res._dev_code}`; }
  }
}

async function verifyOTP() {
  const code = [0,1,2,3,4,5].map(i=>document.getElementById(`otp${i}`)?.value||'').join('');
  if (code.length < 6) { toast('Enter all 6 digits', 'error'); return; }
  setLoading('verifyOtpBtn', true, 'Verify');
  const res = await API.post('/auth/otp/verify', { phone: State.pendingPhone, code });
  setLoading('verifyOtpBtn', false, 'Verify');
  if (!res.success) {
    toast(res.error || 'Incorrect code', 'error');
    [0,1,2,3,4,5].forEach(i=>{const el=document.getElementById(`otp${i}`);if(el){el.value='';el.classList.add('otp-error');setTimeout(()=>el.classList.remove('otp-error'),500);}});
    document.getElementById('otp0')?.focus(); return;
  }
  onAuthSuccess(res);
}

async function socialLogin(provider) {
  const mockData = { facebook:{name:'Alex Johnson',avatar:''}, instagram:{name:'Alex J.',avatar:''} };
  const d = mockData[provider];
  toast(`Connecting to ${provider}…`, 'default');
  await new Promise(r=>setTimeout(r,1200));
  const fakeToken = 'mock_' + Date.now();
  const res = await API.post('/auth/social', { provider, token: fakeToken, name: d.name, avatar: d.avatar });
  if (!res.success) { toast(res.error || 'Login failed', 'error'); return; }
  onAuthSuccess(res);
}

function onAuthSuccess(res) {
  State.sessionToken = res.token;
  State.myProfile    = res.profile;
  localStorage.setItem('nexus_token', res.token);
  toast('Welcome to Nexus! 🎉', 'success');
  launchApp(res.isNewUser || !res.profile?.name);
}

async function logout() {
  showConfirm('Log out of Nexus?', async () => {
    await API.post('/auth/logout', {});
    State.sessionToken = null; State.myProfile = null;
    localStorage.removeItem('nexus_token');
    showAuth();
  });
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════
function showAdminLogin() {
  const ov = document.createElement('div'); ov.className='modal-overlay'; ov.id='adminLoginOverlay';
  ov.innerHTML=`<div class="modal-box" style="max-width:360px"><h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:1rem;color:var(--fg)">Admin Login</h3><input class="input" id="adminPassInput" type="password" placeholder="Admin password" style="margin-bottom:1rem" onkeydown="if(event.key==='Enter')submitAdminLogin()"><div class="modal-btns"><button class="modal-btn-cancel" onclick="document.getElementById('adminLoginOverlay').remove()">Cancel</button><button class="modal-btn-confirm" id="adminLoginBtn" onclick="submitAdminLogin()">Login</button></div></div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('adminPassInput')?.focus(),100);
}

async function submitAdminLogin() {
  const pass = document.getElementById('adminPassInput')?.value;
  setLoading('adminLoginBtn', true, 'Login');
  const res = await API.post('/admin/login', { password: pass });
  setLoading('adminLoginBtn', false, 'Login');
  if (!res.success) { toast('Wrong password', 'error'); return; }
  State.adminToken = res.token;
  sessionStorage.setItem('nexus_admin_token', res.token);
  document.getElementById('adminLoginOverlay')?.remove();
  showAdminDashboard();
}

async function showAdminDashboard() {
  const [statsRes, usersRes] = await Promise.all([
    fetch('/api/admin/stats',{headers:{'X-Session-Token':State.adminToken}}).then(r=>r.json()),
    fetch('/api/admin/users',{headers:{'X-Session-Token':State.adminToken}}).then(r=>r.json()),
  ]);
  const s = statsRes.data || {};
  const users = usersRes.data || [];

  document.body.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-sidebar-brand"><div class="nav-brand-logo">${Icon.heart}</div><span>nexus admin</span></div>
        <nav class="admin-nav">
          <div class="admin-nav-item active" onclick="setAdminTab(this,'overview')">${Icon.dashboard} Overview</div>
          <div class="admin-nav-item" onclick="setAdminTab(this,'users')">${Icon.users} Users</div>
        </nav>
        <div class="admin-sidebar-footer">
          <button class="admin-logout-btn" onclick="adminLogout()">${Icon.logout} Exit Dashboard</button>
        </div>
      </aside>
      <main class="admin-main">
        <div class="admin-topbar">
          <h1 class="admin-topbar-title">Admin Dashboard</h1>
          <div class="admin-topbar-meta">Nexus v4 · ${new Date().toLocaleDateString()} · ${s.supabaseEnabled?'<span style="color:var(--green)">● Supabase connected</span>':'<span style="color:var(--amber)">● In-memory mode</span>'}</div>
        </div>
        <div id="admin-tab-overview" class="admin-tab active">
          <div class="admin-stats-grid">
            ${[{label:'Total Users',value:s.totalUsers||0,color:'accent',icon:Icon.users},{label:'Total Matches',value:s.totalMatches||0,color:'green',icon:Icon.heart},{label:'Messages Sent',value:s.totalMessages||0,color:'blue',icon:Icon.msg},{label:'Online Now',value:s.onlineNow||0,color:'amber',icon:Icon.zap},{label:'New (7 days)',value:s.recent7||0,color:'purple',icon:Icon.check}].map(c=>`<div class="admin-stat-card"><div class="admin-stat-icon ${c.color}">${c.icon}</div><div class="admin-stat-body"><div class="admin-stat-value">${c.value}</div><div class="admin-stat-label">${c.label}</div></div></div>`).join('')}
          </div>
          <div class="admin-section">
            <h2 class="admin-section-title">Login methods</h2>
            <div class="admin-method-bars">
              ${Object.entries(s.byMethod||{phone:0}).map(([method,count])=>{const pct=s.totalUsers?Math.round(count/s.totalUsers*100):0;const icons={phone:Icon.phone,facebook:Icon.facebook,instagram:Icon.instagram};return`<div class="admin-method-row"><span class="admin-method-name">${icons[method]||''} ${method}</span><div class="admin-method-bar-wrap"><div class="admin-method-bar" style="width:${pct}%"></div></div><span class="admin-method-count">${count} (${pct}%)</span></div>`;}).join('')}
            </div>
          </div>
        </div>
        <div id="admin-tab-users" class="admin-tab">
          <div class="admin-section">
            <div class="admin-users-toolbar">
              <h2 style="font-family:var(--font-display);font-weight:700;font-size:1rem">All Users <span class="badge badge-accent">${users.length}</span></h2>
              <div class="search-wrap" style="width:250px"><span class="search-icon">${Icon.search}</span><input class="input search-in" id="adminUserSearch" type="text" placeholder="Search…" oninput="filterAdminUsers(this.value)"></div>
            </div>
            <div class="admin-table-wrap">
              <table class="admin-table" id="adminUsersTable">
                <thead><tr><th>Name</th><th>Phone/ID</th><th>Age</th><th>Location</th><th>Login via</th><th>Photos</th><th>Matches</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody id="adminUsersBody">${renderAdminUsersRows(users)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
  window._adminUsers = users;
}

function renderAdminUsersRows(users) {
  return users.map(u=>`
    <tr id="admin-user-row-${esc(u.id)}">
      <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar avatar-sm" style="background:${u.loginMethod==='facebook'?'#1877F2':u.loginMethod==='instagram'?'#E1306C':'var(--accent)'}">${esc((u.name||'?').charAt(0).toUpperCase())}</div><span style="font-weight:600;font-size:0.85rem">${esc(u.name||'—')}</span></div></td>
      <td><code style="font-size:0.72rem;color:var(--fg-2)">${esc(u.phone||u.id)}</code></td>
      <td>${esc(u.age||'—')}</td>
      <td>${esc(u.location||'—')}</td>
      <td><span class="method-badge method-${u.loginMethod==='phone'?'get':u.loginMethod==='facebook'?'post':'put'}" style="font-size:0.65rem">${u.loginMethod||'phone'}</span></td>
      <td>${u.photoCount||0}</td>
      <td>${u.matchCount||0}</td>
      <td style="font-size:0.72rem;color:var(--fg-3)">${u.joinedAt?new Date(u.joinedAt).toLocaleDateString():'—'}</td>
      <td><button class="admin-action-btn danger" onclick="adminDeleteUser('${esc(u.id)}','${esc(u.name||u.id)}')" title="Delete user">${Icon.trash}</button></td>
    </tr>
  `).join('')||'<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--fg-3)">No users yet</td></tr>';
}

function filterAdminUsers(q) {
  const qlo=q.toLowerCase();
  const filtered=(window._adminUsers||[]).filter(u=>(u.name||'').toLowerCase().includes(qlo)||(u.phone||'').toLowerCase().includes(qlo));
  const body=document.getElementById('adminUsersBody');
  if(body) body.innerHTML=renderAdminUsersRows(filtered);
}

function setAdminTab(el, tab) {
  document.querySelectorAll('.admin-nav-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(`admin-tab-${tab}`)?.classList.add('active');
}

async function adminDeleteUser(userId, name) {
  showConfirm(`Delete user "${name}"? This cannot be undone.`, async()=>{
    const res=await fetch(`/api/admin/users/${encodeURIComponent(userId)}`,{method:'DELETE',headers:{'X-Session-Token':State.adminToken}}).then(r=>r.json());
    if(res.success){document.getElementById(`admin-user-row-${userId}`)?.remove();toast(`User "${name}" deleted.`,'success');}
    else{toast('Failed to delete','error');}
  });
}

function adminLogout() {
  State.adminToken=null; sessionStorage.removeItem('nexus_admin_token'); showAuth();
}

// ═══════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════
async function launchApp(isNew) {
  const mRes = await API.get('/matches');
  if (mRes.success) State.matches = mRes.data;
  buildLayout();
  renderHome();
  renderProfile();
  renderSettings();
  applyTheme(State.theme);
  updateUnreadBadge();
  showPage(isNew ? 'profile' : 'home');
  if (isNew) toast("Welcome! Set up your profile first 👋", 'default');
}

// ── NAVIGATION ──────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+id); if(pg) pg.classList.add('active');
  State.page=id;
  document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===id));
  document.querySelectorAll('.bnav-btn').forEach(el=>el.classList.toggle('active',el.dataset.page===id));
  const titles={home:'Home',discover:'Discover',messages:'Messages',matches:'Matches',profile:'My Profile',settings:'Settings'};
  const nt=document.getElementById('navTitle'); if(nt) nt.textContent=titles[id]||'';
  closeMobileMenu();
  window.scrollTo(0,0);
  if(id==='discover')  loadDiscover();
  if(id==='messages')  loadMessages();
  if(id==='matches')   loadMatches();
}

function openMobileMenu(){ document.getElementById('mobileDrawer')?.classList.add('open'); document.getElementById('drawerOverlay')?.classList.add('open'); document.getElementById('hamburger')?.classList.add('open'); }
function closeMobileMenu(){ document.getElementById('mobileDrawer')?.classList.remove('open'); document.getElementById('drawerOverlay')?.classList.remove('open'); document.getElementById('hamburger')?.classList.remove('open'); }

function buildLayout() {
  const p = State.myProfile || {};
  const initials = p.name ? p.name.charAt(0).toUpperCase() : 'Y';
  const hasPhoto = p.photos && p.photos.length > 0 && p.photos[0]?.src;

  const navList = [
    {id:'home',    icon:Icon.home,    label:'Home'},
    {id:'discover',icon:Icon.compass, label:'Discover'},
    {id:'matches', icon:Icon.heart,   label:'Matches'},
    {id:'messages',icon:Icon.msg,     label:'Messages', msgBadge:true},
    {id:'profile', icon:Icon.user,    label:'My Profile'},
    {id:'settings',icon:Icon.settings,label:'Settings'},
  ];

  document.body.innerHTML = `
    <div id="toastWrap" class="toast-wrap"></div>
    <div id="drawerOverlay" class="drawer-overlay" onclick="closeMobileMenu()"></div>
    <div id="mobileDrawer" class="mobile-drawer">
      <div class="drawer-header">
        <div style="display:flex;align-items:center;gap:8px"><div class="nav-brand-logo">${Icon.heart}</div>nexus</div>
        <button class="drawer-close" onclick="closeMobileMenu()">${Icon.x}</button>
      </div>
      <div class="drawer-nav">
        ${navList.map(item=>`<div class="drawer-item" data-page="${item.id}" onclick="showPage('${item.id}')">${item.icon} ${item.label}${item.msgBadge?`<div class="sidebar-item-badge" data-msg-badge style="margin-left:auto;display:none">0</div>`:''}</div>`).join('')}
        <div class="drawer-item" style="margin-top:1rem;color:var(--accent)" onclick="logout()">${Icon.logout} Log out</div>
      </div>
    </div>
    <header class="nav" id="mainNav">
      <div class="nav-brand"><div class="nav-brand-logo">${Icon.heart}</div>nexus</div>
      <div class="nav-main"><span id="navTitle" class="nav-title"></span></div>
      <div class="nav-actions">
        <button class="nav-icon-btn" id="themeBtn" onclick="toggleTheme()" title="Toggle theme">${State.theme==='dark'?Icon.moon:Icon.sun}</button>
        <button class="nav-icon-btn" style="position:relative" onclick="showPage('messages')">${Icon.msg}<div class="nav-badge nav-badge-msg" style="display:none">0</div></button>
        <div class="nav-avatar" onclick="showPage('profile')" title="My Profile">
          ${hasPhoto?`<img src="${p.photos[0].src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span>${initials}</span>`}
        </div>
        <button class="hamburger" id="hamburger" onclick="openMobileMenu()"><span></span><span></span><span></span></button>
      </div>
    </header>
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Main</div>
        ${navList.map(item=>`<div class="sidebar-item" data-page="${item.id}" onclick="showPage('${item.id}')">${item.icon}<span>${item.label}</span>${item.msgBadge?`<div class="sidebar-item-badge" data-msg-badge style="display:none">0</div>`:''}</div>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" onclick="showPage('profile')">
          <div class="sidebar-user-av">${hasPhoto?`<img src="${p.photos[0].src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span>${initials}</span>`}</div>
          <div class="sidebar-user-info"><h5>${esc(p.name||'Your profile')}</h5><p>${esc(p.location||'Add location')}</p></div>
          <div style="margin-left:auto;color:var(--fg-3)">${Icon.chevronR}</div>
        </div>
        <button class="sidebar-logout" onclick="logout()">${Icon.logout} Log out</button>
      </div>
    </aside>
    <div class="app-shell">
      <div id="page-home"     class="page"></div>
      <div id="page-discover" class="page"></div>
      <div id="page-messages" class="page"></div>
      <div id="page-matches"  class="page"></div>
      <div id="page-profile"  class="page"></div>
      <div id="page-settings" class="page"></div>
    </div>
    <nav class="bottom-nav">
      ${[{id:'home',icon:Icon.home,label:'Home'},{id:'discover',icon:Icon.compass,label:'Discover'},{id:'matches',icon:Icon.heart,label:'Matches'},{id:'messages',icon:Icon.msg,label:'Chat',dot:true},{id:'settings',icon:Icon.settings,label:'More'}].map(b=>`<button class="bnav-btn" data-page="${b.id}" onclick="showPage('${b.id}')">${b.dot?`<span class="bnav-dot bnav-dot-msg" style="display:none"></span>`:''}${b.icon}<span>${b.label}</span></button>`).join('')}
    </nav>
  `;
}

// ── HOME ────────────────────────────────────────────────────────
function renderHome(){
  document.getElementById('page-home').innerHTML=`
    <section class="hero" style="position:relative;overflow:hidden">
      <div class="hero-glow-1"></div><div class="hero-glow-2"></div>
      <div style="position:relative;z-index:1;flex:1;min-width:280px">
        <div class="hero-eyebrow animate-up"><div class="hero-line"></div><span class="badge badge-accent">Mutual connections only</span></div>
        <h1 class="hero-h1 animate-up delay-1">Date <em>mutuals,</em><br>not strangers.</h1>
        <p class="hero-desc animate-up delay-2">Connect with people through your real-world network. Every match shares a mutual — no cold swipes, no catfishing.</p>
        <div class="hero-btns animate-up delay-3">
          <button class="btn-primary" onclick="showPage('discover')">Start discovering</button>
          <button class="btn-secondary" onclick="showPage('profile')">Complete profile →</button>
        </div>
        <div class="hero-stats animate-up delay-4">
          <div><div class="stat-n">94%</div><div class="stat-l">Feel safer</div></div>
          <div><div class="stat-n">3.2×</div><div class="stat-l">More dates</div></div>
          <div><div class="stat-n">50k+</div><div class="stat-l">Users</div></div>
        </div>
      </div>
    </section>
    <section class="why">
      <div class="section-eyebrow">Why Nexus</div>
      <h2 class="section-title" style="font-size:clamp(1.75rem,4vw,2.75rem)">Dating the way it was<br><em>meant to work</em></h2>
      <p class="section-sub">No more swiping blind. Every match comes with context and a shared connection.</p>
      <div class="why-grid">
        ${[{icon:Icon.lock,title:'Anonymous until mutual',desc:'Likes are invisible until you both match.'},{icon:Icon.users,title:'Real-world connections',desc:'Every profile has a 1st or 2nd degree connection through people you know.'},{icon:Icon.shield,title:'Built-in trust',desc:'Shared friends provide natural accountability.'},{icon:Icon.target,title:'What you\'re looking for',desc:'Set your intent — serious, casual, or open. Match with aligned people.'},{icon:Icon.heart,title:'Swipe with purpose',desc:'Tinder-style cards, but every person is already in your circle.'},{icon:Icon.eye,title:'Privacy first',desc:'Your contacts are never notified. Your data stays yours.'}].map(c=>`<div class="why-card"><div class="why-icon">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p></div>`).join('')}
      </div>
    </section>
    <div style="height:3rem"></div>
  `;
}

// ═══════════════════════════════════════════════════════════════
//  DISCOVER — Tinder-style swipe cards
// ═══════════════════════════════════════════════════════════════

let swipeState = {
  isDragging: false,
  startX: 0, startY: 0,
  currentX: 0, currentY: 0,
  cardEl: null,
  threshold: 100,
  activeFilter: 'All',
};

async function loadDiscover() {
  // Try Supabase first for real user profiles
  let realProfiles = null;
  if (State.supabaseEnabled) {
    realProfiles = await sbGetProfiles();
  }

  const res = await API.get('/discover');
  if (res.success) {
    State.discoverQueue = res.data.map(u => ({...u}));
    // If we got real Supabase profiles, merge/prepend them
    if (realProfiles && realProfiles.length > 0) {
      const sbUsers = realProfiles.map(p => ({
        id: p.user_id, name: p.name || 'User', age: p.age || '?',
        location: p.location || 'Cape Town', init: (p.name||'U').charAt(0).toUpperCase(),
        color: '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'),
        mutuals: Math.floor(Math.random()*5)+1, online: Math.random()>0.5,
        interests: p.interests || [], lookingFor: p.looking_for || '',
        prompt1: p.prompt1 || '', ans1: p.ans1 || '', photos: p.photos || [], bio: p.bio || '',
        isRealUser: true,
      }));
      State.discoverQueue = [...sbUsers, ...State.discoverQueue];
    }
  }
  renderDiscover();
}

function renderDiscover() {
  const pg = document.getElementById('page-discover'); if (!pg) return;
  pg.innerHTML = `
    <div class="discover-page">
      <div class="discover-top">
        <h2 class="discover-top-title">Discover</h2>
        <div class="discover-top-count">${Icon.users}<span id="discoverCount">${State.discoverQueue.length}</span></div>
      </div>
      <div class="filter-pills" id="filterPills">
        ${['All','Nearby','Online','New'].map((f,i)=>`<div class="filter-pill ${i===0?'on':''}" onclick="filterDiscover(this,'${f}')">${f}</div>`).join('')}
      </div>
      <div class="swipe-stack" id="swipeStack"></div>
      <div class="swipe-actions" id="swipeActions">
        <button class="swipe-action-btn swipe-btn-pass" onclick="swipeCard('pass')" title="Pass">${Icon.x}</button>
        <button class="swipe-action-btn swipe-btn-info" onclick="toggleCardPrompt()" title="See more">${Icon.info}</button>
        <button class="swipe-action-btn swipe-btn-like" onclick="swipeCard('like')" title="Like">${Icon.heartFill}</button>
        <button class="swipe-action-btn swipe-btn-super" onclick="swipeCard('super')" title="Super like">${Icon.starFill}</button>
      </div>
    </div>
  `;
  renderCardStack();
}

function renderCardStack() {
  const stack = document.getElementById('swipeStack'); if (!stack) return;
  const queue = getFilteredQueue();

  if (queue.length === 0) {
    stack.innerHTML = `
      <div class="no-more-cards">
        <div class="no-more-cards-icon">✨</div>
        <h3>You've seen everyone!</h3>
        <p>Check back soon for new profiles in your circle.</p>
        <button class="btn-primary" style="margin-top:1rem" onclick="loadDiscover()">Refresh</button>
      </div>`;
    document.getElementById('swipeActions')?.style.setProperty('display','none');
    return;
  }

  document.getElementById('swipeActions')?.style.removeProperty('display');
  stack.innerHTML = '';

  // Render up to 3 cards (back to front, so top is last in DOM)
  const visible = queue.slice(0, 3).reverse();
  visible.forEach((user, revIdx) => {
    const cardIdx = visible.length - 1 - revIdx; // 0=top, 1=second, 2=third
    const card = buildCard(user, cardIdx);
    stack.appendChild(card);
  });

  // Attach drag to top card
  const topCard = stack.querySelector('.is-top');
  if (topCard) attachSwipeListeners(topCard, queue[0]);
}

function buildCard(user, stackPosition) {
  const card = document.createElement('div');
  card.className = `swipe-card is-${['top','second','third'][stackPosition] || 'third'}`;
  card.dataset.userId = user.id;

  const photos = user.photos || [];
  const firstPhoto = photos[0]?.src || null;
  const colorStyle = `background: linear-gradient(145deg, ${user.color}33, ${user.color}55)`;

  const lf = LOOKING_FOR_LABELS[user.lookingFor];
  const interests = (user.interests || []).slice(0, 3);

  // Photo dots (show only if multiple photos)
  const photoDots = photos.length > 1 ? `
    <div class="swipe-card-dots">
      ${photos.map((_, i) => `<div class="swipe-card-dot ${i===0?'active':''}" style="width:${i===0?'20px':'8px'}"></div>`).join('')}
    </div>` : '';

  card.innerHTML = `
    <div class="swipe-card-photo" ${!firstPhoto?`style="${colorStyle}"`:''}>
      ${firstPhoto ? `<img src="${firstPhoto}" alt="${esc(user.name)}" draggable="false">` : `
        <div class="swipe-card-photo-placeholder">
          <div class="avatar avatar-xl" style="background:${user.color};font-size:2.5rem">${esc(user.init||'?')}</div>
        </div>`}
    </div>
    <div class="swipe-card-gradient"></div>
    ${photoDots}
    <div class="swipe-card-mutual">
      ${Icon.users} ${user.mutuals} mutual${user.mutuals!==1?'s':''}
    </div>
    <div class="swipe-card-info">
      <div class="swipe-card-name">
        <span>${esc(user.name)}</span>
        <span class="swipe-card-age">${esc(user.age)}</span>
      </div>
      <div class="swipe-card-location">${Icon.pin} ${esc(user.location)}</div>
      ${lf ? `<div class="swipe-card-looking-for">${lf.emoji} ${esc(lf.label)}</div>` : ''}
      ${interests.length > 0 ? `<div class="swipe-card-interests">${interests.map(i=>`<span class="swipe-card-interest-chip">${esc(i)}</span>`).join('')}</div>` : ''}
    </div>
    ${user.prompt1 && user.ans1 ? `
    <div class="swipe-card-prompt" id="card-prompt-${user.id}">
      <div class="swipe-card-prompt-q">${esc(user.prompt1)}</div>
      <div class="swipe-card-prompt-a">"${esc(user.ans1)}"</div>
    </div>` : ''}
    <div class="swipe-like-indicator">LIKE</div>
    <div class="swipe-pass-indicator">NOPE</div>
    <div class="swipe-super-indicator">SUPER</div>
  `;

  return card;
}

function attachSwipeListeners(card, user) {
  // Mouse events
  card.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY, card, user));
  // Touch events
  card.addEventListener('touchstart', e => { const t=e.touches[0]; startDrag(t.clientX, t.clientY, card, user); }, {passive:true});
}

function startDrag(x, y, card, user) {
  swipeState.isDragging = true;
  swipeState.startX = x;
  swipeState.startY = y;
  swipeState.currentX = 0;
  swipeState.currentY = 0;
  swipeState.cardEl = card;
  card.classList.add('no-transition');

  const onMove = (ex, ey) => {
    if (!swipeState.isDragging) return;
    swipeState.currentX = ex - swipeState.startX;
    swipeState.currentY = ey - swipeState.startY;
    const rotate = swipeState.currentX * 0.08;
    card.style.transform = `translateX(${swipeState.currentX}px) translateY(${swipeState.currentY * 0.3}px) rotate(${rotate}deg)`;

    // Show indicators
    const likeEl  = card.querySelector('.swipe-like-indicator');
    const passEl  = card.querySelector('.swipe-pass-indicator');
    const pct = Math.abs(swipeState.currentX) / swipeState.threshold;
    if (swipeState.currentX > 20)  { if(likeEl) likeEl.style.opacity = Math.min(pct, 1); if(passEl) passEl.style.opacity = 0; }
    else if (swipeState.currentX < -20) { if(passEl) passEl.style.opacity = Math.min(pct, 1); if(likeEl) likeEl.style.opacity = 0; }
    else { if(likeEl) likeEl.style.opacity=0; if(passEl) passEl.style.opacity=0; }
  };

  const onEnd = () => {
    if (!swipeState.isDragging) return;
    swipeState.isDragging = false;
    card.classList.remove('no-transition');
    document.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mouseup', mouseUp);
    document.removeEventListener('touchmove', touchMove);
    document.removeEventListener('touchend', touchEnd);

    if (swipeState.currentX > swipeState.threshold) { finalizeSwipe(user, 'like'); }
    else if (swipeState.currentX < -swipeState.threshold) { finalizeSwipe(user, 'pass'); }
    else {
      // Snap back
      card.style.transform = '';
      card.querySelectorAll('.swipe-like-indicator,.swipe-pass-indicator').forEach(el=>el.style.opacity=0);
    }
  };

  const mouseMove = e => onMove(e.clientX, e.clientY);
  const mouseUp   = () => onEnd();
  const touchMove = e => { const t=e.touches[0]; onMove(t.clientX, t.clientY); };
  const touchEnd  = () => onEnd();

  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('mouseup',   mouseUp);
  document.addEventListener('touchmove', touchMove, {passive:true});
  document.addEventListener('touchend',  touchEnd);
}

function finalizeSwipe(user, action) {
  const card = swipeState.cardEl || document.querySelector('.swipe-card.is-top');
  if (!card) return;

  // Animate out
  const dir = action==='like' ? 1 : action==='pass' ? -1 : 0;
  const upDir = action==='super' ? -1 : 0;
  card.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s';
  card.style.transform  = `translateX(${dir * 160}%) translateY(${upDir * 60}%) rotate(${dir * 30}deg)`;
  card.style.opacity    = '0';

  // Process action
  processSwipeAction(user, action);

  setTimeout(() => {
    card.remove();
    updateDiscoverCount();
  }, 420);
}

async function swipeCard(action) {
  const queue = getFilteredQueue();
  if (queue.length === 0) return;
  const user = queue[0];
  finalizeSwipe(user, action);
}

async function processSwipeAction(user, action) {
  if (action === 'like' || action === 'super') {
    if (State.likedIds.has(user.id)) return;
    State.likedIds.add(user.id);

    // Save to Supabase
    await sbSaveLike(user.id, action);

    // Create match via API
    const res = await API.post('/matches', { userId: user.id });
    if (res.success) {
      await sbSaveMatch(res.data);
      State.matches = [res.data, ...State.matches.filter(m=>m.userId!==user.id)];
      updateUnreadBadge();

      // Show match celebration overlay
      showMatchOverlay(user);
    }
  } else {
    await sbSaveLike(user.id, 'pass');
    toast(`Passed on ${user.name}`, 'default');
  }

  // Remove from queue
  const idx = State.discoverQueue.findIndex(u=>u.id===user.id);
  if (idx !== -1) State.discoverQueue.splice(idx, 1);

  // Render next card after animation
  setTimeout(() => renderCardStack(), 450);
}

function showMatchOverlay(user) {
  const ov = document.createElement('div');
  ov.className = 'match-overlay';
  const p = State.myProfile || {};
  const myInit = (p.name||'Y').charAt(0).toUpperCase();
  const hasMyPhoto = p.photos && p.photos[0]?.src;
  const hasTheirPhoto = user.photos && user.photos[0]?.src;

  ov.innerHTML = `
    <div class="match-overlay-title">It's a Match!</div>
    <p class="match-overlay-sub">You and ${esc(user.name)} liked each other 🎉</p>
    <div class="match-overlay-avatars">
      <div class="avatar avatar-xl avatar-ring">
        ${hasMyPhoto ? `<img src="${p.photos[0].src}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:2rem">${myInit}</span>`}
      </div>
      <div class="match-overlay-heart">💛</div>
      <div class="avatar avatar-xl avatar-ring" style="background:${user.color}">
        ${hasTheirPhoto ? `<img src="${user.photos[0].src}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:2rem">${esc(user.init)}</span>`}
      </div>
    </div>
    <div class="match-overlay-btns">
      <button class="btn-primary" onclick="this.closest('.match-overlay').remove();openMatchChat('${esc(State.matches[0]?.id||'')}')">Send a message</button>
      <button class="btn-secondary" onclick="this.closest('.match-overlay').remove()">Keep swiping</button>
    </div>
  `;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });
}

function toggleCardPrompt() {
  const topCard = document.querySelector('.swipe-card.is-top');
  if (!topCard) return;
  const prompt = topCard.querySelector('.swipe-card-prompt');
  if (prompt) prompt.classList.toggle('open');
}

function filterDiscover(el, filter) {
  swipeState.activeFilter = filter;
  document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  renderCardStack();
  updateDiscoverCount();
}

function getFilteredQueue() {
  const queue = State.discoverQueue;
  if (swipeState.activeFilter === 'All') return queue;
  if (swipeState.activeFilter === 'Online') return queue.filter(u=>u.online);
  if (swipeState.activeFilter === 'Nearby') return queue.filter(u=>u.location?.includes('Cape Town'));
  return queue;
}

function updateDiscoverCount() {
  const el = document.getElementById('discoverCount');
  if (el) el.textContent = getFilteredQueue().length;
}

// ── MESSAGES ────────────────────────────────────────────────────
async function loadMessages(){
  const res=await API.get('/matches');
  if(res.success) State.matches=res.data;
  renderMessages(); updateUnreadBadge();
}

function renderMessages(){
  const pg=document.getElementById('page-messages'); if(!pg)return;
  pg.innerHTML=`
    <div class="messages-layout">
      <div class="convos-panel ${State.mobileChatOpen?'mobile-hidden':''}" id="convosPanel">
        <div class="convos-header">
          <h2>Messages</h2>
          <div class="search-wrap"><span class="search-icon">${Icon.search}</span><input class="input search-in" type="text" placeholder="Search…" oninput="filterConvos(this.value)"></div>
        </div>
        <div class="convos-list" id="convosList"></div>
      </div>
      <div class="chat-area ${State.mobileChatOpen?'':'mobile-hidden'}" id="chatArea">
        <div class="chat-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>Select a conversation</p></div>
      </div>
    </div>
  `;
  renderConvosList();
  if(State.currentConvo&&State.matches.find(m=>m.id===State.currentConvo)) loadChat(State.currentConvo);
  else if(State.matches.length>0&&window.innerWidth>700){State.currentConvo=State.matches[0].id;loadChat(State.currentConvo);}
}

function renderConvosList(filter=''){
  const el=document.getElementById('convosList'); if(!el)return;
  const list=filter?State.matches.filter(m=>m.user?.name?.toLowerCase().includes(filter.toLowerCase())):State.matches;
  el.innerHTML=list.map(m=>{
    const u=m.user||{}; const hasPhoto=u.photos&&u.photos[0]?.src;
    return `<div class="convo-row ${m.id===State.currentConvo?'active':''}" onclick="selectConvo('${m.id}')">
      <div class="convo-av">${hasPhoto?`<img class="avatar avatar-md" src="${u.photos[0].src}" style="object-fit:cover">`:`<div class="avatar avatar-md" style="background:${u.color||'#888'}">${u.init||'?'}</div>`}${u.online?'<div class="online-indicator"></div>':''}</div>
      <div class="convo-info"><div class="convo-name">${esc(u.name||'Unknown')}</div><div class="convo-last">${esc(m.lastMessage||'Start a conversation…')}</div></div>
      <div class="convo-meta"><div class="convo-time">${m.unread>0?'now':'1h'}</div>${m.unread>0?`<div class="unread-pill">${m.unread}</div>`:''}</div>
    </div>`;
  }).join('')||'<div style="padding:1.5rem;text-align:center;color:var(--fg-3);font-size:0.82rem">No conversations yet. Start matching!</div>';
}

function filterConvos(v){renderConvosList(v);}

async function selectConvo(id){
  State.currentConvo=id; State.mobileChatOpen=true; renderConvosList();
  document.getElementById('convosPanel')?.classList.add('mobile-hidden');
  document.getElementById('chatArea')?.classList.remove('mobile-hidden');
  await loadChat(id);
}

function backToConvos(){
  State.mobileChatOpen=false;
  document.getElementById('convosPanel')?.classList.remove('mobile-hidden');
  document.getElementById('chatArea')?.classList.add('mobile-hidden');
}

async function loadChat(id){
  const match=State.matches.find(m=>m.id===id); const u=match?.user||{};
  const res=await API.get('/messages/'+id);
  if(res.success){State.messages[id]=res.data;if(match)match.unread=0;updateUnreadBadge();renderConvosList();}
  const msgs=State.messages[id]||[];
  const el=document.getElementById('chatArea'); if(!el)return;
  const hasPhoto=u.photos&&u.photos[0]?.src;
  el.innerHTML=`
    <div class="chat-header">
      <button class="chat-back-btn" onclick="backToConvos()">${Icon.chevronL}</button>
      ${hasPhoto?`<img class="avatar avatar-md" src="${u.photos[0].src}" style="object-fit:cover">`:`<div class="avatar avatar-md" style="background:${u.color||'#888'}">${u.init||'?'}</div>`}
      <div class="chat-header-info"><h4>${esc(u.name||'Match')}</h4><p>${esc(u.location||'')} · ${u.mutuals||0} mutuals</p></div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
        ${u.online?`<span class="badge badge-green" style="font-size:0.62rem">Online</span>`:''}
        <button class="nav-icon-btn" onclick="openMatchMenu('${id}')" style="width:32px;height:32px;font-size:1.2rem;font-weight:700">⋯</button>
      </div>
    </div>
    <div class="chat-msgs" id="chatMsgs">
      ${msgs.length===0?`<div style="text-align:center;color:var(--fg-3);font-size:0.82rem;padding:2rem">You matched with ${esc(u.name)}! Say hello 👋</div>`:''}
      ${msgs.map(m=>`<div class="msg ${m.from==='me'?'mine':'theirs'}"><div class="msg-bub">${esc(m.text)}</div><div class="msg-time">${m.time}</div></div>`).join('')}
    </div>
    <div class="chat-input-wrap">
      <div class="chat-input-row">
        <textarea class="chat-ta" id="chatInput" placeholder="Write a message…" rows="1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage('${id}')}"></textarea>
        <button class="send-btn" onclick="sendMessage('${id}')">${Icon.send}</button>
      </div>
    </div>
  `;
  scrollChat();
}

function openMatchMenu(matchId){
  const match=State.matches.find(m=>m.id===matchId); const u=match?.user||{};
  const menu=document.createElement('div'); menu.className='dropdown-menu';
  menu.innerHTML=`<div class="dropdown-item" onclick="this.closest('.dropdown-menu').remove();confirmUnmatch('${matchId}')">${Icon.x} Unmatch</div><div class="dropdown-item danger" onclick="this.closest('.dropdown-menu').remove();confirmBlock('${u.id}','${matchId}')">${Icon.slash} Block & report</div>`;
  const btn=event.currentTarget; btn.style.position='relative'; btn.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',function rm(){menu.remove();document.removeEventListener('click',rm);},{once:true}),10);
}

function confirmUnmatch(matchId){
  showConfirm('Unmatch this person?',async()=>{
    const res=await API.del('/matches/'+matchId);
    if(res.success){State.matches=State.matches.filter(m=>m.id!==matchId);delete State.messages[matchId];State.currentConvo=null;State.mobileChatOpen=false;toast('Unmatched.','default');renderMessages();updateUnreadBadge();}
  });
}
function confirmBlock(userId,matchId){
  showConfirm('Block and report this person?',async()=>{
    await API.post('/block',{userId});
    State.matches=State.matches.filter(m=>m.id!==matchId);delete State.messages[matchId];State.currentConvo=null;State.mobileChatOpen=false;toast('User blocked.','success');renderMessages();updateUnreadBadge();
  });
}

async function sendMessage(matchId){
  const inp=document.getElementById('chatInput'); const txt=inp?.value.trim(); if(!txt)return;
  inp.value=''; inp.style.height='auto';
  // Save to Supabase
  await sbSaveMessage(matchId, txt);
  const res=await API.post('/messages/'+matchId,{text:txt});
  if(res.success){
    if(!State.messages[matchId]) State.messages[matchId]=[];
    State.messages[matchId].push(res.data);
    const m=State.matches.find(x=>x.id===matchId); if(m) m.lastMessage=res.data.text;
    const box=document.getElementById('chatMsgs');
    if(box){const d=document.createElement('div');d.className='msg mine';d.innerHTML=`<div class="msg-bub">${esc(res.data.text)}</div><div class="msg-time">${res.data.time}</div>`;box.appendChild(d);scrollChat();}
    renderConvosList();
  }
}
function scrollChat(){setTimeout(()=>{const b=document.getElementById('chatMsgs');if(b)b.scrollTop=b.scrollHeight;},50);}

// ── MATCHES ─────────────────────────────────────────────────────
async function loadMatches(){const res=await API.get('/matches');if(res.success){State.matches=res.data;renderMatches();}}

function renderMatches(){
  document.getElementById('page-matches').innerHTML=`
    <div class="matches-page">
      <div class="matches-top"><h1 class="matches-h1">Your <em>matches</em></h1><span class="badge badge-accent">${State.matches.length}</span></div>
      ${State.matches.length===0?`<div class="empty-state">${Icon.heart}<h3>No matches yet</h3><p>Start discovering people in your circle.</p><button class="btn-primary" style="margin-top:1.5rem" onclick="showPage('discover')">Discover people</button></div>`:`
        <div class="matches-section">
          <div class="ms-label">Recent matches</div>
          <div class="new-match-scroll">${State.matches.slice(0,8).map(m=>{const u=m.user||{};const hp=u.photos&&u.photos[0]?.src;return`<div class="nm-item" onclick="openMatchChat('${m.id}')"><div class="nm-av">${hp?`<img class="avatar avatar-lg avatar-ring" src="${u.photos[0].src}" style="object-fit:cover">`:`<div class="avatar avatar-lg avatar-ring" style="background:${u.color||'#888'}">${u.init||'?'}</div>`}</div><div class="nm-name">${esc((u.name||'').split(' ')[0])}</div></div>`;}).join('')}</div>
        </div>
        <div class="matches-section">
          <div class="ms-label">All matches</div>
          <div class="match-grid">${State.matches.map(m=>{const u=m.user||{};const hp=u.photos&&u.photos[0]?.src;const bg=`linear-gradient(145deg,${u.color||'#888'}22,${u.color||'#888'}44,var(--bg-2))`;return`<div class="match-card" onclick="openMatchChat('${m.id}')"><div class="match-card-cover" style="background:${bg}">${hp?`<img class="avatar avatar-lg" src="${u.photos[0].src}" style="object-fit:cover">`:`<div class="avatar avatar-lg" style="background:${u.color||'#888'};font-size:1.8rem">${u.init||'?'}</div>`}</div><div class="match-card-body"><div class="match-card-name">${esc(u.name||'?')}</div><div class="match-card-meta">${esc(u.location||'')}</div><span class="badge badge-accent" style="font-size:0.62rem">${u.mutuals||1} mutual${(u.mutuals||1)>1?'s':''}</span></div></div>`;}).join('')}</div>
        </div>
      `}
    </div>
  `;
}
function openMatchChat(matchId){State.currentConvo=matchId;showPage('messages');}

// ── PROFILE ─────────────────────────────────────────────────────
const INTERESTS = ['Hiking','Coffee','Wine','Travel','Cooking','Music','Art','Reading','Photography','Yoga','Running','Cycling','Film','Gaming','Surfing','Dancing','Pottery','Architecture','Tech','Fashion','Podcasts','Plants','Baking','Climbing','Fitness','Foodie','Theatre','Dogs','Cats'];

function renderProfile(){
  const p=State.myProfile||{};
  const photos=p.photos||[];

  const supabaseBanner = !State.supabaseEnabled ? `
    <div class="supabase-banner">
      ${Icon.info}
      <div>Supabase not configured — data stored in memory only. <a href="#" onclick="event.preventDefault();showPage('settings')">Set up Supabase</a> for persistent data and real user discovery.</div>
    </div>` : '';

  document.getElementById('page-profile').innerHTML=`
    <div class="profile-page">
      <div class="profile-page-header">
        <h1 class="section-title" style="font-size:2rem">My <em>profile</em></h1>
        <p class="section-sub" style="margin-top:0.25rem;margin-bottom:0">This is how you appear to potential matches.</p>
      </div>
      ${supabaseBanner}

      <!-- Photos -->
      <div class="profile-section-card">
        <h3>Your photos</h3>
        <p class="sub">Add real photos so people know who you are. First photo is your main picture.</p>
        <div class="photo-grid" id="photoGrid">${renderPhotoGrid(photos)}</div>
        <p style="font-size:0.72rem;color:var(--fg-3);margin-top:0.75rem">Up to 6 photos · Click a photo to remove it</p>
        <input type="file" id="photoFileInput" accept="image/*" style="display:none" onchange="handlePhotoUpload(event)">
      </div>

      <!-- Basic info -->
      <div class="profile-section-card">
        <h3>Basic info</h3>
        <p class="sub">What people see when they discover your profile.</p>
        <div class="form-row-2">
          <div class="form-group"><label class="label">First name</label><input class="input" id="pName" value="${esc(p.name||'')}" placeholder="Your first name"></div>
          <div class="form-group"><label class="label">Age</label><input class="input" id="pAge" type="number" value="${esc(p.age||'')}" placeholder="Your age" min="18" max="100"></div>
        </div>
        <div class="form-group"><label class="label">Location</label><input class="input" id="pLocation" value="${esc(p.location||'')}" placeholder="City, Country"></div>
        <div class="form-group"><label class="label">Bio <span style="color:var(--fg-3);font-weight:400">(optional)</span></label><textarea class="input" id="pBio" rows="2" placeholder="A short line about yourself…" style="resize:none">${esc(p.bio||'')}</textarea></div>
        <div class="form-row-2">
          <div class="form-group"><label class="label">Gender</label><select class="input" id="pGender" style="appearance:auto;cursor:pointer">${['','Woman','Man','Non-binary','Prefer not to say'].map(g=>`<option value="${g}" ${p.gender===g?'selected':''}>${g||'Select…'}</option>`).join('')}</select></div>
          <div class="form-group"><label class="label">Interested in</label><select class="input" id="pInterestedIn" style="appearance:auto;cursor:pointer">${['Men','Women','Everyone'].map(x=>`<option value="${x}" ${p.interestedIn===x?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
      </div>

      <!-- What are you looking for -->
      <div class="profile-section-card">
        <h3>What are you looking for?</h3>
        <p class="sub">Be upfront about your intentions — it leads to better connections.</p>
        <div class="looking-for-options" id="lookingForOptions">
          ${Object.entries(LOOKING_FOR_LABELS).map(([key,val])=>`
            <div class="looking-for-option ${p.lookingFor===key?'selected':''}" onclick="selectLookingFor('${key}',this)">
              <span class="lfo-emoji">${val.emoji}</span>
              <div class="lfo-label">${val.label}</div>
              <div class="lfo-desc">${val.desc}</div>
            </div>
          `).join('')}
        </div>
        <div class="form-group" id="lookingForCustomWrap" style="${p.lookingFor?'':'display:none'}">
          <label class="label">Tell them more <span style="color:var(--fg-3);font-weight:400">(optional)</span></label>
          <input class="input" id="pLookingForCustom" value="${esc(p.lookingForCustom||'')}" placeholder="e.g. I'm hoping to find someone to explore the city with…">
        </div>
      </div>

      <!-- Prompt -->
      <div class="profile-section-card">
        <h3>Your prompt</h3>
        <p class="sub">One honest answer that shows who you really are.</p>
        <div class="prompts-stack">
          <div class="prompt-entry-editable">
            <select class="input" id="pPrompt1" style="appearance:auto;font-size:0.82rem;padding:0.5rem 0.75rem;margin-bottom:0.5rem">
              ${["I'm happiest when I'm…","A perfect Sunday looks like…","My love language is…","The way to my heart is…","I geek out about…","Best travel story…","Hot take…","Guilty pleasure…","Non-negotiable for me…","My soundtrack right now…","I'm secretly competitive about…"].map(pr=>`<option value="${pr}" ${p.prompt1===pr?'selected':''}>${pr}</option>`).join('')}
            </select>
            <textarea class="input" id="pAns1" rows="2" placeholder="Your answer…" style="resize:none">${esc(p.ans1||'')}</textarea>
          </div>
        </div>
      </div>

      <!-- Interests -->
      <div class="profile-section-card">
        <h3>Interests</h3>
        <p class="sub">Select things you're genuinely into.</p>
        <div class="interests-wrap" id="interestsWrap">${INTERESTS.map(int=>`<div class="tag ${(p.interests||[]).includes(int)?'selected':''}" onclick="toggleInterest('${int}',this)">${int}</div>`).join('')}</div>
        <p style="font-size:0.72rem;color:var(--fg-3);margin-top:0.75rem" id="interestCount">${(p.interests||[]).length} selected</p>
      </div>

      <button class="btn-full-w" id="saveProfileBtn" onclick="saveProfile()">Save profile →</button>
      <div style="height:2rem"></div>
    </div>
  `;
}

function renderPhotoGrid(photos){
  return Array(6).fill(null).map((_,i)=>{
    if(photos[i]&&photos[i].src){
      return `<div class="photo-slot filled" onclick="removePhoto(${i})"><img src="${photos[i].src}" style="width:100%;height:100%;object-fit:cover"><div class="photo-remove-hint">✕ Remove</div></div>`;
    }
    return `<div class="photo-slot" onclick="triggerPhotoUpload(${i})">${i===0?Icon.camera:Icon.plus}</div>`;
  }).join('');
}

function selectLookingFor(key, el) {
  document.querySelectorAll('.looking-for-option').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  if (State.myProfile) State.myProfile.lookingFor = key;
  const customWrap = document.getElementById('lookingForCustomWrap');
  if (customWrap) customWrap.style.display = '';
}

let _photoSlotIndex = 0;
function triggerPhotoUpload(idx){ _photoSlotIndex=idx; document.getElementById('photoFileInput')?.click(); }

function handlePhotoUpload(event){
  const file=event.target.files[0]; if(!file)return;
  if(!file.type.startsWith('image/')){toast('Please select an image file','error');return;}
  if(file.size>5*1024*1024){toast('Image too large (max 5MB)','error');return;}
  const reader=new FileReader();
  reader.onload=async(e)=>{
    const dataUrl=e.target.result;
    const resized=await resizeImage(dataUrl,800,800);
    toast('Uploading photo…','default');
    const res=await API.post('/profile/photo',{dataUrl:resized,index:_photoSlotIndex});
    if(res.success){
      if(!State.myProfile.photos) State.myProfile.photos=[];
      State.myProfile.photos[_photoSlotIndex]={type:'base64',src:resized};
      document.getElementById('photoGrid').innerHTML=renderPhotoGrid(State.myProfile.photos);
      toast('Photo added! ✓','success');
    } else { toast(res.error||'Upload failed','error'); }
  };
  reader.readAsDataURL(file);
  event.target.value='';
}

function resizeImage(dataUrl,maxW,maxH){
  return new Promise(resolve=>{
    const img=new Image(); img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
      if(h>maxH){w=Math.round(w*maxH/h);h=maxH;}
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg',0.82));
    };
    img.src=dataUrl;
  });
}

async function removePhoto(idx){
  const res=await API.del('/profile/photo/'+idx);
  if(res.success){State.myProfile.photos=res.data;document.getElementById('photoGrid').innerHTML=renderPhotoGrid(State.myProfile.photos);toast('Photo removed','default');}
}

function toggleInterest(name,el){
  const p=State.myProfile; if(!p)return;
  if(!p.interests) p.interests=[];
  if(p.interests.includes(name)){p.interests=p.interests.filter(i=>i!==name);el.classList.remove('selected');}
  else{p.interests.push(name);el.classList.add('selected');}
  const cnt=document.getElementById('interestCount'); if(cnt) cnt.textContent=p.interests.length+' selected';
}

async function saveProfile(){
  const p=State.myProfile; if(!p)return;
  p.name          = document.getElementById('pName')?.value.trim()||p.name;
  p.age           = document.getElementById('pAge')?.value||p.age;
  p.location      = document.getElementById('pLocation')?.value.trim()||p.location;
  p.bio           = document.getElementById('pBio')?.value.trim()||p.bio;
  p.gender        = document.getElementById('pGender')?.value||p.gender;
  p.interestedIn  = document.getElementById('pInterestedIn')?.value||p.interestedIn;
  p.lookingForCustom = document.getElementById('pLookingForCustom')?.value.trim()||p.lookingForCustom;
  p.prompt1       = document.getElementById('pPrompt1')?.value||p.prompt1;
  p.ans1          = document.getElementById('pAns1')?.value.trim()||p.ans1;

  setLoading('saveProfileBtn',true,'Save profile →');
  const [apiRes] = await Promise.all([
    API.put('/profile', p),
    sbSaveProfile(p),
  ]);
  setLoading('saveProfileBtn',false,'Save profile →');

  if(apiRes.success){
    State.myProfile=apiRes.data;
    // Update sidebar
    const av=document.querySelector('.sidebar-user-av');
    const nm=document.querySelector('.sidebar-user-info h5');
    const lc=document.querySelector('.sidebar-user-info p');
    if(av) av.innerHTML=p.photos&&p.photos[0]?.src?`<img src="${p.photos[0].src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span>${(p.name||'Y').charAt(0).toUpperCase()}</span>`;
    if(nm) nm.textContent=p.name||'Your profile';
    if(lc) lc.textContent=p.location||'Add location';
    toast('Profile saved! ✓','success');
    showPage('discover');
  } else { toast('Could not save — try again','error'); }
}

// ── SETTINGS ────────────────────────────────────────────────────
function renderSettings(){
  const p=State.myProfile||{};
  const sbStatus = State.supabaseEnabled
    ? `<span style="color:var(--green)">Connected</span>`
    : `<span style="color:var(--amber)">Not configured</span>`;

  document.getElementById('page-settings').innerHTML=`
    <div class="settings-page">
      <h1 class="settings-h1">Settings</h1>
      ${[
        {label:'Account',rows:[
          {icon:Icon.user,   cls:'rose',  title:'Edit profile',     desc:'Photos, prompts & info', action:"showPage('profile')",chevron:true},
          {icon:Icon.bell,   cls:'green', title:'Notifications',    desc:'Matches & messages',     toggle:true,checked:true},
          {icon:Icon.map,    cls:'blue',  title:'Location',         desc:p.location||'Not set',    action:"showPage('profile')",chevron:true},
        ]},
        {label:'Discovery preferences',rows:[
          {icon:Icon.heart,  cls:'rose',  title:'Interested in',    desc:p.interestedIn||'Everyone',action:"showPage('profile')",chevron:true},
          {icon:Icon.target, cls:'amber', title:'Looking for',      desc:LOOKING_FOR_LABELS[p.lookingFor]?.label||'Not set',action:"showPage('profile')",chevron:true},
          {icon:Icon.eye,    cls:'green', title:'Show in discovery',desc:'Visible to others',      toggle:true,checked:true},
        ]},
        {label:'Privacy & safety',rows:[
          {icon:Icon.lock,   cls:'blue',  title:'Contact sync',        desc:'Surfaces mutual connections',  chevron:true,action:"toast('Coming soon','default')"},
          {icon:Icon.shield, cls:'rose',  title:'Block/report history',desc:'Manage blocked accounts',      chevron:true,action:"toast('Coming soon','default')"},
          {icon:Icon.eye,    cls:'amber', title:'Read receipts',        desc:'Let others see when you\'ve read',toggle:true,checked:false},
        ]},
        {label:'App',rows:[
          {icon:Icon.moon,   cls:'blue',  title:'Dark mode',        desc:'Toggle light/dark theme',       toggleFn:'themeToggle',checked:State.theme==='dark'},
          {icon:Icon.zap,    cls:'purple',title:'Supabase database', desc:sbStatus,                       chevron:true,action:"toast('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars to enable','default')"},
        ]},
        {label:'Danger zone',rows:[
          {icon:Icon.logout, cls:'blue',  title:'Log out',          desc:'Sign out of your account',  action:'logout()',chevron:true},
          {icon:Icon.trash,  cls:'red',   title:'Delete account',   desc:'Permanently remove all data',action:'confirmDeleteAccount()',danger:true,chevron:true},
        ]},
      ].map(sec=>`
        <div class="settings-group">
          <div class="settings-group-label">${sec.label}</div>
          <div class="settings-card">
            ${sec.rows.map(row=>`
              <div class="settings-row" ${row.action?`onclick="${row.action}"`:''}>
                <div class="sr-icon ${row.cls}">${row.icon}</div>
                <div class="sr-text"><h4 ${row.danger?'class="danger"':''}>${row.title}</h4><p>${row.desc}</p></div>
                ${row.chevron?`<div class="sr-chevron">${Icon.chevronR}</div>`:''}
                ${row.toggle?`<label class="toggle" onclick="event.stopPropagation()"><input type="checkbox" ${row.checked?'checked':''}><div class="toggle-track"></div><div class="toggle-thumb"></div></label>`:''}
                ${row.toggleFn==='themeToggle'?`<label class="toggle" onclick="event.stopPropagation();toggleTheme()"><input type="checkbox" id="darkModeToggle" ${State.theme==='dark'?'checked':''}><div class="toggle-track"></div><div class="toggle-thumb"></div></label>`:''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <p style="text-align:center;font-size:0.72rem;color:var(--fg-3);margin-top:1.5rem">Nexus v4.0 · <a href="#" style="color:var(--fg-3)">Terms</a> · <a href="#" style="color:var(--fg-3)">Privacy</a></p>
      <div style="height:2rem"></div>
    </div>
  `;
}

function confirmDeleteAccount(){
  showConfirm('Delete your account? ALL data will be permanently removed.',async()=>{
    toast('Account deletion requested.','default');
    setTimeout(()=>{State.sessionToken=null;localStorage.removeItem('nexus_token');showAuth();},1500);
  });
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
async function init(){
  document.documentElement.setAttribute('data-theme', State.theme);

  // Init Supabase
  await initSupabase();

  // Check if already logged in
  if (State.sessionToken) {
    const res = await API.get('/auth/me');
    if (res.success && res.profile) {
      State.myProfile = res.profile;
      launchApp(false);
      return;
    } else {
      State.sessionToken = null;
      localStorage.removeItem('nexus_token');
    }
  }

  // Check admin
  if (State.adminToken) {
    const res = await fetch('/api/admin/stats',{headers:{'X-Session-Token':State.adminToken}}).then(r=>r.json());
    if (res.success) { showAdminDashboard(); return; }
    State.adminToken = null; sessionStorage.removeItem('nexus_admin_token');
  }

  showAuth();

  // Auto-resize textareas
  document.addEventListener('input', e=>{
    if(e.target.classList.contains('chat-ta')){e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}
  });
}

document.addEventListener('DOMContentLoaded', init);

// Subscribe to new messages
State.supabase
  .channel('messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
    const msg = payload.new;
    if (msg.match_id === State.currentConvo) {
      // Append message to chat
      const box = document.getElementById('chatMsgs');
      if (box) {
        const d = document.createElement('div');
        d.className = 'msg theirs';
        d.innerHTML = `<div class="msg-bub">${esc(msg.text)}</div><div class="msg-time">now</div>`;
        box.appendChild(d);
        scrollChat();
      }
    }
  })
  .subscribe();
