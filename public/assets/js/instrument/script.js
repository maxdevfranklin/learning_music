// Note frequencies from Middle C (C4) to High C (C5)
const noteFrequencies = [
  261.63, // C4
  277.18, // C#4
  293.66, // D4
  311.13, // D#4
  329.63, // E4
  349.23, // F4
  369.99, // F#4
  392.00, // G4
  415.30, // G#4
  440.00, // A4
  466.16, // A#4
  493.88, // B4
  523.25, // C5
];

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'];
const whiteKeyIndices = [0, 2, 4, 5, 7, 9, 11, 12];
const blackKeyIndices = [1, 3, 6, 8, 10];
const whiteKeyNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
const blackKeyNames = ['C#', 'D#', 'F#', 'G#', 'A#'];

let currentInstrument = 'piano';
let audioContext = null;

// Initialize audio context
function getAudioContext() {
  if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Play note function
function playNote(frequency, instrument) {
  const ctx = getAudioContext();
  
  if (ctx.state === 'suspended') {
      ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Different waveforms for different instruments
  switch (instrument) {
      case 'piano':
          oscillator.type = 'triangle';
          break;
      case 'xylophone':
          oscillator.type = 'square';
          break;
      case 'glasses':
          oscillator.type = 'sine';
          break;
  }

  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  
  // Envelope for more realistic sound
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 1);
}

// Update pitch visualization
function updatePitchVisualization(noteIndex) {
  const pitchBars = document.querySelectorAll('.pitch-bar');
  
  // Reset all bars
  pitchBars.forEach(bar => {
      bar.classList.remove('opacity-100', 'scale-105', 'shadow-lg');
      bar.classList.add('opacity-90');
  });
  
  // Highlight active bar (only for white keys)
  if (whiteKeyIndices.includes(noteIndex)) {
      const activeBar = document.querySelector(`[data-note="${noteIndex}"]`);
      if (activeBar) {
          activeBar.classList.remove('opacity-90');
          activeBar.classList.add('opacity-100', 'scale-105', 'shadow-lg');
          
          // Clear highlight after delay
          setTimeout(() => {
              activeBar.classList.remove('opacity-100', 'scale-105', 'shadow-lg');
              activeBar.classList.add('opacity-90');
          }, 500);
      }
  }
}

// Handle note play
function handleNotePlay(noteIndex) {
  const frequency = noteFrequencies[noteIndex];
  playNote(frequency, currentInstrument);
  updatePitchVisualization(noteIndex);
}

// --- Custom cursor logic for large images ---
let customCursorImg = null;
// Add shake animation CSS class to the document head if not present
function injectShakeAnimation() {
  if (!document.getElementById('shake-keyframes')) {
    const style = document.createElement('style');
    style.id = 'shake-keyframes';
    style.innerHTML = `
      @keyframes shake {
        0% { transform: translateX(0) rotate(0deg); }
        30% { transform: translateX(-6px) rotate(-8deg); }
        100% { transform: translateX(0px) rotate(0deg); }
      }
      .shake {
        animation: shake 0.25s cubic-bezier(.36,.07,.19,.97) both;
      }
    `;
    document.head.appendChild(style);
  }
}

function setupCustomCursor() {
  // Create the custom cursor image if it doesn't exist
  if (!customCursorImg) {
    customCursorImg = document.createElement('img');
    customCursorImg.className = 'custom-cursor-img';
    customCursorImg.style.position = 'fixed';
    customCursorImg.style.pointerEvents = 'none';
    customCursorImg.style.zIndex = '9999';
    customCursorImg.style.width = '200px';
    customCursorImg.style.height = '200px';
    customCursorImg.style.display = 'none';
    document.body.appendChild(customCursorImg);
    // Inject shake animation CSS
    injectShakeAnimation();
    // Remove shake class after animation
    customCursorImg.addEventListener('animationend', () => customCursorImg.classList.remove('shake'));
  }
}

function enableCustomCursor(imgSrc) {
  setupCustomCursor();
  customCursorImg.src = imgSrc;
  customCursorImg.style.display = 'block';
  document.body.classList.add('custom-cursor-active');
}

function disableCustomCursor() {
  if (customCursorImg) customCursorImg.style.display = 'none';
  document.body.classList.remove('custom-cursor-active');
}

function moveCustomCursor(e) {
  if (customCursorImg && customCursorImg.style.display === 'block') {
    customCursorImg.style.left = (e.clientX - 20) + 'px';
    customCursorImg.style.top = (e.clientY - 20) + 'px';
  }
}

function shakeCustomCursor() {
  if (customCursorImg && customCursorImg.style.display === 'block') {
    customCursorImg.classList.remove('shake'); // reset if already animating
    void customCursorImg.offsetWidth; // force reflow
    customCursorImg.classList.add('shake');
  }
}

// Create piano keys
function createPiano() {
  const pianoKeys = document.getElementById('pianoKeys');
  pianoKeys.innerHTML = '';
  
  // Create white keys
  whiteKeyIndices.forEach((noteIndex, index) => {
      const key = document.createElement('button');
      key.className = 'w-14 h-40 bg-white border border-gray-300 rounded-b-lg shadow-md hover:bg-gray-100 active:bg-gray-200 transition-colors duration-100 flex items-end justify-center pb-2 cursor-pointer';
      key.innerHTML = `<span class="text-xs text-gray-600 font-medium">${whiteKeyNames[index]}</span>`;
      key.addEventListener('mousedown', () => handleNotePlay(noteIndex));
      pianoKeys.appendChild(key);
  });
  
  // Create black keys
  blackKeyIndices.forEach((noteIndex, index) => {
      const positions = [0.75, 1.75, 3.75, 4.75, 5.75];
      const key = document.createElement('button');
      key.className = 'absolute w-9 h-24 bg-gray-900 rounded-b-lg shadow-lg hover:bg-gray-800 active:bg-gray-700 transition-colors duration-100 flex items-end justify-center pb-1 cursor-pointer';
      key.style.left = `${positions[index] * 56}px`;
      key.style.zIndex = '10';
      key.innerHTML = `<span class="text-xs text-white font-medium">${blackKeyNames[index]}</span>`;
      key.addEventListener('mousedown', () => handleNotePlay(noteIndex));
      pianoKeys.appendChild(key);
  });
}

// Create xylophone
function createXylophone() {
  const xylophoneKeys = document.getElementById('xylophoneKeys');
  xylophoneKeys.innerHTML = '';
  
  noteNames.forEach((note, index) => {
      const barHeight = 80 + (index * 10);
      const isSharp = note.includes('#');
      
      const container = document.createElement('div');
      container.className = 'flex flex-col items-center';
      
      const bar = document.createElement('button');
      bar.className = `rounded-lg shadow-lg transition-all duration-100 hover:brightness-110 active:scale-95 ${
          isSharp 
              ? 'bg-gradient-to-b from-gray-400 to-gray-600 w-7' 
              : 'bg-gradient-to-b from-gray-300 to-gray-500 w-9'
      }`;
      bar.style.height = `${barHeight}px`;
      bar.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.3), 0 4px 8px rgba(0,0,0,0.2)';
      bar.addEventListener('mousedown', () => {
        handleNotePlay(index);
        shakeCustomCursor();
      });
      // Custom cursor events
      bar.addEventListener('mouseenter', () => enableCustomCursor('assets/image/instrument/mallet.png'));
      bar.addEventListener('mouseleave', disableCustomCursor);
      bar.addEventListener('mousemove', moveCustomCursor);
      
      const label = document.createElement('span');
      label.className = 'text-xs mt-2 text-gray-700 font-medium';
      label.textContent = note;
      
      container.appendChild(bar);
      container.appendChild(label);
      xylophoneKeys.appendChild(container);
  });
}

