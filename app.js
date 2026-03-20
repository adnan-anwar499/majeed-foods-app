import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const state = {
  user:null,
  role:null,
  breakdowns:[],
  pmRecords:[],
  equipments:[],
  spares:[],
  listenersStarted:false,
  pageSize:4,
  pages:{ breakdowns:1, pm:1, equipments:1, spares:1 }
};
const $ = (id) => document.getElementById(id);

function today(){ return new Date().toISOString().slice(0,10); }
$('bdDate').value = today();
$('pmDate').value = today();

function notify(title, body){
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') new Notification(title, { body });
}

function setAuthStatus(text){ $('authStatus').textContent = text; }

function showSection(sectionId){
  ['sectionBreakdown','sectionPM','sectionEquipment','sectionSpares'].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (id === sectionId) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  document.querySelectorAll('.section-tab-btn').forEach(btn => {
    if (btn.dataset.section === sectionId) btn.classList.add('active-tab');
    else btn.classList.remove('active-tab');
  });
}

function getFilteredEquipments() {
  const filter = $('equipmentFilterArea') ? $('equipmentFilterArea').value : 'All';
  if (filter === 'All') return state.equipments;
  return state.equipments.filter(item => item.area === filter);
}

function getPagedItems(type, items){
  const page = state.pages[type] || 1;
  const start = (page - 1) * state.pageSize;
  return items.slice(start, start + state.pageSize);
}

