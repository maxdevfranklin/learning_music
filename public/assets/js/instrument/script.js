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

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#'];
const whiteKeyIndices = [0, 2, 4, 5, 7, 9, 11, 12];
const blackKeyIndices = [1, 3, 6, 8, 10, 13];
const whiteKeyNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
const blackKeyNames = ['C#', 'D#', 'F#', 'G#', 'A#'];

let currentInstrument = 'piano';
let audioContext = null;

// Mouse and touch drag state
let isDragging = false;
let lastPlayedNote = null;

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
  
  // Reset all bars to default dark grey color
  pitchBars.forEach(bar => {
      bar.classList.remove('opacity-100', 'scale-105', 'shadow-lg');
      bar.classList.add('opacity-90');
      bar.style.backgroundColor = 'transparent'; // Dark grey default color
  });
  
  // Highlight active bar (only for white keys)
  if (whiteKeyIndices.includes(noteIndex)) {
      const activeBar = document.querySelector(`[data-note="${noteIndex}"]`);
      if (activeBar) {
          const activeColor = activeBar.getAttribute('data-active-color');
          activeBar.classList.remove('opacity-90');
          activeBar.classList.add('opacity-100', 'scale-105', 'shadow-lg');
          activeBar.style.backgroundColor = activeColor; // Change to active color
          
          // Clear highlight after delay
          setTimeout(() => {
              activeBar.classList.remove('opacity-100', 'scale-105', 'shadow-lg');
              activeBar.classList.add('opacity-90');
              activeBar.style.backgroundColor = 'transparent'; // Back to dark grey
          }, 500);
      }
  }
}

// Handle note play
function handleNotePlay(noteIndex) {
  const frequency = noteFrequencies[noteIndex];
  playNote(frequency, currentInstrument);
  updatePitchVisualization(noteIndex);
  shakeCustomCursor();
}

// Handle mouse down - start dragging
function handleMouseDown(noteIndex) {
  isDragging = true;
  lastPlayedNote = noteIndex;
  handleNotePlay(noteIndex);
}

// Handle mouse enter/over during drag
function handleMouseOverDrag(noteIndex) {
  if (isDragging && lastPlayedNote !== noteIndex) {
    lastPlayedNote = noteIndex;
    handleNotePlay(noteIndex);
  }
}

// Handle mouse up - stop dragging
function handleMouseUp() {
  isDragging = false;
  lastPlayedNote = null;
}

// Handle touch start - start dragging
function handleTouchStart(noteIndex, event) {
  event.preventDefault();
  isDragging = true;
  lastPlayedNote = noteIndex;
  handleNotePlay(noteIndex);
}

// Handle touch move - play notes during drag
function handleTouchMove(event) {
  if (!isDragging) return;
  
  event.preventDefault();
  const touch = event.touches[0];
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  
  // Update custom cursor position for xylophone and glasses
  // if (currentInstrument !== 'piano') {
  // Create a fake event object for moveCustomCursor
  const fakeEvent = {
    clientX: touch.clientX,
    clientY: touch.clientY
  };
  moveCustomCursor(fakeEvent);
  // }
  
  if (element) {
    // Find the note index from the element
    let noteIndex = null;
    
    if (currentInstrument === 'piano') {
      // Check if it's a piano key
      const pianoKeys = document.querySelectorAll('#pianoKeys .piano-white-button, #pianoKeys .piano-black-button');
      const keyIndex = Array.from(pianoKeys).indexOf(element);
      if (keyIndex !== -1) {
        // Map to actual note indices
        if (element.classList.contains('piano-white-button')) {
          const whiteKeyIndex = Array.from(document.querySelectorAll('#pianoKeys .piano-white-button')).indexOf(element);
          noteIndex = whiteKeyIndices[whiteKeyIndex];
        } else if (element.classList.contains('piano-black-button')) {
          const blackKeyIndex = Array.from(document.querySelectorAll('#pianoKeys .piano-black-button')).indexOf(element);
          noteIndex = blackKeyIndices[blackKeyIndex];
        }
      }
    } else if (currentInstrument === 'xylophone') {
      // Check if it's a xylophone bar
      const xyloContainers = document.querySelectorAll('#xylophoneKeys .xylophone-button');
      const containerIndex = Array.from(xyloContainers).findIndex(container => 
        container.contains(element) || container === element
      );
      if (containerIndex !== -1) {
        noteIndex = naturalNoteIndices[containerIndex];
      }
    } else if (currentInstrument === 'glasses') {
      // Check if it's a glass
      const glassContainers = document.querySelectorAll('#glassesKeys .glass-button');
      const containerIndex = Array.from(glassContainers).findIndex(container => 
        container.contains(element) || container === element
      );
      if (containerIndex !== -1) {
        noteIndex = naturalNoteIndices[containerIndex];
      }
    }
    
    if (noteIndex !== null && lastPlayedNote !== noteIndex) {
      lastPlayedNote = noteIndex;
      handleNotePlay(noteIndex);
    }
  }
}

