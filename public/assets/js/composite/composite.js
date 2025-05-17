import { ToneAudioBuffer } from "https://esm.sh/tone";

import { bus } from "./data/EventBus.js";
import { SongOptions } from "./data/SongOptions.js";
import { MidiData } from "./midi/Data.js";
import { History } from "./history/History.js";

import { Sound } from "./sound/Sound.js";

const buffer = new ToneAudioBuffer();

const songOptions = new SongOptions();
const midiData = new MidiData();
const sound = new Sound(songOptions, midiData);

let isPlaying = false;
let stopRequested = false;
let currentPlaybackTimeout = null;

const numColumns = 32;
const buttonNote = ["Do", "Ti", "La", "Sol", "Fa", "Mi", "Re", "Do"];
const noteIndex = [48, 50, 52, 53, 55, 57, 59, 60];
const noteColor = [
  "#e33059",
  "#f7943d",
  "#edd929",
  "#95c631",
  "#11826d",
  "#5b37cc",
  "#ea57b2",
  "#e33059",
];
let noteGroup = [];
for (let i = 0; i < 32; i++) {
  noteGroup.push([]);
}
const notePair = ["c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4", "c/5"];
const EasePair = ["qr", "q", "q", "q", "q", "q", "q", "q"];

const gridContainer = document.getElementById("noteGroup");

gridContainer.style.gridTemplateColumns = `repeat(${numColumns}, 1fr)`;

for (let i = 1; i <= 10 * numColumns; i++) {
  const button = document.createElement("button");
  button.classList.add("grid-btn");
  button.setAttribute("data-id", i);
  let indexColumn = i % numColumns;
  let indexRow = Math.floor(i / numColumns);
  if (i <= 8 * numColumns) {
    if (Math.floor((indexColumn - 1) / 8) % 2) {
      button.classList.add("oddBtn");
    } else {
      button.classList.add("evenBtn");
    }

    if ((indexColumn - 1) % 2 && indexColumn != 0) {
      button.classList.add("mainDivider");
    }

    button.addEventListener("mousedown", () => {
      button.classList.toggle("selected");
      console.log(noteGroup);
      const index = button.getAttribute("data-id");
      let buttonRow = 7 - Math.floor(index / numColumns);
      let buttonColumn = (index - 1) % numColumns;
      if (button.classList.contains("selected")) {
        if (!button.hasAttribute("data-original-bg")) {
          button.setAttribute(
            "data-original-bg",
            button.style.backgroundColor || ""
          );
        }
        button.setAttribute("border", "none");
        button.style.backgroundColor = noteColor[buttonRow];
        // button.innerHTML = buttonNote[buttonRow];

        //play audio

        //impact music sheet
        noteGroup[buttonColumn].push(buttonRow);
        sound.instrumentTrack.playNote(
          noteIndex[buttonRow],
          undefined,
          undefined,
          0.8
        );

        // console.log(buttonColumn, buttonRow + 1);
        drawVex();
      } else {
        const originalBg = button.getAttribute("data-original-bg");
        button.style.backgroundColor = originalBg || "";
        for (let k = 0; k < noteGroup[buttonColumn].length; k++) {
          if (noteGroup[buttonColumn][k] == buttonRow)
            noteGroup[buttonColumn].splice(k, 1);
        }
        drawVex();
      }
    });

    gridContainer.appendChild(button);

    //Give note to first button
    if (i % numColumns == 1) {
      const noteLabel = document.createElement("div");
      noteLabel.style.marginRight = "5px";
      noteLabel.style.display = "inline-block";
      noteLabel.style.verticalAlign = "center";
      noteLabel.textContent = buttonNote[indexRow];
      // document.appendChild(noteLabel);
      // button.innerHTML = buttonNote[indexRow];
    }
    if (i > 7 * numColumns) button.style.marginBottom = "30px";
  } else {
    button.style.width = "50%";
    button.style.height = "50%";
    button.style.marginLeft = "25%";
    button.style.marginTop = "25%";
    button.style.borderRadius = "50%";
    button.style.backgroundColor = "#ccc";
    // gridContainer.style.gap = "10px";
    button.addEventListener("click", () => {
      const index = button.getAttribute("data-id");
      let buttonRow = Math.floor(index / numColumns);

      console.log(buttonRow);
      button.classList.toggle("selected");
      if (button.classList.contains("selected")) {
        button.style.width = "70%";
        button.style.height = "65%";
        button.style.marginLeft = "15%";
        button.style.marginTop = "15%";
        button.style.backgroundColor = "#16a8f0";
        button.style.borderLeft = "0px";
        button.style.borderTop = "0px";
        if (buttonRow == 8) button.style.borderRadius = "20%";
      } else {
        button.style.width = "50%";
        button.style.height = "50%";
        button.style.marginLeft = "25%";
        button.style.backgroundColor = "#ccc";
        button.style.borderRadius = "50%";
      }
    });
    gridContainer.appendChild(button);
  }
}

