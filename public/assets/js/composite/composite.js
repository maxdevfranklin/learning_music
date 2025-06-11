import { ToneAudioBuffer } from "https://esm.sh/tone";

import { bus } from "./data/EventBus.js";
import { SongOptions } from "./data/SongOptions.js";
import { MidiData } from "./midi/Data.js";
import { History } from "./history/History.js";
import { InstrumentToggle } from "./bottom/InstrumentToggle.js";

import { Sound } from "./sound/Sound.js";

import { GA } from "./functions/GA.js";

const buffer = new ToneAudioBuffer();

const songOptions = new SongOptions();
const midiData = new MidiData();
const sound = new Sound(songOptions, midiData);

let isPlaying = false;
let stopRequested = false;
let currentPlaybackTimeout = null;
let isResizing = false;
let currentTimeSignature = "4/4";
let songChanged = true;

// Add history stacks for undo/redo
const historyStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

// Number of pitches (0-7 for Do to Si, plus 2 for rests)
// if you want to change this value, you need to change the buttonNote, notePair, noteIndex, and noteColor arrays accordingly
const numPitch   = 8;
var   numColumns = 32;
var   numColumnsWindow = 32;
const notePair   = ["c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4", "c/5", "d/5", "e/5", "f/5", "g/5", "a/5", "b/5", "c/6"];
const buttonNote = ["Do", "Ti", "La", "Sol", "Fa", "Mi", "Re", "Do", "Ti", "La", "Sol", "Fa", "Mi", "Re", "Do"];
const noteIndex  = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72];
const noteColor  = [
  "#e33059",
  "#f7943d",
  "#edd929",
  "#95c631",
  "#11826d",
  "#5b37cc",
  "#ea57b2",
  "#e33059",
  "#f7943d",
  "#edd929",
  "#95c631",
  "#11826d",
  "#5b37cc",
  "#ea57b2",
  "#e33059",
];
function noteUnit() {
  return songOptions.beats * songOptions.subdivision;
};

let noteGroup = [];
for (let i = 0; i < numColumns; i++) {
  noteGroup.push([]);
}

let percussionGroup = [];
for (let i = 0; i < numColumns; i++) {
  percussionGroup.push([]);
}

let dynamics = [];

function getVolume(dynamic) {
  switch(dynamic) {
    case "ff":
      return 0;
    case "f":
      return -5;
    case "mf":
      return -10;
    case "mp":
      return -15;
    case "p":
      return -20;
    case "pp":
      return -25;
  }
}

const cursor = document.getElementById("cursor");
const notation = document.getElementById("notation");
const noteArea = document.getElementById("note_area");
const bottomLeft = document.getElementById("bottom-left");

let collapsedNotes = [];
let moreCollapsedNotes = [];

function findMinimalSum(target) {
  // Sort the numbers in descending order
  const sortedNumbers = [0.5,1,2,3,4,6,8,12].sort((a, b) => b - a);
  const result = [];
  let remaining = target;

  for (const num of sortedNumbers) {
    while (remaining >= num) {
      result.push(num);
      remaining -= num;
    }
    if (remaining === 0) break;
  }

  return remaining === 0 ? result : [];
}

function getDurations(length) {
  const map = {
    0.5 : { duration: "16", dots: 0, durationLength: 0.5 },
    1   : { duration: "8",  dots: 0, durationLength: 1 },
    2   : { duration: "q",  dots: 0, durationLength: 2 },
    3   : { duration: "qd", dots: 1, durationLength: 3 }, // dotted quarter
    4   : { duration: "h",  dots: 0, durationLength: 4 },
    6   : { duration: "hd", dots: 1, durationLength: 6 }, // dotted half
    8   : { duration: "w",  dots: 0, durationLength: 8 },
    12  : { duration: "wd", dots: 1, durationLength: 12 },
  };
  if (map.hasOwnProperty(length)) {
    return [map[length]]
  } else {
    var durations = findMinimalSum(length);
    if (durations.length > 0) {
      return durations.map(d => map[d]);
    } else {
      return [];
    }
  }
}

function getToneDurations(duration) {
  switch(duration) {
    case "16":
      return 0.25;
    case "8":
      return 0.5;
    case "q":
      return 1;
    case "qd":
      return 1.5;
    case "h":
      return 2;
    case "hd":
      return 3;
    case "w":
      return 4;
    case "wd":
      return 6;
  }
}

const gridContainer = document.getElementById("note_group");

// Add drag selection variables
let isDragging = false;
let lastSelectedButton = null;
let lastSelectedNote = 0;
let selectionStarted = false;
let initialButtonState = false; // true if first button was selected, false if unselected

function noteUnitWidth() {
  var val = (window.innerWidth - 140) / numColumnsWindow;
  document.documentElement.style.setProperty('--note-unit-width', val + 'px');
  return val;
}

