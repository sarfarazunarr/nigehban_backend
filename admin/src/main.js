import './style.css';

// 1. Inject Dynamic Leaflet Map CSS for Custom Markers (Sleek pulses & status dots)
const styleNode = document.createElement('style');
styleNode.innerHTML = `
  .sos-marker-container {
    position: relative;
    width: 24px;
    height: 24px;
  }
  .sos-marker-dot {
    width: 10px;
    height: 10px;
    background-color: var(--status-sos, #d90429);
    border-radius: 50%;
    position: absolute;
    top: 7px;
    left: 7px;
    border: 1.5px solid #ffffff;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  }
  .sos-marker-pulse {
    width: 24px;
    height: 24px;
    background-color: rgba(217, 4, 41, 0.4);
    border-radius: 50%;
    position: absolute;
    top: 0;
    left: 0;
    animation: mapPulse 1.8s infinite ease-out;
  }
  @keyframes mapPulse {
    0% { transform: scale(0.3); opacity: 0.8; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  .incident-marker {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #ffffff;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
  }
  .marker-pending { background-color: var(--status-pending, #ffc107); }
  .marker-inprogress { background-color: var(--status-inprogress, #0d6efd); }
  .marker-resolved { background-color: var(--status-resolved, #198754); }
  .marker-dismissed { background-color: var(--status-dismissed, #dc3545); }
`;
document.head.appendChild(styleNode);

// 2. Constants
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const API_BASE = `${BACKEND_URL}/api`;
const SOCKET_BASE = BACKEND_URL;

// 3. Application State
const state = {
  token: localStorage.getItem('nigehbaan_access_token') || '',
  refreshToken: localStorage.getItem('nigehbaan_refresh_token') || '',
  user: null,
  pusher: null,
  activeTab: 'dashboard',

  // Lists & Feeds
  activeSosSessions: [],
  selectedSosId: null,
  incidents: [],
  users: [],
  activeChats: [],
  selectedChatUserId: null,

  // Pagination & Filters
  incidentsPage: 1,
  incidentsLimit: 8,
  incidentsTotal: 0,
  incidentStatusFilter: '',
  incidentCategoryFilter: '',
  usersSearchQuery: '',

  // Maps
  maps: {
    dashboard: null,
    tracking: null
  },
  markers: {
    dashboardSos: {},        // userId -> L.marker
    dashboardIncidents: {},  // incidentId -> L.marker
    trackingUser: null
  },
  trackingPolyline: null,
  trackingCoordinates: [],

  // Periodic Polling handles
  intervals: {
    dashboard: null,
    incidents: null,
    users: null,
    activeChats: null,
    resources: null
  }
};

