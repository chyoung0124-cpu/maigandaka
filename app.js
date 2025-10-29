/* 賣肝打卡 PWA - 本地儲存版 */
const EIGHT_HOURS_MIN = 8*60;

function todayKey(d=new Date()){
  const tzOffset = d.getTimezoneOffset(); // keep local date
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function parseHM(str){
  // "HH:MM" -> minutes from midnight
  if(!str) return null;
  const [h,m] = str.split(":").map(x=>parseInt(x,10));
  return h*60 + m;
}
function minutesToHM(min){
  const h = Math.floor(min/60);
  const m = min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function formatDelta(min){ // signed +/-HH:MM
  const sign = min>=0 ? "+" : "-";
  const abs = Math.abs(min);
  const h = Math.floor(abs/60);
  const m = abs%60;
  return `${sign}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function loadAll(){
  try{
    const raw = localStorage.getItem("maigan.records");
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveAll(records){
  localStorage.setItem("maigan.records", JSON.stringify(records));
}

function getMonthRange(date=new Date()){
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m+1, 1);
  return {start, end};
}

function computeDayStats(rec){
  if(!rec || rec.start==null || rec.end==null) return {minutes:null, delta:null};
  let mins = rec.end - rec.start;
  if(mins<0) mins += 24*60; // 跨日容錯
  return {minutes: mins, delta: mins - EIGHT_HOURS_MIN};
}

function computeMonthDelta(records, date=new Date()){
  const {start, end} = getMonthRange(date);
  let sum = 0;
  for(const [key, rec] of Object.entries(records)){
    const d = new Date(key+"T00:00:00");
    if(d>=start && d<end){
      const st = computeDayStats(rec);
      if(st.delta!=null) sum += st.delta;
    }
  }
  return sum;
}

function setTodayUI(records){
  const key = todayKey();
  const rec = records[key] || {};
  const startEl = document.getElementById("startTime");
  const endEl = document.getElementById("endTime");
  const deltaEl = document.getElementById("todayDelta");
  const monthEl = document.getElementById("monthBalance");

  startEl.textContent = rec.start!=null ? minutesToHM(rec.start) : "—";
  endEl.textContent = rec.end!=null ? minutesToHM(rec.end) : "—";

  const st = computeDayStats(rec);
  deltaEl.textContent = st.delta!=null ? formatDelta(st.delta) : "+00:00";
  deltaEl.classList.toggle("delta-pos", st.delta!=null && st.delta>=0);
  deltaEl.classList.toggle("delta-neg", st.delta!=null && st.delta<0);

  const monthDelta = computeMonthDelta(records, new Date());
  monthEl.textContent = "本月：" + formatDelta(monthDelta);
  monthEl.classList.toggle("delta-pos", monthDelta>=0);
  monthEl.classList.toggle("delta-neg", monthDelta<0);
}

function renderHistory(records){
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = "";
  const keys = Object.keys(records).sort().reverse(); // recent first
  for(const key of keys){
    const rec = records[key];
    const st = computeDayStats(rec);
    const tr = document.createElement("tr");
    const duration = st.minutes!=null ? minutesToHM(st.minutes) : "—";
    const deltaStr = st.delta!=null ? formatDelta(st.delta) : "+00:00";

    tr.innerHTML = `
      <td>${key}</td>
      <td>${rec.start!=null ? minutesToHM(rec.start) : "—"}</td>
      <td>${rec.end!=null ? minutesToHM(rec.end) : "—"}</td>
      <td>${duration}</td>
      <td class="${st.delta!=null ? (st.delta>=0?'delta-pos':'delta-neg') : ''}">${deltaStr}</td>
      <td><button class="btn ghost btn-edit" data-date="${key}">編輯</button></td>
    `;
    tbody.appendChild(tr);
  }
}

function ensureRecord(records, key){
  if(!records[key]) records[key] = {start:null, end:null};
  return records[key];
}

function clockIn(){
  const now = new Date();
  const key = todayKey(now);
  const records = loadAll();
  const rec = ensureRecord(records, key);
  if(rec.start==null){
    rec.start = now.getHours()*60 + now.getMinutes();
  }else{
    // 如果已有上班時間但尚未下班，則覆蓋上班時間為現在
    if(rec.end==null){
      rec.start = now.getHours()*60 + now.getMinutes();
    }else{
      // 都有 -> 覆寫上班時間
      rec.start = now.getHours()*60 + now.getMinutes();
      rec.end = null;
    }
  }
  saveAll(records);
  setTodayUI(records);
  renderHistory(records);
}

function clockOut(){
  const now = new Date();
  const key = todayKey(now);
  const records = loadAll();
  const rec = ensureRecord(records, key);
  rec.end = now.getHours()*60 + now.getMinutes();
  saveAll(records);
  setTodayUI(records);
  renderHistory(records);
}

function openEdit(dateStr){
  const dlg = document.getElementById("editDialog");
  const form = document.getElementById("editForm");
  const title = document.getElementById("editTitle");
  const inDate = document.getElementById("editDate");
  const inStart = document.getElementById("editStart");
  const inEnd = document.getElementById("editEnd");
  const btnDel = document.getElementById("btnDelete");

  const records = loadAll();
  const rec = records[dateStr] || {start:null,end:null};

  title.textContent = `編輯：${dateStr}`;
  inDate.value = dateStr;
  inStart.value = rec.start!=null ? minutesToHM(rec.start) : "";
  inEnd.value = rec.end!=null ? minutesToHM(rec.end) : "";
  btnDel.onclick = ()=>{
    delete records[dateStr];
    saveAll(records);
    dlg.close();
    setTodayUI(records);
    renderHistory(records);
  };

  form.onsubmit = (e)=>{
    e.preventDefault();
    const ds = inDate.value;
    if(!ds) return;
    const s = inStart.value ? parseHM(inStart.value) : null;
    const eMin = inEnd.value ? parseHM(inEnd.value) : null;
    if(s==null && eMin==null){
      // 清空則刪除
      delete records[ds];
    }else{
      records[ds] = {start:s, end:eMin};
    }
    saveAll(records);
    dlg.close();
    setTodayUI(records);
    renderHistory(records);
  };

  dlg.showModal();
}

function attachEvents(){
  document.getElementById("btnClockIn").addEventListener("click", clockIn);
  document.getElementById("btnClockOut").addEventListener("click", clockOut);
  document.getElementById("btnEditToday").addEventListener("click", ()=>openEdit(todayKey()));

  document.querySelector("#historyTable tbody").addEventListener("click", (e)=>{
    const btn = e.target.closest(".btn-edit");
    if(btn){
      const d = btn.getAttribute("data-date");
      openEdit(d);
    }
  });
}

function updateDateLabel(){
  const d = new Date();
  const opts = {weekday:'short', year:'numeric', month:'2-digit', day:'2-digit'};
  const s = d.toLocaleDateString('zh-Hant-TW', opts);
  document.getElementById("clockDate").textContent = s;
}

/* LED dot-matrix clock rendered on Canvas */
const DIGITS = {
  "0":[
    "01110",
    "10001",
    "10011",
    "10101",
    "11001",
    "10001",
    "01110"
  ],
  "1":[
    "00100",
    "01100",
    "00100",
    "00100",
    "00100",
    "00100",
    "01110"
  ],
  "2":[
    "01110",
    "10001",
    "00001",
    "00010",
    "00100",
    "01000",
    "11111"
  ],
  "3":[
    "11110",
    "00001",
    "00001",
    "01110",
    "00001",
    "00001",
    "11110"
  ],
  "4":[
    "00010",
    "00110",
    "01010",
    "10010",
    "11111",
    "00010",
    "00010"
  ],
  "5":[
    "11111",
    "10000",
    "11110",
    "00001",
    "00001",
    "10001",
    "01110"
  ],
  "6":[
    "00110",
    "01000",
    "10000",
    "11110",
    "10001",
    "10001",
    "01110"
  ],
  "7":[
    "11111",
    "00001",
    "00010",
    "00100",
    "01000",
    "01000",
    "01000"
  ],
  "8":[
    "01110",
    "10001",
    "10001",
    "01110",
    "10001",
    "10001",
    "01110"
  ],
  "9":[
    "01110",
    "10001",
    "10001",
    "01111",
    "00001",
    "00010",
    "01100"
  ],
  ":":[
    "00000",
    "00100",
    "00100",
    "00000",
    "00100",
    "00100",
    "00000"
  ]
};
function drawClock(){
  const canvas = document.getElementById("ledClock");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // Current time HH:MM:SS
  const now = new Date();
  const HH = String(now.getHours()).padStart(2,'0');
  const MM = String(now.getMinutes()).padStart(2,'0');
  const SS = String(now.getSeconds()).padStart(2,'0');
  const str = `${HH}:${MM}:${SS}`;

  // Layout
  const dot = 10;       // dot size
  const gap = 6;        // spacing between dots
  const glyphW = 5, glyphH = 7;
  const glyphSpace = 22; // spacing between glyphs
  const startX = 20, startY = 30;

  // LED colors (retro green)
  const on = "#7CFF9E";
  const off = "#063b1a";

  // Subtle glow
  ctx.shadowColor = "rgba(0, 255, 140, 0.35)";
  ctx.shadowBlur = 12;

  let x = startX;
  for(const ch of str){
    const pat = DIGITS[ch];
    if(!pat){ x += glyphW*(dot+gap) + glyphSpace; continue; }
    for(let r=0;r<glyphH;r++){
      for(let c=0;c<glyphW;c++){
        const bit = pat[r][c] === "1";
        ctx.fillStyle = bit ? on : off;
        const dx = x + c*(dot+gap);
        const dy = startY + r*(dot+gap);
        // draw rounded dot
        ctx.beginPath();
        ctx.arc(dx+dot/2, dy+dot/2, dot/2, 0, Math.PI*2);
        ctx.fill();
      }
    }
    x += glyphW*(dot+gap) + glyphSpace;
  }

  // Dim border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0c1a12";
  ctx.strokeRect(6,6,w-12,h-12);
}

function tick(){
  drawClock();
  updateDateLabel();
  requestAnimationFrame(()=>{});
}
setInterval(tick, 1000);

/* PWA install */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./service-worker.js");
  });
}

/* Init */
document.addEventListener("DOMContentLoaded", ()=>{
  attachEvents();
  const records = loadAll();
  setTodayUI(records);
  renderHistory(records);
  tick();
});
