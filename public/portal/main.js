let token = null;
let user = null;
let wettkaempfe = [];
let editingResultId = null;

const API_BASE_URL = window.location.origin;
const IMAGE_BASE_URL = window.location.origin;

// Login-Funktion
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    token = data.token;
    user = data.user;
    document.querySelector('.portal-nav').style.display = 'flex';
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('portal-wrapper').style.display = 'block';
    document.getElementById('athlete-name').innerText = (user.vorname || '') + ' ' + (user.nachname || '');
    showSection('dashboard');
    fillDashboardResults();
    fillDashboardChart();
    fillDashboardProfile();
  } else if (data.setPassword) {
    // Passwort muss gesetzt werden
    showSetPasswordForm(email);
  } else {
    document.getElementById('login-error').innerText = data.error || 'Login fehlgeschlagen';
  }
}

// Zeige Formular zum Passwort setzen
function showSetPasswordForm(email) {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('set-password-section').style.display = 'flex';
  document.getElementById('set-password-email').value = email;
  document.getElementById('set-password-error').innerText = '';
}

// Passwort setzen
async function setPassword() {
  const email = document.getElementById('set-password-email').value;
  const password = document.getElementById('set-password-password').value;
  const password2 = document.getElementById('set-password-password2').value;
  if (!password || password.length < 6) {
    document.getElementById('set-password-error').innerText = 'Passwort muss mindestens 6 Zeichen haben!';
    return;
  }
  if (password !== password2) {
    document.getElementById('set-password-error').innerText = 'Passwörter stimmen nicht überein!';
    return;
  }
  const res = await fetch(`${API_BASE_URL}/api/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('set-password-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('login-error').innerText = 'Passwort gesetzt, bitte einloggen!';
  } else {
    document.getElementById('set-password-error').innerText = data.error || 'Fehler beim Setzen des Passworts';
  }
}
window.location.reload();

// Umschalten der Portal-Bereiche
function showSection(section) {
  document.querySelectorAll('.portal-section').forEach(s => s.style.display = 'none');
  document.getElementById(section + '-section').style.display = 'block';

  document.querySelectorAll('.portal-nav button').forEach(btn => btn.classList.remove('active'));
  const navBtn = Array.from(document.querySelectorAll('.portal-nav button'))
    .find(btn => btn.onclick && btn.onclick.toString().includes(section));
  if (navBtn) navBtn.classList.add('active');

  if (section === 'dashboard') {
    fillDashboardResults();
    fillDashboardChart();
    fillDashboardProfile();
  }
  if (section === 'results') loadResults();
  if (section === 'stats') loadResults();
  if (section === 'profile') loadProfile();
}

// Logout-Funktion
function logout() {
  token = null;
  user = null;
  document.querySelector('.portal-nav').style.display = 'none';
  document.getElementById('portal-wrapper').style.display = 'none';
  document.getElementById('login-section').style.display = 'flex';
}

// WETTKÄMPFE LADEN (für Dropdown)
async function loadWettkaempfe() {
  const res = await fetch(`${API_BASE_URL}/api/wettkaempfe`);
  wettkaempfe = await res.json();
  const dropdown = document.getElementById('wettkampf-dropdown');
  dropdown.innerHTML = '<option value="">Wettkampf auswählen</option>' +
    wettkaempfe.map(w => 
      `<option value="${w.name}" data-datum="${w.datum || ''}">${w.name}</option>`
    ).join('');

  dropdown.addEventListener('change', function() {
    const selected = dropdown.options[dropdown.selectedIndex];
    const datum = selected.getAttribute('data-datum');
    if (datum) {
      const d = new Date(datum);
      if (!isNaN(d)) {
        const tag = String(d.getDate()).padStart(2, "0");
        const monat = String(d.getMonth() + 1).padStart(2, "0");
        const jahr = d.getFullYear();
        document.getElementById('datum').value = `${tag}.${monat}.${jahr}`;
      }
    }
  });
}

// DROPDOWN ANZEIGEN, WENN ART=WETTKAMPF
document.getElementById('art').addEventListener('change', function() {
  const isWettkampf = this.value === 'Wettkampf';
  const dropdown = document.getElementById('wettkampf-dropdown');
  dropdown.style.display = isWettkampf ? 'inline-block' : 'none';
  if (isWettkampf) loadWettkaempfe();
});

// Ergebnisse laden
async function loadResults() {
  if (!user) return;
  const res = await fetch(`${API_BASE_URL}/api/results/${user.id}`);
  const data = await res.json();
  const tbody = document.querySelector('#results-table tbody');
  if (tbody) {
    tbody.innerHTML = '';
    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.datum.substr(0,10)}</td>
        <td>${r.art}</td>
        <td>${r.wert}</td>
        <td>${r.kommentar || ''}</td>
        <td><button type="button" onclick="editResult('${r.id}')">Bearbeiten</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  if (document.getElementById('chart')) drawChart(data);
}

// Ergebnis speichern/bearbeiten
async function addResult() {
  let datum = document.getElementById('datum').value;
  const art = document.getElementById('art').value;
  let wertStr = document.getElementById('wert').value.replace(',', '.');
  const wert = parseFloat(wertStr);
  const kommentar = document.getElementById('kommentar').value;
  let wettkampf = '';
  if (art === 'Wettkampf') {
    wettkampf = document.getElementById('wettkampf-dropdown').value;
  }

  if (datum && datum.includes('.')) {
    const [tag, monat, jahr] = datum.split('.');
    datum = `${jahr}-${monat.padStart(2, '0')}-${tag.padStart(2, '0')}`;
  }

  if (isNaN(wert)) {
    document.getElementById('result-message').innerText = 'Bitte eine gültige Zahl für das Ergebnis eingeben!';
    return;
  }

  let url = `${API_BASE_URL}/api/results`;
  let method = 'POST';
  let body = { user_id: user.id, datum, art, wert, kommentar, wettkampf };

  if (window.editingResultId) {
    url = `${API_BASE_URL}/api/results/${window.editingResultId}`;
    method = 'PUT';
    body.id = window.editingResultId;
  }

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    document.getElementById('result-message').innerText = 'Serverfehler: Ungültige Antwort vom Server!';
    return;
  }

  if (res.ok) {
    document.getElementById('result-message').innerText = 'Gespeichert!';
    loadResults();
    window.editingResultId = null;
    document.getElementById('result-form').reset();
    document.getElementById('wettkampf-dropdown').style.display = 'none';
  } else {
    document.getElementById('result-message').innerText = data.error || 'Fehler beim Speichern';
  }
}

// Chart.js Leistungskurve (Detailansicht)
function drawChart(results) {
  const ctx = document.getElementById('chart').getContext('2d');
  results.sort((a, b) => new Date(a.datum) - new Date(b.datum));
  const labels = results.map(r => r.datum.substr(0,10));
  const werte = results.map(r => parseFloat(r.wert));
  const windowSize = 3;
  function movingAverage(arr, windowSize) {
    return arr.map((_, idx, a) => {
      const start = Math.max(0, idx - windowSize + 1);
      const window = a.slice(start, idx + 1);
      const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
      return avg;
    });
  }
  const movingAvgArray = movingAverage(werte, windowSize);
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ergebnis',
          data: werte,
          borderColor: 'blue',
          fill: false
        },
        {
          label: `Gleitender Durchschnitt (${windowSize})`,
          data: movingAvgArray,
          borderColor: 'rgba(255, 99, 132, 0.5)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      plugins: {
        legend: { display: true }
      }
    }
  });
}

// Profil laden (Detailansicht)
async function loadProfile() {
  if (!user) return;
  const res = await fetch(`${API_BASE_URL}/api/user/${user.id}`);
  const data = await res.json();
  const bildUrl = data.bild_url ? IMAGE_BASE_URL + data.bild_url : IMAGE_BASE_URL + "/default.jpg";
  document.getElementById('user-profile').innerHTML = `
    <img src="${bildUrl}" alt="Profilbild" class="profile-avatar">
    <div class="profile-name">${data.vorname || ''} ${data.nachname || ''}</div>
    <div class="profile-status">${data.kaderstatus || 'Kein Status'}</div>
    <div class="profile-details">
      <div><span>Geburtsdatum:</span> ${data.geburtsdatum || '-'}</div>
      <div><span>Wohnort:</span> ${data.wohnort || '-'}</div>
      <div><span>E-Mail:</span> ${data.email || '-'}</div>
    </div>
  `;
}

// Dashboard: Nur letzte 3 Wettkampfergebnisse mit Wettkampfname
async function fillDashboardResults() {
  if (!user) return;
  const res = await fetch(`${API_BASE_URL}/api/results/${user.id}`);
  const data = await res.json();

  const wettkampfErgebnisse = data
    .filter(r => r.art === 'Wettkampf')
    .sort((a, b) => new Date(b.datum) - new Date(a.datum))
    .slice(0, 3);

  const tbody = document.querySelector('#dashboard-results-table tbody');
  tbody.innerHTML = '';
  wettkampfErgebnisse.forEach(r => {
    const wettkampf = r.wettkampf || r.kommentar || '-';
    const wert = r.wert || '-';
    const datum = r.datum ? r.datum.substr(0,10) : '-';
    tbody.innerHTML += `<tr><td>${datum}</td><td>${wettkampf}</td><td>${wert}</td></tr>`;
  });
}

// Dashboard: Mini-Leistungskurve und Durchschnitt
async function fillDashboardChart() {
  if (!user) return;
  const res = await fetch(`${API_BASE_URL}/api/results/${user.id}`);
  const data = await res.json();

  // 1. Nach Datum aufsteigend sortieren (alt → neu)
  const sorted = [...data].sort((a, b) => new Date(a.datum) - new Date(b.datum));
  const last5 = sorted.slice(-5);

  // Debug-Ausgabe zur Kontrolle (kann nach Test entfernt werden)
  console.log('DashboardChart last5:', last5.map(r => r.datum), last5.map(r => r.wert));

  const labels = last5.map(r => r.datum.substr(5,5));
  const werte5 = last5.map(r => parseFloat(r.wert));

  const ctx = document.getElementById('dashboard-chart').getContext('2d');
  if (window.dashChart) window.dashChart.destroy();
  window.dashChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ergebnis',
        data: werte5,
        borderColor: 'blue',
        borderWidth: 2,
        fill: false,
        pointRadius: 2
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: false } }
    }
  });
}

// Dashboard: Mini-Profil
async function fillDashboardProfile() {
  if (!user) return;
  const res = await fetch(`${API_BASE_URL}/api/user/${user.id}`);
  const data = await res.json();
  const bildUrl = data.bild_url ? IMAGE_BASE_URL + data.bild_url : IMAGE_BASE_URL + "/default.jpg";
  document.getElementById('dashboard-profile').innerHTML = `
    <img src="${bildUrl}" alt="Profilbild">
    <div><b>${data.vorname || ''} ${data.nachname || ''}</b></div>
    <div style="font-size:0.95em;">${data.kaderstatus || ''}</div>
  `;
}