function layoutGridContainer() {
  gridContainer.innerHTML = "";
  gridContainer.style.gridTemplateColumns = `repeat(${numColumns}, 1fr)`;
  
  
  for (let i = 1; i <= (numPitch + 2) * numColumns; i++) {
    const button = document.createElement("button");
    button.classList.add("grid-btn");
    button.setAttribute("data-id", i);
    let indexColumn = (i - 1) % numColumns;
    let indexRow = Math.floor((i - 1) / numColumns);
    if (i <= numPitch * numColumns) {
      if (noteGroup[indexColumn]?.includes(numPitch - indexRow - 1)) {
        button.classList.add('selected');
        button.setAttribute("border", "none");
        button.style.backgroundColor = noteColor[numPitch - indexRow - 1];
      }
      if (Math.floor(indexColumn / noteUnit()) % 2) {
        button.classList.add("oddBtn");
      } else {
        button.classList.add("evenBtn");
      }
      if (indexColumn % 2 && indexColumn != 0) {
        button.classList.add("mainDivider");
      }
  
      // Remove the old mousedown event listener and add new drag functionality
      button.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent text selection while dragging
        isDragging = true;
        selectionStarted = true;
        lastSelectedButton = button;
  
        // Store initial state - if the button was selected or not
        initialButtonState = !button.classList.contains("selected");
  
        // Toggle the first button
        // add condition to toggle
        const buttons = document.elementsFromPoint(e.clientX, e.clientY);
        const targetButton = buttons.find((el) =>
          el.classList.contains("grid-btn")
        );
        if (targetButton && targetButton.classList.contains("selected")) {
          const rect = targetButton.getBoundingClientRect();
          if (
            e.clientX >= rect.right - rect.width / 5 ||
            e.clientX <= rect.left + rect.width / 5
          ) {
            isResizing = true;
            selectionStarted = true;
            initialButtonState = true;
          } else {
            toggleButton(button, initialButtonState);
          }
        } else {
          toggleButton(button, initialButtonState);
        }
        makeResizeBlock();
      });
  
      gridContainer.appendChild(button);
  
      //Give note to first button
      // if (i % numColumns == 1) {
      //   const noteLabel = document.createElement("div");
      //   noteLabel.style.marginRight = "5px";
      //   noteLabel.style.display = "inline-block";
      //   noteLabel.style.verticalAlign = "center";
      //   noteLabel.textContent = buttonNote[indexRow];
      // }
      // if (i > (numPitch - 1) * numColumns) button.style.marginBottom = "30px";
    } else {
      button.style.width            = "50%";
      button.style.aspectRatio      = "1";
      button.style.margin           = "auto";
      button.style.backgroundColor  = "#ccc";
      button.classList.add('percussion');

      if (indexColumn % noteUnit() == 0) {
        button.classList.add('left');
      }
      if (indexColumn % numColumns == numColumns - 1) {
        button.classList.add('right');
      }
      let index = button.getAttribute("data-id");
      let buttonRow = Math.floor((index - 1) / numColumns);
      if (buttonRow == numPitch) button.style.borderRadius = "20%";
      else                button.style.borderRadius = "50%";
      if (percussionGroup[indexColumn]?.includes(numPitch + 1 - buttonRow)) {
        button.classList.add("selected");
        button.style.backgroundColor = "#16a8f0";
      }
      button.addEventListener("click", () => {
        button.classList.toggle("selected");
        if (button.classList.contains("selected")) {
          button.style.backgroundColor  = "#16a8f0";
        } else {
          button.style.backgroundColor  = "#ccc";
        }
        togglePercussion(button);
      });
      gridContainer.appendChild(button);
    }
  }
  makeDynamics();
  makeResizeBlock();
}
layoutGridContainer();

// Italian tempo terms mapping
const tempoTerms = [
  { min: 20,  max: 40,  term: "Grave" },
  { min: 41,  max: 60,  term: "Largo" },
  { min: 61,  max: 76,  term: "Adagio" },
  { min: 77,  max: 108, term: "Andante" },
  { min: 109, max: 120, term: "Moderato" },
  { min: 121, max: 168, term: "Allegro" },
  { min: 169, max: 200, term: "Presto" },
  { min: 201, max: 300, term: "Prestissimo" },
];

function getTempoTerm(bpm) {
  for (const t of tempoTerms) {
    if (bpm >= t.min && bpm <= t.max) return t.term;
  }
  return "Allegro";
}

// Tempo Italian label handling
const tempoItalianLabel = document.getElementById("tempo-italian");
const tempoSlider = document.getElementById("tempo-slider");
const bpmValue = document.getElementById("bpm-value");

function updateTempoItalianLabel() {
  const bpm = songOptions.tempo;
  tempoItalianLabel.textContent = getTempoTerm(bpm);
  if (bpmValue) bpmValue.textContent = bpm;
  if (tempoSlider) tempoSlider.value = bpm;
}

if (tempoSlider) {
  tempoSlider.addEventListener("input", (e) => {
    const bpm = parseInt(e.target.value);
    songOptions.tempo = bpm;
    updateTempoItalianLabel();
  });
}

// Attach event listeners to all possible BPM inputs (for legacy support)
const tempoInputs = document.querySelectorAll(
  'input[type="range"], input[type="number"], input[name="tempo"], #tempo'
);
tempoInputs.forEach((input) => {
  input.addEventListener("input", (e) => {
    const bpm = parseInt(e.target.value);
    songOptions.tempo = bpm;
    updateTempoItalianLabel();
  });
});
updateTempoItalianLabel();
drawVex();

const playButton = document.getElementById("play-button");

// Set up event listener
playButton.addEventListener("click", togglePlayback);

/**
 * Toggles music playback state
 */
function togglePlayback() {
  const playButton = document.getElementById("play-button");

  if (isPlaying) {
    // Switch to play icon
    playButton.classList.remove("playing");
    stopPlayback();
  } else {
    // Switch to pause icon
    playButton.classList.add("playing");
    startPlayback();
  }
}