// Handle touch end - stop dragging
function handleTouchEnd() {
  isDragging = false;
  lastPlayedNote = null;
  
  // Disable custom cursor for xylophone and glasses
  if (currentInstrument !== 'piano') {
    disableCustomCursor();
  }
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
    var left = e.clientX || e.touches[0].clientX - 20;
    var top = e.clientY || e.touches[0].clientY - 20;
    customCursorImg.style.left = left + 'px';
    customCursorImg.style.top = top + 'px';
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
  
  // Create white keys with consistent spacing
  whiteKeyIndices.forEach((noteIndex, index) => {
      const key = document.createElement('div');
      key.className = 'piano-white-button h-40 bg-white border border-gray-300 rounded-b-lg shadow-md hover:bg-gray-100 active:bg-gray-200 transition-colors duration-100 flex items-end justify-center pb-2';
      key.style.margin = '0 1px';
      // key.innerHTML = `<span class="text-xs text-gray-600 font-medium">${whiteKeyNames[index]}</span>`;
      key.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleMouseDown(noteIndex);
      });
      key.addEventListener('mouseover', () => handleMouseOverDrag(noteIndex));
      key.addEventListener('mousemove', (e) => {
        moveCustomCursor(e);
        handleMouseOverDrag(noteIndex);
      });
      key.addEventListener('mouseup', handleMouseUp);
      key.addEventListener('mouseenter', () => {
        enableCustomCursor('assets/image/instrument/hand-icon.png');
      });
      key.addEventListener('mouseleave', disableCustomCursor);
      
      // Touch events for mobile
      key.addEventListener('touchstart', (e) => {
        enableCustomCursor('assets/image/instrument/hand-icon.png');
        moveCustomCursor(e);
        handleTouchStart(noteIndex, e);
      });
      key.addEventListener('touchend', (e) => {
        handleTouchEnd();
        disableCustomCursor();
      });
      
      pianoKeys.appendChild(key);
  });
  
  // Create black keys
  blackKeyIndices.forEach((noteIndex, index) => {
      const positions = [1, 2, 4, 5, 6, 8]; // Adjusted for better spacing
      const key = document.createElement('div');
      key.className = 'piano-black-button absolute h-24 bg-gray-900 rounded-b-lg shadow-lg flex items-end justify-center pb-1';
      key.style.left = `calc(${positions[index]} * 12.5% - 4.25%)`; // Adjusted positioning
      key.style.zIndex = '10';
      if (positions[index] == 8) {
        key.className += " half-key"
      }
      key.innerHTML = `<span class="text-xs text-white font-medium"></span>`; //${blackKeyNames[index]}
      // key.addEventListener('mousedown', (e) => {
      //   e.preventDefault();
      //   handleMouseDown(noteIndex);
      // });
      // key.addEventListener('mouseover', () => handleMouseOverDrag(noteIndex));
      // key.addEventListener('mousemove', () => handleMouseOverDrag(noteIndex));
      // key.addEventListener('mouseup', handleMouseUp);
      
      // // Touch events for mobile
      // key.addEventListener('touchstart', (e) => handleTouchStart(noteIndex, e));
      // key.addEventListener('touchend', handleTouchEnd);
      
      pianoKeys.appendChild(key);
  });
}

// Only use natural notes for xylophone and glasses
const naturalNoteIndices = [0, 2, 4, 5, 7, 9, 11, 12];
const naturalNoteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];

