// admin_script.js
import { CONFIG } from './config.js';
const { BACKEND_URL } = CONFIG;
const VISITORS_PER_PAGE = 10;

const dom = {
    loginSection: document.getElementById('login-section'),
    dashboardSection: document.getElementById('dashboard-section'),
    loginForm: document.getElementById('login-form'),
    logoutButton: document.getElementById('logout-button'),
    createStandForm: document.getElementById('create-stand-form'),
    standNameInput: document.getElementById('stand-name'),
    standDescriptionInput: document.getElementById('stand-description'),
    standLogoInput: document.getElementById('stand-logo'),
    standList: document.getElementById('stand-list'),
    visitorList: document.getElementById('visitor-list'),
    visitorSearchInput: document.getElementById('visitor-search-input'),
    visitorPaginationControls: document.getElementById('visitor-pagination-controls'),
    messageAreaDiv: document.getElementById('message-area'),
};

let allVisitors = [];
let filteredVisitors = [];
let currentVisitorPage = 1;

function showMessage(msg, isError = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `alert alert-${isError ? 'danger' : 'success'} alert-dismissible fade show`;
    wrapper.innerHTML = `
    ${msg}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
    dom.messageAreaDiv.innerHTML = '';
    dom.messageAreaDiv.appendChild(wrapper);
}

function fetchWithAuth(url, opts = {}) {
    const token = localStorage.getItem('fp_adminToken');
    const isFormData = opts.body instanceof FormData;
  
    // Asegurar que opts.headers nunca sea undefined
    const headers = opts.headers || {};
  
    // Solo forzar Content-Type si no es FormData
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
  
    // Siempre añadir Authorization si hay token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      return Promise.reject(new Error('No estás autenticado'));
    }
  
    return fetch(url, { ...opts, headers })
      .then(async res => {
        if (res.status === 401) {
          localStorage.removeItem('fp_adminToken');
          toggleView(false);
          throw new Error('Sesión expirada');
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || res.statusText);
        }
        return res.status === 204 ? null : res.json();
      });
  }
  

function toggleView(showDashboard) {
    dom.loginSection.classList.toggle('d-none', showDashboard);
    dom.dashboardSection.classList.toggle('d-none', !showDashboard);
}

async function handleLogin(event) {
    event.preventDefault();
    const username = dom.loginForm.querySelector('#username').value.trim();
    const password = dom.loginForm.querySelector('#password').value.trim();

    try {
        const res = await fetch(`${BACKEND_URL}/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || res.statusText);

        localStorage.setItem('fp_adminToken', data.token);
        showMessage('Login exitoso');
        loadDashboard();
    } catch (err) {
        showMessage(`Error en login: ${err.message}`, true);
        dom.loginForm.querySelector('#password').value = '';
    }
}

dom.loginForm.addEventListener('submit', handleLogin);
dom.logoutButton.addEventListener('click', () => {
    localStorage.removeItem('fp_adminToken');
    showMessage('Sesión cerrada');
    toggleView(false);
});

async function loadDashboard() {
    toggleView(true);
    await fetchAndRenderStands();
    await fetchAndRenderVisitors();
}

async function fetchAndRenderStands() {
    dom.standList.innerHTML = `
    <li class="list-group-item text-center">
      <div class="spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
    </li>`;
    try {
        const { data } = await fetchWithAuth(`${BACKEND_URL}/admin/stands`);
        renderStands(data);
    } catch (err) {
        dom.standList.innerHTML = `<li class="list-group-item text-danger text-center">${err.message}</li>`;
    }
}