function stopPlayback() {
  cursor.classList.add('hide');

  const playButton = document.getElementById("play-button");
  stopRequested = true;
  isPlaying = false;
  playButton.classList.remove("playing");

  // Remove any remaining column highlights
  const allButtons = document.querySelectorAll(".grid-btn");
  allButtons.forEach((btn) => {
    btn.classList.remove("playing-column");
    btn.classList.remove("next-column");
  });

  if (currentPlaybackTimeout) {
    clearTimeout(currentPlaybackTimeout);
    currentPlaybackTimeout = null;
  }
}

/**
 * Starts music playback
 */
function startPlayback() {

  isPlaying = true;
  stopRequested = false;

  // Start playing from the beginning
  cursor.classList.remove('hide');
  playMusic(0);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Update the playMusic function with enhanced visual effects
async function playMusic(startIndex = 0) {
  if (stopRequested) {
    stopRequested = false;
    return;
  }

  // Remove highlight from all columns
  const allButtons = document.querySelectorAll(".grid-btn");
  allButtons.forEach((btn) => {
    btn.classList.remove("playing-column");
    btn.classList.remove("next-column");
    // btn.style.transform = btn.classList.contains("selected")
    //   ? "scale(1.05)"
    //   : "scale(1)";
  });

  for (let i = startIndex; i < numColumns; i++) {
    if (stopRequested) {
      stopRequested = false;
      return;
    }

    const left = allButtons[i].getClientRects()[0].x;
    const width = allButtons[i].getClientRects()[0].width;
    const height = noteArea.getClientRects()[0].bottom - notation.getClientRects()[0].top;
    cursor.style.left = left + 'px';
    cursor.style.width = width + 'px';
    cursor.style.height = height + 'px';

    sound.volume = getVolume(dynamics[Math.floor(i / noteUnit())]);

    // Play notes with visual feedback
    if (moreCollapsedNotes[i].keys.length > 0 && moreCollapsedNotes[i].note >= 0 && !moreCollapsedNotes[i].rest) {
      sound.instrumentTrack.playNote(
        noteIndex[moreCollapsedNotes[i].note],
        moreCollapsedNotes[i].length / 2.0,
        undefined,
        1
      );
    }

    percussionGroup[i].forEach((p) => {
      sound.percussionTrack.playNote(
        p,
        undefined,
        undefined,
        0.8
      )
    })

    syncScrollX(noteArea, cursor);

    await delay(60000 / songOptions.tempo);
  }

  if (!stopRequested && isPlaying) {
    // Smooth transition when looping
    const lastColumnButtons = Array.from(allButtons).filter((btn) => {
      const btnIndex = parseInt(btn.getAttribute("data-id"));
      return (btnIndex - 1) % numColumns === numColumns - 1;
    });

    lastColumnButtons.forEach((btn) => {
      btn.classList.remove("playing-column");
      btn.style.transition = "all 0.3s ease";
    });

    await delay(50);
    playMusic(0);
  } else {
    allButtons.forEach((btn) => {
      btn.classList.remove("playing-column");
      btn.classList.remove("next-column");
      btn.style.transform = btn.classList.contains("selected")
        ? "scale(1.05)"
        : "scale(1)";
    });
  }
}

function syncScrollX(slaveElement, masterElement) {
  // Get the master element's absolute X position
  const masterRect = masterElement.getBoundingClientRect();
  const masterX = masterRect.left + window.scrollX;
  
  // Calculate the scroll position needed to center the master element
  const slaveWidth = slaveElement.clientWidth;
  const scrollTo = masterX - (slaveWidth / 2) + (masterRect.width / 2);
  
  // Smooth scroll the slave element
  slaveElement.scrollTo({
    left: scrollTo,
    behavior: 'smooth'
  });
}

function collapseNotes(raw) {
  
  let result = [];
  for (let i = 0; i < raw.length; i++) {
    result.push([]);
  }
  let i = 0;

  while (i < raw.length) {
    const current = raw[i];
    let length = 1;

    while (
      (i + length) % noteUnit() !== 0 &&
      JSON.stringify(raw[i + length]) === JSON.stringify(current)
    ) {
      length++;
    }

    const isRest = current.length === 0;
    const durations = getDurations(length);
    if (durations.length) {
      let j = i;
      durations.forEach((d) => {
        const { duration, dots, durationLength } = d;
        const pitch = isRest ? "b/4" : notePair[current[0]];
        const note = {
          keys: [pitch],
          duration: isRest ? duration + "r" : duration,
          dots: dots,
          length: durationLength,
          note: raw[i]?.[0]??-1,
          rest: isRest
        };
    
        result[j] = note;
        j += durationLength;
      })
    }
    i += length;
  }

  return result;
}

function moreCollapseNotes(raw) {
  
  let result = [];
  for (let i = 0; i < raw.length; i++) {
    result.push([]);
  }  
  let i = 0;

  while (i < raw.length) {
    const current = raw[i];
    let length = 1;

    while (
      (i + length) % noteUnit() !== 0 &&
      JSON.stringify(raw[i + length]) === JSON.stringify(current)
    ) {
      length++;
    }

    const isRest = current.length === 0;
    result[i] = {
      keys: [isRest === 0 ? "b/4" : notePair[current[0]]],
      dots: 0,
      length: length,
      note: raw[i]?.[0]??-1,
      rest: isRest
    };
    i += length;
  }

  return result;
}

function isVoiceComplete(voice) {
  const expectedTicks = voice.getTotalTicks().value(); // what the voice expects
  const actualTicks = voice.getTickables()
    .reduce((sum, note) => sum + note.getTicks().value(), 0); // what the notes provide

  return expectedTicks === actualTicks;
}

function drawVex() {
  // Initialize VexFlow
  const div = document.getElementById("notation");
  div.innerHTML = "";

  const VF = Vex.Flow;
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

  let noteWidth   = noteUnitWidth();
  let sheetLength = noteWidth * numColumns + 95; // 20px padding

  console.log(sheetLength, noteWidth);

  renderer.resize(sheetLength, 150);
  const context = renderer.getContext();

  let stave = new VF.Stave(10, 20, sheetLength - 20);
  stave.setContext(context).draw();
  
  collapsedNotes = collapseNotes(noteGroup);
  moreCollapsedNotes = moreCollapseNotes(noteGroup);

  var firstNoteForTie = null;
  var firstNoteIndex = 0;
  var secondNoteForTie = null;
  var prevNote = null;
  for (let i = 0; i < numColumns; i++) {
    const x = i === 0 ? 10 : noteWidth * i + 74;
    let stave1 = new VF.Stave(x, 20, noteWidth);
  
    if (i < numColumns - 1 && i % noteUnit() !== noteUnit() - 1) {
      stave1.setBegBarType(VF.Barline.type.NONE);
      stave1.setEndBarType(VF.Barline.type.NONE);
    }
  
    stave1.setBegBarType(VF.Barline.type.NONE);
  
    if (i == 0) {
      stave1.addClef("treble").addTimeSignature(currentTimeSignature);
    }
  
    stave1.setContext(context).draw();

    var notes = [];

    if (collapsedNotes[i].keys.length) {
      var note = null;
      if (collapsedNotes[i].dots) {
        note = new VF.StaveNote({
          clef: "treble",
          keys: collapsedNotes[i].keys,
          duration: collapsedNotes[i].duration
        });
        VF.Dot.buildAndAttach([note], {all: true});
        notes.push(note);
      } else {
        note = new VF.StaveNote({
          clef: "treble",
          keys: collapsedNotes[i].keys,
          duration: collapsedNotes[i].duration
        })
        notes.push(note);
      }
      var voice = new VF.Voice({
        num_beats: collapsedNotes[i].length,
        beat_value: 8,
        strict: false,
      });
      voice.addTickables(notes);

      if (!isVoiceComplete(voice)) {
        console.warn(`Incomplete voice at index ${i}: expected ${voice.getTotalTicks().value()}, got ${notes.map(n => n.getTicks().value()).join(", ")}`);
        // optionally skip rendering or fix the durations
      } else {
        new VF.Formatter().joinVoices([voice]).format([voice], 40);
        voice.draw(context, stave1);
      }

      // draw the note tie
      if (note && !firstNoteForTie) {
        firstNoteForTie = note;
        firstNoteIndex = i;
      }

      if (note && note != firstNoteForTie && !note.glyphProps.rest) {
        if (note?.keys[0] == firstNoteForTie?.keys[0] && Math.floor(i / noteUnit()) === Math.floor(firstNoteIndex / noteUnit())) {
          drawTie(firstNoteForTie, note, context);
          firstNoteForTie = null;
        } else {
          firstNoteForTie = note;
          firstNoteIndex = i;
        }
      } else if (note.glyphProps.rest) {
        firstNoteForTie = null;
      }
        
      // if (note && !firstNoteForTie && !collapsedNotes[i]?.rest) {
      //   firstNoteForTie = note;
      //   firstNoteIndex = i;
      // }

      // if (collapsedNotes[i]?.keys[0] === prevNote?.keys[0] && !collapsedNotes[i]?.rest && !prevNote?.rest && Math.floor(i / noteUnit()) === Math.floor(firstNoteIndex / noteUnit()) ) {
      //   secondNoteForTie = note;
      // } else {
      //   if (secondNoteForTie && firstNoteForTie) {
      //     drawTie(firstNoteForTie, secondNoteForTie, context);

      //     firstNoteForTie = null;
      //     secondNoteForTie = null;
      //   } else {
      //     if (!collapsedNotes[i]?.rest) {
      //       firstNoteForTie = note;
      //     } else {
      //       firstNoteForTie = null;
      //     }
      //   }
      // }
      // prevNote = collapsedNotes[i];
    }
  }

  // if (firstNoteForTie && secondNoteForTie) {
  //   drawTie(firstNoteForTie, secondNoteForTie, context);
  // }

  // add 60px for padding right
  const svg = div.querySelector("svg");
  // svg.style.paddingRight = "70px";

  let vftimesignature = document.getElementsByClassName('vf-timesignature');
  if (vftimesignature.length) {
    vftimesignature[0].outerHTML += 
      `<g id="timesignature" style="stroke:#444; stroke-width:2;">
        <rect x="53" y="50" width="30" height="65" fill="none" stroke="gray" stroke-dasharray="2"/>
        <rect class="zoom-rect" x="53" y="50" width="30" height="65" fill="transparent" stroke="red"/>
      </g>`;
  }
  addVFListener();
}

function drawTie(firstNote, secondNote, context) {
  if (firstNote && secondNote && context) {
    if (!firstNote.glyphProps.rest) {
      const tie = new Vex.Flow.StaveTie({
        first_note: firstNote,    // First note to tie
        last_note: secondNote,     // Second note to tie
        first_indices: [0],          // Which note heads to tie (for chords)
        last_indices: [0],           // Which note heads to tie (for chords)
      });
      
      tie.render_options = {
        ...tie.render_options,
        y_shift: 40,        // Vertical offset (negative moves up)
        height: 20           // Curve height
      };

      // Set the tie direction (1 = up, -1 = down)
      tie.setDirection(-1);
      
      // Draw the tie
      tie.setContext(context).draw();
    }
  }
}

function addVFListener() {
  // Your code here
  // Time signature handling
  const timeSignatureToggle = document.getElementById("timesignature");
  if (timeSignatureToggle){
    timeSignatureToggle.addEventListener("click", (e) => {
      // Update beats in SongOptions
      if (currentTimeSignature === "4/4") {
        // set as 3/4
        resetGrid(() => {
          songOptions.beats = 3;
          currentTimeSignature = "3/4";
          numColumns = 24;
          numColumnsWindow = 24;
          document.documentElement.style.setProperty('--note-count-beat', noteUnit());
  
          layoutGridContainer();
          drawVex();
        })
      } else if (currentTimeSignature === "3/4") {
        // set as 4/4
        resetGrid(() => {
          songOptions.beats = 4;
          currentTimeSignature = "4/4";
          numColumns = 32;
          numColumnsWindow = 32;
          document.documentElement.style.setProperty('--note-count-beat', noteUnit());
          
          layoutGridContainer();
          drawVex();
        })
        
      }
    });
  } else {
    console.log('no time signature');
  }
};

function makeDynamics() {
  const dynamicsContainer = document.getElementById("dynamics_container");
  var prevDynamics = dynamics;
  dynamics = [];
  if (dynamicsContainer) {
    dynamicsContainer.innerHTML = "";
    for (let i = 0 ; i < numColumns / noteUnit() ; i ++) {
      if (prevDynamics[i]) {
        dynamicsContainer.innerHTML += 
           `<div class="dynamics-item ${i == 0 ? 'start' : ''}">
              <span class="dynamics-btn" data-dynamics="${prevDynamics[i]}" data-index="${i}"><image src="/assets/fonts/${prevDynamics[i]}.svg" alt="${prevDynamics[i]}" /></span>
            </div>`;
        dynamics.push(prevDynamics[i]);  
      } else {
        dynamicsContainer.innerHTML += 
             `<div class="dynamics-item ${i == 0 ? 'start' : ''}">
                <span class="dynamics-btn" data-dynamics="f" data-index="${i}"><image src="/assets/fonts/f.svg" alt="f" /></span>
              </div>`;
        dynamics.push('f');
      }
    }
  }
  addDynamicsListener();
}

function addDynamicsListener() {
  tippy('.dynamics-btn', {
    content: `
      <div class="tooltip-content">
        <div style="display: flex;">
          <button class="confirm-btn" data-dynamics="pp"><img src="/assets/fonts/pp.svg" /></button>
          <button class="confirm-btn" data-dynamics="p"><img src="/assets/fonts/p.svg" /></button>
          <button class="confirm-btn" data-dynamics="mp"><img src="/assets/fonts/mp.svg" /></button>
          <button class="confirm-btn" data-dynamics="mf"><img src="/assets/fonts/mf.svg" /></button>
          <button class="confirm-btn" data-dynamics="f"><img src="/assets/fonts/f.svg" /></button>
          <button class="confirm-btn" data-dynamics="ff"><img src="/assets/fonts/ff.svg" /></button>
        </div>
      </div>
    `,
    allowHTML: true,  // Allows HTML content
    interactive: true,  // Makes tooltip interactive
    trigger: 'click',  // Shows on click instead of hover
    placement: 'top',
    arrow: true,
    onMount(instance) {
      // Add event listeners to buttons inside tooltip
      const confirmBtns = instance.popper.querySelectorAll('.confirm-btn');
      
      // Add click handler to each button
      confirmBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
          instance.reference.innerHTML = `<img src="/assets/fonts/${btn.dataset.dynamics}.svg" />`;
          instance.reference.setAttribute("data-dynamics", btn.dataset.dynamics);
          dynamics[parseInt(instance.reference.dataset.index)] = btn.dataset.dynamics;
          instance.hide();
        });
      });
    }
  });
}