// Create xylophone
function createXylophone() {
  const xylophoneKeys = document.getElementById('xylophoneKeys');
  xylophoneKeys.innerHTML = '';
  
  naturalNoteNames.forEach((note, i) => {
      const index = naturalNoteIndices[i];
      const barHeight = 200 - (i * 10);
      const container = document.createElement('div');
      container.className = 'xylophone-button flex flex-col items-center';
      // container.style.margin = '0 6px'; // Consistent spacing
      const bar = document.createElement('div');
      bar.className = 'rounded-lg shadow-lg transition-all duration-100 hover:brightness-110 active:scale-95 flex items-center justify-center w-full';
      bar.style.height = `${barHeight}px`;
      bar.style.backgroundImage = 'url("assets/image/instrument/xylophone.png")';
      bar.style.backgroundSize = '100% 100%';
      bar.style.backgroundPosition = 'center';
      bar.style.backgroundRepeat = 'no-repeat';
      bar.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.3), 0 4px 8px rgba(0,0,0,0.2)';
      bar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleMouseDown(index);
      });
      bar.addEventListener('mouseenter', () => {
        enableCustomCursor('assets/image/instrument/mallet.png');
      });
      bar.addEventListener('mouseover', () => handleMouseOverDrag(index));
      bar.addEventListener('mousemove', (e) => {
        moveCustomCursor(e);
        handleMouseOverDrag(index);
      });
      bar.addEventListener('mouseleave', disableCustomCursor);
      bar.addEventListener('mouseup', handleMouseUp);
      
      // Touch events for mobile
      bar.addEventListener('touchstart', (e) => {
        enableCustomCursor('assets/image/instrument/mallet.png');
        moveCustomCursor(e);
        handleTouchStart(index, e);
      });
      bar.addEventListener('touchend', () => {
        handleTouchEnd();
        disableCustomCursor();
      });
      // const label = document.createElement('span');
      // label.className = 'text-xs text-gray-700 font-medium pointer-events-none';
      // label.textContent = note;
      // bar.appendChild(label);
      container.appendChild(bar);
      xylophoneKeys.appendChild(container);
  });
}

// Create glasses
function createGlasses() {
  const glassesKeys = document.getElementById('glassesKeys');
  glassesKeys.innerHTML = '';
  naturalNoteNames.forEach((note, i) => {
      const index = naturalNoteIndices[i];
      const glassHeight = 150;
      const waterLevel = 150 - (30 + (i * 9));
      const container = document.createElement('div');
      container.className = 'flex flex-col items-center glass-button';
      // container.style.margin = '0 6px'; // Consistent spacing
      const glass = document.createElement('div');
      glass.className = 'relative transition-all duration-100 hover:scale-105 active:scale-95 flex items-center justify-center w-full';
      glass.style.height = `${glassHeight}px`;
      // glass.style.width = '12.5%'; // Consistent width
      glass.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleMouseDown(index);
      });
      glass.addEventListener('mouseenter', () => {
        enableCustomCursor('assets/image/instrument/metalstick.png');
      });
      glass.addEventListener('mouseover', () => handleMouseOverDrag(index));
      glass.addEventListener('mousemove', (e) => {
        moveCustomCursor(e);
        handleMouseOverDrag(index);
      });
      glass.addEventListener('mouseleave', disableCustomCursor);
      glass.addEventListener('mouseup', handleMouseUp);
      
      // Touch events for mobile
      glass.addEventListener('touchstart', (e) => {
        enableCustomCursor('assets/image/instrument/metalstick.png');
        moveCustomCursor(e);
        handleTouchStart(index, e);
      });
      glass.addEventListener('touchend', () => {
        handleTouchEnd();
        disableCustomCursor();
      });
      // Use glass image as background (glass-1.png through glass-8.png)
      const glassImageNumber = i + 1; // i starts from 0, so +1 for glass-1 to glass-8
      glass.style.backgroundImage = `url("assets/image/instrument/glass-${glassImageNumber}.png")`;
      glass.style.backgroundSize = '100% 100%';
      glass.style.backgroundPosition = 'center';
      glass.style.backgroundRepeat = 'no-repeat';
      // Centered label inside the glass button
      // const label = document.createElement('span');
      // label.className = 'text-xs text-gray-700 font-medium pointer-events-none z-10';
      // label.textContent = note;
      // glass.appendChild(label);
      container.appendChild(glass);
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
  
}

