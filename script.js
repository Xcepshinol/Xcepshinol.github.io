//Date and Time JS

function updateClock() {
    const now = new Date();

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').textContent = now.toLocaleDateString('en-US', options);

    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    document.getElementById('hours').textContent = hours;
    document.getElementById('minutes').textContent = minutes;

    const colon = document.getElementById('colon');
    colon.style.opacity = seconds % 2 === 0 ? '1' : '0';
}

//call date/time function
setInterval(updateClock, 1000);
updateClock();

//Equilizer JS

const AUDIO_SRC = '9PM in Shibuya (432Hz).mp3';

// Inline SVG strings for play & pause
const PLAY_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#1f2433"/>
    <polygon points="9,7 9,17 17,12" fill="#c9c6ff"/>
  </svg>
`;

const PAUSE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#1f2433"/>
    <rect x="8" y="7" width="3" height="10" fill="#c9c6ff"/>
    <rect x="13" y="7" width="3" height="10" fill="#c9c6ff"/>
  </svg>
`;

const btn  = document.getElementById('playPause');
const icon = document.getElementById('playPauseIcon');

// set initial icon
icon.innerHTML = PLAY_ICON;

const BASE = 1;          // <-- bars never go below this (0 = flat, 1 = full box)
const HEIGHT_MULT = 4.0;    // optional: overall height scaler

const BAR_COUNT = parseInt(getComputedStyle(document.documentElement)
  .getPropertyValue('--bar-count')) || 41;

const eq  = document.getElementById('equalizer');

// Build bars
const bars = [], smooth = [];
for (let i = 0; i < BAR_COUNT; i++){
  const b = document.createElement('span');
  b.className = 'bar';
  b.style.transform = `scaleY(${BASE})`;     // start at the floor
  eq.appendChild(b);
  bars.push(b);
  smooth.push(BASE);
}

let audioCtx, analyser, data, srcNode, audioEl, rafId, ranges = [];

function initAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  audioEl = new Audio(encodeURI(AUDIO_SRC));
  audioEl.loop = true;
  audioEl.preload = 'auto';

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;
  analyser.minDecibels = -85;
  analyser.maxDecibels = -10;
  data = new Uint8Array(analyser.frequencyBinCount);

  srcNode = audioCtx.createMediaElementSource(audioEl);
  srcNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  audioEl.addEventListener('canplay', computeRanges);
  audioEl.addEventListener('error', () => console.error('Audio error:', audioEl.error));
}

function computeRanges(){
  const binCount = analyser.frequencyBinCount;
  const nyquist = audioCtx.sampleRate / 2;
  const fMin = 20, fMax = nyquist;
  const lf = Math.log10(fMin), hf = Math.log10(fMax);
  ranges = [];
  for (let i = 0; i < BAR_COUNT; i++){
    const t0 = i / BAR_COUNT, t1 = (i + 1) / BAR_COUNT;
    const f0 = 10 ** (lf + (hf - lf) * t0);
    const f1 = 10 ** (lf + (hf - lf) * t1);
    const i0 = Math.max(0, Math.floor(f0 / nyquist * (binCount - 1)));
    const i1 = Math.min(binCount - 1, Math.ceil (f1 / nyquist * (binCount - 1)));
    ranges.push([i0, Math.max(i0 + 1, i1)]);
  }
}

function frame(){
  analyser.getByteFrequencyData(data);

  for (let i = 0; i < BAR_COUNT; i++){
    const [a, b] = ranges[i] || [0, 1];
    let sum = 0; for (let k = a; k < b; k++) sum += data[k];
    const mag = sum / Math.max(1, (b - a));     // 0..255
    const vRaw = Math.pow(mag / 255, 0.3); //Compression value

    const d = Math.abs(i - (BAR_COUNT - 1) / 2);
    const sigma = BAR_COUNT / 6;
    const weight = Math.exp(-(d * d) / (2 * sigma * sigma));

    // Never below BASE; scale overall with HEIGHT_MULT
    const target = Math.max(
      BASE,
      (BASE + vRaw * (0.35 + 1.45 * weight)) * HEIGHT_MULT //height multiplier
    );

    // smooth toward target
    smooth[i] = smooth[i] * 0.6 + target * 0.4;
    bars[i].style.transform = `scaleY(${smooth[i].toFixed(3)})`;
  }
  rafId = requestAnimationFrame(frame);
}

// Drop-to-floor helper
function resetToBase(){
  eq.classList.add('paused');             // enable CSS transition
  bars.forEach((b, i) => {
    smooth[i] = BASE;
    b.style.transform = `scaleY(${BASE})`;
  });
}