function saveState() {
  const state = {
    notes: JSON.parse(JSON.stringify(noteGroup)),
    tempo: songOptions.tempo,
    timeSignature: currentTimeSignature,
    // dynamics: currentDynamicMarking,
  };
  historyStack.push(state);
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  }
  redoStack.length = 0;
}

function undo() {
  if (historyStack.length > 0) {
    const currentState = {
      notes: JSON.parse(JSON.stringify(noteGroup)),
      tempo: songOptions.tempo,
      timeSignature: currentTimeSignature,
      // dynamics: currentDynamicMarking,
    };
    redoStack.push(currentState);

    const previousState = historyStack.pop();
    restoreState(previousState);
  }
}

function redo() {
  if (redoStack.length > 0) {
    const currentState = {
      notes: JSON.parse(JSON.stringify(noteGroup)),
      tempo: songOptions.tempo,
      timeSignature: currentTimeSignature,
      // dynamics: currentDynamicMarking,
    };
    historyStack.push(currentState);

    const nextState = redoStack.pop();
    restoreState(nextState);
  }
}

function restoreState(state) {
  noteGroup = JSON.parse(JSON.stringify(state.notes));
  songOptions.tempo = state.tempo;
  currentTimeSignature = state.timeSignature;
  // currentDynamicMarking = state.dynamics;

  // Update UI
  updateUI();
  drawVex();
}

