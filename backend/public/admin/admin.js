// Administration page. All server data is written with textContent: never HTML.
(function () {
  'use strict';

  var API = '/api';
  var token = null;
  try { token = sessionStorage.getItem('plaqup_admin_token'); } catch (e) { /* storage unavailable */ }

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k]; else if (k === 'class') node.className = attrs[k]; else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  };

  function call(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401 || res.status === 403) { signOut(data.error || 'Accès réservé aux administrateurs'); throw new Error(data.error); }
        if (!res.ok) throw new Error(data.error || 'Erreur');
        return data;
      });
    });
  }

  function showError(message) { $('app-error').textContent = message || ''; }

  function signOut(message) {
    token = null;
    try { sessionStorage.removeItem('plaqup_admin_token'); } catch (e) { /* ignore */ }
    $('app').hidden = true; $('login').hidden = false; $('logout').hidden = true;
    $('login-error').textContent = message || '';
  }

  function enter() {
    $('login').hidden = true; $('app').hidden = false; $('logout').hidden = false;
    loadStats(); loadReports();
  }

  $('login-form').addEventListener('submit', function (event) {
    event.preventDefault();
    $('login-error').textContent = '';
    fetch(API + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate: $('plate').value, password: $('password').value })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { $('login-error').textContent = r.data.error || 'Connexion impossible'; return; }
        token = r.data.token; $('password').value = '';
        try { sessionStorage.setItem('plaqup_admin_token', token); } catch (e) { /* ignore */ }
        return call('GET', '/admin/stats').then(enter).catch(function () { /* signOut already explained */ });
      })
      .catch(function () { $('login-error').textContent = 'Serveur injoignable'; });
  });

  $('logout').addEventListener('click', function () { signOut(''); });

  // ---- Stats ----
  var STATS = [
    ['users', 'Utilisateurs'], ['verifiedUsers', 'Comptes vérifiés'], ['messages', 'Messages'],
    ['messagesLast24h', 'Messages (24 h)'], ['messagesLast7d', 'Messages (7 j)'], ['conversations', 'Conversations'],
    ['openReports', 'Signalements à traiter'], ['suspendedUsers', 'Comptes suspendus']
  ];
  function loadStats() {
    call('GET', '/admin/stats').then(function (s) {
      var box = $('stats'); box.textContent = '';
      STATS.forEach(function (pair) {
        var alert = pair[0] === 'openReports' && s[pair[0]] > 0;
        box.appendChild(el('div', { class: 'stat' + (alert ? ' alert' : '') }, [el('b', { text: String(s[pair[0]]) }), el('span', { text: pair[1] })]));
      });
    }).catch(function (e) { showError(e.message); });
  }

  // ---- Reports ----
  var REASONS = { harassment: 'Harcèlement', spam: 'Spam', inappropriate: 'Contenu inapproprié', other: 'Autre' };
  var STATUS = { open: 'À traiter', dismissed: 'Classé', suspended: 'Suspension' };
  var fmt = function (d) { return new Date(d).toLocaleString('fr-FR'); };
  var label = function (p) { return (p.pseudo ? p.pseudo + ' · ' : '') + (p.plates.join(', ') || 'compte supprimé'); };

  function line(text, who, flag) {
    return el('div', { class: 'line' + (flag ? ' flag' : '') }, [el('div', { class: 'who', text: who }), el('div', { text: text || '(image sans texte)' })]);
  }

  function reportCard(r) {
    var s = r.snapshot;
    var evidence = el('div', { class: 'evidence' });
    s.context.forEach(function (m) {
      evidence.appendChild(line(m.content, (m.senderId === s.reported.id ? 'Signalé' : 'Signalant') + ' · ' + fmt(m.createdAt)));
    });
    evidence.appendChild(line(s.message.content, 'MESSAGE SIGNALÉ · ' + fmt(s.message.createdAt), true));

    var card = el('div', { class: 'card' }, [
      el('h3', { text: REASONS[r.reason] + ' — contre ' + label(s.reported) }),
      el('div', { class: 'meta', text: 'Signalé par ' + label(s.reporter) + ' · ' + fmt(r.createdAt) }),
      el('span', { class: 'badge ' + r.status, text: STATUS[r.status] }),
      r.note ? el('p', { text: 'Note du signalant : ' + r.note }) : el('span'),
      evidence
    ]);

    if (r.status === 'open') {
      var note = el('input', { placeholder: 'Note interne (facultatif)', maxlength: '500' });
      var dismiss = el('button', { text: 'Classer sans suite' });
      var suspend = el('button', { class: 'danger', text: 'Suspendre le compte' });
      var decide = function (action, confirmText) {
        if (confirmText && !window.confirm(confirmText)) return;
        call('POST', '/admin/reports/' + r.id + '/' + action, { note: note.value }).then(function () { showError(''); loadReports(); loadStats(); })
          .catch(function (e) { showError(e.message); });
      };
      dismiss.addEventListener('click', function () { decide('dismiss'); });
      suspend.addEventListener('click', function () { decide('suspend', 'Suspendre ' + label(s.reported) + ' ? Ses autres signalements ouverts seront clos.'); });
      card.appendChild(el('div', { class: 'actions' }, [note, dismiss, suspend]));
    } else if (r.decisionNote) {
      card.appendChild(el('p', { class: 'meta', text: 'Décision : ' + r.decisionNote + ' (' + fmt(r.decidedAt) + ')' }));
    }
    return card;
  }

  function loadReports() {
    call('GET', '/admin/reports?status=' + encodeURIComponent($('report-status').value)).then(function (list) {
      var box = $('reports'); box.textContent = '';
      if (!list.length) box.appendChild(el('div', { class: 'empty', text: 'Aucun signalement.' }));
      list.forEach(function (r) { box.appendChild(reportCard(r)); });
      showError('');
    }).catch(function (e) { showError(e.message); });
  }

  $('report-status').addEventListener('change', loadReports);
  $('refresh').addEventListener('click', function () { loadReports(); loadStats(); });

  // ---- Users ----
  function userCard(u) {
    var toggle = el('button', { class: u.suspended ? 'primary' : 'danger', text: u.suspended ? 'Débloquer' : 'Suspendre' });
    if (u.isAdmin) toggle.disabled = true;
    toggle.addEventListener('click', function () {
      if (!u.suspended && !window.confirm('Suspendre ' + label(u) + ' ?')) return;
      call('POST', '/admin/users/' + u.id + '/' + (u.suspended ? 'unsuspend' : 'suspend')).then(function () { showError(''); searchUsers(); loadStats(); })
        .catch(function (e) { showError(e.message); });
    });
    return el('div', { class: 'card' }, [
      el('h3', { text: label(u) }),
      el('div', { class: 'meta', text: 'Inscrit le ' + fmt(u.createdAt) + (u.verified ? '' : ' · non vérifié') + (u.isAdmin ? ' · administrateur' : '') }),
      u.suspended ? el('span', { class: 'badge suspended', text: 'Suspendu' }) : el('span'),
      el('div', { class: 'actions' }, [toggle])
    ]);
  }

  function searchUsers() {
    var query = $('user-query').value.trim();
    if (!query) { $('users').textContent = ''; return; }
    call('GET', '/admin/users?plate=' + encodeURIComponent(query)).then(function (list) {
      var box = $('users'); box.textContent = '';
      if (!list.length) box.appendChild(el('div', { class: 'empty', text: 'Aucun utilisateur trouvé.' }));
      list.forEach(function (u) { box.appendChild(userCard(u)); });
      showError('');
    }).catch(function (e) { showError(e.message); });
  }

  $('user-search').addEventListener('submit', function (event) { event.preventDefault(); searchUsers(); });

  document.querySelectorAll('nav button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('nav button').forEach(function (x) { x.classList.toggle('active', x === b); });
      $('tab-reports').hidden = b.dataset.tab !== 'reports';
      $('tab-users').hidden = b.dataset.tab !== 'users';
    });
  });

  if (token) { call('GET', '/admin/stats').then(enter).catch(function () { /* signed out */ }); }
})();