function renderStands(stands) {
    dom.standList.innerHTML = '';
    if (!stands.length) {
        dom.standList.innerHTML = '<li class="list-group-item fst-italic text-center">No hay stands aún.</li>';
        return;
    }
    stands.forEach(s => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-start';

        // Ruta del logo si existe
        const logoUrl = s.logoUrl ? `${BACKEND_URL.replace('/api', '')}${s.logoUrl}` : null;

        li.innerHTML = ` 
        <div>
            <h5>
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo ${s.name}" width="60" style="margin-top:10px;border-radius:4px;">` : '<small class="text-muted">Sin logo</small>'}
                ${s.name}
            </h5>
            <p>${s.description || ''}</p>
            <small>ID: ${s.uniqueId}</small><br>
        </div>
        <img src="" alt="QR ${s.name}" width="80" height="80">`;

        const img = li.querySelector('img[alt^="QR"]');
        QRCode.toDataURL(s.uniqueId, { width: 80, margin: 1 })
            .then(url => img.src = url)
            .catch(() => img.alt = 'QR no disponible');

        dom.standList.appendChild(li);
    });
}


dom.createStandForm.addEventListener('submit', async e => {
    e.preventDefault();

    const name = dom.standNameInput.value.trim();
    const description = dom.standDescriptionInput.value.trim();
    const logoFile = dom.standLogoInput.files[0];

    if (!name) {
        return showMessage('El nombre del stand es obligatorio.', true);
    }

    const form = new FormData();
    form.append('name', name);
    form.append('description', description);
    if (logoFile) form.append('logoFile', logoFile);

    try {
        const response = await fetchWithAuth(`${BACKEND_URL}/admin/stands`, {
            method: 'POST',
            body: form
        });

        console.log('Respuesta crear stand:', response);

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
});


async function fetchAndRenderVisitors() {
    dom.visitorList.innerHTML = `
    <li class="list-group-item text-center">
      <div class="spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
    </li>`;
    try {
        const { data } = await fetchWithAuth(`${BACKEND_URL}/admin/visitors`);
        allVisitors = data;
        filteredVisitors = data;
        currentVisitorPage = 1;
        displayVisitorPage();
    } catch (err) {
        dom.visitorList.innerHTML = `<li class="list-group-item text-danger text-center">${err.message}</li>`;
    }
}

// ... lógica de paginación y búsqueda ...

function filterVisitors() {
    const searchTerm = dom.visitorSearchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        filteredVisitors = [...allVisitors];
    } else {
        filteredVisitors = allVisitors.filter(visitor =>
            visitor.name.toLowerCase().includes(searchTerm) ||
            visitor.code.toLowerCase().includes(searchTerm)
        );
    }
}

function displayVisitorPage() {
    filterVisitors(); // Aplicar filtro

    const totalItems = filteredVisitors.length;
    const totalPages = Math.ceil(totalItems / VISITORS_PER_PAGE);

    if (currentVisitorPage > totalPages && totalPages > 0) currentVisitorPage = totalPages;
    if (currentVisitorPage < 1) currentVisitorPage = 1;

    const startIndex = (currentVisitorPage - 1) * VISITORS_PER_PAGE;
    const endIndex = startIndex + VISITORS_PER_PAGE;
    const paginatedVisitors = filteredVisitors.slice(startIndex, endIndex);

    renderVisitors(paginatedVisitors);
    renderPaginationControls(totalPages);
}

function renderVisitors(visitorsToRender) {
    dom.visitorList.innerHTML = '';
    if (!visitorsToRender.length) {
        dom.visitorList.innerHTML = '<li class="list-group-item text-center fst-italic">No se encontraron visitantes.</li>';
        dom.visitorPaginationControls.innerHTML = '';
        return;
    }

    visitorsToRender.forEach(visitor => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
        <div>
          <strong class="text-primary">${visitor.name}</strong>
          <span class="text-muted ms-2">(Código: <code>${visitor.code}</code>)</span>
        </div>
        <button class="btn btn-sm btn-warning show-visits-button" data-visitor-code="${visitor.code}">Mostrar Visitas</button>
      `;
        dom.visitorList.appendChild(li);
    });

    // Aquí se agrega el listener después de renderizar los botones
    document.querySelectorAll('.show-visits-button').forEach(button => {
        button.addEventListener('click', async (e) => {
        const code = e.target.dataset.visitorCode;
        await showVisitorVisits(code);
        });
    });
}

async function showVisitorVisits(visitorCode) {
    try {
      const response = await fetchWithAuth(`${BACKEND_URL}/admin/visits?visitorCode=${visitorCode}`);
      if (response && response.success) {
        const visits = response.data;
        console.log(`Visitas de ${visitorCode}:`, visits);
       
        const visitList = visits.map(v =>
            v.stand && v.stand.name
              ? `- ${v.stand.name} (${new Date(v.visitedAt).toLocaleString('es-CO')})`
              : '- Visita sin stand válido'
        ).join('\\n'); alert(`Visitas de ${visitorCode}:\\n${visitList || 'No hay visitas registradas.'}`);
      } else {
        showMessage('No se pudieron cargar las visitas.', true);
      }
    } catch (err) {
      showMessage(`Error al obtener visitas: ${err.message}`, true);
    }
  }
  

function renderPaginationControls(totalPages) {
    dom.visitorPaginationControls.innerHTML = '';
    if (totalPages <= 1) return;

    // Botón Anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentVisitorPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentVisitorPage - 1}">Anterior</a>`;
    dom.visitorPaginationControls.appendChild(prevLi);

    // Números de página (ventana ±2)
    const startPage = Math.max(1, currentVisitorPage - 2);
    const endPage = Math.min(totalPages, currentVisitorPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentVisitorPage ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        dom.visitorPaginationControls.appendChild(pageLi);
    }

    // Botón Siguiente
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentVisitorPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentVisitorPage + 1}">Siguiente</a>`;
    dom.visitorPaginationControls.appendChild(nextLi);
}

dom.visitorPaginationControls.addEventListener('click', (event) => {
    event.preventDefault();
    const target = event.target;
    if (target.tagName === 'A' && target.dataset.page) {
        const page = parseInt(target.dataset.page, 10);
        if (!isNaN(page) && page !== currentVisitorPage) {
            currentVisitorPage = page;
            displayVisitorPage();
        }
    }
});

dom.visitorSearchInput.addEventListener('input', () => {
    currentVisitorPage = 1; // Resetear página al buscar
    displayVisitorPage();
});


if (localStorage.getItem('fp_adminToken')) loadDashboard();
else toggleView(false);