function updateUI() {
  // Update tempo slider
  if (tempoSlider) {
    tempoSlider.value = songOptions.tempo;
    updateTempoItalianLabel();
  }

  // Update time signature
  // if (timeSignatureSelect) {
  //   timeSignatureSelect.value = currentTimeSignature;
  //   songOptions.beats = currentTimeSignature === "4/4" ? 4 : 3;
  // }

  // Update grid buttons
  const allButtons = document.querySelectorAll(".grid-btn");
  allButtons.forEach((btn) => {
    const buttonColumn = (parseInt(btn.getAttribute("data-id")) - 1) % numColumns;
    const buttonRow = numPitch - 1 - Math.floor(parseInt(btn.getAttribute("data-id")) / numColumns);

    const isSelected = noteGroup[buttonColumn].includes(buttonRow);
    btn.classList.toggle("selected", isSelected);
    if (isSelected) {
      btn.style.backgroundColor = noteColor[buttonRow];
    } else {
      btn.style.backgroundColor = "";
    }
  });
}

// Restore resetGrid function
function resetGrid(
  callback = undefined,
  options = {
    notes: true,
    tempo: true,
    timeSignature: true,
    dynamics: true,
  },
) {
  // Save current state before reset
  saveState();

  // Add confirmation dialog if there are notes and we're resetting notes
  if (options.notes) {
    const hasNotes = noteGroup.some((column) => column.length > 0);
    if (hasNotes) {
      // Create a custom confirmation dialog
      const dialog = document.createElement("div");
      dialog.className = "reset-confirm";
      dialog.innerHTML = `
        <h3>Reset Confirmation</h3>
        <p>This will clear all notes from the grid. This action cannot be undone. Do you want to continue?</p>
        <div class="reset-confirm-buttons">
          <button class="reset-confirm-button reset-confirm-cancel">Cancel</button>
          <button class="reset-confirm-button reset-confirm-ok">Reset</button>
        </div>
      `;

      document.body.appendChild(dialog);

      // Handle dialog buttons
      return new Promise((resolve) => {
        dialog.querySelector(".reset-confirm-cancel").onclick = () => {
          document.body.removeChild(dialog);
          resolve(false);
        };

        dialog.querySelector(".reset-confirm-ok").onclick = () => {
          document.body.removeChild(dialog);
          resolve(true);
        };
      }).then((confirmed) => {
        if (!confirmed) return;
        callback?.();
        performReset(options);
      });
    }
  }

  callback?.();
  performReset(options);
}

