// script.js
import { CONFIG } from './config.js';
const { BACKEND_URL } = CONFIG;
const SCANNER_STATES = { NOT_STARTED: 1, SCANNING: 2, STOPPED: 3 };

const dom = {
  registrationSection: document.getElementById('registration-section'),
  appSection: document.getElementById('app-section'),
  registrationForm: document.getElementById('registration-form'),
  visitorNameInput: document.getElementById('visitor-name'),
  displayName: document.getElementById('display-name'),
  displayCode: document.getElementById('display-code'),
  messageArea: document.getElementById('message-area'),
  qrReaderResults: document.getElementById('qr-reader-results'),
  logoutButton: document.getElementById('logout-button'),
  visitedStandsList: document.getElementById('visited-stands-list'),
};

let html5QrCodeScanner = null;

function showMessage(msg, isError = false) {
  dom.messageArea.textContent = msg;
  dom.messageArea.className = `alert alert-${isError ? 'danger' : 'success'}`;
  setTimeout(() => dom.messageArea.className = '', 4000);
}

function showQrMessage(msg, isError = false) {
  dom.qrReaderResults.textContent = msg;
  dom.qrReaderResults.className = `alert alert-${isError ? 'danger' : 'success'}`;
  setTimeout(() => dom.qrReaderResults.className = '', 3000);
}

function showAppView(name, code) {
  dom.displayName.textContent = name;
  dom.displayCode.textContent = code;
  dom.registrationSection.classList.add('d-none');
  dom.appSection.classList.remove('d-none');
  startQrScanner();
  fetchVisitedStands(code);
}

function showRegistrationView() {
  dom.registrationSection.classList.remove('d-none');
  dom.appSection.classList.add('d-none');
  stopQrScanner();
  dom.visitedStandsList.innerHTML = '<li class="list-group-item">Cargando...</li>';
}

async function fetchVisitedStands(code) {
  dom.visitedStandsList.innerHTML = '<li class="list-group-item">Consultando...</li>';
  try {
    const res = await fetch(`${BACKEND_URL}/visits?visitorCode=${code}`);
    if (!res.ok) {
      if (res.status === 409) throw new Error('Ya registraste esta visita.');
      throw new Error('Error del servidor');
    }
    const { data } = await res.json();
    renderVisitedStands(data);
  } catch (err) {
    dom.visitedStandsList.innerHTML = `<li class="list-group-item text-danger">${err.message}</li>`;
  }
}

function renderVisitedStands(visits) {
  dom.visitedStandsList.innerHTML = '';
  if (!visits.length) {
    dom.visitedStandsList.innerHTML = '<li class="list-group-item fst-italic">Aún no visitas ningún stand.</li>';
    return;
  }
  visits.forEach(v => {
    const date = new Date(v.visitedAt);
    const time = date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
    const day = date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.innerHTML = `<span>${v.stand?.name || 'Desconocido'}</span><span>${day} ${time}</span>`;
    dom.visitedStandsList.appendChild(li);
  });
}

// Registro y logout
dom.registrationForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = dom.visitorNameInput.value.trim();
  if (!name) return showMessage('Ingresa tu nombre', true);
  try {
    const res = await fetch(`${BACKEND_URL}/visitors/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);
    localStorage.setItem('fp_visitorCode', json.code);
    localStorage.setItem('fp_visitorName', name);
    showMessage('Registro exitoso');
    showAppView(name, json.code);
  } catch (err) {
    showMessage(err.message, true);
  }
});

dom.logoutButton.addEventListener('click', () => {
  localStorage.removeItem('fp_visitorCode');
  localStorage.removeItem('fp_visitorName');
  showMessage('Sesión cerrada');
  showRegistrationView();
});

// Escáner QR
function onScanSuccess(decodedText) {
  showQrMessage(`Escaneado ${decodedText.slice(0, 10)}...`);
  const code = localStorage.getItem('fp_visitorCode');
  if (!code) return showQrMessage('No registrado', true);
  recordVisit(code, decodedText);
}
function onScanFailure() { /* silenciosos */ }

function startQrScanner() {
  if (!html5QrCodeScanner || html5QrCodeScanner.getState() !== SCANNER_STATES.SCANNING) {
    html5QrCodeScanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
    html5QrCodeScanner.render(onScanSuccess, onScanFailure);
  }
}
function stopQrScanner() {
  if (html5QrCodeScanner && html5QrCodeScanner.getState() === SCANNER_STATES.SCANNING) {
    html5QrCodeScanner.clear();
  }
}

async function recordVisit(visitorCode, standId) {
  try {
    const res = await fetch(`${BACKEND_URL}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorCode, standId }),
    });
    if (!res.ok) {
      if (res.status === 409) throw new Error('Visita duplicada');
      throw new Error('Error al registrar');
    }
    showQrMessage('¡Visita registrada!');
    fetchVisitedStands(visitorCode);
  } catch (err) {
    showQrMessage(err.message, true);
  }
}

try {
    const response = await fetchWithAuth(`${BACKEND_URL}/admin/stands`, {
        method: 'POST',
        body: form
    });

    console.log('Respuesta crear stand:', response); // << Log para depurar

    if (response && response.success) {
        showMessage('¡Stand creado exitosamente!');
        dom.createStandForm.reset();
        fetchAndRenderStands();
    } else {
        throw new Error(response?.message || 'Error inesperado al crear stand.');
    }
} catch (err) {
    showMessage(`Error al crear stand: ${err.message}`, true);
}

// Inicializar vista
const savedCode = localStorage.getItem('fp_visitorCode');
const savedName = localStorage.getItem('fp_visitorName');
if (savedCode && savedName) showAppView(savedName, savedCode);
else showRegistrationView();