// 4. Cache DOM Elements
const DOM = {
  loginOverlay: document.getElementById('login-overlay'),
  loginForm: document.getElementById('login-form'),
  loginUsername: document.getElementById('login-username'),
  loginPassword: document.getElementById('login-password'),
  loginErrorMsg: document.getElementById('login-error-msg'),
  
  portalContainer: document.getElementById('portal-container'),
  logoutBtn: document.getElementById('logout-btn'),
  operatorDisplayPhone: document.getElementById('operator-display-phone'),
  operatorDisplayRole: document.getElementById('operator-display-role'),
  
  navLinks: document.querySelectorAll('.nav-link'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // Dashboard Elements
  statTotalUsers: document.getElementById('stat-total-users'),
  statActiveSos: document.getElementById('stat-active-sos'),
  statPendingIncidents: document.getElementById('stat-pending-incidents'),
  statInprogressIncidents: document.getElementById('stat-inprogress-incidents'),
  dashboardFeedList: document.getElementById('dashboard-feed-list'),
  refreshDashboardBtn: document.getElementById('refresh-dashboard-btn'),
  badgeSosCount: document.getElementById('badge-sos-count'),
  badgeChatCount: document.getElementById('badge-chat-count'),
  
  // SOS Elements
  sosActiveList: document.getElementById('sos-active-list'),
  sosTrackingDetails: document.getElementById('sos-tracking-details'),
  
  // Incident Elements
  incidentsTbody: document.getElementById('incidents-tbody'),
  incidentStatusFilters: document.getElementById('incident-status-filters'),
  incidentCategorySelect: document.getElementById('incident-category-select'),
  refreshIncidentsBtn: document.getElementById('refresh-incidents-btn'),
  incidentPageCount: document.getElementById('incident-page-count'),
  incidentPrevPage: document.getElementById('incident-prev-page'),
  incidentNextPage: document.getElementById('incident-next-page'),
  
  // Modal Elements
  incidentModal: document.getElementById('incident-modal'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  modalContentDetails: document.getElementById('modal-content-details'),
  incidentUpdateForm: document.getElementById('incident-update-form'),
  modalIncidentId: document.getElementById('modal-incident-id'),
  modalStatusSelect: document.getElementById('modal-status-select'),
  modalActionInput: document.getElementById('modal-action-input'),
  modalReplyInput: document.getElementById('modal-reply-input'),
  
  // Chat Elements
  chatSessionList: document.getElementById('chat-session-list'),
  chatTargetPhone: document.getElementById('chat-target-phone'),
  chatTargetCnic: document.getElementById('chat-target-cnic'),
  chatActionsContainer: document.getElementById('chat-actions-container'),
  btnCloseChat: document.getElementById('btn-close-chat'),
  chatMessagesContainer: document.getElementById('chat-messages-container'),
  chatInputForm: document.getElementById('chat-input-form'),
  chatMsgInput: document.getElementById('chat-msg-input'),
  
  // Users Elements
  usersTbody: document.getElementById('users-tbody'),
  usersSearchInput: document.getElementById('users-search-input'),
  refreshUsersBtn: document.getElementById('refresh-users-btn'),
  
  // Safety Resources Elements
  lawsListContainer: document.getElementById('laws-list-container'),
  lawForm: document.getElementById('law-form'),
  lawCategory: document.getElementById('law-category'),
  lawTitle: document.getElementById('law-title'),
  lawDescription: document.getElementById('law-description'),
  lawInstructions: document.getElementById('law-instructions'),
  lawPrecautions: document.getElementById('law-precautions'),
  clearLawForm: document.getElementById('clear-law-form'),

  contactsListContainer: document.getElementById('contacts-list-container'),
  emergencyContactForm: document.getElementById('emergency-contact-form'),
  contactId: document.getElementById('contact-id'),
  contactName: document.getElementById('contact-name'),
  contactPhone: document.getElementById('contact-phone'),
  contactDescription: document.getElementById('contact-description'),
  clearContactForm: document.getElementById('clear-contact-form'),

  // User details modal elements
  userModal: document.getElementById('user-modal'),
  userModalCloseBtn: document.getElementById('user-modal-close-btn'),
  userModalCancelBtn: document.getElementById('user-modal-cancel-btn'),
  userModalContentDetails: document.getElementById('user-modal-content-details'),

  // Safety resource details modal elements
  resourceModal: document.getElementById('resource-modal'),
  resourceModalCloseBtn: document.getElementById('resource-modal-close-btn'),
  resourceModalCancelBtn: document.getElementById('resource-modal-cancel-btn'),
  resourceModalContentDetails: document.getElementById('resource-modal-content-details'),
  
  toastContainer: document.getElementById('toast-container')
};

// 5. Sound Alert Generator (Web Audio API - Synthesized alarm chime)
function playEmergencyChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Beep 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(950, audioCtx.currentTime);
    gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.35);
    
    // Beep 2 (Chime response offset)
    setTimeout(() => {
      if (audioCtx.state === 'closed') return;
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
      osc2.start(audioCtx.currentTime);
      osc2.stop(audioCtx.currentTime + 0.45);
    }, 120);
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

// 6. Toast Notification slide-in engine
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  if (type === 'sos') {
    toast.style.borderLeftColor = 'var(--status-sos)';
    toast.style.borderColor = 'var(--status-sos)';
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--status-sos); font-size: 1.3rem; margin-top: 2px;"></i>
        <div>
          <strong style="color: var(--status-sos); text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.8rem; display: block; margin-bottom: 4px;">CRITICAL SOS DISPATCH</strong>
          <span style="font-size: 0.9rem;">${message}</span>
        </div>
      </div>
    `;
    playEmergencyChime();
  } else if (type === 'handoff') {
    toast.style.borderLeftColor = 'var(--status-inprogress)';
    toast.style.borderColor = 'var(--status-inprogress)';
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <i class="fa-solid fa-headset" style="color: var(--status-inprogress); font-size: 1.3rem; margin-top: 2px;"></i>
        <div>
          <strong style="color: var(--status-inprogress); text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.8rem; display: block; margin-bottom: 4px;">OPERATOR TAKEOVER REQUEST</strong>
          <span style="font-size: 0.9rem;">${message}</span>
        </div>
      </div>
    `;
    playEmergencyChime();
  } else {
    toast.style.borderLeftColor = 'var(--accent-cyan)';
    toast.style.borderColor = 'var(--border-glass)';
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <i class="fa-solid fa-bell" style="color: var(--accent-cyan); font-size: 1.2rem; margin-top: 2px;"></i>
        <div>
          <strong style="color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem; display: block; margin-bottom: 4px;">NOTIFICATION</strong>
          <span style="font-size: 0.9rem;">${message}</span>
        </div>
      </div>
    `;
  }
  
  DOM.toastContainer.appendChild(toast);
  
  // Auto dismiss after 7s
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 7000);
}

// 7. Auth REST helper (includes token refresh and 401 handling)
async function fetchAuth(url, options = {}) {
  options.headers = options.headers || {};
  if (state.token) {
    options.headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  try {
    let response = await fetch(url, options);
    
    // Handle Token Expiry
    if (response.status === 401 && state.refreshToken) {
      console.log('[Auth] Access token expired, attempting refresh...');
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: state.refreshToken })
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        state.token = refreshData.accessToken;
        localStorage.setItem('nigehbaan_access_token', state.token);
        
        // Re-attempt request with new token
        options.headers['Authorization'] = `Bearer ${state.token}`;
        response = await fetch(url, options);
      } else {
        console.warn('[Auth] Refresh token failed. Directing to logout.');
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    }
    
    return response;
  } catch (error) {
    console.error(`[Fetch Auth Error] Endpoint: ${url}`, error);
    throw error;
  }
}

// 8. Auth flow handlers
async function login(phoneOrEmail, password) {
  DOM.loginErrorMsg.style.display = 'none';
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail, password })
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Invalid username or password.');
    }
    
    // Console Access check: role validation
    const userRole = data.user.role;
    if (userRole !== 'B2G' && userRole !== 'SuperAdmin') {
      throw new Error('Access Denied. You do not have permissions to access the dispatch console.');
    }
    
    // Save tokens and profile
    state.token = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    
    localStorage.setItem('nigehbaan_access_token', state.token);
    localStorage.setItem('nigehbaan_refresh_token', state.refreshToken);
    
    // Bind operator details to UI sidebar
    DOM.operatorDisplayPhone.innerText = state.user.phone || state.user.email;
    DOM.operatorDisplayRole.innerText = state.user.role === 'SuperAdmin' ? 'Super Administrator' : 'Dispatch Operator';
    
    // Hide overlay & reveal portal
    DOM.loginOverlay.style.opacity = '0';
    setTimeout(() => {
      DOM.loginOverlay.style.display = 'none';
      DOM.portalContainer.style.display = 'flex';
      
      // Initialize systems
      initPusher();
      switchTab('dashboard');
    }, 300);
    
  } catch (error) {
    DOM.loginErrorMsg.innerText = error.message;
    DOM.loginErrorMsg.style.display = 'block';
  }
}

function logout() {
  // Disconnect Pusher
  if (state.pusher) {
    state.pusher.disconnect();
    state.pusher = null;
  }
  
  // Clear State & localstorage
  state.token = '';
  state.refreshToken = '';
  state.user = null;
  localStorage.removeItem('nigehbaan_access_token');
  localStorage.removeItem('nigehbaan_refresh_token');
  
  // Clear periodic polling loops
  clearIntervals();
  
  // Revert maps
  if (state.maps.dashboard) {
    state.maps.dashboard.remove();
    state.maps.dashboard = null;
  }
  if (state.maps.tracking) {
    state.maps.tracking.remove();
    state.maps.tracking = null;
  }
  
  // Reset overlay
  DOM.loginPassword.value = '';
  DOM.loginOverlay.style.display = 'flex';
  setTimeout(() => {
    DOM.loginOverlay.style.opacity = '1';
    DOM.portalContainer.style.display = 'none';
  }, 50);
}

function clearIntervals() {
  Object.keys(state.intervals).forEach(key => {
    if (state.intervals[key]) {
      clearInterval(state.intervals[key]);
      state.intervals[key] = null;
    }
  });
}

// Check initial session status
async function verifySession() {
  if (state.token) {
    try {
      const response = await fetchAuth(`${API_BASE}/profile`);
      if (response && response.ok) {
        const result = await response.json();
        state.user = result.data;
        
        DOM.operatorDisplayPhone.innerText = state.user.phone || state.user.email;
        DOM.operatorDisplayRole.innerText = state.user.role === 'SuperAdmin' ? 'Super Administrator' : 'Dispatch Operator';
        
        DOM.loginOverlay.style.display = 'none';
        DOM.portalContainer.style.display = 'flex';
        
        initPusher();
        switchTab('dashboard');
      } else {
        logout();
      }
    } catch (err) {
      logout();
    }
  }
}

// 9. Realtime Pusher Connection
function initPusher() {
  if (state.pusher) return;
  
  console.log('[Pusher] Establishing connection...');
  state.pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY || '8becfba0db54590a6632', {
    cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap2',
    forceTLS: true
  });
  
  // Real-time Event: Live SOS Triggered Alert
  const roleB2GChannel = state.pusher.subscribe('role-B2G');
  roleB2GChannel.bind('sos_dispatch_alert', (data) => {
    console.log('[Pusher] SOS dispatch alert received:', data);
    showToast(`SOS Triggered by ${data.reporterPhone}! Dispatch units alert.`, 'sos');
    
    // Refresh SOS and Dashboard
    fetchActiveSos();
    if (state.activeTab === 'dashboard') {
      fetchDashboardMetrics();
    }
  });

  // Real-time Event: Operator Chat Handoff requested
  const operatorsChannel = state.pusher.subscribe('operators');
  operatorsChannel.bind('handoff_request', (data) => {
    console.log('[Pusher] Handoff takeover request received:', data);
    showToast(`Takeover requested: user ${data.phone} needs operator!`, 'handoff');
    
    fetchActiveChats();
  });
  
  // Real-time Event: User messages during human mode
  operatorsChannel.bind('operator_receive_message', (data) => {
    console.log('[Pusher] User chat message received in human mode:', data);
    
    // Increment unread counts or update sidebar UI lists
    fetchActiveChats();
    
    // Append to messages log if currently selected chat
    if (state.selectedChatUserId === data.userId) {
      appendChatMessage('user', data.content, new Date(data.timestamp));
    }
  });
  
  // Real-time Event: Sync messages typed by other operator consoles
  operatorsChannel.bind('operator_message_sync', (data) => {
    console.log('[Pusher] Syncing operator response message:', data);
    
    if (state.selectedChatUserId === data.userId) {
      appendChatMessage('operator', data.content, new Date(data.timestamp));
    }
  });
}

// 10. Modular Tabs Switch Routing
function switchTab(tabName) {
  state.activeTab = tabName;
  clearIntervals();
  
  // Update nav menu UI classes
  DOM.navLinks.forEach(link => {
    if (link.getAttribute('data-tab') === tabName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Update content layouts visibility
  DOM.tabContents.forEach(content => {
    if (content.id === `tab-${tabName}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Run component loaders
  if (tabName === 'dashboard') {
    initDashboardMap();
    fetchDashboardMetrics();
    // 15s poll metrics backup
    state.intervals.dashboard = setInterval(fetchDashboardMetrics, 15000);
  } else if (tabName === 'sos') {
    initTrackingMap();
    fetchActiveSos();
    // 10s poll active SOS list backup
    state.intervals.sos = setInterval(fetchActiveSos, 10000);
  } else if (tabName === 'incidents') {
    fetchIncidents();
    // 30s poll complaints
    state.intervals.incidents = setInterval(fetchIncidents, 30000);
  } else if (tabName === 'chat') {
    fetchActiveChats();
    // 10s poll active chat rooms list backup
    state.intervals.activeChats = setInterval(fetchActiveChats, 10000);
  } else if (tabName === 'users') {
    fetchUsers();
    // 60s poll users list
    state.intervals.users = setInterval(fetchUsers, 60000);
  } else if (tabName === 'resources' || tabName === 'contacts') {
    fetchResources();
    // 45s poll resources
    state.intervals.resources = setInterval(fetchResources, 45000);
  }
}

// 11. Dashboard Operations
function initDashboardMap() {
  if (state.maps.dashboard) {
    setTimeout(() => state.maps.dashboard.invalidateSize(), 50);
    return;
  }
  
  console.log('[Maps] Initializing Dashboard map overlay...');
  // Default centered in Islamabad
  state.maps.dashboard = L.map('dashboard-map', {
    zoomControl: true,
    minZoom: 4
  }).setView([33.6844, 73.0479], 12);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(state.maps.dashboard);
  
  setTimeout(() => state.maps.dashboard.invalidateSize(), 100);
}