function performReset(options) {
  const resetButton = document.getElementById("reset-button");

  // Add spinning animation class
  resetButton.classList.add("resetting");

  // Create reset wave animation
  const wave = document.createElement("div");
  wave.className = "reset-wave";
  resetButton.appendChild(wave);
  setTimeout(() => resetButton.removeChild(wave), 800);

  // If playing, stop playback first
  if (isPlaying) {
    stopPlayback();
  }

  // Reset based on options
  if (options.notes) {
    // reset percussion beats
    percussionGroup = [];
    for (let i = 0; i < numColumns; i++) {
      percussionGroup.push([]);
    }

    // Add ripple effect to the entire grid
    gridContainer.style.position = "relative";
    const ripple = document.createElement("div");
    ripple.className = "grid-ripple";
    gridContainer.appendChild(ripple);

    // Reset all buttons with ripple animation
    const allButtons = document.querySelectorAll(".grid-btn");
    allButtons.forEach((btn, index) => {
      // remove connected buttons
      btn.classList.remove("connect");

      if (btn.classList.contains("selected")) {
        // Add fade out effect with delay based on column
        const buttonColumn =
          (parseInt(btn.getAttribute("data-id")) - 1) % numColumns;
        const delay = buttonColumn * 20; // 20ms delay per column

        setTimeout(() => {
          btn.style.transition = "all 0.3s ease-out";
          btn.style.opacity = "0.5";
          btn.style.transform = "scale(0.9)";

          setTimeout(() => {
            btn.classList.remove("selected");
            btn.style.backgroundColor = "";
            btn.style.opacity = "1";
            btn.style.transform = "scale(1)";

            const buttonRow = numPitch - 1 - Math.floor(parseInt(btn.getAttribute("data-id")) / numColumns);
            const columnNotes = noteGroup[buttonColumn];
            const noteIndex = columnNotes.indexOf(buttonRow);
            if (noteIndex > -1) {
              columnNotes.splice(noteIndex, 1);
            }
          }, 300);
        }, delay);
      }
    });

    // Remove ripple effect after animation
    setTimeout(() => {
      gridContainer?.removeChild(ripple);
    }, numColumns * 20 + 600);

    // Clear all notes from noteGroup
    for (let i = 0; i < noteGroup.length; i++) {
      noteGroup[i] = [];
    }

    // Clear all percussion from percussionGroup
    for (let i = 0; i < percussionGroup.length; i++) {
      percussionGroup[i] = [];
    }
  }

  if (options.tempo) {
    // Reset tempo to default with smooth transition
    if (tempoSlider) {
      tempoSlider.style.transition = "all 0.3s ease";
      tempoSlider.value = 120;
      songOptions.tempo = 120;
      updateTempoItalianLabel();
    }
  }

  // Update the music notation
  drawVex();

  // Show success message
  const successMessage = document.createElement("div");
  successMessage.className = "reset-success";
  successMessage.textContent = "Reset complete!";
  document.body.appendChild(successMessage);

  setTimeout(() => {
    successMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(successMessage);
    }, 300);
  }, 2000);

  // Remove spinning animation class after completion
  setTimeout(() => {
    resetButton.classList.remove("resetting");
  }, 800);
}

