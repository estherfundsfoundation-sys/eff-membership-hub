/* MyEFF 2.0 — core.js
   Shared by member.html and admin.html. Requires supabase-config.js and supabase-js v2 loaded first.
   No secrets here: the publishable key is public by design; RLS protects every table. */
(function (w) {
  'use strict';
  const cfg = w.EFF_MEMBER_SUPABASE || {};
  if (!cfg.url || !w.supabase) { console.error('MyEFF: Supabase config or library missing'); return; }
  const db = w.supabase.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const fmtDT = (d) => d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const first = (p) => ((p && (p.preferred_name || p.full_name)) || 'friend').split(' ')[0];

  /* ---------- toast ---------- */
  let toastBox;
  function toast(msg, kind = 'info', ms = 4200) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; document.body.appendChild(toastBox); }
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; toastBox.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
  }

  /* ---------- auth ---------- */
  async function sendMagicLink(email, redirectPath) {
    email = (email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + redirectPath, shouldCreateUser: true } });
    if (error) {
      const m = /rate limit/i.test(error.message) ? 'Too many requests. Wait a minute, then try again.' : error.message;
      return { error: m };
    }
    return { ok: true };
  }
  async function currentUser() { const { data } = await db.auth.getUser(); return data.user || null; }
  async function signOut() { await db.auth.signOut(); location.href = location.pathname; }
  async function myRoles(uid) {
    const { data, error } = await db.from('eff_chapter_roles').select('role,chapter_id').eq('user_id', uid);
    if (error) return [];
    return data || [];
  }
  const isStaff = (roles) => roles.some((r) => r.role === 'national_staff');

  /* ---------- data helpers ---------- */
  async function loadChapters() {
    const { data } = await db.from('eff_chapters').select('*').order('kind').order('name');
    return data || [];
  }
  const MODULES = [
    { key: '0', title: 'Our story', tag: 'WHY EFF EXISTS', lesson: 'Esther Funds Foundation exists to prevent college dropouts. It began with one truth: most students who leave college don\u2019t leave because they can\u2019t do the work. They leave because of a bill nobody explained, a hold nobody lifted, a semester nobody asked about. Founder\u2019s Day marks the promise that no student walks that road alone.', reflect: 'Who was the person who kept you going when leaving felt easier than staying?', q: 'Every Future Fulfilled means\u2026', a: 'help students keep going', opts: ['help students keep going', 'replace universities', 'only host social events'] },
    { key: '1', title: 'Mission & values', tag: 'WHAT WE ASK OF EACH OTHER', lesson: 'Service, resources, leadership, dignity, and follow-through. A member notices a need and connects it to support. A member protects private information the way they\u2019d want theirs protected. A member finishes what they start \u2014 an hour, a task, a semester.', reflect: 'Name one value here you already live, and one you\u2019re still growing into.', q: 'Which action reflects EFF values?', a: 'connect a student to support', opts: ['ignore a need', 'connect a student to support', 'share private information'] },
    { key: '2', title: 'Understanding REACH', tag: 'THE FRAMEWORK', lesson: 'Reach Out. Engage Your Community. Access Resources. Care for Your Mental Health. Hold On. REACH is EFF\u2019s framework and its toolset: aid-letter comparisons, appeal drafts, hold triage, emergency resources. A member who knows REACH can walk a friend from \u201cI\u2019m dropping out\u201d to \u201chere\u2019s who to call.\u201d', reflect: 'Which letter of REACH would have helped you most in your first semester?', q: 'The A in REACH stands for\u2026', a: 'Access Resources', opts: ['Academic awards', 'Access Resources', 'Ambassador rules'] },
    { key: '3', title: 'Member expectations', tag: 'SHOWING UP', lesson: 'Show up. Fundraise with integrity. Communicate before you disappear, not after. Protect the culture: no one is humiliated, pressured, or left out to \u201cearn\u201d belonging. Represent EFF like your name is on it \u2014 because it is.', reflect: 'What does \u201ccommunicate before you disappear\u201d look like for you this semester?', q: 'EFF members are expected to\u2026', a: 'contribute with integrity', opts: ['contribute with integrity', 'pay a membership fee', 'promise hours they cannot complete'] },
    { key: '4', title: 'Service & impact', tag: 'HOURS THAT MEAN SOMETHING', lesson: 'Plan it, do it, reflect on it, document it. Service that protects student dignity: no photos of people receiving help without consent, no posting others\u2019 stories, no \u201cpoverty tourism.\u201d Your service transcript records what you did and what it did for someone.', reflect: 'Describe a service idea for your campus that a student could receive without feeling exposed.', q: 'After service, members should\u2026', a: 'reflect and document impact', opts: ['reflect and document impact', 'post others without consent', 'skip follow-up'] },
    { key: '5', title: 'Leadership structure', tag: 'HOW EFF FITS TOGETHER', lesson: 'Members \u2192 chapter officers \u2192 advisor \u2192 regional leaders \u2192 Nationals. Chapters run their own campus; Nationals sets the standard, screens, trains, and watches. Healthy leadership is clear communication, shared work, and no one carrying it alone.', reflect: 'Who in your chapter would you want to co-lead with, and why?', q: 'Healthy leadership includes\u2026', a: 'clear communication', opts: ['clear communication', 'gossip', 'working alone'] },
    { key: '6', title: 'Faith & purpose', tag: 'FOR SUCH A TIME AS THIS', lesson: 'Esther 4:14. EFF is faith-rooted and never faith-required. Lead with humility, hope, and service; respect every student\u2019s beliefs; encourage without pressuring. Esther Light is optional, always.', reflect: 'What does \u201cfor such a time as this\u201d mean for where you are right now?', q: 'Faith-rooted leadership should be\u2026', a: 'humble and supportive', opts: ['humble and supportive', 'controlling', 'exclusive'] },
    { key: '7', title: 'Safety & anti-hazing', tag: 'ZERO TOLERANCE', lesson: 'EFF has zero tolerance for hazing, coercion, humiliation, harassment, or unsafe initiation of any kind. There is no \u201ctradition\u201d exception. If something feels unsafe, pause and report it \u2014 to your advisor, to Nationals, to campus authorities. Reporting is protected. Retaliation ends a membership.', reflect: 'Write the exact words you would use to stop an activity that felt wrong.', q: 'If something feels unsafe, you should\u2026', a: 'pause and report it', opts: ['pause and report it', 'stay silent', 'pressure others to continue'] }
  ];
  const STAMPS = {
    joined: ['\u2726', 'Joined MyEFF'], verified: ['\u2713', 'Roster verified'], esther_experience: ['\u2726', 'Esther Experience complete'],
    first_service: ['\u2661', 'First service approved'], leadership: ['\u2605', 'Leadership'], national_event: ['\u2691', 'National event'], checkin: ['\u270E', 'Check-in'], graduate: ['\u2691', 'Graduate']
  };

  /* ---------- letters ---------- */
  function acceptanceLetterHTML(p, chapter, rec) {
    const name = p.preferred_name || p.full_name;
    const status = rec && rec.membership_status === 'active' ? 'active member' : (p.member_path === 'alumni' ? 'alumni member' : p.member_path === 'community' ? 'community member' : 'Esther Experience candidate');
    return `
      <div class="letter">
        <div class="letter-head"><div class="letter-mark">EFF</div><div><b>Esther Funds Foundation</b><small>EVERY FUTURE FULFILLED</small></div><span class="letter-date">${esc(fmtDate(p.created_at || Date.now()))}</span></div>
        <h3>Welcome home, ${esc(name)}.</h3>
        <p>On behalf of Esther Funds Foundation, I am glad to tell you that your place in our national community is confirmed. You joined as ${esc(status)}${chapter ? `, connected to <b>${esc(chapter.name)}</b>` : ''}. This is a free, national membership \u2014 and it is a real one. It comes with people who will know your name, a framework called REACH that exists so you never face a bill, a hold, or a hard semester alone, and a community that expects your excellence because it believes in it.</p>
        <p>Three things I want you to know. You do not have to be finished to belong here. You do not have to be perfect to serve. And a number \u2014 a GPA, a balance, a test score \u2014 is not a verdict on who you are or where you are going.</p>
        <p>Your next steps are in your member home: complete the Esther Experience, log your first service hour, and, if your campus has a chapter, meet the people leading it. If it doesn\u2019t yet, you may be the reason it will.</p>
        <p class="letter-sig">For such a time as this,<br><b>Shayna Vincent</b><br><small>Founder &amp; Executive Director, Esther Funds Foundation</small></p>
        <div class="letter-foot">National membership is free. Chapter dues, if any, are set locally. Faith participation is always optional. Nothing in this letter creates an obligation to pay. Questions: info@estherfundsfoundation.org</div>
      </div>`;
  }
  function certificateHTML(p) {
    return `<div class="cert"><div class="cert-k">ESTHER FUNDS FOUNDATION</div><div class="cert-t">The Esther Experience</div><div class="cert-s">Certificate of Completion</div><div class="cert-n">${esc(p.preferred_name || p.full_name)}</div><p>has completed all eight modules of The Esther Experience \u2014 our story, mission and values, REACH, member expectations, service and impact, leadership, faith and purpose, and safety \u2014 with reflection and understanding.</p><div class="cert-foot"><span>${esc(fmtDate(Date.now()))}</span><span class="cert-seal">\u2726 EVERY FUTURE FULFILLED \u2726</span><span>Shayna Vincent, Founder</span></div><small>This certificate confirms preparation. It is not an induction certificate; induction clearance is issued by EFF National after roster verification.</small></div>`;
  }

  /* ---------- CSV ---------- */
  function toCSV(rows, cols) {
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    return [cols.map(q).join(','), ...rows.map((r) => cols.map((c) => q(typeof c === 'string' ? r[c] : c)).join(','))].join('\n');
  }
  function download(name, text, type = 'text/csv') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  }

  w.MyEFF = { db, $, $$, esc, fmtDate, fmtDT, money, first, toast, sendMagicLink, currentUser, signOut, myRoles, isStaff, loadChapters, MODULES, STAMPS, acceptanceLetterHTML, certificateHTML, toCSV, download };
})(window);