// Add click event listeners to pitch bars
function setupPitchBarClickListeners() {
  const pitchBars = document.querySelectorAll('.pitch-bar');
  
  pitchBars.forEach(bar => {
    bar.addEventListener('click', (e) => {
      e.preventDefault();
      const noteIndex = parseInt(bar.getAttribute('data-note'));
      
      // Show custom cursor on the corresponding instrument key/bar
      showCustomCursorForInstrument(noteIndex);
      
      handleNotePlay(noteIndex);
      
      // Hide cursor after a short delay
      setTimeout(() => {
        disableCustomCursor();
      }, 300);
    });
    
    // Add hover effect for better UX
    bar.addEventListener('mouseenter', () => {
      bar.style.cursor = 'pointer';
      bar.style.opacity = '0.8';
    });
    
    bar.addEventListener('mouseleave', () => {
      bar.style.cursor = 'default';
      bar.style.opacity = '0.9';
    });
  });
}

// Show custom cursor on the corresponding instrument key/bar
function showCustomCursorForInstrument(noteIndex) {
  let cursorImage = '';
  let targetElement = null;
  
  switch (currentInstrument) {
    case 'piano':
      cursorImage = 'assets/image/instrument/hand-icon.png';
      targetElement = findPianoKeyElement(noteIndex);
      break;
    case 'xylophone':
      cursorImage = 'assets/image/instrument/mallet.png';
      targetElement = findXylophoneBarElement(noteIndex);
      break;
    case 'glasses':
      cursorImage = 'assets/image/instrument/metalstick.png';
      targetElement = findGlassElement(noteIndex);
      break;
  }
  
  if (cursorImage && targetElement) {
    enableCustomCursor(cursorImage);
    positionCursorOnElement(targetElement, currentInstrument);
    shakeCustomCursor();
  }
}

// Find the piano key element for a given note index
function findPianoKeyElement(noteIndex) {
  if (whiteKeyIndices.includes(noteIndex)) {
    const whiteKeyIndex = whiteKeyIndices.indexOf(noteIndex);
    return document.querySelectorAll('#pianoKeys .piano-white-button')[whiteKeyIndex];
  } else if (blackKeyIndices.includes(noteIndex)) {
    const blackKeyIndex = blackKeyIndices.indexOf(noteIndex);
    return document.querySelectorAll('#pianoKeys .piano-black-button')[blackKeyIndex];
  }
  return null;
}

// Find the xylophone bar element for a given note index
function findXylophoneBarElement(noteIndex) {
  const naturalIndex = naturalNoteIndices.indexOf(noteIndex);
  if (naturalIndex !== -1) {
    return document.querySelectorAll('#xylophoneKeys .xylophone-button')[naturalIndex];
  }
  return null;
}

// Find the glass element for a given note index
function findGlassElement(noteIndex) {
  const naturalIndex = naturalNoteIndices.indexOf(noteIndex);
  if (naturalIndex !== -1) {
    return document.querySelectorAll('#glassesKeys .glass-button')[naturalIndex];
  }
  return null;
}

// Position cursor on a specific element
function positionCursorOnElement(element, instrument) {
  if (element) {
    const rect = element.getBoundingClientRect();
    let positionX = 0;
    let positionY = 0;
    if (instrument === 'piano') {
      positionX = rect.left + rect.width / 2;
      positionY = rect.top + rect.height - 40;
    } else if (instrument === 'xylophone') {
      positionX = rect.left + rect.width / 2;
      positionY = rect.top + rect.height / 2 - 30;
    } else if (instrument === 'glasses') {
      positionX = rect.left + rect.width / 2;
      positionY = rect.top + rect.height / 2;
    }
    
    // Create a fake event object for moveCustomCursor
    const fakeEvent = {
      clientX: positionX,
      clientY: positionY
    };
    moveCustomCursor(fakeEvent);
  }
}

// Initialize the app
function init() {
  // Create instruments
  createPiano();
  createXylophone();
  createGlasses();
  
  // Setup pitch bar click listeners
  setupPitchBarClickListeners();
  
  // Add event listeners to instrument selector
  document.querySelectorAll('.instrument-btn').forEach(btn => {
      btn.addEventListener('click', () => {
          const instrument = btn.getAttribute('data-instrument');
          switchInstrument(instrument);
      });
  });
  
  // Set default instrument
  switchInstrument('piano');
  
  // Add global mouse up event listener to stop dragging
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mouseleave', handleMouseUp);
  
  // Add global touch event listeners for mobile
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchcancel', handleTouchEnd);
  
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 