var instrumentTonalButton = new InstrumentToggle(bottomLeft, [
  // {
  //   name: "Marimba",
  //   audioPath: "marimba",
  // },
  {
    name: "Piano",
    audioPath: "piano",
  },
  {
    name: "Strings",
    audioPath: "strings",
  },
  {
    name: "Woodwind",
    audioPath: "woodwind",
  },
  {
    name: "Synth",
    audioPath: "synth",
  },
]);
instrumentTonalButton.container.id = "instrument-toggle-button";
instrumentTonalButton.on("change", (name) => {
  songOptions.instrument = name;
  songOptions.changeInstrument();
  // songChanged = true;
  //   Vs.instrument.timeline._length + Vs.percussion.timeline._length < 1
  //     ? oc.disableSaveButton(!0)
  //     : oc.disableSaveButton(!1);
  songChanged = true;
  GA.track({
    eventCategory: "bottom",
    eventLabel: "instrument:tonal:" + name,
  });
});

var percussionButton = new InstrumentToggle(bottomLeft, [
  {
    name: "Electronic",
    audioPath: "electronic",
  },
  {
    name: "Blocks",
    audioPath: "woodblock",
  },
  {
    name: "Kit",
    audioPath: "kit",
  },
  {
    name: "Conga",
    audioPath: "bongo",
  },
]);

percussionButton.container.id = "percussion-toggle-button";
percussionButton.on("change", (name) => {
  // this.emit("percussion-change", name);
  songOptions.percussion = name;
  songOptions.changeInstrument();
  songChanged = true;
  GA.track({
    eventCategory: "bottom",
    eventLabel: "instrument:percussion:" + name,
  });
});

function checkConnectedNotes() {
  let elements = Array.from(document.querySelectorAll('.selected.grid-btn'));

  let sorted = elements.sort((a, b) => Number(a.dataset.id) - Number(b.dataset.id));

  // Group connected elements into blocks
  let blocks = [];
  let currentBlock = [];

  for (let i = 0; i < sorted.length; i++) {
    let currentId = Number(sorted[i].dataset.id);
    if (currentId <= numPitch * numColumns) {
      let prevId = i > 0 ? Number(sorted[i - 1].dataset.id) : null;
      if (prevId % numColumns == 0) prevId = null; // if prev element is in the end of line, set null
  
      if (i === 0 || (currentId === prevId + 1 && ((prevId - 1) % noteUnit() !== noteUnit() - 1))) {
        currentBlock.push(sorted[i]);
      } else {
        blocks.push(currentBlock);
        currentBlock = [sorted[i]];
      }
    }
  }
  if (currentBlock.length) {
    blocks.push(currentBlock); // push the final block
  }

  return blocks;
}

function makeResizeBlock() {
  removeResizeBlock();
  checkConnectedNotes().forEach((block) => {
    let startBlock = block[0];
    let endBlock = block[block.length - 1];
    startBlock.classList.add("resize-start");
    startBlock.style.setProperty('--bg-color', darkenRgb(startBlock.style.backgroundColor, 0.7));
    endBlock.classList.add("resize-end");
    endBlock.style.setProperty('--bg-color', darkenRgb(startBlock.style.backgroundColor, 0.7));
  })
}

function removeResizeBlock() {
  let resizeBlocks = document.querySelectorAll(".resize-start, .resize-end");
  resizeBlocks.forEach((el) => {
    el.classList.remove("resize-start", "resize-end");
  });
}

function darkenRgb(rgbString, factor = 0.8) {
  // Extract rgb numbers from "rgb(r, g, b)"
  const result = rgbString.match(/\d+/g);
  if (!result || result.length < 3) return rgbString;

  let [r, g, b] = result.map(Number);

  // Darken each component
  r = Math.floor(r * factor);
  g = Math.floor(g * factor);
  b = Math.floor(b * factor);

  return `rgb(${r}, ${g}, ${b})`;
}

// initialize variables
function initVariables() {
  isDragging = false;
  isResizing = false;
  selectionStarted = false;
  lastSelectedButton = null;
  lastSelectedNote = 0;
}

function togglePercussion(button) {
  const index = button.getAttribute("data-id");
  let buttonRow = numPitch + 1 - Math.floor((index - 1) / numColumns);
  let buttonColumn = (index - 1) % numColumns;

  if (!percussionGroup[buttonColumn]?.includes(buttonRow)) {
    percussionGroup[buttonColumn].push(buttonRow);
      
    sound.volume = getVolume(dynamics[Math.floor(buttonColumn / noteUnit())]);

    sound.percussionTrack.playNote(
      buttonRow,
      undefined,
      undefined,
      0.8
    )
  } else {
    percussionGroup[buttonColumn] = percussionGroup[buttonColumn].filter(item => item !== buttonRow);
  }
}