// Italian tempo terms mapping
const tempoTerms = [
  { min: 20, max: 40, term: "Grave" },
  { min: 41, max: 60, term: "Largo" },
  { min: 61, max: 76, term: "Adagio" },
  { min: 77, max: 108, term: "Andante" },
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

// Time signature handling
const timeSignatureSelect = document.getElementById('time-signature');
let currentTimeSignature = '4/4';
timeSignatureSelect.addEventListener('change', (e) => {
  currentTimeSignature = e.target.value;
  // Update beats in SongOptions
  if (currentTimeSignature === '4/4') {
    songOptions.beats = 4;
  } else if (currentTimeSignature === '3/4') {
    songOptions.beats = 3;
  }
  drawVex();
});

// Tempo Italian label handling
const tempoItalianLabel = document.getElementById('tempo-italian');
const tempoSlider = document.getElementById('tempo-slider');
const bpmValue = document.getElementById('bpm-value');

function updateTempoItalianLabel() {
  const bpm = songOptions.tempo;
  tempoItalianLabel.textContent = getTempoTerm(bpm);
  if (bpmValue) bpmValue.textContent = bpm;
  if (tempoSlider) tempoSlider.value = bpm;
}

if (tempoSlider) {
  tempoSlider.addEventListener('input', (e) => {
    const bpm = parseInt(e.target.value);
    songOptions.tempo = bpm;
    updateTempoItalianLabel();
  });
}

// Attach event listeners to all possible BPM inputs (for legacy support)
const tempoInputs = document.querySelectorAll('input[type="range"], input[type="number"], input[name="tempo"], #tempo');
tempoInputs.forEach(input => {
  input.addEventListener('input', (e) => {
    const bpm = parseInt(e.target.value);
    songOptions.tempo = bpm;
    updateTempoItalianLabel();
  });
});
updateTempoItalianLabel();

// Dynamic markings handling
const dynamicMarkingsSelect = document.getElementById('dynamic-markings');
const dynamicMarkingDisplay = document.getElementById('dynamic-marking-display');
let currentDynamicMarking = '';
dynamicMarkingsSelect.addEventListener('change', (e) => {
  currentDynamicMarking = e.target.value;
  dynamicMarkingDisplay.textContent = currentDynamicMarking;
  // Only update the display, do not break or block any other functionality
  drawVex();
});

drawVex();

const playButton = document.getElementById("play-button");

// Set up event listener
playButton.addEventListener("click", togglePlayback);

/**
 * Toggles music playback state
 */
function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function stopPlayback() {
  stopRequested = true;
  playButton.classList.remove("playing");
  isPlaying = false;

  // Clear any pending timeouts
  if (currentPlaybackTimeout) {
    clearTimeout(currentPlaybackTimeout);
    currentPlaybackTimeout = null;
  }
}

/**
 * Starts music playback
 */
function startPlayback() {
  playButton.classList.add("playing");
  isPlaying = true;
  stopRequested = false;

  // Start playing from the beginning
  playMusic(0);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playMusic(startIndex = 0) {
  try {
    for (let i = startIndex; i < noteGroup.length; i++) {
      if (stopRequested) {
        return; // Exit if stop was requested
      }

      // Play all notes in the current group
      for (let j = 0; j < noteGroup[i].length; j++) {
        sound.instrumentTrack.playNote(
          noteIndex[noteGroup[i][j]],
          undefined,
          undefined,
          0.8
        );
      }

      // Wait before playing the next note group, based on current tempo
      const bpm = songOptions.tempo || 120;
      const msPerBeat = 60000 / bpm;
      await delay(msPerBeat);
    }

    // When we reach the end, loop back to the beginning
    if (isPlaying && !stopRequested) {
      playMusic(0);
    } else {
      stopPlayback(); // Ensure proper cleanup if we exit the loop
    }
  } catch (error) {
    console.error("Error during playback:", error);
    stopPlayback(); // Clean up on error
  }
}

function drawVex() {
  // Initialize VexFlow
  const div = document.getElementById("notation");
  div.innerHTML = "";

  const VF = Vex.Flow;
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

  let sheetLength = 1300;

  renderer.resize(sheetLength, 150);
  const context = renderer.getContext();

  let stave = new VF.Stave(10, 20, sheetLength - 20);
  stave.setContext(context).draw();

  for (let i = 0; i < 32; i++) {
    let stave1 = new VF.Stave(10, 20, 38);
    if (i > 0) {
      stave1 = new VF.Stave(38 * i + 74, 20, 38);
    }
    if (i < 31 && i % (songOptions.beats) !== (songOptions.beats - 1)) {
      stave1.setBegBarType(VF.Barline.type.NONE);
      stave1.setEndBarType(VF.Barline.type.NONE);
    }
    stave1.setBegBarType(VF.Barline.type.NONE);
    if (i == 0) {
      stave1.addClef("treble").addTimeSignature(currentTimeSignature);
    }
    stave1.setContext(context).draw();

    var notes = [];
    if (noteGroup[i].length > 0) {
      let tempKeys = [];
      for (let k = 0; k < noteGroup[i].length; k++) {
        tempKeys.push(notePair[noteGroup[i][k]]);
      }
      notes.push(
        new VF.StaveNote({
          clef: "treble",
          keys: tempKeys,
          duration: "q",
        })
      );
    }
    if (notes.length > 0) {
      var voice = new VF.Voice({ num_beats: 1, beat_value: parseInt(currentTimeSignature.split('/')[1]) });
      voice.addTickables(notes);
      var formatter = new VF.Formatter().joinVoices([voice]).format([voice], 40);
      voice.draw(context, stave1);
    }
    // Draw dynamic marking below percussion line (at the bottom of the stave)
    if (currentDynamicMarking && i === 0) {
      // Draw the dynamic marking as plain text below the staff
      context.save();
      context.setFont("Serif", 18, "bold");
      context.setFillStyle("#222");
      // Position: x = start of stave1, y = stave1.getBottomY() + offset
      context.fillText(
        currentDynamicMarking,
        stave1.getX() + 10,
        stave1.getBottomY() + 25
      );
      context.restore();
    }
  }
}