function paginationHtml(type, totalItems){
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  const current = Math.min(state.pages[type] || 1, totalPages);
  state.pages[type] = current;
  return `
    <div class="toolbar" style="margin-top:10px">
      <button class="save-btn nav-btn page-btn" data-type="${type}" data-dir="prev" ${current <= 1 ? 'disabled' : ''}>Previous</button>
      <div class="section-box" style="padding:10px 14px; margin:0;">Page ${current} of ${totalPages}</div>
      <button class="save-btn nav-btn page-btn" data-type="${type}" data-dir="next" ${current >= totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function renderAlerts(){
  const lowStock = state.spares.filter(x => Number(x.currentStock) <= Number(x.minStock)).length;
  const pendingPm = state.pmRecords.filter(x => x.status === 'Pending' || x.status === 'Skipped').length;
  const highPriority = state.breakdowns.filter(x => x.priority === 'High').length;
  const alerts = [];
  if (highPriority > 0) alerts.push(`<div class="alert-item alert-red">High priority faults open: ${highPriority}</div>`);
  if (pendingPm > 0) alerts.push(`<div class="alert-item alert-orange">Pending / skipped PM records: ${pendingPm}</div>`);
  if (lowStock > 0) alerts.push(`<div class="alert-item alert-red">Low stock spare items: ${lowStock}</div>`);
  if (!alerts.length) alerts.push(`<div class="alert-item alert-green">All clear. No critical alerts right now.</div>`);
  $('alertsBox').innerHTML = alerts.join('');
}

function updateDashboard(){
  $('openFaultsCount').textContent = state.breakdowns.length;
  $('pmDueCount').textContent = state.pmRecords.length;
  $('criticalEquipmentCount').textContent = state.equipments.filter(x => x.criticality === 'High').length;
  $('lowStockCount').textContent = state.spares.filter(x => Number(x.currentStock) <= Number(x.minStock)).length;

  if (state.role === 'Manager') {
    $('bossDashboard').classList.remove('hidden');
    $('bossHighFaults').textContent = state.breakdowns.filter(x => x.priority === 'High').length;
    $('bossPendingPM').textContent = state.pmRecords.filter(x => x.status === 'Pending' || x.status === 'Skipped').length;
    $('bossLowStock').textContent = state.spares.filter(x => Number(x.currentStock) <= Number(x.minStock)).length;
    $('bossCriticalControl').textContent = state.equipments.filter(x => x.criticality === 'High' && x.area === 'Control Room').length;
  } else {
    $('bossDashboard').classList.add('hidden');
  }
}

function renderList(id, items, type){
  const list = $(id);
  if (!list) return;

  let workingItems = items;
  if (type === 'equipments') {
    workingItems = getFilteredEquipments();
  }

  const totalItems = workingItems.length;
  if (!totalItems) {
    list.innerHTML = '<p>No records yet.</p>';
    return;
  }

  const paged = getPagedItems(type, workingItems);
  let html = '';

  if (type === 'breakdowns') {
    html = paged.map((b,i)=>`<div class="item-row"><strong>${((state.pages[type]-1)*state.pageSize)+i+1}. ${b.equipmentName}</strong><br><span class="muted">Date: ${b.date} | Area: ${b.area} | Type: ${b.equipmentType} | Fault: ${b.faultType}</span><br><span class="muted">Code: ${b.faultCode || '-'} | Priority: ${b.priority} | Shift: ${b.shift}</span><br>${b.description}</div>`).join('');
  } else if (type === 'pm') {
    html = paged.map((p,i)=>`<div class="item-row"><strong>${((state.pages[type]-1)*state.pageSize)+i+1}. ${p.equipmentName}</strong><br><span class="muted">Date: ${p.date} | Area: ${p.area} | Frequency: ${p.frequency} | Focus: ${p.focus}</span><br><span class="muted">Status: ${p.status}</span><br>${p.task}</div>`).join('');
  } else if (type === 'equipments') {
    html = paged.map((e,i)=>`<div class="item-row"><strong>${((state.pages[type]-1)*state.pageSize)+i+1}. ${e.name}</strong><br><span class="muted">Area: ${e.area} | Type: ${e.type} | Tag: ${e.tag}</span><br><span class="muted">Criticality: ${e.criticality}</span><br>${e.remarks || ''}</div>`).join('');
  } else if (type === 'spares') {
    html = paged.map((s,i)=>`<div class="item-row"><strong>${((state.pages[type]-1)*state.pageSize)+i+1}. ${s.name}</strong><br><span class="muted">Part No: ${s.number} | For: ${s.forType}</span><br><span class="muted">Stock: ${s.currentStock} | Min: ${s.minStock} | Location: ${s.location}</span></div>`).join('');
  }

  list.innerHTML = html + paginationHtml(type, totalItems);
}

function renderAll(){
  updateDashboard();
  renderAlerts();
  renderList('breakdownList', state.breakdowns, 'breakdowns');
  renderList('pmList', state.pmRecords, 'pm');
  renderList('equipmentList', state.equipments, 'equipments');
  renderList('spareList', state.spares, 'spares');
}

function clearInputs(ids){ ids.forEach(id => $(id).value = ''); }

async function createProfile(user, name, role){
  await setDoc(doc(db, 'users', user.uid), {
    uid:user.uid, name, email:user.email, role, createdAt:serverTimestamp()
  }, { merge:true });
}

async function loadRole(uid){
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().role || 'Engineer') : 'Engineer';
}

function startRealtime(){
  if (state.listenersStarted) return;
  state.listenersStarted = true;

  onSnapshot(query(collection(db, 'breakdowns'), orderBy('createdAt', 'desc')), snap => {
    const prevHigh = state.breakdowns.filter(x => x.priority === 'High').length;
    state.breakdowns = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const newHigh = state.breakdowns.filter(x => x.priority === 'High').length;
    if (newHigh > prevHigh) notify('High Priority Fault', 'A new high priority breakdown has been added.');
    state.pages.breakdowns = 1;
    renderAll();
  });

  onSnapshot(query(collection(db, 'pmRecords'), orderBy('createdAt', 'desc')), snap => {
    const prevPending = state.pmRecords.filter(x => x.status === 'Pending' || x.status === 'Skipped').length;
    state.pmRecords = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const newPending = state.pmRecords.filter(x => x.status === 'Pending' || x.status === 'Skipped').length;
    if (newPending > prevPending) notify('PM Alert', 'A pending or skipped PM record has been added.');
    state.pages.pm = 1;
    renderAll();
  });

  onSnapshot(query(collection(db, 'equipments'), orderBy('createdAt', 'desc')), snap => {
    state.equipments = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    state.pages.equipments = 1;
    renderAll();
  });

  onSnapshot(query(collection(db, 'spares'), orderBy('createdAt', 'desc')), snap => {
    const prevLow = state.spares.filter(x => Number(x.currentStock) <= Number(x.minStock)).length;
    state.spares = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const newLow = state.spares.filter(x => Number(x.currentStock) <= Number(x.minStock)).length;
    if (newLow > prevLow) notify('Low Stock Alert', 'A spare item has reached low stock.');
    state.pages.spares = 1;
    renderAll();
  });
}

$('enableNotificationsBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('Browser notifications supported nahi hain.');
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    return alert('Notifications local IP par block ho sakti hain. Best result ke liye app ko HTTPS hosting par chalayen.');
  }
  const permission = await Notification.requestPermission();
  alert('Notification permission: ' + permission);
});

$('signupBtn').addEventListener('click', async () => {
  try {
    const name = $('authName').value.trim();
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const role = $('authRole').value;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createProfile(cred.user, name || email, role);
    alert('Account created.');
  } catch (e) { alert(e.message); }
});

$('loginBtn').addEventListener('click', async () => {
  try {
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) { alert(e.message); }
});

$('showAuthBtn').addEventListener('click', () => $('authSection').classList.remove('hidden'));
$('logoutTopBtn').addEventListener('click', async () => { await signOut(auth); });

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.role = await loadRole(user.uid);
    setAuthStatus(`Logged in as ${user.email} · Role: ${state.role}`);
    $('userInfoText').textContent = `Logged in as ${user.email} · Role: ${state.role}`;
    $('authSection').classList.add('hidden');
    $('userPanel').classList.remove('hidden');
    startRealtime();
  } else {
    state.role = null;
    setAuthStatus('Not logged in.');
    $('userInfoText').textContent = 'Not logged in.';
    $('authSection').classList.remove('hidden');
    $('userPanel').classList.add('hidden');
  }
  renderAll();
});

$('saveBreakdownBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Pehle login karein.');
  const data = {
    date:$('bdDate').value,
    area:$('bdArea').value,
    equipmentName:$('bdEquipmentName').value.trim(),
    equipmentType:$('bdEquipmentType').value,
    faultType:$('bdFaultType').value,
    faultCode:$('bdFaultCode').value.trim(),
    priority:$('bdPriority').value,
    shift:$('bdShift').value,
    description:$('bdDescription').value.trim(),
    createdBy:auth.currentUser.email,
    createdAt:serverTimestamp()
  };
  if (!data.equipmentName || !data.description) return alert('Equipment Name aur Problem Description likhein.');
  await addDoc(collection(db, 'breakdowns'), data);
  clearInputs(['bdEquipmentName','bdFaultCode','bdDescription']);
});

$('savePmBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Pehle login karein.');
  const data = {
    date:$('pmDate').value,
    area:$('pmArea').value,
    equipmentName:$('pmEquipmentName').value.trim(),
    frequency:$('pmFrequency').value,
    focus:$('pmFocus').value,
    task:$('pmTask').value.trim(),
    status:$('pmStatus').value,
    createdBy:auth.currentUser.email,
    createdAt:serverTimestamp()
  };
  if (!data.equipmentName || !data.task) return alert('Equipment Name aur Task likhein.');
  await addDoc(collection(db, 'pmRecords'), data);
  clearInputs(['pmEquipmentName','pmTask']);
});

$('saveEquipmentBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Pehle login karein.');
  const data = {
    name:$('eqName').value.trim(),
    area:$('eqArea').value,
    type:$('eqType').value,
    tag:$('eqTag').value.trim(),
    criticality:$('eqCriticality').value,
    remarks:$('eqRemarks').value.trim(),
    createdBy:auth.currentUser.email,
    createdAt:serverTimestamp()
  };
  if (!data.name) return alert('Equipment Name likhein.');
  await addDoc(collection(db, 'equipments'), data);
  clearInputs(['eqName','eqTag','eqRemarks']);
});

$('saveSpareBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Pehle login karein.');
  const data = {
    name:$('spName').value.trim(),
    number:$('spNumber').value.trim(),
    forType:$('spForType').value,
    currentStock:$('spCurrentStock').value || '0',
    minStock:$('spMinStock').value || '0',
    location:$('spLocation').value.trim(),
    createdBy:auth.currentUser.email,
    createdAt:serverTimestamp()
  };
  if (!data.name) return alert('Part Name likhein.');
  await addDoc(collection(db, 'spares'), data);
  clearInputs(['spName','spNumber','spCurrentStock','spMinStock','spLocation']);
});

$('printBtn').addEventListener('click', () => window.print());

$('exportBtn').addEventListener('click', () => {
  const backup = {
    exportedAt:new Date().toISOString(),
    breakdowns:state.breakdowns,
    pmRecords:state.pmRecords,
    equipments:state.equipments,
    spares:state.spares
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'majeed_foods_cloud_backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

$('importFile').addEventListener('change', async (e) => {
  if (!auth.currentUser) return alert('Pehle login karein.');
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const groups = [
        ['breakdowns', data.breakdowns || []],
        ['pmRecords', data.pmRecords || []],
        ['equipments', data.equipments || []],
        ['spares', data.spares || []]
      ];
      for (const [name, rows] of groups) {
        for (const row of rows) {
          const clean = { ...row };
          delete clean.id;
          clean.createdBy = auth.currentUser.email;
          clean.createdAt = serverTimestamp();
          await addDoc(collection(db, name), clean);
        }
      }
      alert('Backup imported successfully.');
    } catch { alert('Backup file read nahi ho saki.'); }
  };
  reader.readAsText(file);
});

async function clearCollection(name){
  const snap = await getDocs(collection(db, name));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

$('clearAllBtn').addEventListener('click', async () => {
  if (!auth.currentUser) return alert('Pehle login karein.');
  if (!confirm('Kya aap waqai saara cloud data delete karna chahte hain?')) return;
  await clearCollection('breakdowns');
  await clearCollection('pmRecords');
  await clearCollection('equipments');
  await clearCollection('spares');
  alert('All cloud data deleted.');
});

document.addEventListener('click', (e) => {

  // Pagination buttons
  const pageBtn = e.target.closest('.page-btn');

  if (pageBtn) {
    const type = pageBtn.dataset.type;
    const dir = pageBtn.dataset.dir;
    if (dir === 'next') state.pages[type] += 1;
    if (dir === 'prev') state.pages[type] = Math.max(1, state.pages[type] - 1);
    renderAll();
    return;
  }

  const sectionBtn = e.target.closest('.section-tab-btn');
  if (sectionBtn) {
    showSection(sectionBtn.dataset.section);
  }
});

if ($('equipmentFilterArea')) {
  $('equipmentFilterArea').addEventListener('change', () => {
    state.pages.equipments = 1;
    renderAll();
  });
}

showSection('sectionBreakdown');
renderAll();