// Function to toggle button state
function toggleButton(button, forceState = null) {
  const index = button.getAttribute("data-id");
  let buttonRow = numPitch - 1 - Math.floor((index - 1) / numColumns);
  let buttonColumn = (index - 1) % numColumns;

  // If forceState is provided, use it; otherwise toggle current state
  const shouldBeSelected =
    forceState !== null ? forceState : !button.classList.contains("selected");

  if (shouldBeSelected) {
    if (!button.hasAttribute("data-original-bg")) {
      button.setAttribute(
        "data-original-bg",
        button.style.backgroundColor || ""
      );
    }

    generateSequence(buttonColumn + 1, numColumns, numPitch * numColumns).forEach((id) => {
      const btn = document.querySelector(`.grid-btn[data-id="${id}"]`);
      btn.classList.remove("selected");
      btn.classList.remove("connect");
      btn.removeAttribute('style');
    });

    button.setAttribute("border", "none");
    button.style.backgroundColor = noteColor[buttonRow];
    button.classList.add("selected");

    // Add note to noteGroup if not already present
    if (!noteGroup[buttonColumn].includes(buttonRow)) {
      // remove other notes in current line
      noteGroup[buttonColumn] = [];

      noteGroup[buttonColumn].push(buttonRow);

      sound.volume = getVolume(dynamics[Math.floor(buttonColumn / noteUnit())]);
      // Play sound only when adding notes
      sound.instrumentTrack.playNote(
        noteIndex[buttonRow],
        undefined,
        undefined,
        0.8
      );
    }
  } else {
    const originalBg = button.getAttribute("data-original-bg");
    button.style.backgroundColor = originalBg || "";
    button.classList.remove("selected");
    button.classList.remove("connect");

    // Remove note from noteGroup
    const noteIndex = noteGroup[buttonColumn].indexOf(buttonRow);
    if (noteIndex > -1) {
      noteGroup[buttonColumn].splice(noteIndex, 1);
    }
  }
}

function generateSequence(start, step, max) {
  const result = [];
  for (let i = start; i <= max; i += step) {
    result.push(i);
  }
  return result;
}

// Add keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Reset (Ctrl/Cmd + R)
  if ((e.ctrlKey || e.metaKey) && e.key === "r") {
    e.preventDefault();
    resetGrid();
  }

  // Undo (Ctrl/Cmd + Z)
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    undo();
  }

  // Redo (Ctrl/Cmd + Shift + Z) or (Ctrl/Cmd + Y)
  if (
    (e.ctrlKey || e.metaKey) &&
    ((e.shiftKey && e.key === "z") || e.key === "y")
  ) {
    e.preventDefault();
    redo();
  }
});

// Initialize reset functionality
document.addEventListener("DOMContentLoaded", () => {
  const resetButton = document.getElementById("reset-button");
  if (resetButton) {
    resetButton.addEventListener("click", () => resetGrid());
    // addResetContextMenu();
  }
});

// Add mouse event listeners to handle dragging
document.addEventListener("mousemove", (e) => {
  if (!isDragging || !selectionStarted) return;

  const buttons = document.elementsFromPoint(e.clientX, e.clientY);
  const targetButton = buttons.find((el) => el.classList.contains("grid-btn"));

  if (
    targetButton &&
    targetButton !== lastSelectedButton &&
    targetButton.getAttribute("data-id") <= numPitch * numColumns
  ) {
    if (!isResizing) {
      lastSelectedButton = targetButton;
      toggleButton(targetButton, initialButtonState);
    } else {
      if (
        lastSelectedNote == 0 ||
        lastSelectedNote == Math.floor( targetButton.getAttribute("data-id") / numColumns )
      ) {
        if (lastSelectedButton) {
          if (targetButton.classList.contains("selected") && lastSelectedButton.classList.contains("selected")) {
            toggleButton(lastSelectedButton, false);
          }
          if (!targetButton.classList.contains("selected") && lastSelectedButton.classList.contains("selected")) {
            toggleButton(targetButton, true);
          }
        }
        lastSelectedButton = targetButton;
        lastSelectedNote = Math.floor( targetButton.getAttribute("data-id") / numColumns );
        targetButton.style.boxShadow = "none";
        
      } else {
        initVariables();
      }
    }
    makeResizeBlock();
  }

  // if (
  //   targetButton &&
  //   targetButton !== lastSelectedButton &&
  //   targetButton.getAttribute("data-id") > numPitch * numColumns
  // ) {

  // }
});

document.addEventListener("mouseup", () => {
  if (isDragging || isResizing || selectionStarted)
    drawVex();

  initVariables();
  // Redraw the music notation
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    drawVex();
  }, 200); // Debounced to avoid flickering
});

function checkMeasureButtonVisibility() {

}

document.getElementById("add_measure").addEventListener('click', () => {
  const playButton = document.getElementById("play-button");

  if (isPlaying) {
    // Switch to play icon
    playButton.classList.remove("playing");
    stopPlayback();
  }

  for (let i = 0 ; i < noteUnit() ; i ++) {
    noteGroup.push([]);
    percussionGroup.push([]);
  }
  numColumns += noteUnit();
  layoutGridContainer();
  drawVex();
})

document.getElementById("remove_measure").addEventListener('click', () => {
  const playButton = document.getElementById("play-button");

  if (isPlaying) {
    // Switch to play icon
    playButton.classList.remove("playing");
    stopPlayback();
  }
  
  if (numColumns > numColumnsWindow) {
    noteGroup.slice(noteGroup.length - noteUnit(), noteUnit());
    percussionGroup.slice(percussionGroup.length - noteUnit(), noteUnit());
    numColumns -= noteUnit();
    layoutGridContainer();
    drawVex();
  }
})