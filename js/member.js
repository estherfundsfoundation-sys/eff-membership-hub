/* MyEFF 2.0 — member.js */
(function () {
  'use strict';
  const M = window.MyEFF; if (!M) return;
  const { db, $, $$, esc, fmtDate, money, first, toast, MODULES, STAMPS } = M;
  let user, profile, record, roles = [], chapters = [], done = [];

  /* ---------- auth ---------- */
  $('sendLogin').onclick = async () => {
    const btn = $('sendLogin'); btn.disabled = true;
    const r = await M.sendMagicLink($('loginEmail').value, '/member.html');
    $('loginMessage').textContent = r.error || 'Sent. Check Inbox, Spam, Junk, and Promotions for your secure link.';
    setTimeout(() => (btn.disabled = false), 4000);
  };
  $('loginEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sendLogin').click(); });
  $('logout').onclick = M.signOut;

  /* ---------- tabs ---------- */
  function showTab(name) {
    $$('#tabsNav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === name));
    location.hash = name; window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('#tabsNav button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  /* ---------- boot ---------- */
  (async () => {
    // Surface magic-link errors that Supabase puts in the URL hash
    const h = new URLSearchParams(location.hash.replace('#', ''));
    if (h.get('error_description')) { $('loginMessage').textContent = decodeURIComponent(h.get('error_description')).replace(/\+/g, ' ') + ' Request a new link.'; history.replaceState(null, '', location.pathname); }
    user = await M.currentUser();
    if (!user) return;
    $('authView').classList.add('hide'); $('appView').classList.remove('hide'); $('logout').classList.remove('hide');
    [roles, chapters] = await Promise.all([M.myRoles(user.id), M.loadChapters()]);
    if (M.isStaff(roles)) $('adminLink').classList.remove('hide');
    fillChapterSelects();
    const { data: p, error } = await db.from('eff_member_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) { toast('Could not load your profile: ' + error.message, 'bad'); return; }
    profile = p;
    if (!profile) { $('onboard').classList.remove('hide'); return; }
    await loadDashboard();
  })();

  function fillChapterSelects() {
    const opts = chapters.map((c) => `<option value="${c.id}">${esc(c.name)}${c.kind === 'chapter' ? ` — ${esc(c.city)}, ${esc(c.state)}` : ''}</option>`).join('');
    $('chapterSel').innerHTML = opts; $('eChapter').innerHTML = opts;
    const nat = chapters.find((c) => c.kind === 'national'); if (nat) $('chapterSel').value = nat.id;
  }

  /* ---------- onboarding ---------- */
  $('profileForm').onsubmit = async (e) => {
    e.preventDefault();
    const chap = chapters.find((c) => c.id === $('chapterSel').value);
    const row = { user_id: user.id, full_name: $('fullName').value.trim(), preferred_name: $('preferredName').value.trim() || null, school: $('school').value.trim(), chapter: chap ? chap.name : null, chapter_id: chap ? chap.id : null, major: $('major').value.trim() || null, graduation_year: $('gradYear').value ? +$('gradYear').value : null, member_path: $('memberPath').value, city: $('city').value.trim() || null, state: ($('state').value.trim() || '').toUpperCase() || null, directory_opt_in: $('optIn').checked };
    if (!row.full_name || !row.school) return ($('profileMessage').textContent = 'Name and school are required.');
    const { error } = await db.from('eff_member_profiles').insert(row);
    if (error) return ($('profileMessage').textContent = error.message);
    // ensure the membership record exists even if the trigger is missing
    await db.from('eff_membership_records').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
    toast('Welcome to EFF. Your letter is ready.', 'ok');
    profile = row; $('onboard').classList.add('hide'); await loadDashboard(); openLetter(true);
  };

  /* ---------- dashboard ---------- */
  async function loadDashboard() {
    const { data: r } = await db.from('eff_membership_records').select('*').eq('user_id', user.id).maybeSingle();
    record = r || { joinit_status: 'unverified', membership_status: 'candidate' };
    $('dashboard').classList.remove('hide'); $('tabsNav').classList.remove('hide');
    $('greeting').innerHTML = `Welcome, <em>${esc(first(profile))}.</em>`;
    const chap = chapters.find((c) => c.id === profile.chapter_id);
    $('statusLine').textContent = `${profile.member_path === 'alumni' ? 'EFF Alumni Community' : profile.member_path === 'community' ? 'EFF Community Member' : record.membership_status === 'active' ? 'Active EFF member' : 'Esther Experience candidate'} · ${chap ? chap.name : profile.school}`;
    await Promise.all([loadModules(), loadService(), loadFund(), loadStamps(), loadNews(), loadChapter(chap), loadDirectory(), loadLight(), fillProfileForm()]);
    paintRoad();
    if (location.hash && $$('#tabsNav button').some((b) => b.dataset.tab === location.hash.slice(1))) showTab(location.hash.slice(1));
  }

  function paintRoad() {
    const s1 = true, s2 = record.joinit_status === 'verified', s3 = done.length >= MODULES.length, s4 = svApproved > 0, s5 = roles.some((r) => r.role !== 'national_staff');
    const steps = [s1, s2, s3, s4, s5]; let now = steps.findIndex((x) => !x); if (now < 0) now = 4;
    steps.forEach((ok, i) => { const li = $('r' + (i + 1)); li.classList.toggle('done', ok); li.classList.toggle('now', !ok && i === now); });
    const doneCount = steps.filter(Boolean).length; $('roadFill').style.width = (Math.max(0, doneCount - 1) / 4 * 92) + '%';
    const nexts = [['Open your acceptance letter', 'It\u2019s waiting on this page.', () => openLetter(true)], ['Verify your roster', 'Register free on Join It; staff verifies it here within a few days.', () => window.open('https://app.joinit.com/o/esther-funds-foundation', '_blank')], ['Continue the Esther Experience', `${MODULES.length - done.length} modules left.`, () => showTab('experience')], ['Log your first service hours', 'Approved hours start your transcript and earn a stamp.', () => showTab('service')], ['Step into leadership', 'Talk to your chapter leaders or Nationals about a role.', () => showTab('chapter')]];
    const n = nexts[now]; $('nextTitle').textContent = n[0]; $('nextCopy').textContent = n[1]; $('nextBtn').onclick = n[2];
  }

  /* ---------- letter ---------- */
  function openLetter(scroll) {
    const chap = chapters.find((c) => c.id === profile.chapter_id);
    $('letterBox').innerHTML = M.acceptanceLetterHTML(profile, chap, record);
    db.rpc('eff_mark_letter_viewed').then(() => {});
    if (scroll) { showTab('road'); $('letterBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  $('openLetter').onclick = () => openLetter(true);
  $('printLetter').onclick = () => { if (!$('letterBox').innerHTML) openLetter(false); setTimeout(() => window.print(), 300); };

  /* ---------- modules ---------- */
  async function loadModules() {
    const { data = [] } = await db.from('eff_member_module_completions').select('module_key').eq('user_id', user.id);
    done = (data || []).map((x) => x.module_key);
    $('moduleList').innerHTML = MODULES.map((m, i) => `<article class="module-row ${done.includes(m.key) ? 'done' : ''}"><div><b>Module ${i + 1}: ${esc(m.title)}</b><span>${done.includes(m.key) ? 'Completed with reflection + check' : 'Guided lesson · reflection · check'}</span></div><button class="btn ${done.includes(m.key) ? 'white' : 'purple'} sm" data-i="${i}">${done.includes(m.key) ? 'Review' : 'Start'}</button></article>`).join('');
    $$('#moduleList [data-i]').forEach((b) => (b.onclick = () => moduleModal(+b.dataset.i)));
    const pct = Math.round(done.length / MODULES.length * 100);
    $('progressNumber').textContent = pct + '%'; $('progressBar').style.width = pct + '%';
    $('progressCopy').textContent = pct === 100 ? 'Complete. Your certificate is ready below.' : `${MODULES.length - done.length} guided lessons remaining. Any order.`;
    if (pct === 100) { $('certWrap').classList.remove('hide'); $('certBox').innerHTML = M.certificateHTML(profile); }
  }
  $('printCert').onclick = () => window.print();
  function moduleModal(i) {
    const m = MODULES[i]; const d = document.createElement('div'); d.className = 'modal';
    d.innerHTML = `<section><button class="x" aria-label="Close">×</button><p class="eyebrow">ESTHER EXPERIENCE · MODULE ${i + 1} · ${esc(m.tag)}</p><h2>${esc(m.title)}</h2><div class="lesson">${esc(m.lesson)}</div><label>Reflection — ${esc(m.reflect)}</label><textarea id="mRef" rows="4"></textarea><h3 style="font-size:18px;margin-top:14px">${esc(m.q)}</h3>${m.opts.map((o) => `<label class="opt"><input type="radio" name="q" value="${esc(o)}">${esc(o)}</label>`).join('')}<div class="toolbar"><button id="mDone" class="btn purple">Submit reflection & complete →</button></div><p id="mMsg" class="form-message"></p></section>`;
    document.body.appendChild(d); d.querySelector('.x').onclick = () => d.remove(); d.addEventListener('click', (e) => { if (e.target === d) d.remove(); });
    d.querySelector('#mDone').onclick = async () => {
      const ref = d.querySelector('#mRef').value.trim(), a = (d.querySelector('input[name=q]:checked') || {}).value, msg = d.querySelector('#mMsg');
      if (ref.length < 20) return (msg.textContent = 'Write at least a couple of sentences of reflection first.');
      if (!a) return (msg.textContent = 'Choose an answer.'); if (a !== m.a) return (msg.textContent = 'Not quite — re-read the lesson and try again.');
      const { error: e1 } = await db.from('eff_member_course_work').upsert({ user_id: user.id, module_key: m.key, reflection: ref, quiz_answer: a, passed: true }, { onConflict: 'user_id,module_key' });
      const { error: e2 } = await db.from('eff_member_module_completions').upsert({ user_id: user.id, module_key: m.key }, { onConflict: 'user_id,module_key' });
      if (e1 || e2) return (msg.textContent = (e1 || e2).message);
      d.remove(); toast(`Module ${i + 1} complete.`, 'ok'); await loadModules(); await loadStamps(); paintRoad();
    };
  }

  /* ---------- service ---------- */
  let svApproved = 0;
  async function loadService() {
    const { data = [] } = await db.from('eff_member_service_hours').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    svApproved = (data || []).filter((x) => x.status === 'approved').reduce((a, x) => a + Number(x.hours), 0);
    $('svTotal').textContent = svApproved.toFixed(2);
    const tb = $$('#svTable tbody')[0];
    tb.innerHTML = (data || []).map((x) => `<tr><td>${esc(fmtDate(x.service_date || x.created_at))}</td><td>${esc(x.title)}<br><small class="small">${esc(x.organization || '')}</small>${x.review_note ? `<br><small class="small">Staff: ${esc(x.review_note)}</small>` : ''}</td><td>${Number(x.hours).toFixed(2)}</td><td><span class="pill ${x.status}">${x.status}</span></td><td>${x.status === 'pending' ? `<button class="btn danger sm" data-del="${x.id}">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="small">No hours yet. Your first approved hour earns a passport stamp.</td></tr>';
    $$('[data-del]', tb).forEach((b) => (b.onclick = async () => { if (!confirm('Delete this pending entry?')) return; await db.from('eff_member_service_hours').delete().eq('id', b.dataset.del); loadService(); }));
  }
  $('svAdd').onclick = async () => {
    const row = { user_id: user.id, title: $('svTitle').value.trim(), service_date: $('svDate').value || null, hours: +$('svHours').value, organization: $('svOrg').value.trim() || null, reflection: $('svRef').value.trim() || null, evidence_url: $('svUrl').value.trim() || null, status: 'pending' };
    if (!row.title || !(row.hours > 0)) return ($('svMsg').textContent = 'Add what you did and how many hours.');
    if (row.hours > 24) return ($('svMsg').textContent = 'Log one day at a time (24 hours max per entry).');
    const { error } = await db.from('eff_member_service_hours').insert(row);
    if (error) return ($('svMsg').textContent = error.message);
    ['svTitle', 'svDate', 'svHours', 'svOrg', 'svRef', 'svUrl'].forEach((id) => ($(id).value = '')); $('svMsg').textContent = ''; toast('Hours submitted for review.', 'ok'); loadService();
  };

  /* ---------- fundraising ---------- */
  async function loadFund() {
    const { data = [] } = await db.from('eff_member_fundraising').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    $$('#fdTable tbody')[0].innerHTML = (data || []).map((x) => `<tr><td>${esc(fmtDate(x.created_at))}</td><td>${esc(x.campaign)}<br><small class="small">${esc(x.note || '')}</small></td><td>${money(x.amount)}</td><td><span class="pill ${x.status}">${x.status}</span></td></tr>`).join('') || '<tr><td colspan="4" class="small">Nothing recorded yet.</td></tr>';
  }
  $('fdAdd').onclick = async () => {
    const amt = +$('fdAmt').value; if (!(amt >= 0)) return ($('fdMsg').textContent = 'Enter an amount.');
    const { error } = await db.from('eff_member_fundraising').insert({ user_id: user.id, amount: amt, campaign: $('fdCamp').value, note: $('fdNote').value.trim() || null, status: 'pending' });
    if (error) return ($('fdMsg').textContent = error.message);
    $('fdAmt').value = ''; $('fdNote').value = ''; $('fdMsg').textContent = ''; toast('Recorded. Staff will verify.', 'ok'); loadFund();
  };

  /* ---------- passport ---------- */
  async function loadStamps() {
    const { data = [] } = await db.from('eff_passport_stamps').select('stamp_key,awarded_at').eq('user_id', user.id);
    const got = new Set((data || []).map((x) => x.stamp_key));
    $('passport').innerHTML = Object.entries(STAMPS).map(([k, [icon, label]]) => `<div class="stamp ${got.has(k) ? 'got' : ''}" title="${esc(label)}"><div><i>${icon}</i>${esc(label)}</div></div>`).join('');
  }

  /* ---------- news ---------- */
  async function loadNews() {
    const { data = [] } = await db.from('eff_announcements').select('*').order('published_at', { ascending: false }).limit(6);
    $('news').innerHTML = (data || []).map((n) => `<article class="module-row" style="flex-direction:column;align-items:flex-start"><b>${esc(n.title)}</b><span>${esc(fmtDate(n.published_at))}${n.audience === 'chapter' ? ' · your chapter' : ' · national'}</span><p class="small" style="margin:6px 0 0;color:var(--ink)">${esc(n.body)}</p></article>`).join('') || '<p class="small">No announcements yet.</p>';
  }

  /* ---------- chapter ---------- */
  async function loadChapter(chap) {
    if (!chap) { $('chName').textContent = 'National member'; $('chMeta').textContent = 'You joined nationally. Explore starting a chapter on your campus.'; $('chLeaders').innerHTML = ''; return; }
    $('chName').textContent = chap.name; $('chMeta').textContent = `${chap.school} · ${chap.city}, ${chap.state} · ${chap.kind === 'pgws' ? 'Sisterhood branch' : 'Collegiate chapter'} · status: ${chap.status}`;
    const { data: lead = [] } = await db.from('eff_chapter_roles').select('role,user_id').eq('chapter_id', chap.id).neq('role', 'national_staff');
    if (!lead || !lead.length) { $('chLeaders').innerHTML = '<p class="small">Chapter leaders will appear here once Nationals assigns them.</p>'; return; }
    const ids = lead.map((l) => l.user_id);
    const { data: names = [] } = await db.from('eff_directory').select('user_id,display_name').in('user_id', ids);
    $('chLeaders').innerHTML = lead.map((l) => { const n = (names || []).find((x) => x.user_id === l.user_id); return `<div class="module-row"><div><b>${esc(n ? n.display_name : 'Verified leader')}</b><span>${esc(l.role.replace('_', ' '))}</span></div></div>`; }).join('');
  }

  /* ---------- directory ---------- */
  let dir = [];
  async function loadDirectory() { const { data = [] } = await db.from('eff_directory').select('*').limit(500); dir = data || []; renderDir(''); }
  function renderDir(q) {
    q = q.toLowerCase(); const list = dir.filter((d) => !q || [d.display_name, d.school, d.major, d.chapter_name, d.city, d.state].join(' ').toLowerCase().includes(q)).slice(0, 60);
    $('dirList').innerHTML = list.map((d) => `<div class="module-row"><div><b>${esc(d.display_name)}</b><span>${esc(d.school)}${d.major ? ' · ' + esc(d.major) : ''}${d.chapter_name ? ' · ' + esc(d.chapter_name) : ''}</span></div></div>`).join('') || '<p class="small">No members match yet.</p>';
  }
  $('dirQ').oninput = (e) => renderDir(e.target.value);

  /* ---------- check-ins ---------- */
  async function saveCheckin(reach) {
    const row = { user_id: user.id, academic: +$('ciA').value, wellness: +$('ciW').value, belonging: +$('ciB').value, needs_reach: reach, note: $('ciNote').value.trim() || null };
    const { error } = await db.from('eff_checkins').insert(row);
    $('ciMsg').textContent = error ? error.message : reach ? 'Got it. A national staff member will reach out. If it\u2019s urgent, call or text 988.' : 'Saved. Thank you for checking in.';
    if (!error) $('ciNote').value = '';
  }
  $('ciSave').onclick = () => saveCheckin(false); $('ciReach').onclick = () => saveCheckin(true);

  /* ---------- esther light ---------- */
  async function loadLight() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await db.from('eff_light_daily').select('*').lte('day', today).order('day', { ascending: false }).limit(1).maybeSingle();
    $('lightBox').innerHTML = data ? `<p style="font:26px Caveat,cursive;color:var(--p);margin:0">\u201c${esc(data.verse_text)}\u201d</p><p class="small"><b>${esc(data.verse_ref)}</b></p>${data.reflection ? `<p style="max-width:56ch;margin:12px auto 0">${esc(data.reflection)}</p>` : ''}` : '<p class="small">Today\u2019s light hasn\u2019t been posted yet. Esther 4:14 \u2014 for such a time as this.</p>';
  }

  /* ---------- profile ---------- */
  async function fillProfileForm() {
    $('eFull').value = profile.full_name || ''; $('ePref').value = profile.preferred_name || ''; $('eChapter').value = profile.chapter_id || ''; $('eSchool').value = profile.school || ''; $('eMajor').value = profile.major || ''; $('eGrad').value = profile.graduation_year || ''; $('eCity').value = profile.city || ''; $('eState').value = profile.state || ''; $('ePhone').value = profile.phone || ''; $('ePron').value = profile.pronouns || ''; $('eBio').value = profile.bio || ''; $('eOpt').checked = !!profile.directory_opt_in; $('eEmail').checked = profile.email_updates !== false; $('eSms').checked = !!profile.sms_updates;
    $('pEmail').textContent = user.email; $('pJoinit').innerHTML = `<span class="pill ${record.joinit_status}">${record.joinit_status}</span>`; $('pStatus').innerHTML = `<span class="pill ${record.membership_status}">${record.membership_status}</span>`; $('pSince').textContent = fmtDate(profile.created_at);
  }
  $('editForm').onsubmit = async (e) => {
    e.preventDefault(); const chap = chapters.find((c) => c.id === $('eChapter').value);
    const row = { full_name: $('eFull').value.trim(), preferred_name: $('ePref').value.trim() || null, chapter_id: chap ? chap.id : null, chapter: chap ? chap.name : null, school: $('eSchool').value.trim(), major: $('eMajor').value.trim() || null, graduation_year: $('eGrad').value ? +$('eGrad').value : null, city: $('eCity').value.trim() || null, state: ($('eState').value.trim() || '').toUpperCase() || null, phone: $('ePhone').value.trim() || null, pronouns: $('ePron').value.trim() || null, bio: $('eBio').value.trim() || null, directory_opt_in: $('eOpt').checked, email_updates: $('eEmail').checked, sms_updates: $('eSms').checked };
    const { error } = await db.from('eff_member_profiles').update(row).eq('user_id', user.id);
    $('editMsg').textContent = error ? error.message : 'Saved.'; if (!error) { Object.assign(profile, row); toast('Profile saved.', 'ok'); loadDirectory(); }
  };
})();
