import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = { user:null, role:null, breakdowns:[], pmRecords:[], equipments:[], spares:[], listenersStarted:false };
const $ = (id) => document.getElementById(id);

// ================= PAGINATION =================
const pageState = { breakdowns:1, pm:1, equipments:1 };
const ITEMS_PER_PAGE = window.innerWidth < 768 ? 3 : 5;

function paginate(items, type){
  const page = pageState[type];
  const start = (page-1)*ITEMS_PER_PAGE;
  return items.slice(start, start+ITEMS_PER_PAGE);
}

window.changePage = function(type, step){
  const items = state[type === 'pm' ? 'pmRecords' : type];
  const total = Math.ceil(items.length / ITEMS_PER_PAGE);

  pageState[type] += step;
  if(pageState[type] < 1) pageState[type] = 1;
  if(pageState[type] > total) pageState[type] = total;

  renderAll();
};

// ================= SWIPE =================
function addSwipe(element, type){
  let startX = 0;
  element.addEventListener('touchstart', e => startX = e.touches[0].clientX);
  element.addEventListener('touchend', e => {
    let endX = e.changedTouches[0].clientX;
    if(endX - startX > 50) changePage(type, -1);
    if(startX - endX > 50) changePage(type, 1);
  });
}

// ================= RENDER =================
function renderList(id, items, type){
  const list = $(id);

  if (!items.length) {
    list.innerHTML = '<p>No records yet.</p>';
    return;
  }

  const key = type === 'pm' ? 'pm' : type;
  const paginated = paginate(items, key);

  let html = paginated.map(item => {

    if (type === 'breakdowns') {
      return `
      <div class="card-item">
        <h4>${item.equipmentName}</h4>
        <p><b>Date:</b> ${item.date} | ${item.area}</p>
        <p><b>Priority:</b> ${item.priority}</p>
        <p>${item.description}</p>
      </div>`;
    }

    if (type === 'pm') {
      return `
      <div class="card-item">
        <h4>${item.equipmentName}</h4>
        <p>${item.date} | ${item.frequency}</p>
        <p>Status: ${item.status}</p>
        <p>${item.task}</p>
      </div>`;
    }

    if (type === 'equipments') {
      return `
      <div class="card-item">
        <h4>${item.name}</h4>
        <p>${item.area}</p>
        <p>Critical: ${item.criticality}</p>
      </div>`;
    }

    if (type === 'spares') {
      return `
      <div class="card-item">
        <h4>${item.name}</h4>
        <p>Stock: ${item.currentStock}</p>
      </div>`;
    }

  }).join('');

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  if(totalPages > 1){
    html += `
    <div class="pagination">
      <button onclick="changePage('${key}', -1)">Prev</button>
      <span>Page ${pageState[key]} / ${totalPages}</span>
      <button onclick="changePage('${key}', 1)">Next</button>
    </div>`;
  }

  list.innerHTML = html;
  addSwipe(list, key);
}

function renderAll(){
  updateDashboard();
  renderList('breakdownList', state.breakdowns, 'breakdowns');
  renderList('pmList', state.pmRecords, 'pm');
  renderList('equipmentList', state.equipments, 'equipments');
  renderList('spareList', state.spares, 'spares');
}

// ================= DASHBOARD =================
function updateDashboard(){
  $('openFaultsCount').textContent = state.breakdowns.length;
  $('pmDueCount').textContent = state.pmRecords.length;
  $('criticalEquipmentCount').textContent = state.equipments.filter(x => x.criticality === 'High').length;
  $('lowStockCount').textContent = state.spares.filter(x => Number(x.currentStock) <= Number(x.minStock)).length;
}

// ================= FIREBASE =================
function startRealtime(){
  if(state.listenersStarted) return;
  state.listenersStarted = true;

  onSnapshot(query(collection(db,'breakdowns'),orderBy('createdAt','desc')),snap=>{
    state.breakdowns = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAll();
  });

  onSnapshot(query(collection(db,'pmRecords'),orderBy('createdAt','desc')),snap=>{
    state.pmRecords = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAll();
  });

  onSnapshot(query(collection(db,'equipments'),orderBy('createdAt','desc')),snap=>{
    state.equipments = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAll();
  });

  onSnapshot(query(collection(db,'spares'),orderBy('createdAt','desc')),snap=>{
    state.spares = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAll();
  });
}

// ================= AUTH =================
onAuthStateChanged(auth, async (user)=>{
  state.user = user;
  if(user){
    startRealtime();
  }
});

// ================= SAVE =================
$('saveBreakdownBtn').onclick = async ()=>{
  await addDoc(collection(db,'breakdowns'),{
    equipmentName:$('bdEquipmentName').value,
    date:$('bdDate').value,
    area:$('bdArea').value,
    priority:$('bdPriority').value,
    description:$('bdDescription').value,
    createdAt:serverTimestamp()
  });
};

$('savePmBtn').onclick = async ()=>{
  await addDoc(collection(db,'pmRecords'),{
    equipmentName:$('pmEquipmentName').value,
    date:$('pmDate').value,
    frequency:$('pmFrequency').value,
    status:$('pmStatus').value,
    task:$('pmTask').value,
    createdAt:serverTimestamp()
  });
};

$('saveEquipmentBtn').onclick = async ()=>{
  await addDoc(collection(db,'equipments'),{
    name:$('eqName').value,
    area:$('eqArea').value,
    criticality:$('eqCriticality').value,
    createdAt:serverTimestamp()
  });
};

$('saveSpareBtn').onclick = async ()=>{
  await addDoc(collection(db,'spares'),{
    name:$('spName').value,
    currentStock:$('spCurrentStock').value,
    minStock:$('spMinStock').value,
    createdAt:serverTimestamp()
  });
};