// Create glasses
function createGlasses() {
  const glassesKeys = document.getElementById('glassesKeys');
  glassesKeys.innerHTML = '';
  
  noteNames.forEach((note, index) => {
      const glassHeight = 100 + (index * 8);
      const waterLevel = 30 + (index * 6);
      
      const container = document.createElement('div');
      container.className = 'flex flex-col items-center';
      
      const glass = document.createElement('button');
      glass.className = 'relative transition-all duration-100 hover:scale-105 active:scale-95';
      glass.style.height = `${glassHeight}px`;
      glass.style.width = '36px';
      glass.addEventListener('mousedown', () => {
        handleNotePlay(index);
        shakeCustomCursor();
      });
      // Custom cursor events
      glass.addEventListener('mouseenter', () => enableCustomCursor('assets/image/instrument/metalstick.png'));
      glass.addEventListener('mouseleave', disableCustomCursor);
      glass.addEventListener('mousemove', moveCustomCursor);
      
      const glassBody = document.createElement('div');
      glassBody.className = 'absolute bottom-0 w-full border-2 border-gray-400 rounded-b-lg bg-gradient-to-t from-blue-50 to-transparent';
      glassBody.style.height = `${glassHeight}px`;
      
      const water = document.createElement('div');
      water.className = 'absolute bottom-0 w-full bg-gradient-to-t from-blue-300 to-blue-200 rounded-b-lg opacity-80';
      water.style.height = `${waterLevel}px`;
      
      const shine = document.createElement('div');
      shine.className = 'absolute left-1 top-2 w-1 h-12 bg-white opacity-60 rounded-full';
      
      glassBody.appendChild(water);
      glassBody.appendChild(shine);
      glass.appendChild(glassBody);
      
      const label = document.createElement('span');
      label.className = 'text-xs mt-2 text-gray-700 font-medium';
      label.textContent = note;
      
      container.appendChild(glass);
      container.appendChild(label);
      glassesKeys.appendChild(container);
  });
}

// Switch instrument
function switchInstrument(instrument) {
  currentInstrument = instrument;
  
  // Update selector buttons
  document.querySelectorAll('.instrument-btn').forEach(btn => {
      btn.classList.remove('bg-blue-500', 'text-white', 'scale-105');
      btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-50');
  });
  
  document.querySelector(`[data-instrument="${instrument}"]`).classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-50');
  document.querySelector(`[data-instrument="${instrument}"]`).classList.add('bg-blue-500', 'text-white', 'scale-105');
  
  // Hide all instruments
  document.querySelectorAll('.instrument').forEach(inst => {
      inst.classList.add('hidden');
      inst.classList.remove('active');
  });
  
  // Show selected instrument
  document.getElementById(instrument).classList.remove('hidden');
  document.getElementById(instrument).classList.add('active');
  
  // // Update instructions
  // const instructions = document.getElementById('instructions');
  // instructions.textContent = `Click on the ${instrument} to play notes and see the pitch visualization above!`;
}

// Initialize the app
function init() {
  // Create instruments
  createPiano();
  createXylophone();
  createGlasses();
  
  // Add event listeners to instrument selector
  document.querySelectorAll('.instrument-btn').forEach(btn => {
      btn.addEventListener('click', () => {
          const instrument = btn.getAttribute('data-instrument');
          switchInstrument(instrument);
      });
  });
  
  // Set default instrument
  switchInstrument('piano');
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);