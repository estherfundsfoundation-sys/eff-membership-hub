/* MyEFF 2.0 — admin.js (national staff only; every write is also enforced by RLS) */
(function () {
  'use strict';
  const M = window.MyEFF; if (!M) return;
  const { db, $, $$, esc, fmtDate, fmtDT, money, toast, MODULES } = M;
  let user, chapters = [], members = [], records = [], modCounts = {}, emails = {};

  $('login').onclick = async () => { const r = await M.sendMagicLink($('email').value, '/admin.html'); $('message').textContent = r.error || 'Check your email for your staff sign-in link.'; };
  $('logout').onclick = M.signOut;
  function showTab(n) { $$('#tabsNav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === n)); $$('.panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === n)); }
  $$('#tabsNav button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  (async () => {
    user = await M.currentUser(); if (!user) return;
    const roles = await M.myRoles(user.id);
    if (!M.isStaff(roles)) { $('message').textContent = 'This account is signed in but is not approved for EFF National staff access.'; $('logout').classList.remove('hide'); return; }
    $('authView').classList.add('hide'); $('appView').classList.remove('hide'); $('tabsNav').classList.remove('hide'); $('logout').classList.remove('hide');
    chapters = await M.loadChapters(); fillChapterSelects();
    await Promise.all([loadStats(), loadMembers(), loadQueues(), loadChapters(), loadRoles(), loadNews(), loadLight()]);
  })();

  function chapterName(id) { const c = chapters.find((x) => x.id === id); return c ? c.name : '—'; }
  function fillChapterSelects() {
    const opts = '<option value="">—</option>' + chapters.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    ['fChapter', 'roleChapter', 'nChapter'].forEach((id) => ($(id).innerHTML = (id === 'fChapter' ? '<option value="">Chapter: all</option>' : '<option value="">—</option>') + chapters.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')));
  }

  /* ---------- stats ---------- */
  async function loadStats() {
    const { data, error } = await db.rpc('eff_admin_stats'); if (error) return toast('Stats: ' + error.message, 'bad');
    const s = data || {};
    const cards = [['Members', s.members], ['New this week', s.new_7d], ['Awaiting verification', s.unverified], ['Active members', s.active], ['Experience complete', s.experience_complete], ['REACH flags · 30d', s.reach_flags_30d]];
    $('stats').innerHTML = cards.map(([l, v]) => `<div class="stat"><b>${v ?? 0}</b><span>${l}</span></div>`).join('');
    $$('#byChapter tbody')[0].innerHTML = (s.by_chapter || []).sort((a, b) => b.members - a.members).map((r) => `<tr><td>${esc(r.chapter)}</td><td>${esc(r.state)}</td><td>${r.members}</td></tr>`).join('') || '<tr><td colspan="3" class="small">No chapter assignments yet.</td></tr>';
    $('attention').innerHTML = [[s.unverified, 'roster checks waiting', 'queues'], [s.hours_pending, 'service-hour entries to review', 'queues'], [s.fund_pending, 'fundraising entries to verify', 'queues'], [s.reach_flags_30d, 'REACH flags this month', 'queues']].map(([n, t, tab]) => `<div class="module-row"><div><b>${n ?? 0}</b><span>${t}</span></div><button class="btn white sm" data-go="${tab}">Open</button></div>`).join('') + `<div class="module-row"><div><b>${Number(s.hours_approved_total || 0).toFixed(1)} hrs</b><span>approved service, all time</span></div><div><b>${money(s.fund_approved_total)}</b></div></div>`;
    $$('[data-go]').forEach((b) => (b.onclick = () => showTab(b.dataset.go)));
  }

  /* ---------- members ---------- */
  async function loadMembers() {
    const [{ data: p }, { data: r }, { data: m }] = await Promise.all([db.from('eff_member_profiles').select('*').order('created_at', { ascending: false }), db.from('eff_membership_records').select('*'), db.from('eff_member_module_completions').select('user_id')]);
    members = p || []; records = r || []; modCounts = {}; (m || []).forEach((x) => (modCounts[x.user_id] = (modCounts[x.user_id] || 0) + 1));
    $('roleUser').innerHTML = members.map((x) => `<option value="${x.user_id}">${esc(x.full_name)} — ${esc(x.school)}</option>`).join('');
    renderMembers();
  }
  const rec = (uid) => records.find((x) => x.user_id === uid) || { joinit_status: 'unverified', membership_status: 'candidate' };
  function renderMembers() {
    const q = $('q').value.toLowerCase(), fj = $('fJoin').value, fs = $('fStatus').value, fc = $('fChapter').value, fp = $('fPath').value;
    const list = members.filter((x) => { const r = rec(x.user_id); return (!q || [x.full_name, x.preferred_name, x.school, x.major, x.city, x.state, emails[x.user_id]].join(' ').toLowerCase().includes(q)) && (!fj || r.joinit_status === fj) && (!fs || r.membership_status === fs) && (!fc || x.chapter_id === fc) && (!fp || (x.member_path || 'member') === fp); });
    $('count').textContent = `${list.length} of ${members.length}`;
    $$('#members tbody')[0].innerHTML = list.map((x) => { const r = rec(x.user_id); const mc = modCounts[x.user_id] || 0; return `<tr data-uid="${x.user_id}" style="cursor:pointer"><td><b>${esc(x.full_name)}</b>${x.preferred_name ? ` <small class="small">(${esc(x.preferred_name)})</small>` : ''}<br><small class="small">${esc(emails[x.user_id] || '')}</small></td><td>${esc(x.school)}<br><small class="small">${esc(chapterName(x.chapter_id))}</small></td><td>${esc(x.member_path || 'member')}</td><td><span class="pill ${r.joinit_status}">${r.joinit_status}</span></td><td><span class="pill ${r.membership_status}">${r.membership_status}</span></td><td>${mc}/${MODULES.length}</td><td>${fmtDate(x.created_at)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="small">No members match.</td></tr>';
    $$('#members tbody tr[data-uid]').forEach((tr) => (tr.onclick = () => openMember(tr.dataset.uid)));
  }
  ['q', 'fJoin', 'fStatus', 'fChapter', 'fPath'].forEach((id) => ($(id).oninput = renderMembers));
  $('exportCsv').onclick = () => {
    const rows = members.map((x) => { const r = rec(x.user_id); return { name: x.full_name, preferred: x.preferred_name, email: emails[x.user_id] || '', school: x.school, chapter: chapterName(x.chapter_id), path: x.member_path, major: x.major, grad_year: x.graduation_year, city: x.city, state: x.state, roster: r.joinit_status, membership: r.membership_status, modules_done: modCounts[x.user_id] || 0, joined: x.created_at }; });
    M.download(`eff-members-${new Date().toISOString().slice(0, 10)}.csv`, M.toCSV(rows, ['name', 'preferred', 'email', 'school', 'chapter', 'path', 'major', 'grad_year', 'city', 'state', 'roster', 'membership', 'modules_done', 'joined']));
  };

  /* ---------- member drawer ---------- */
  $('dClose').onclick = () => $('drawer').classList.remove('on');
  async function openMember(uid) {
    const x = members.find((m) => m.user_id === uid); const r = rec(uid); $('drawer').classList.add('on');
    $('dBody').innerHTML = `<p class="eyebrow">MEMBER RECORD</p><h2>${esc(x.full_name)}</h2><p class="small">Loading…</p>`;
    const [{ data: email }, { data: hours }, { data: fund }, { data: notes }, { data: act }, { data: ci }, { data: rl }] = await Promise.all([
      db.rpc('eff_member_email', { uid }), db.from('eff_member_service_hours').select('*').eq('user_id', uid).order('created_at', { ascending: false }), db.from('eff_member_fundraising').select('*').eq('user_id', uid).order('created_at', { ascending: false }), db.from('eff_member_notes').select('*').eq('subject_user_id', uid).order('created_at', { ascending: false }), db.from('eff_activity').select('*').eq('subject_user_id', uid).order('created_at', { ascending: false }).limit(40), db.from('eff_checkins').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5), db.from('eff_chapter_roles').select('*').eq('user_id', uid)]);
    emails[uid] = email || '';
    const approvedHrs = (hours || []).filter((h) => h.status === 'approved').reduce((a, h) => a + Number(h.hours), 0);
    $('dBody').innerHTML = `
      <p class="eyebrow">MEMBER RECORD</p><h2>${esc(x.full_name)}</h2><p class="small">${esc(email || '')}${x.phone ? ' · ' + esc(x.phone) : ''}</p>
      <div class="kv"><b>School</b><span>${esc(x.school)}</span><b>Chapter</b><span>${esc(chapterName(x.chapter_id))}</span><b>Path</b><span>${esc(x.member_path || 'member')}</span><b>Major</b><span>${esc(x.major || '—')} ${x.graduation_year ? '· ' + x.graduation_year : ''}</span><b>Location</b><span>${esc([x.city, x.state].filter(Boolean).join(', ') || '—')}</span><b>Roster</b><span><span class="pill ${r.joinit_status}">${r.joinit_status}</span> ${r.verified_at ? '<small class="small">' + fmtDate(r.verified_at) + '</small>' : ''}</span><b>Membership</b><span><span class="pill ${r.membership_status}">${r.membership_status}</span></span><b>Experience</b><span>${modCounts[uid] || 0}/${MODULES.length} modules</span><b>Service</b><span>${approvedHrs.toFixed(2)} hrs approved</span><b>Roles</b><span>${(rl || []).map((z) => esc(z.role) + (z.chapter_id ? ' · ' + esc(chapterName(z.chapter_id)) : '')).join(', ') || '—'}</span><b>Directory</b><span>${x.directory_opt_in ? 'opted in' : 'private'}</span><b>Joined</b><span>${fmtDate(x.created_at)}</span></div>
      <div class="toolbar"><button class="btn purple sm" data-act="verify">Verify roster</button><button class="btn white sm" data-act="pending">Mark pending</button><button class="btn white sm" data-act="mismatch">Mismatch</button><button class="btn white sm" data-act="alumni">Set alumni</button><button class="btn danger sm" data-act="revoke">Revoke access</button></div>
      <h3 style="font-size:16px;margin-top:16px">Staff notes</h3><textarea id="noteIn" rows="2" placeholder="Add a note (staff only)"></textarea><div class="toolbar"><button class="btn purple sm" id="noteAdd">Add note</button></div>
      <div id="noteList">${(notes || []).map((n) => `<div class="note">${esc(n.body)}<small>${fmtDT(n.created_at)}</small></div>`).join('') || '<p class="small">No notes.</p>'}</div>
      <h3 style="font-size:16px;margin-top:16px">Check-ins</h3>${(ci || []).map((c) => `<div class="log">${c.needs_reach ? '<b class="bad">I NEED TO REACH</b> · ' : ''}A ${c.academic} · W ${c.wellness} · B ${c.belonging}${c.note ? ' — ' + esc(c.note) : ''}<br><small>${fmtDT(c.created_at)}</small></div>`).join('') || '<p class="small">No check-ins.</p>'}
      <h3 style="font-size:16px;margin-top:16px">Service &amp; fundraising</h3>${(hours || []).map((h) => `<div class="log">${esc(h.title)} · ${Number(h.hours).toFixed(2)} hrs · <span class="pill ${h.status}">${h.status}</span><br><small>${fmtDate(h.service_date || h.created_at)}${h.organization ? ' · ' + esc(h.organization) : ''}</small></div>`).join('')}${(fund || []).map((f) => `<div class="log">${esc(f.campaign)} · ${money(f.amount)} · <span class="pill ${f.status}">${f.status}</span></div>`).join('') || ''}
      <h3 style="font-size:16px;margin-top:16px">Activity</h3>${(act || []).map((a) => `<div class="log">${esc(a.action)} <small>${esc(JSON.stringify(a.detail))}</small><br><small>${fmtDT(a.created_at)}</small></div>`).join('') || '<p class="small">No activity yet.</p>'}`;
    $$('#dBody [data-act]').forEach((b) => (b.onclick = () => memberAction(uid, b.dataset.act)));
    $('noteAdd').onclick = async () => { const body = $('noteIn').value.trim(); if (!body) return; const { error } = await db.from('eff_member_notes').insert({ subject_user_id: uid, author_id: user.id, body }); if (error) return toast(error.message, 'bad'); toast('Note added', 'ok'); openMember(uid); };
    renderMembers();
  }
  async function memberAction(uid, act) {
    const patch = { verify: { joinit_status: 'verified', membership_status: 'active', access_revoked: false, verified_at: new Date().toISOString(), verified_by: user.id }, pending: { joinit_status: 'pending' }, mismatch: { joinit_status: 'mismatch' }, alumni: { membership_status: 'alumni' }, revoke: { joinit_status: 'revoked', access_revoked: true, membership_status: 'inactive' } }[act];
    if (act === 'revoke' && !confirm('Revoke this member\u2019s access?')) return;
    const { error } = await db.from('eff_membership_records').upsert({ user_id: uid, ...patch }, { onConflict: 'user_id' });
    if (error) return toast(error.message, 'bad'); toast('Updated', 'ok');
    const { data: r } = await db.from('eff_membership_records').select('*'); records = r || []; await loadStats(); await loadQueues(); openMember(uid);
  }

  /* ---------- queues ---------- */
  async function loadQueues() {
    const [{ data: r }, { data: h }, { data: f }, { data: c }] = await Promise.all([db.from('eff_membership_records').select('*').in('joinit_status', ['unverified', 'pending']), db.from('eff_member_service_hours').select('*').eq('status', 'pending').order('created_at'), db.from('eff_member_fundraising').select('*').eq('status', 'pending').order('created_at'), db.from('eff_checkins').select('*').eq('needs_reach', true).gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('created_at', { ascending: false })]);
    const nameOf = (uid) => { const m = members.find((x) => x.user_id === uid); return m ? m.full_name : 'Member'; };
    $('qVerify').innerHTML = (r || []).map((x) => `<div class="module-row"><div><b>${esc(nameOf(x.user_id))}</b><span>${esc((members.find((m) => m.user_id === x.user_id) || {}).school || '')} · <span class="pill ${x.joinit_status}">${x.joinit_status}</span></span></div><div><button class="btn white sm" data-open="${x.user_id}">Open</button> <button class="btn purple sm" data-verify="${x.user_id}">Verify</button></div></div>`).join('') || '<p class="small">Queue is empty.</p>';
    $('qReach').innerHTML = (c || []).map((x) => `<div class="module-row"><div><b>${esc(nameOf(x.user_id))}</b><span>A ${x.academic} · W ${x.wellness} · B ${x.belonging}${x.note ? ' — ' + esc(x.note) : ''} · ${fmtDT(x.created_at)}</span></div><button class="btn gold sm" data-open="${x.user_id}">Follow up</button></div>`).join('') || '<p class="small">No flags in the last 30 days.</p>';
    $('qHours').innerHTML = (h || []).map((x) => `<div class="module-row"><div><b>${esc(nameOf(x.user_id))} · ${Number(x.hours).toFixed(2)} hrs</b><span>${esc(x.title)}${x.organization ? ' · ' + esc(x.organization) : ''} · ${fmtDate(x.service_date || x.created_at)}${x.evidence_url ? ` · <a href="${esc(x.evidence_url)}" target="_blank" rel="noopener">evidence</a>` : ''}${x.reflection ? `<br>${esc(x.reflection)}` : ''}</span></div><div><button class="btn purple sm" data-hr="${x.id}" data-s="approved">Approve</button> <button class="btn danger sm" data-hr="${x.id}" data-s="rejected">Reject</button></div></div>`).join('') || '<p class="small">Nothing pending.</p>';
    $('qFund').innerHTML = (f || []).map((x) => `<div class="module-row"><div><b>${esc(nameOf(x.user_id))} · ${money(x.amount)}</b><span>${esc(x.campaign)}${x.note ? ' · ' + esc(x.note) : ''} · ${fmtDate(x.created_at)}</span></div><div><button class="btn purple sm" data-fd="${x.id}" data-s="approved">Verify</button> <button class="btn danger sm" data-fd="${x.id}" data-s="rejected">Reject</button></div></div>`).join('') || '<p class="small">Nothing pending.</p>';
    $$('[data-open]').forEach((b) => (b.onclick = () => openMember(b.dataset.open)));
    $$('[data-verify]').forEach((b) => (b.onclick = () => memberAction(b.dataset.verify, 'verify')));
    $$('[data-hr]').forEach((b) => (b.onclick = async () => { const note = b.dataset.s === 'rejected' ? prompt('Reason (shown to the member):') || null : null; const { error } = await db.from('eff_member_service_hours').update({ status: b.dataset.s, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note }).eq('id', b.dataset.hr); if (error) return toast(error.message, 'bad'); toast('Saved', 'ok'); loadQueues(); loadStats(); }));
    $$('[data-fd]').forEach((b) => (b.onclick = async () => { const { error } = await db.from('eff_member_fundraising').update({ status: b.dataset.s, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', b.dataset.fd); if (error) return toast(error.message, 'bad'); toast('Saved', 'ok'); loadQueues(); loadStats(); }));
  }

  /* ---------- chapters ---------- */
  async function loadChapters() {
    chapters = await M.loadChapters(); fillChapterSelects();
    $$('#chTable tbody')[0].innerHTML = chapters.map((c) => `<tr><td><b>${esc(c.name)}</b><br><small class="small">${esc(c.school)}</small></td><td>${esc(c.city)}, ${esc(c.state)}</td><td>${esc(c.kind)}</td><td><span class="pill ${c.status === 'active' ? 'active' : c.status === 'provisional' ? 'pending' : 'inactive'}">${c.status}</span></td><td><button class="btn white sm" data-edit="${c.id}">Edit</button></td></tr>`).join('');
    $$('[data-edit]').forEach((b) => (b.onclick = () => { const c = chapters.find((x) => x.id === b.dataset.edit); $('chId').value = c.id; $('chNameIn').value = c.name; $('chSchool').value = c.school; $('chCity').value = c.city; $('chState').value = c.state; $('chKind').value = c.kind; $('chStatus').value = c.status; $('chSlug').value = c.slug; $('chDues').value = c.dues_note || ''; $('chFormTitle').textContent = 'Edit chapter'; showTab('chapters'); }));
  }
  $('chReset').onclick = () => { $('chForm').reset(); $('chId').value = ''; $('chFormTitle').textContent = 'New chapter'; };
  $('chForm').onsubmit = async (e) => {
    e.preventDefault(); const row = { name: $('chNameIn').value.trim(), school: $('chSchool').value.trim(), city: $('chCity').value.trim(), state: $('chState').value.trim().toUpperCase(), kind: $('chKind').value, status: $('chStatus').value, slug: $('chSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'), dues_note: $('chDues').value.trim() || null };
    if (!row.name || !row.school || !row.slug) return ($('chMsg').textContent = 'Name, school, and slug are required.');
    const q = $('chId').value ? db.from('eff_chapters').update(row).eq('id', $('chId').value) : db.from('eff_chapters').insert(row);
    const { error } = await q; $('chMsg').textContent = error ? error.message : 'Saved.'; if (!error) { toast('Chapter saved', 'ok'); $('chReset').click(); loadChapters(); }
  };

  /* ---------- roles ---------- */
  async function loadRoles() {
    const { data } = await db.from('eff_chapter_roles').select('*').order('created_at', { ascending: false });
    $('roleList').innerHTML = (data || []).map((r) => { const m = members.find((x) => x.user_id === r.user_id); return `<div class="module-row"><div><b>${esc(m ? m.full_name : r.user_id.slice(0, 8))}</b><span>${esc(r.role.replace('_', ' '))}${r.chapter_id ? ' · ' + esc(chapterName(r.chapter_id)) : ' · national'}</span></div><button class="btn danger sm" data-rm="${r.id}">Remove</button></div>`; }).join('') || '<p class="small">No roles assigned.</p>';
    $$('[data-rm]').forEach((b) => (b.onclick = async () => { if (!confirm('Remove this role?')) return; await db.from('eff_chapter_roles').delete().eq('id', b.dataset.rm); loadRoles(); }));
  }
  $('roleAdd').onclick = async () => {
    const row = { user_id: $('roleUser').value, role: $('roleName').value, chapter_id: $('roleChapter').value || null, granted_by: user.id };
    if (row.role === 'national_staff' && !confirm('Grant full admin access to this member?')) return;
    const { error } = await db.from('eff_chapter_roles').insert(row); $('roleMsg').textContent = error ? error.message : 'Granted.'; if (!error) loadRoles();
  };

  /* ---------- announcements ---------- */
  async function loadNews() {
    const { data } = await db.from('eff_announcements').select('*').order('created_at', { ascending: false }).limit(20);
    $('newsList').innerHTML = (data || []).map((n) => `<div class="module-row" style="flex-direction:column;align-items:flex-start"><b>${esc(n.title)}</b><span>${n.audience === 'chapter' ? esc(chapterName(n.chapter_id)) : 'All members'} · ${n.published_at ? fmtDT(n.published_at) : 'draft'}</span><p class="small" style="margin:6px 0 0;color:var(--ink)">${esc(n.body)}</p><button class="btn danger sm" data-dn="${n.id}" style="margin-top:8px">Delete</button></div>`).join('') || '<p class="small">Nothing published.</p>';
    $$('[data-dn]').forEach((b) => (b.onclick = async () => { if (!confirm('Delete?')) return; await db.from('eff_announcements').delete().eq('id', b.dataset.dn); loadNews(); }));
  }
  $('newsForm').onsubmit = async (e) => {
    e.preventDefault(); const row = { title: $('nTitle').value.trim(), body: $('nBody').value.trim(), audience: $('nAud').value, chapter_id: $('nAud').value === 'chapter' ? $('nChapter').value || null : null, published_at: $('nWhen').value ? new Date($('nWhen').value).toISOString() : new Date().toISOString(), author_id: user.id };
    if (!row.title || !row.body) return ($('nMsg').textContent = 'Title and body are required.'); if (row.audience === 'chapter' && !row.chapter_id) return ($('nMsg').textContent = 'Pick a chapter.');
    const { error } = await db.from('eff_announcements').insert(row); $('nMsg').textContent = error ? error.message : 'Published.'; if (!error) { $('newsForm').reset(); loadNews(); }
  };

  /* ---------- esther light ---------- */
  async function loadLight() {
    const { data } = await db.from('eff_light_daily').select('*').gte('day', new Date(Date.now() - 864e5).toISOString().slice(0, 10)).order('day').limit(30);
    $('lightList').innerHTML = (data || []).map((l) => `<div class="module-row" style="flex-direction:column;align-items:flex-start"><b>${esc(l.day)} · ${esc(l.verse_ref)}</b><span>${esc(l.verse_text)}</span></div>`).join('') || '<p class="small">Nothing scheduled. Post one for today.</p>';
  }
  $('lightForm').onsubmit = async (e) => {
    e.preventDefault(); const row = { day: $('lDay').value || new Date().toISOString().slice(0, 10), verse_ref: $('lRef').value.trim(), verse_text: $('lText').value.trim(), reflection: $('lRefl').value.trim() || null };
    if (!row.verse_ref || !row.verse_text) return ($('lMsg').textContent = 'Reference and text are required.');
    const { error } = await db.from('eff_light_daily').upsert(row, { onConflict: 'day' }); $('lMsg').textContent = error ? error.message : 'Saved.'; if (!error) { $('lightForm').reset(); loadLight(); }
  };
})();