btn.addEventListener('click', async () => {
  initAudio();
  await audioCtx.resume();

  if (audioEl.paused) {
    if (!ranges.length) computeRanges();
    await audioEl.play();
    if (!rafId) rafId = requestAnimationFrame(frame);

    // Swap to pause icon
    icon.innerHTML = PAUSE_ICON;
    btn.setAttribute('aria-label', 'Pause');
    btn.title = 'Pause';

    eq.classList.remove('paused');  // if you use the CSS-only paused animation
  } else {
    audioEl.pause();
    if (rafId) cancelAnimationFrame(rafId), rafId = null;
    resetToBase(true); // or resetToBase(false) depending on your choice

    // Swap to play icon
    icon.innerHTML = PLAY_ICON;
    btn.setAttribute('aria-label', 'Play');
    btn.title = 'Play';

    eq.classList.add('paused');
  }
});

window.addEventListener('pagehide', () => {
  if (rafId) cancelAnimationFrame(rafId);
  if (audioEl) audioEl.pause();
  resetToBase();                             // also on unload
});


//Folder JS

const modal = document.querySelector('.modal');
const modal1 = document.querySelector('.modal-1');
const modal2 = document.querySelector('.modal-2');
header = modal.querySelector('.modal-header');
header1 = modal1.querySelector('.modal-header-1');
header2 = modal2.querySelector('.modal-header-2');

const softbutton = document.querySelector('.software');
const hardbutton = document.querySelector('.hardware');
const perbutton = document.querySelector('.personal');
const closeWin = document.querySelector('.close-button');
const closeWin1 = document.querySelector('.close-button-1');
const closeWin2 = document.querySelector('.close-button-2');

let zIndexCounter = 1000;

//software folder

function onDrag({movementX,movementY}){
  let sty = window.getComputedStyle(modal);
  let left = parseInt(sty.left);
  let top = parseInt(sty.top);

  modal.style.left = `${left + movementX}px`;
  modal.style.top = `${top + movementY}px`;
}

header.addEventListener('mousedown', ()=>{
  modal.style.zIndex = ++zIndexCounter;
  header.addEventListener('mousemove',  onDrag);
});

header.addEventListener('mouseup', ()=>{
  header.removeEventListener('mousemove',  onDrag);
});

//hardware Folder

function onDrag1({movementX,movementY}){
  let sty1 = window.getComputedStyle(modal1);
  let left1 = parseInt(sty1.left);
  let top1 = parseInt(sty1.top);

  modal1.style.left = `${left1 + movementX}px`;
  modal1.style.top = `${top1 + movementY}px`;
}

header1.addEventListener('mousedown', ()=>{
  modal1.style.zIndex = ++zIndexCounter;
  header1.addEventListener('mousemove',  onDrag1);
});

header1.addEventListener('mouseup', ()=>{
  header1.removeEventListener('mousemove',  onDrag1);
});

//misc. folder

function onDrag2({movementX,movementY}){
  let sty2 = window.getComputedStyle(modal2);
  let left2 = parseInt(sty2.left);
  let top2 = parseInt(sty2.top);

  modal2.style.left = `${left2 + movementX}px`;
  modal2.style.top = `${top2 + movementY}px`;
}

header2.addEventListener('mousedown', ()=>{
  modal2.style.zIndex = ++zIndexCounter;
  header2.addEventListener('mousemove',  onDrag2);
});

header2.addEventListener('mouseup', ()=>{
  header2.removeEventListener('mousemove',  onDrag2);
});

//open and close logic

softbutton.addEventListener('click', ()=>{
  if (modal.classList.contains('active')){
    modal.classList.remove('active')
  }

  else{
    modal.classList.add('active')
    modal.style.zIndex = ++zIndexCounter;
  }
});

closeWin.addEventListener('click', ()=>{
  modal.classList.remove('active')
});

hardbutton.addEventListener('click', ()=>{
  if (modal1.classList.contains('active')){
    modal1.classList.remove('active')
  }

  else{
    modal1.classList.add('active')
    modal1.style.zIndex = ++zIndexCounter;
  }
});

closeWin1.addEventListener('click', ()=>{
  modal1.classList.remove('active')
});

perbutton.addEventListener('click', ()=>{
  if (modal2.classList.contains('active')){
    modal2.classList.remove('active')
  }

  else{
    modal2.classList.add('active')
    modal2.style.zIndex = ++zIndexCounter;
  }
});

closeWin2.addEventListener('click', ()=>{
  modal2.classList.remove('active')
});