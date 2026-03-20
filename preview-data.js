const today = () => new Date().toISOString().slice(0,10);
document.getElementById('bdDate').value = today();
document.getElementById('pmDate').value = today();

const sampleBreakdowns = [
  {equipment:'Packing F2 Conveyor', priority:'High', category:'Mechanical', status:'Open', date:'2026-03-20', problem:'Product jam at discharge point'},
  {equipment:'ABB IRB 460', priority:'Medium', category:'Robot', status:'Open', date:'2026-03-20', problem:'Gripper pick error / cycle stop'},
  {equipment:'PLC Panel 1', priority:'Medium', category:'Control', status:'Closed', date:'2026-03-19', problem:'Communication fault with remote I/O'}
];

const samplePM = [
  {equipment:'VFD F1', frequency:'Weekly', status:'Done', date:'2026-03-20', task:'Check fan, trip history and terminal tightness'},
  {equipment:'Roller Mill 12', frequency:'Monthly', status:'Done', date:'2026-03-19', task:'Inspect motor current and bearing condition'},
  {equipment:'Auto Scale 3', frequency:'Weekly', status:'Pending', date:'2026-03-20', task:'Accuracy check and cleaning'}
];

const sampleEquipment = [
  {name:'Roller Mill 01', category:'Roller Mill', line:'Milling', area:'Section A', criticality:'High'},
  {name:'Packing Machine F1', category:'VFD', line:'Packing F1', area:'Packing', criticality:'High'},
  {name:'Drying PLC Panel', category:'PLC', line:'Drying', area:'Drying System', criticality:'High'},
  {name:'ABB IRB 460', category:'Robot', line:'Palletizer', area:'Packing Dispatch', criticality:'High'}
];

const sampleSpares = [
  {name:'PLC I/O Card', partNumber:'6ES7-321', currentStock:1, minStock:2, location:'Rack A-1'},
  {name:'VFD Cooling Fan', partNumber:'DELTA-FAN', currentStock:3, minStock:1, location:'Rack B-2'},
  {name:'Proximity Sensor', partNumber:'OMRON-E2E', currentStock:2, minStock:2, location:'Rack C-1'}
];

document.getElementById('openBreakdowns').textContent = sampleBreakdowns.filter(x=>x.status==='Open').length;
document.getElementById('pmRecords').textContent = samplePM.length;
document.getElementById('equipmentCount').textContent = sampleEquipment.length;
document.getElementById('lowStock').textContent = sampleSpares.filter(x=>x.currentStock<=x.minStock).length;

function render(targetId, items, fn){
  const el = document.getElementById(targetId);
  el.innerHTML = items.map(fn).join('');
}
render('recentBreakdowns', sampleBreakdowns, x => `<div class="item"><b>${x.equipment}</b><div>${x.problem}</div><div class="meta">${x.date} · ${x.category} · ${x.priority} · ${x.status}</div></div>`);
render('breakdownList', sampleBreakdowns, x => `<div class="item"><b>${x.equipment}</b><div>${x.problem}</div><div class="meta">${x.date} · ${x.category} · ${x.priority} · ${x.status}</div></div>`);
render('recentPM', samplePM, x => `<div class="item"><b>${x.equipment}</b><div>${x.task}</div><div class="meta">${x.date} · ${x.frequency} · ${x.status}</div></div>`);
render('pmList', samplePM, x => `<div class="item"><b>${x.equipment}</b><div>${x.task}</div><div class="meta">${x.date} · ${x.frequency} · ${x.status}</div></div>`);
render('equipmentList', sampleEquipment, x => `<div class="item"><b>${x.name}</b><div class="meta">${x.category} · ${x.line} · ${x.area} · Criticality: ${x.criticality}</div></div>`);
render('sparesList', sampleSpares, x => `<div class="item"><b>${x.name}</b><div class="meta">${x.partNumber} · Stock ${x.currentStock} / Min ${x.minStock} · ${x.location}</div></div>`);

document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});