async function fetchDashboardMetrics() {
  try {
    // 1. Fetch active SOS sessions
    const activeSosRes = await fetchAuth(`${API_BASE}/sos/active`);
    let activeSosData = [];
    if (activeSosRes && activeSosRes.ok) {
      const data = await activeSosRes.json();
      activeSosData = data.data || [];
    }
    
    // 2. Fetch incidents lists (Limit 100 for markers plot)
    const incidentsRes = await fetchAuth(`${API_BASE}/incidents?limit=100`);
    let incidentsList = [];
    if (incidentsRes && incidentsRes.ok) {
      const data = await incidentsRes.json();
      incidentsList = data.incidents || [];
    }
    
    // 3. Fetch total registered users count
    const usersRes = await fetchAuth(`${API_BASE}/profile/users`);
    let usersCount = 0;
    if (usersRes && usersRes.ok) {
      const data = await usersRes.json();
      usersCount = (data.data || []).length;
    }
    
    // Compute quick dashboard totals
    const totalActiveSos = activeSosData.length;
    const totalPending = incidentsList.filter(i => i.status === 'pending').length;
    const totalInprogress = incidentsList.filter(i => i.status === 'in-progress').length;
    
    // Bind numeric indicators
    DOM.statTotalUsers.innerText = usersCount;
    DOM.statActiveSos.innerText = totalActiveSos;
    DOM.statPendingIncidents.innerText = totalPending;
    DOM.statInprogressIncidents.innerText = totalInprogress;
    
    // Update sidebar SOS counter badge
    if (totalActiveSos > 0) {
      DOM.badgeSosCount.innerText = totalActiveSos;
      DOM.badgeSosCount.style.display = 'inline-block';
    } else {
      DOM.badgeSosCount.style.display = 'none';
    }
    
    // Render recent incident activity feed
    renderDashboardFeed(incidentsList.slice(0, 10));
    
    // Plot dashboard map layers
    plotDashboardMarkers(activeSosData, incidentsList);
    
  } catch (error) {
    console.error('Failed to reload dashboard statistics metrics:', error);
  }
}

function renderDashboardFeed(incidents) {
  if (incidents.length === 0) {
    DOM.dashboardFeedList.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; margin-top: 50px; font-size: 0.9rem;">
        No recent incident reports.
      </div>
    `;
    return;
  }
  
  DOM.dashboardFeedList.innerHTML = incidents.map(inc => {
    let statusColor = 'var(--status-pending)';
    if (inc.status === 'in-progress') statusColor = 'var(--status-inprogress)';
    else if (inc.status === 'resolved') statusColor = 'var(--status-resolved)';
    else if (inc.status === 'dismissed') statusColor = 'var(--status-dismissed)';
    
    const time = new Date(inc.timestamp || inc.createdAt).toLocaleString();
    const phone = inc.reporter ? inc.reporter.phone : 'Anonymous';
    
    return `
      <div class="activity-item" style="cursor: pointer;" onclick="openIncidentModal('${inc._id}')">
        <div class="activity-indicator" style="background-color: ${statusColor};"></div>
        <div class="activity-details">
          <h4>${inc.category.replace('_', ' ').toUpperCase()}</h4>
          <p>${inc.description ? inc.description.substring(0, 75) + '...' : 'No details description.'}</p>
          <p style="font-size:0.75rem; margin-top: 2px;">Reported by: ${phone}</p>
          <span class="activity-time">${time}</span>
        </div>
      </div>
    `;
  }).join('');
}

function plotDashboardMarkers(activeSos, incidents) {
  if (!state.maps.dashboard) return;
  
  // 1. Clear old markers no longer present
  const currentSosIds = activeSos.map(s => s.user._id);
  Object.keys(state.markers.dashboardSos).forEach(userId => {
    if (!currentSosIds.includes(userId)) {
      state.maps.dashboard.removeLayer(state.markers.dashboardSos[userId]);
      delete state.markers.dashboardSos[userId];
    }
  });
  
  const currentIncidentIds = incidents.map(i => i._id);
  Object.keys(state.markers.dashboardIncidents).forEach(incId => {
    if (!currentIncidentIds.includes(incId)) {
      state.maps.dashboard.removeLayer(state.markers.dashboardIncidents[incId]);
      delete state.markers.dashboardIncidents[incId];
    }
  });
  
  // 2. Plot SOS markers (Pulse)
  activeSos.forEach(sos => {
    if (!sos.coordinates || sos.coordinates.length < 2) return;
    const latestCoords = sos.coordinates[sos.coordinates.length - 1].location.coordinates;
    const latlng = [latestCoords[1], latestCoords[0]];
    const userId = sos.user._id;
    
    if (state.markers.dashboardSos[userId]) {
      state.markers.dashboardSos[userId].setLatLng(latlng);
    } else {
      const sosIcon = L.divIcon({
        className: 'sos-marker-container',
        html: '<div class="sos-marker-pulse"></div><div class="sos-marker-dot"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      const marker = L.marker(latlng, { icon: sosIcon })
        .addTo(state.maps.dashboard)
        .bindPopup(`<strong>EMERGENCY SOS: ${sos.user.phone}</strong><br>CNIC: ${sos.user.cnic}<br><a href="#" style="color:var(--status-sos); font-weight:600;" onclick="switchTab('sos')">Track Live</a>`);
        
      state.markers.dashboardSos[userId] = marker;
    }
  });
  
  // 3. Plot Incidents markers (Colored Dots)
  incidents.forEach(inc => {
    if (!inc.location || !inc.location.coordinates || inc.location.coordinates.length < 2) return;
    const [lng, lat] = inc.location.coordinates;
    
    if (state.markers.dashboardIncidents[inc._id]) {
      // Update status/class if already exists
      const marker = state.markers.dashboardIncidents[inc._id];
      const el = marker.getElement();
      if (el) {
        const iconDiv = el.querySelector('.incident-marker');
        if (iconDiv) {
          iconDiv.className = `incident-marker marker-${inc.status}`;
        }
      }
    } else {
      const incidentIcon = L.divIcon({
        className: 'incident-marker-container',
        html: `<div class="incident-marker marker-${inc.status}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      
      const marker = L.marker([lat, lng], { icon: incidentIcon })
        .addTo(state.maps.dashboard)
        .bindPopup(`<strong>${inc.category.replace('_', ' ').toUpperCase()}</strong><br>${inc.description ? inc.description.substring(0, 50) + '...' : ''}<br><a href="#" style="color:var(--accent-cyan);" onclick="openIncidentModal('${inc._id}')">View Details</a>`);
        
      state.markers.dashboardIncidents[inc._id] = marker;
    }
  });
}

// 12. SOS Tracking Panel Operations
function initTrackingMap() {
  if (state.maps.tracking) {
    setTimeout(() => state.maps.tracking.invalidateSize(), 50);
    return;
  }
  
  console.log('[Maps] Initializing SOS Tracking map...');
  state.maps.tracking = L.map('sos-tracking-map', {
    zoomControl: true,
    minZoom: 4
  }).setView([33.6844, 73.0479], 12);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(state.maps.tracking);
  
  setTimeout(() => state.maps.tracking.invalidateSize(), 100);
}

async function fetchActiveSos() {
  try {
    const res = await fetchAuth(`${API_BASE}/sos/active`);
    if (!res.ok) throw new Error('Failed to fetch active SOS.');
    
    const data = await res.json();
    state.activeSosSessions = data.data || [];
    
    renderActiveSosList();
  } catch (error) {
    console.error(error);
  }
}

