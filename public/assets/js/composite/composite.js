// import { ToneAudioBuffer } from "https://esm.sh/tone";

import { bus } from "./data/EventBus.js";
// import { SongOptions } from "./data/SongOptions.js";
import { MidiData } from "./midi/Data.js";
import { History } from "./history/History.js";

import { Sound } from "./sound/Sound.js";

const { ToneAudioBuffer } = Tone;

const buffer = new ToneAudioBuffer();

// console.log(SongOptions);
// const { SongOptions } = SongOptions;

// const songOptions = new SongOptions();
const midiData = new MidiData();

// const sound = new Sound(songOptions, midiData);

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
        // sound.instrumentTrack.playNote(
        //   noteIndex[buttonRow],
        //   undefined,
        //   undefined,
        //   0.8
        // );

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

drawVex();

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
    if (i < 31) {
      stave1.setBegBarType(VF.Barline.type.NONE);
      stave1.setEndBarType(VF.Barline.type.NONE);
    }
    stave1.setBegBarType(VF.Barline.type.NONE);
    if (i == 0) {
      stave1.addClef("treble").addTimeSignature("4/4");
    }
    stave1.setContext(context).draw();

    var notes = [
      // A quarter-note C.
      // new VF.StaveNote({
      //   clef: "treble",
      //   keys: [notePair[noteGroup[i]]],
      //   duration: EasePair[noteGroup[i]],
      // }),
      // new VF.StaveNote({
      //   clef: "treble",
      //   keys: ["c/4", "e/4", "g/4"],
      //   duration: "q",
      // }),
    ];

    if (noteGroup[i].length > 0) {
      // if (noteGroup[i][j] == "0") {
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
      // }
    }
    // console.log(noteGroup);

    // // Create a voice in 4/4 and add above notes
    if (notes.length > 0) {
      var voice = new VF.Voice({ num_beats: 1, beat_value: 4 });
      voice.addTickables(notes);

      // Format and justify the notes to 400 pixels.
      var formatter = new VF.Formatter()
        .joinVoices([voice])
        .format([voice], 40);

      // Render voice
      voice.draw(context, stave1);
    }
  }
}