function renderActiveSosList() {
  if (state.activeSosSessions.length === 0) {
    DOM.sosActiveList.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; margin-top: 100px; font-size: 0.95rem;">
        <i class="fa-solid fa-circle-check" style="color: var(--status-resolved); font-size: 2.5rem; margin-bottom: 15px; display: block;"></i>
        All quiet. No active SOS signals detected.
      </div>
    `;
    return;
  }
  
  DOM.sosActiveList.innerHTML = state.activeSosSessions.map(session => {
    const isActive = state.selectedSosId === session.user._id ? 'active' : '';
    const phone = session.user.phone || 'Unknown';
    const cnic = session.user.cnic || 'N/A';
    const latestCoords = session.coordinates.length > 0 
      ? session.coordinates[session.coordinates.length - 1].location.coordinates
      : null;
    const coordStr = latestCoords ? `${latestCoords[1].toFixed(5)}, ${latestCoords[0].toFixed(5)}` : 'No GPS Data';
    const time = new Date(session.startTime).toLocaleTimeString();
    
    return `
      <div class="sos-card ${isActive}" onclick="selectSosTracking('${session.user._id}')">
        <div class="sos-card-header">
          <span class="sos-phone"><i class="fa-solid fa-triangle-exclamation" style="color: var(--status-sos); margin-right: 6px;"></i> ${phone}</span>
          <span class="badge badge-sos">SOS</span>
        </div>
        <p>CNIC ID: ${cnic}</p>
        <p style="font-size:0.8rem; color: var(--accent-cyan);"><i class="fa-solid fa-location-crosshairs"></i> ${coordStr}</p>
        <div class="sos-card-footer">
          <span>Started: ${time}</span>
          <span>Pings: ${session.coordinates.length}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.selectSosTracking = async function(userId) {
  // If selecting the already active session, ignore
  if (state.selectedSosId === userId) return;
  
  // 1. Unsubscribe from current room if any
  if (state.selectedSosId && state.pusher) {
    state.pusher.unsubscribe(`sos-room-${state.selectedSosId}`);
  }
  
  state.selectedSosId = userId;
  
  // Update UI list classes
  document.querySelectorAll('.sos-card').forEach(card => {
    card.classList.remove('active');
  });
  
  // Reset maps layers
  if (state.markers.trackingUser) {
    state.maps.tracking.removeLayer(state.markers.trackingUser);
    state.markers.trackingUser = null;
  }
  if (state.trackingPolyline) {
    state.maps.tracking.removeLayer(state.trackingPolyline);
    state.trackingPolyline = null;
  }
  state.trackingCoordinates = [];
  
  // Find session data
  const session = state.activeSosSessions.find(s => s.user._id === userId);
  if (!session) return;
  
  // 2. Fetch history and plot past path
  session.coordinates.forEach(pt => {
    state.trackingCoordinates.push([pt.location.coordinates[1], pt.location.coordinates[0]]);
  });
  
  // Set up tracking map view
  if (state.trackingCoordinates.length > 0) {
    const latestLatLng = state.trackingCoordinates[state.trackingCoordinates.length - 1];
    
    // Draw path
    state.trackingPolyline = L.polyline(state.trackingCoordinates, { color: '#d90429', weight: 4 }).addTo(state.maps.tracking);
    
    // Draw icon
    const sosIcon = L.divIcon({
      className: 'sos-marker-container',
      html: '<div class="sos-marker-pulse"></div><div class="sos-marker-dot"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    state.markers.trackingUser = L.marker(latestLatLng, { icon: sosIcon }).addTo(state.maps.tracking);
    
    state.maps.tracking.setView(latestLatLng, 15);
  }
  
  // Redraw list to add active class
  renderActiveSosList();
  
  // 3. Render telemetry and details card
  const startTime = new Date(session.startTime).toLocaleString();
  const guardiansList = session.listeningGuardians && session.listeningGuardians.length > 0
    ? session.listeningGuardians.map(g => `<li>${g.phone} (CNIC: ${g.cnic})</li>`).join('')
    : '<li style="color:var(--text-muted)">No guardians registered/online.</li>';
    
  DOM.sosTrackingDetails.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
      <h3 style="font-family:'Outfit'; color:var(--status-sos); font-size:1.4rem;">
        <i class="fa-solid fa-radiation" style="animation: pulse 1.2s infinite; margin-right: 8px;"></i> LIVE BROADCAST TELEMETRY
      </h3>
      <button class="btn btn-resolved" onclick="resolveActiveSos('${userId}')">Resolve Emergency</button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <h4 style="color:var(--accent-cyan); font-size:0.8rem; margin-bottom: 6px;">VICTIM PROFILE</h4>
        <p style="margin-bottom:4px;"><strong>Name:</strong> ${session.user.name || 'Unknown'}</p>
        <p style="margin-bottom:4px;"><strong>Phone Number:</strong> ${session.user.phone || 'Unknown'}</p>
        <p style="margin-bottom:4px;"><strong>National CNIC:</strong> ${session.user.cnic || 'N/A'}</p>
        <p style="margin-bottom:4px;"><strong>Home Address:</strong> ${session.user.address || 'N/A'}</p>
        <p style="margin-bottom:4px;"><strong>Session Started:</strong> ${startTime}</p>
      </div>
      <div>
        <h4 style="color:var(--accent-cyan); font-size:0.8rem; margin-bottom: 6px;">LISTENERS & GUARDIANS</h4>
        <ul style="list-style:none; padding-left: 0; font-size:0.9rem;">
          ${guardiansList}
        </ul>
      </div>
    </div>
    
    <div style="margin-top: 15px; border-top:1px solid var(--border-glass); padding-top: 15px;">
      <h4 style="color:var(--accent-cyan); font-size:0.8rem; margin-bottom: 8px;">COORDINATE LOGS FEED</h4>
      <div id="sos-telemetry-log" style="height:110px; background:rgba(0,0,0,0.2); border:1px solid var(--border-glass); border-radius:8px; padding: 10px; overflow-y:auto; font-family:monospace; font-size:0.8rem;">
        ${state.trackingCoordinates.map((c, idx) => {
          const t = session.coordinates[idx] ? new Date(session.coordinates[idx].timestamp).toLocaleTimeString() : '';
          return `<p><span style="color: var(--accent-cyan); font-weight:600;">[${t}]</span> Telemetry Logged: ${c[0].toFixed(5)}, ${c[1].toFixed(5)}</p>`;
        }).join('')}
      </div>
    </div>
  `;
  
  // Auto scroll telemetry logs to bottom
  const telLog = document.getElementById('sos-telemetry-log');
  if (telLog) telLog.scrollTop = telLog.scrollHeight;
  
  // 4. Subscribe over Pusher for live coordinate updates
  if (state.pusher) {
    const sosChannel = state.pusher.subscribe(`sos-room-${userId}`);
    
    sosChannel.bind('location_update', (data) => {
      console.log('[Pusher] Live location tracking ping:', data);
      
      // Update map path array if this is the active user SOS being tracked
      if (state.selectedSosId === data.userId) {
        const coord = [data.coordinates[1], data.coordinates[0]]; // [lat, lng]
        state.trackingCoordinates.push(coord);
        
        // Update UI marker and path
        if (state.maps.tracking) {
          // Redraw polyline
          if (state.trackingPolyline) {
            state.trackingPolyline.setLatLngs(state.trackingCoordinates);
          } else {
            state.trackingPolyline = L.polyline(state.trackingCoordinates, { color: '#d90429', weight: 4 }).addTo(state.maps.tracking);
          }
          
          // Update user marker
          if (state.markers.trackingUser) {
            state.markers.trackingUser.setLatLng(coord);
          } else {
            const sosIcon = L.divIcon({
              className: 'sos-marker-container',
              html: '<div class="sos-marker-pulse"></div><div class="sos-marker-dot"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            state.markers.trackingUser = L.marker(coord, { icon: sosIcon }).addTo(state.maps.tracking);
          }
          
          state.maps.tracking.panTo(coord);
          
          // Append telemetry log to UI
          const telLog = document.getElementById('sos-telemetry-log');
          if (telLog) {
            const time = new Date(data.timestamp).toLocaleTimeString();
            const p = document.createElement('p');
            p.innerHTML = `<span style="color: var(--accent-cyan); font-weight:600;">[${time}]</span> Telemetry Ping: ${data.coordinates[1].toFixed(5)}, ${data.coordinates[0].toFixed(5)}`;
            telLog.appendChild(p);
            telLog.scrollTop = telLog.scrollHeight;
          }
        }
      }
      
      // Update marker coordinates in general dashboard map
      if (state.maps.dashboard && state.markers.dashboardSos[data.userId]) {
        const coord = [data.coordinates[1], data.coordinates[0]];
        state.markers.dashboardSos[data.userId].setLatLng(coord);
      }
    });

    sosChannel.bind('sos_resolved', (data) => {
      console.log('[Pusher] SOS session resolved by user:', data);
      showToast(`SOS session resolved for user ${data.userId}. Clear track.`, 'info');
      
      // Clear marker from dashboard map
      if (state.maps.dashboard && state.markers.dashboardSos[data.userId]) {
        state.maps.dashboard.removeLayer(state.markers.dashboardSos[data.userId]);
        delete state.markers.dashboardSos[data.userId];
      }
      
      // Reset active selected tracker if resolving this
      if (state.selectedSosId === data.userId) {
        state.selectedSosId = null;
        if (state.markers.trackingUser) {
          state.maps.tracking.removeLayer(state.markers.trackingUser);
          state.markers.trackingUser = null;
        }
        if (state.trackingPolyline) {
          state.maps.tracking.removeLayer(state.trackingPolyline);
          state.trackingPolyline = null;
        }
        state.trackingCoordinates = [];
        DOM.sosTrackingDetails.innerHTML = `
          <h3>SOS Session Closed</h3>
          <p>This SOS event was marked resolved. Select another active card from the left panel.</p>
        `;
      }
      
      fetchActiveSos();
      if (state.activeTab === 'dashboard') {
        fetchDashboardMetrics();
      }
    });
  }
};

window.resolveActiveSos = async function(userId) {
  if (!confirm('Are you sure you want to resolve this SOS emergency? This will notify all guardians and close tracking.')) return;
  
  try {
    const response = await fetchAuth(`${API_BASE}/sos/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to resolve SOS session.');
    }
    
    showToast('SOS session resolved and cleared successfully.', 'info');
    
    // Clear details panel
    DOM.sosTrackingDetails.innerHTML = `
      <h3>No Session Selected</h3>
      <p>Select an active SOS broadcast card from the left panel to begin live coordinate tracking and telemetry feed monitoring.</p>
    `;
    state.selectedSosId = null;
    
    fetchActiveSos();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

// 13. Incident Hub Operations
async function fetchIncidents() {
  const statusFilter = state.incidentStatusFilter;
  const categoryFilter = state.incidentCategoryFilter;
  const page = state.incidentsPage;
  const limit = state.incidentsLimit;
  
  try {
    let url = `${API_BASE}/incidents?page=${page}&limit=${limit}`;
    if (statusFilter) url += `&status=${statusFilter}`;
    if (categoryFilter) url += `&category=${categoryFilter}`;
    
    const res = await fetchAuth(url);
    if (!res.ok) throw new Error('Failed to retrieve complaints list.');
    
    const data = await res.json();
    state.incidents = data.incidents || [];
    state.incidentsTotal = data.total || 0;
    
    renderIncidentsTable();
  } catch (error) {
    console.error(error);
  }
}

function renderIncidentsTable() {
  if (state.incidents.length === 0) {
    DOM.incidentsTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 50px;">
          No incidents reported matching these filters.
        </td>
      </tr>
    `;
    DOM.incidentPageCount.innerText = '0-0 of 0';
    DOM.incidentPrevPage.disabled = true;
    DOM.incidentNextPage.disabled = true;
    return;
  }
  
  DOM.incidentsTbody.innerHTML = state.incidents.map(inc => {
    const id = inc._id;
    const category = inc.category.replace('_', ' ').toUpperCase();
    const reporter = inc.reporter ? inc.reporter.phone : 'Anonymous';
    
    // Parse location verified address from description if appended
    let details = inc.description || 'No description provided';
    if (details.includes('[Verified Location Address:')) {
      const parts = details.split('[Verified Location Address:');
      details = parts[0].trim() + `<br><small style="color:var(--accent-cyan);"><i class="fa-solid fa-map-pin"></i> Address: ${parts[1].replace(']', '').trim()}</small>`;
    }
    
    const date = new Date(inc.timestamp || inc.createdAt).toLocaleDateString();
    
    let statusClass = 'badge-pending';
    if (inc.status === 'in-progress') statusClass = 'badge-inprogress';
    else if (inc.status === 'resolved') statusClass = 'badge-resolved';
    else if (inc.status === 'dismissed') statusClass = 'badge-dismissed';
    
    return `
      <tr style="cursor: pointer;" onclick="openIncidentModal('${id}')">
        <td style="font-family: monospace; font-size:0.8rem; color:var(--text-muted);">${id.substring(0, 8)}...</td>
        <td><strong>${category}</strong></td>
        <td>${reporter}</td>
        <td>${details}</td>
        <td>${date}</td>
        <td><span class="badge ${statusClass}">${inc.status.toUpperCase()}</span></td>
        <td><span style="font-size:0.85rem; color:var(--text-gray);">${inc.action || '<span style="color:var(--text-muted)">None</span>'}</span></td>
      </tr>
    `;
  }).join('');
  
  // Setup pagination buttons
  const start = (state.incidentsPage - 1) * state.incidentsLimit + 1;
  const end = Math.min(state.incidentsPage * state.incidentsLimit, state.incidentsTotal);
  DOM.incidentPageCount.innerText = `${start}-${end} of ${state.incidentsTotal}`;
  
  DOM.incidentPrevPage.disabled = state.incidentsPage <= 1;
  DOM.incidentNextPage.disabled = end >= state.incidentsTotal;
}

// 14. Details Modal Controllers
window.openIncidentModal = async function(incidentId) {
  try {
    const res = await fetchAuth(`${API_BASE}/incidents/${incidentId}`);
    if (!res.ok) throw new Error('Failed to load incident detail parameters.');
    
    const result = await res.json();
    const inc = result.data;
    
    // Bind form elements
    DOM.modalIncidentId.value = inc._id;
    DOM.modalStatusSelect.value = inc.status || 'pending';
    DOM.modalActionInput.value = inc.action || '';
    DOM.modalReplyInput.value = inc.teamReply || '';
    
    // Setup detail content
    let address = 'GPS Location';
    let cleanDesc = inc.description || '';
    if (cleanDesc.includes('[Verified Location Address:')) {
      const parts = cleanDesc.split('[Verified Location Address:');
      cleanDesc = parts[0].trim();
      address = parts[1].replace(']', '').trim();
    }
    
    const date = new Date(inc.timestamp || inc.createdAt).toLocaleString();
    const reporter = inc.reporter 
      ? `Name: ${inc.reporter.name || 'Unknown'} | Phone: ${inc.reporter.phone} | CNIC: ${inc.reporter.cnic} | Address: ${inc.reporter.address || 'N/A'}` 
      : 'Anonymous User';
      
    // Render media list
    let mediaHtml = '';
    if (inc.mediaUrls && inc.mediaUrls.length > 0) {
      const mediaList = inc.mediaUrls.map(url => {
        const isAudio = url.match(/\.(mp3|wav|ogg|m4a|aac)$/i) || url.includes('/audio/') || url.includes('raw/upload');
        if (isAudio) {
          return `
            <div style="width: 100%; margin-top: 8px;">
              <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;"><i class="fa-solid fa-microphone"></i> Audio Attachment</p>
              <audio src="${url}" controls style="width: 100%; height: 35px;"></audio>
            </div>
          `;
        } else {
          return `
            <img src="${url}" class="media-thumbnail" onclick="window.open('${url}', '_blank')" title="Click to view full image">
          `;
        }
      }).join('');
      mediaHtml = `<div class="media-gallery">${mediaList}</div>`;
    } else {
      mediaHtml = '<p style="color:var(--text-muted); font-size:0.9rem;">No media files uploaded.</p>';
    }
    
    DOM.modalContentDetails.innerHTML = `
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-bottom: 20px;">
        <div>
          <div class="modal-section">
            <h4>Victim Statement</h4>
            <p style="font-size:1rem; line-height: 1.4; color:var(--text-white);">${cleanDesc || 'No written statement.'}</p>
          </div>
          <div class="modal-section">
            <h4>Uploaded Evidence</h4>
            ${mediaHtml}
          </div>
        </div>
        
        <div>
          <div class="modal-section" style="background:rgba(0,0,0,0.15); padding:15px; border-radius:12px; border:1px solid var(--border-glass);">
            <h4 style="margin-bottom:12px;">Telemetry Details</h4>
            <p style="margin-bottom:6px; font-size:0.85rem;"><strong>Category:</strong> ${inc.category.replace('_', ' ').toUpperCase()}</p>
            <p style="margin-bottom:6px; font-size:0.85rem;"><strong>Reported Date:</strong> ${date}</p>
            <p style="margin-bottom:6px; font-size:0.85rem;"><strong>Reporter:</strong> ${reporter}</p>
            <p style="margin-bottom:6px; font-size:0.85rem; color:var(--accent-cyan);">
              <strong><i class="fa-solid fa-location-dot"></i> Address:</strong> ${address}
            </p>
            <p style="margin-bottom:6px; font-size:0.85rem; color:var(--text-muted);">
              <strong>Coordinates:</strong> ${inc.location.coordinates[1].toFixed(6)}, ${inc.location.coordinates[0].toFixed(6)}
            </p>
          </div>
        </div>
      </div>
    `;
    
    // Show Modal
    DOM.incidentModal.style.display = 'flex';
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function closeIncidentModal() {
  DOM.incidentModal.style.display = 'none';
}

// 15. Operator Live Chat takeover panel Operations
async function fetchActiveChats() {
  try {
    const res = await fetchAuth(`${API_BASE}/chat/active`);
    if (!res.ok) throw new Error('Failed to retrieve active chats.');
    
    const data = await res.json();
    state.activeChats = data.data || [];
    
    renderChatSessionsList();
    
    // Update Chat count badge in sidebar
    const chatCount = state.activeChats.length;
    if (chatCount > 0) {
      DOM.badgeChatCount.innerText = chatCount;
      DOM.badgeChatCount.style.display = 'inline-block';
    } else {
      DOM.badgeChatCount.style.display = 'none';
    }
    
    // Refresh active message log if open
    if (state.selectedChatUserId) {
      const activeSession = state.activeChats.find(c => c.user._id === state.selectedChatUserId);
      if (activeSession) {
        renderChatHistoryMessages(activeSession.messages);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

function renderChatSessionsList() {
  if (state.activeChats.length === 0) {
    DOM.chatSessionList.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 40px 20px; font-size: 0.9rem;">
        No active operator handoff requests in progress.
      </div>
    `;
    return;
  }
  
  DOM.chatSessionList.innerHTML = state.activeChats.map(session => {
    const user = session.user;
    const isSelected = state.selectedChatUserId === user._id ? 'active' : '';
    const phone = user.phone || 'Unknown User';
    
    // Preview last message
    let lastMsg = 'Pending takeover...';
    if (session.messages && session.messages.length > 0) {
      const last = session.messages[session.messages.length - 1];
      const prefix = last.sender === 'operator' ? 'You: ' : (last.sender === 'ai' ? 'AI: ' : '');
      lastMsg = `${prefix}${last.content}`;
    }
    
    return `
      <div class="chat-session-item ${isSelected}" onclick="selectOperatorChat('${user._id}')">
        <div class="chat-session-title">
          <span><i class="fa-solid fa-headset" style="color:var(--status-inprogress); margin-right: 6px;"></i> ${phone}</span>
          <span class="chat-session-status">Handoff</span>
        </div>
        <div class="chat-session-subtitle">${lastMsg}</div>
      </div>
    `;
  }).join('');
}

window.selectOperatorChat = function(userId) {
  state.selectedChatUserId = userId;
  
  // Update sidebar item active class
  document.querySelectorAll('.chat-session-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeSession = state.activeChats.find(c => c.user._id === userId);
  if (!activeSession) return;
  
  // Re-render chat list to set active class
  renderChatSessionsList();
  
  // Setup header
  DOM.chatTargetPhone.innerText = activeSession.user.phone || 'Emergency User';
  DOM.chatTargetCnic.innerText = `Identity CNIC: ${activeSession.user.cnic || 'N/A'}`;
  
  DOM.chatActionsContainer.style.display = 'block';
  DOM.chatInputForm.style.display = 'flex';
  
  // Render message histories
  renderChatHistoryMessages(activeSession.messages);
};

function renderChatHistoryMessages(messages) {
  if (!messages || messages.length === 0) {
    DOM.chatMessagesContainer.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; margin-top: 150px; font-size: 0.95rem;">
        No message history.
      </div>
    `;
    return;
  }
  
  DOM.chatMessagesContainer.innerHTML = messages.map(msg => {
    let msgClass = 'message-user';
    let senderName = 'User';
    
    if (msg.sender === 'operator') {
      msgClass = 'message-operator';
      senderName = 'Operator (You)';
    } else if (msg.sender === 'ai') {
      msgClass = 'message-ai';
      senderName = 'Nigehbaan AI';
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString();
    
    return `
      <div class="message ${msgClass}">
        <small style="display:block; font-size:0.75rem; opacity:0.8; font-weight:600; margin-bottom: 2px;">${senderName}</small>
        ${msg.content}
        <span class="message-timestamp">${time}</span>
      </div>
    `;
  }).join('');
  
  // Auto scroll to bottom
  DOM.chatMessagesContainer.scrollTop = DOM.chatMessagesContainer.scrollHeight;
}

function appendChatMessage(sender, content, timestamp) {
  let msgClass = 'message-user';
  let senderName = 'User';
  
  if (sender === 'operator') {
    msgClass = 'message-operator';
    senderName = 'Operator (You)';
  } else if (sender === 'ai') {
    msgClass = 'message-ai';
    senderName = 'Nigehbaan AI';
  }
  
  const time = timestamp.toLocaleTimeString();
  const div = document.createElement('div');
  div.className = `message ${msgClass}`;
  div.innerHTML = `
    <small style="display:block; font-size:0.75rem; opacity:0.8; font-weight:600; margin-bottom: 2px;">${senderName}</small>
    ${content}
    <span class="message-timestamp">${time}</span>
  `;
  
  DOM.chatMessagesContainer.appendChild(div);
  DOM.chatMessagesContainer.scrollTop = DOM.chatMessagesContainer.scrollHeight;
}

async function sendChatReply(text) {
  if (!state.selectedChatUserId) return;
  
  const targetId = state.selectedChatUserId;
  
  try {
    const response = await fetchAuth(`${API_BASE}/chat/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: targetId, text })
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to deliver response message.');
    }
    
    DOM.chatMsgInput.value = '';
    appendChatMessage('operator', text, new Date());
    fetchActiveChats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function closeActiveChatSession() {
  if (!state.selectedChatUserId) return;
  
  const targetId = state.selectedChatUserId;
  if (!confirm('Are you sure you want to end live operator takeover and revert user chat back to AI responder?')) return;
  
  try {
    const response = await fetchAuth(`${API_BASE}/chat/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: targetId })
    });
    
    if (!response.ok) throw new Error('Failed to close chat session.');
    
    showToast('Takeover session closed. Reverted to AI model.', 'info');
    
    // Clear display panel
    DOM.chatTargetPhone.innerText = 'Select a Conversation';
    DOM.chatTargetCnic.innerText = 'Choose a user session from the sidebar to take over communication.';
    DOM.chatActionsContainer.style.display = 'none';
    DOM.chatInputForm.style.display = 'none';
    DOM.chatMessagesContainer.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; margin-top: 150px; font-size: 0.95rem;">
        <i class="fa-solid fa-comments" style="font-size: 3rem; color: var(--border-glass); margin-bottom: 15px; display: block;"></i>
        Operator console ready. Connect and reply to handoffs in real-time.
      </div>
    `;
    
    state.selectedChatUserId = null;
    fetchActiveChats();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 16. Users Directory Operations
async function fetchUsers() {
  try {
    const res = await fetchAuth(`${API_BASE}/profile/users`);
    if (!res.ok) throw new Error('Failed to retrieve user database.');
    
    const data = await res.json();
    state.users = data.data || [];
    
    renderUsersTable();
  } catch (error) {
    console.error(error);
  }
}

function renderUsersTable() {
  const query = state.usersSearchQuery.toLowerCase().trim();
  
  const filteredUsers = state.users.filter(u => {
    const name = (u.name || '').toLowerCase();
    const address = (u.address || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const cnic = (u.cnic || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    
    return name.includes(query) || address.includes(query) || phone.includes(query) || email.includes(query) || cnic.includes(query) || role.includes(query);
  });
  
  if (filteredUsers.length === 0) {
    DOM.usersTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 50px;">
          No registered users found.
        </td>
      </tr>
    `;
    return;
  }
  
  DOM.usersTbody.innerHTML = filteredUsers.map(u => {
    const id = u._id;
    const name = u.name || '<span style="color:var(--text-muted)">N/A</span>';
    const address = u.address || '<span style="color:var(--text-muted)">N/A</span>';
    const phone = u.phone || '<span style="color:var(--text-muted)">N/A</span>';
    const cnic = u.cnic || '<span style="color:var(--text-muted)">N/A</span>';
    const email = u.email || '<span style="color:var(--text-muted)">N/A</span>';
    const role = u.role || 'User';
    const date = new Date(u.createdAt).toLocaleDateString();
    
    let badgeStyle = 'background: rgba(255,255,255,0.05); color: var(--text-gray);';
    if (role === 'SuperAdmin') badgeStyle = 'background: rgba(217,4,41,0.15); color: var(--status-sos);';
    else if (role === 'B2G') badgeStyle = 'background: rgba(102,252,241,0.15); color: var(--accent-cyan);';
    else if (role === 'Guardian') badgeStyle = 'background: rgba(25,135,84,0.15); color: var(--status-resolved);';
    
    return `
      <tr style="cursor: pointer;" onclick="openUserDetailsModal('${id}')">
        <td style="font-family: monospace; font-size:0.8rem; color:var(--text-muted);">${id.substring(0, 8)}...</td>
        <td><strong>${name}</strong></td>
        <td>${address}</td>
        <td>${phone}</td>
        <td>${cnic}</td>
        <td>${email}</td>
        <td><span class="badge" style="${badgeStyle}">${role.toUpperCase()}</span></td>
        <td>${date}</td>
      </tr>
    `;
  }).join('');
}

// 16.5 Safety Resources & User Details Operations
async function fetchResources() {
  try {
    // 1. Fetch Laws
    const lawsRes = await fetchAuth(`${API_BASE}/laws`);
    if (lawsRes && lawsRes.ok) {
      const lawsData = await lawsRes.json();
      renderLawsList(lawsData.data || []);
    }

    // 2. Fetch Emergency Contacts
    const contactsRes = await fetchAuth(`${API_BASE}/emergency-contacts`);
    if (contactsRes && contactsRes.ok) {
      const contactsData = await contactsRes.json();
      renderContactsList(contactsData.data || []);
    }
  } catch (error) {
    console.error('Failed to load safety resources:', error);
  }
}

function renderLawsList(laws) {
  if (laws.length === 0) {
    DOM.lawsListContainer.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 20px;">
        No laws registered. Use the form above to add a new safety resource.
      </div>
    `;
    return;
  }

  DOM.lawsListContainer.innerHTML = laws.map(law => {
    const category = law.category.toUpperCase();
    const langBadgeColor = law.language === 'urdu' ? 'var(--status-inprogress)' : (law.language === 'sindhi' ? 'var(--status-resolved)' : 'var(--accent-cyan)');
    
    return `
      <div class="activity-item law-card-minimal" style="border: 1px solid var(--border-glass); border-radius: 12px; padding: 16px; background: rgba(255,255,255,0.03); transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <span class="badge" style="background: rgba(102,252,241,0.1); color: var(--accent-cyan); font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">${category}</span>
            <span class="badge" style="background: rgba(255,255,255,0.05); color: ${langBadgeColor}; font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 6px; margin-left: 6px; text-transform: capitalize;">${law.language}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(102,252,241,0.1); color: var(--accent-cyan); border: 1px solid rgba(102,252,241,0.2); border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="editLaw('${law.category}', '${law.language}')">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(220,53,69,0.1); color: var(--status-dismissed); border: 1px solid rgba(220,53,69,0.2); border-radius: 6px; cursor: pointer; transition: all 0.2s;" onclick="deleteLaw('${law.category}', '${law.language}')">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </div>
        <h4 style="margin: 0 0 14px 0; color: var(--text-white); font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 600; line-height: 1.3;">${law.title}</h4>
        <button class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.85rem; border-radius: 8px; background: linear-gradient(135deg, var(--accent-cyan) 0%, #0b8793 100%); color: var(--bg-primary); font-weight: 600; border: none; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onclick="openResourceDetailsModal('${law.category}', '${law.language}')">
          <i class="fa-solid fa-eye" style="margin-right: 4px;"></i> View Full Details
        </button>
      </div>
    `;
  }).join('');
}

window.editLaw = async function(category, language) {
  try {
    const res = await fetchAuth(`${API_BASE}/laws/category/${category}/${language || 'english'}`);
    if (res && res.ok) {
      const result = await res.json();
      const law = result.data;
      if (law) {
        DOM.lawCategory.value = law.category;
        const lawLanguage = document.getElementById('law-language');
        if (lawLanguage) lawLanguage.value = law.language;
        DOM.lawTitle.value = law.title;
        DOM.lawDescription.value = law.legalDescription;
        DOM.lawInstructions.value = (law.survivalInstructions || []).join('\n');
        DOM.lawPrecautions.value = (law.precautions || []).join('\n');
        DOM.lawForm.scrollIntoView({ behavior: 'smooth' });
      }
    }
  } catch (error) {
    showToast('Failed to fetch law details: ' + error.message, 'error');
  }
};

window.deleteLaw = async function(category, language) {
  if (!confirm(`Are you sure you want to delete safety resource for category '${category}' in language '${language}'?`)) return;

  try {
    const res = await fetchAuth(`${API_BASE}/laws/category/${category}/${language}`, {
      method: 'DELETE'
    });
    if (res && res.ok) {
      showToast('Safety resource deleted successfully.', 'info');
      fetchResources();
    } else {
      const errData = await res.json();
      throw new Error(errData.error || 'Delete failed.');
    }
  } catch (error) {
    showToast('Failed to delete law: ' + error.message, 'error');
  }
};

window.openResourceDetailsModal = async function(category, language) {
  try {
    const res = await fetchAuth(`${API_BASE}/laws/category/${category}/${language || 'english'}`);
    if (!res.ok) throw new Error('Failed to retrieve safety resource details.');
    
    const result = await res.json();
    const law = result.data;
    if (!law) throw new Error('Safety resource not found.');
    
    const instList = (law.survivalInstructions || []).map(i => `<li style="margin-bottom: 8px; line-height: 1.4;"><i class="fa-solid fa-circle-chevron-right" style="color: var(--accent-cyan); margin-right: 8px;"></i>${i}</li>`).join('');
    const precList = (law.precautions || []).map(p => `<li style="margin-bottom: 8px; line-height: 1.4;"><i class="fa-solid fa-triangle-exclamation" style="color: var(--status-pending); margin-right: 8px;"></i>${p}</li>`).join('');
    
    const langBadgeColor = law.language === 'urdu' ? 'var(--status-inprogress)' : (law.language === 'sindhi' ? 'var(--status-resolved)' : 'var(--accent-cyan)');

    DOM.resourceModalContentDetails.innerHTML = `
      <div style="background: rgba(0,0,0,0.15); padding: 20px; border-radius: 12px; border: 1px solid var(--border-glass); margin-bottom: 20px;">
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <span class="badge" style="background: rgba(102,252,241,0.15); color: var(--accent-cyan); text-transform: uppercase;">${law.category}</span>
          <span class="badge" style="background: rgba(255,255,255,0.05); color: ${langBadgeColor}; text-transform: capitalize;">${law.language}</span>
        </div>
        <h3 style="color: var(--text-white); font-family: 'Outfit'; font-size: 1.4rem; margin: 0 0 12px 0;">${law.title}</h3>
        <p style="font-size: 0.95rem; line-height: 1.5; color: var(--text-gray); margin: 0;">${law.legalDescription}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="modal-section" style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border-glass); border-radius: 12px; padding: 15px;">
          <h4 style="color: var(--accent-cyan); margin: 0 0 12px 0;"><i class="fa-solid fa-shield-halved" style="margin-right: 6px;"></i> Survival Instructions</h4>
          <ul style="list-style: none; padding-left: 0; margin: 0; font-size: 0.9rem; color: var(--text-gray);">
            ${instList || '<li style="color:var(--text-muted)">No instructions defined.</li>'}
          </ul>
        </div>
        <div class="modal-section" style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border-glass); border-radius: 12px; padding: 15px;">
          <h4 style="color: var(--status-pending); margin: 0 0 12px 0;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Safety Precautions</h4>
          <ul style="list-style: none; padding-left: 0; margin: 0; font-size: 0.9rem; color: var(--text-gray);">
            ${precList || '<li style="color:var(--text-muted)">No precautions defined.</li>'}
          </ul>
        </div>
      </div>
    `;
    
    DOM.resourceModal.style.display = 'flex';
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function closeResourceModal() {
  DOM.resourceModal.style.display = 'none';
}

function renderContactsList(contacts) {
  if (contacts.length === 0) {
    DOM.contactsListContainer.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 20px;">
        No emergency helplines registered.
      </div>
    `;
    return;
  }

  DOM.contactsListContainer.innerHTML = contacts.map(c => {
    return `
      <div class="activity-item" style="border: 1px solid var(--border-glass); border-radius: 8px; padding: 12px; background: rgba(255,255,255,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="margin: 0 0 4px 0; color: var(--text-white);">${c.name}</h4>
            <strong style="color: var(--accent-cyan); font-size: 1rem; font-family: monospace;">${c.phone}</strong>
            ${c.description ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0;">${c.description}</p>` : ''}
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(102,252,241,0.1); color: var(--accent-cyan);" onclick="editContact('${c._id}', '${escapeHtml(c.name)}', '${escapeHtml(c.phone)}', '${escapeHtml(c.description || '')}')">Edit</button>
            <button class="btn" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(220,53,69,0.1); color: var(--status-dismissed);" onclick="deleteContact('${c._id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.editContact = function(id, name, phone, description) {
  DOM.contactId.value = id;
  DOM.contactName.value = name;
  DOM.contactPhone.value = phone;
  DOM.contactDescription.value = description;
  DOM.emergencyContactForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteContact = async function(id) {
  if (!confirm('Are you sure you want to delete this emergency contact?')) return;

  try {
    const res = await fetchAuth(`${API_BASE}/emergency-contacts/${id}`, {
      method: 'DELETE'
    });
    if (res && res.ok) {
      showToast('Emergency contact deleted successfully.', 'info');
      fetchResources();
    } else {
      const errData = await res.json();
      throw new Error(errData.error || 'Delete failed.');
    }
  } catch (error) {
    showToast('Failed to delete helpline: ' + error.message, 'error');
  }
};

window.openUserDetailsModal = async function(userId) {
  try {
    const res = await fetchAuth(`${API_BASE}/profile/users/${userId}`);
    if (!res.ok) throw new Error('Failed to retrieve user details.');
    
    const result = await res.json();
    const u = result.data;
    
    const date = new Date(u.createdAt).toLocaleString();
    const guardiansHtml = u.trustedContacts && u.trustedContacts.length > 0
      ? u.trustedContacts.map(g => `
          <div style="border: 1px solid var(--border-glass); border-radius: 8px; padding: 10px; background: rgba(255,255,255,0.02); display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
            <p style="margin:0;"><strong>Name:</strong> ${g.name || '<span style="color:var(--text-muted)">N/A</span>'}</p>
            <p style="margin:0; font-size:0.85rem;"><strong>Phone:</strong> ${g.phone}</p>
            <p style="margin:0; font-size:0.85rem;"><strong>CNIC:</strong> ${g.cnic}</p>
            <p style="margin:0; font-size:0.85rem;"><strong>Email:</strong> ${g.email}</p>
            ${g.address ? `<p style="margin:0; font-size:0.85rem;"><strong>Address:</strong> ${g.address}</p>` : ''}
          </div>
        `).join('')
      : '<p style="color:var(--text-muted); font-size:0.9rem;">No guardians/trusted contacts linked.</p>';
      
    DOM.userModalContentDetails.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 10px;">
        <div class="modal-section" style="background:rgba(0,0,0,0.15); padding:15px; border-radius:12px; border:1px solid var(--border-glass);">
          <h4 style="margin-bottom:12px; color:var(--accent-cyan);">User Profile Details</h4>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Name:</strong> ${u.name || '<span style="color:var(--text-muted)">Not Set</span>'}</p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Phone:</strong> ${u.phone}</p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>CNIC Identity:</strong> ${u.cnic}</p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Email Address:</strong> ${u.email}</p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Address:</strong> ${u.address || '<span style="color:var(--text-muted)">Not Set</span>'}</p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Assigned Role:</strong> <span class="badge" style="background: rgba(102,252,241,0.15); color: var(--accent-cyan);">${u.role.toUpperCase()}</span></p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Registered Date:</strong> ${date}</p>
          <p style="margin-bottom:6px; font-size:0.9rem;"><strong>Tracking Enabled:</strong> ${u.trackingEnabled ? 'Yes' : 'No'}</p>
          <p style="margin-bottom:0; font-size:0.9rem;"><strong>Subscription Tier:</strong> ${u.subscriptionTier}</p>
        </div>
        
        <div class="modal-section" style="background:rgba(0,0,0,0.15); padding:15px; border-radius:12px; border:1px solid var(--border-glass);">
          <h4 style="margin-bottom:12px; color:var(--accent-cyan);">Linked Guardians / Contacts</h4>
          <div style="max-height: 250px; overflow-y: auto;">
            ${guardiansHtml}
          </div>
        </div>
      </div>
    `;
    
    DOM.userModal.style.display = 'flex';
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function closeUserModal() {
  DOM.userModal.style.display = 'none';
}

// 17. Bind UI DOM Event Listeners
function bindEvents() {
  // Login submit
  DOM.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login(DOM.loginUsername.value.trim(), DOM.loginPassword.value);
  });
  
  // Logout click
  DOM.logoutBtn.addEventListener('click', () => {
    if (confirm('Disconnect console session?')) {
      logout();
    }
  });
  
  // Navigation tabs
  DOM.navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tab = link.getAttribute('data-tab');
      switchTab(tab);
    });
  });
  
  // Dashboard Refresh
  DOM.refreshDashboardBtn.addEventListener('click', () => {
    fetchDashboardMetrics();
    showToast('Dashboard metrics refreshed.', 'info');
  });
  
  // Incident status filters
  DOM.incidentStatusFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    // Toggle active style classes
    DOM.incidentStatusFilters.querySelectorAll('button').forEach(b => {
      b.classList.remove('active-filter');
      b.style.background = 'rgba(255,255,255,0.02)';
      b.style.borderColor = 'var(--border-glass)';
      b.style.color = 'var(--text-white)';
    });
    
    btn.classList.add('active-filter');
    btn.style.background = 'var(--bg-tertiary)';
    btn.style.borderColor = 'var(--accent-cyan)';
    btn.style.color = 'var(--accent-cyan)';
    
    state.incidentStatusFilter = btn.getAttribute('data-status');
    state.incidentsPage = 1; // Reset to page 1
    fetchIncidents();
  });
  
  // Incident category dropdown filter
  DOM.incidentCategorySelect.addEventListener('change', () => {
    state.incidentCategoryFilter = DOM.incidentCategorySelect.value;
    state.incidentsPage = 1;
    fetchIncidents();
  });
  
  // Incidents Refresh
  DOM.refreshIncidentsBtn.addEventListener('click', () => {
    fetchIncidents();
    showToast('Incidents directory refreshed.', 'info');
  });
  
  // Incidents Pagination
  DOM.incidentPrevPage.addEventListener('click', () => {
    if (state.incidentsPage > 1) {
      state.incidentsPage--;
      fetchIncidents();
    }
  });
  
  DOM.incidentNextPage.addEventListener('click', () => {
    const end = state.incidentsPage * state.incidentsLimit;
    if (end < state.incidentsTotal) {
      state.incidentsPage++;
      fetchIncidents();
    }
  });
  
  // Modal Actions
  DOM.modalCloseBtn.addEventListener('click', closeIncidentModal);
  DOM.modalCancelBtn.addEventListener('click', closeIncidentModal);
  
  // Close modal when clicking outside card overlay
  DOM.incidentModal.addEventListener('click', (e) => {
    if (e.target === DOM.incidentModal) {
      closeIncidentModal();
    }
  });
  
  // Incident patch status form submission
  DOM.incidentUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = DOM.modalIncidentId.value;
    const status = DOM.modalStatusSelect.value;
    const action = DOM.modalActionInput.value.trim();
    const teamReply = DOM.modalReplyInput.value.trim();
    
    try {
      const response = await fetchAuth(`${API_BASE}/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, action, teamReply })
      });
      
      if (!response.ok) throw new Error('Failed to update complaint.');
      
      showToast('Incident updated and verified successfully.', 'info');
      closeIncidentModal();
      
      // Refresh list
      fetchIncidents();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  
  // Operator chat input submit reply
  DOM.chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.chatMsgInput.value.trim();
    if (text) {
      sendChatReply(text);
    }
  });
  
  // Operator chat close takeover
  DOM.btnCloseChat.addEventListener('click', closeActiveChatSession);
  
  // Users search filter input
  DOM.usersSearchInput.addEventListener('input', () => {
    state.usersSearchQuery = DOM.usersSearchInput.value;
    renderUsersTable();
  });
  
  // Users Refresh
  DOM.refreshUsersBtn.addEventListener('click', () => {
    fetchUsers();
    showToast('Users directory refreshed.', 'info');
  });

  // Safety Resources - Law form submit
  DOM.lawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const category = DOM.lawCategory.value;
    const language = document.getElementById('law-language').value;
    const title = DOM.lawTitle.value.trim();
    const legalDescription = DOM.lawDescription.value.trim();
    const survivalInstructions = DOM.lawInstructions.value.split('\n').map(i => i.trim()).filter(Boolean);
    const precautions = DOM.lawPrecautions.value.split('\n').map(p => p.trim()).filter(Boolean);
    
    try {
      const response = await fetchAuth(`${API_BASE}/laws`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, language, title, legalDescription, survivalInstructions, precautions })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save safety resource.');
      }
      
      showToast('Law safety resource saved successfully.', 'info');
      DOM.lawForm.reset();
      fetchResources();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Resource details modal close buttons
  DOM.resourceModalCloseBtn.addEventListener('click', closeResourceModal);
  DOM.resourceModalCancelBtn.addEventListener('click', closeResourceModal);

  // Close resource modal when clicking outside
  DOM.resourceModal.addEventListener('click', (e) => {
    if (e.target === DOM.resourceModal) {
      closeResourceModal();
    }
  });

  // Safety Resources - Clear law form
  DOM.clearLawForm.addEventListener('click', () => {
    DOM.lawForm.reset();
  });

  // Safety Resources - Emergency contact form submit
  DOM.emergencyContactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = DOM.contactId.value || undefined;
    const name = DOM.contactName.value.trim();
    const phone = DOM.contactPhone.value.trim();
    const description = DOM.contactDescription.value.trim() || undefined;
    
    try {
      const response = await fetchAuth(`${API_BASE}/emergency-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, phone, description })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save emergency contact.');
      }
      
      showToast('Emergency contact helpline saved successfully.', 'info');
      DOM.emergencyContactForm.reset();
      DOM.contactId.value = '';
      fetchResources();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Safety Resources - Clear contact form
  DOM.clearContactForm.addEventListener('click', () => {
    DOM.emergencyContactForm.reset();
    DOM.contactId.value = '';
  });

  // User details modal close buttons
  DOM.userModalCloseBtn.addEventListener('click', closeUserModal);
  DOM.userModalCancelBtn.addEventListener('click', closeUserModal);

  // Close user modal when clicking outside
  DOM.userModal.addEventListener('click', (e) => {
    if (e.target === DOM.userModal) {
      closeUserModal();
    }
  });
}

// 18. Initialize App
function init() {
  bindEvents();
  verifySession();
}

// Kick off
init();
