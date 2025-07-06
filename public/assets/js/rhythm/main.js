class RhythmGame {
    constructor() {
        this.isPlaying = false;
        this.playheadPosition = 0;
        this.bpm = 120;
        this.beatDuration = 60000 / this.bpm;
        this.totalBeats = 16;
        this.currentBeat = 0;
        this.playInterval = null;
        
        // PIXI and character properties
        this.pixi = null;
        this.characterContainer = null;
        this.pairs = [];
        this.characters = {};
        this.scale = 1;
        
        // MultiSequencer properties
        this.multiSequencer = null;
        
        // Audio properties
        this.audioContext = null;
        
        // Character count
        this.CHARACTER_COUNT = 4;
        
        // Note to character mapping
        this.noteToCharacterMap = {
            'eighth': 'woodblock',
            'quarter': 'conga',
            'half': 'triangle',
            'whole': 'cymbals' 
        };
        
        // Direct character index mapping for reliable triggering
        this.characterIndexMap = {
            'woodblock': 0,  
            'conga': 1,
            'triangle': 2,
            'cymbals': 3,
        };
        
        this.init();
    }

    init() {
        this.initAudio();
        this.preloadAssets();
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    preloadAssets() {
        // Preload assets
        var assets = [
        'texture/slices_eyes.png', 
        'image/ui_congas1.svg', 
        'image/ui_congas2.svg', 
        'image/ui_congas3.svg', 
        'image/ui_drums1.svg', 
        'image/ui_drums2.svg', 
        'image/ui_drums3.svg', 
        'image/ui_pause.svg', 
        'image/ui_play.svg', 
        'image/ui_arrow.svg', 
        'image/ui_timpani1.svg', 
        'image/ui_timpani2.svg', 
        'image/ui_timpani3.svg', 
        'image/ui_woodblocks1.svg', 
        'image/ui_woodblocks2.svg', 
        'image/ui_woodblocks3.svg'
    ];

    var charAssets = [];
        for (var i in musicbox.config) {
            var config = musicbox.config[i];
            charAssets = charAssets.concat(musicbox.Character.getAssetList(config.characterSmall));
        }
        assets = assets.concat(charAssets);

        aaf.main({
        assets: assets,
            init: () => this.initGame()
        });
    }

    initGame() {
        this.initPIXI();
        this.initCharacters();
        this.initMultiSequencer();
        this.initTrain();
        this.initEventListeners();
        this.startAnimationLoop();
    }

    initPIXI() {
        this.pixi = new musicbox.EasyPIXI({
            fullscreen: false, 
            transparent: false, 
            width: container.offsetWidth, 
            height: 280, 
            resolution: 2,
        });

        this.characterContainer = new PIXI.Container();
        this.characterContainer.position.y = 5;
        this.pixi.stage.addChild(this.characterContainer);
    }

    initCharacters() {
        this.pairs = [];
        var pairContainers = [];
        var sequencers = [];

        // Collect character pairs and sequencers
        for (var key in musicbox.config) {
            var config = musicbox.config[key];

            // Make character pairs
            var characterSmall = new musicbox.Character(config.characterSmall);
            var basePosition = config.characterSmall.position;
            characterSmall.container.position.x = 0;
            characterSmall.container.position.y = basePosition.y;
            
            var pair = new musicbox.CharacterPair(characterSmall);

            // for clicking the characters, remember which arm is which track.
            pair.armToTrackIndex = {};
            ['left', 'right', 'small'].forEach(function(arm) {
                pair.armToTrackIndex[arm] = config.sequencer.order.indexOf(arm);
            });

            this.pairs.push(pair);

            // Make sequencers
            var sequencerConfig = config.sequencer;
            sequencerConfig.listeners = config.sequencer.order.map(function(animation) {
                return pair[animation];
            });

            var sequencer = new musicbox.Sequencer(sequencerConfig);

            pairContainers.push(pair.container);
            sequencers.push(sequencer);
        }

        // Position characters side by side
        pairContainers.forEach((container, i) => {
            container.position.x = i * this.calculateCharacterWidth();
            this.characterContainer.addChild(container);
        });
    }

    initMultiSequencer() {
        var sequencers = [];
        for (var key in musicbox.config) {
            var config = musicbox.config[key];
            var sequencerConfig = config.sequencer;
            var sequencer = new musicbox.Sequencer(sequencerConfig);
            sequencers.push(sequencer);
        }

        this.multiSequencer = new musicbox.MultiSequencer(sequencers);
        this.multiSequencer.on('pause', () => {
            for (var i = 0, l = this.pairs.length; i < l; i++) {
                this.pairs[i].characterSmall.stopBobbing();
            }
        });

        this.multiSequencer.on('change', (index, prev) => {
            var pair = this.pairs[prev];
            if (pair) {
                pair.characterSmall.stopBobbing();
            }
        });

        // Make rhythm game available to MultiSequencer
        this.multiSequencer.rhythmGame = this;

        window.multiSequencer = this.multiSequencer;
    }

    initTrain() {
        this.multiSequencer.createRhythmTrain(document.getElementById('multi-sequencer-container'));
        this.setupNoteToCharacterMapping();
    }

    setupNoteToCharacterMapping() {
        // Set up drag and drop for notes
        const noteBlocks = document.querySelectorAll('.note-block');
        const dropZones = document.querySelectorAll('.drop-zone');

        noteBlocks.forEach(note => {
            note.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', note.dataset.noteType);
            });
        });

        dropZones.forEach(dropZone => {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                const noteType = e.dataTransfer.getData('text/plain');
                const accepts = dropZone.dataset.accepts;
                
                if (noteType === accepts) {
                    this.handleNoteDrop(noteType, dropZone);
                }
            });
        });
    }

    handleNoteDrop(noteType, dropZone) {
        // Get the character that should be triggered for this note type
        const characterKey = this.noteToCharacterMap[noteType];
        
        if (characterKey && this.pairs) {
            // Use direct character index mapping for reliable triggering
            const characterIndex = this.characterIndexMap[characterKey];
            
            if (characterIndex !== undefined && this.pairs[characterIndex]) {
                const pair = this.pairs[Math.abs(characterIndex - 3)];
                
                // Trigger the character animation
                pair.small(0.085); // Trigger the 'small' animation
                
                // Play the corresponding sound
                if (this.multiSequencer && this.multiSequencer.sequencers[Math.abs(characterIndex - 3)]) {
                    const sequencer = this.multiSequencer.sequencers[Math.abs(characterIndex - 3)];
                    const trackIndex = pair.armToTrackIndex['small'] || 0;
                    sequencer.triggerSample(trackIndex);
                }
                
                this.showFeedback(`${noteType} note triggered ${characterKey}! 🎵`, 'success');
            } else {
                console.error(`Invalid character index: ${characterIndex} or no pair at that index`);
            }
        } else {
            console.error(`No character key found for note type: ${noteType}`);
        }
    }

    initEventListeners() {
        // Character click handlers - make all characters clickable
        this.pairs.forEach((pair, i) => {
            var sequencer = this.multiSequencer.sequencers[i];
            var trigger = (anim) => {
                pair[anim](0.085);
                if (sequencer && sequencer.triggerSample) {
                    const trackIndex = pair.armToTrackIndex[anim] || 0;
                    sequencer.triggerSample(trackIndex);
                }
            };
            pair.characterSmall.on('up', trigger);
        });

        // Resize handler
        // window.addEventListener('resize', () => this.resize(), false);
        this.resize();
    }

    startAnimationLoop() {
        Tone.Buffer.on('load', () => {
            aaf.common.loop.add(() => this.update());
            aaf.common.loop.start();
            container.appendChild(this.pixi.renderer.view);
            window.parent.postMessage('loaded', '*');
            window.parent.postMessage('ready', '*');
        });
    }

    calculateCharacterWidth() {
        var ratio = (container.offsetHeight / 360);
        var baseRatio = ratio * 0.6;
        return container.offsetHeight / baseRatio;
    }

    // calculateCharacterSpacing() {
    //     var windowWidth = container.offsetWidth;
    //     var characterWidth = this.calculateCharacterWidth();
    //     debugger;
    //     console.log(characterWidth);
    //     var baseSpacing = ((windowWidth - characterWidth * this.CHARACTER_COUNT) / (this.CHARACTER_COUNT + 1)) + characterWidth;
    //     return baseSpacing;
    // }

    resize() {
        var ratio = (container.offsetHeight / 360);
        this.scale = ratio * 0.5;

        this.pixi.setSize(container.offsetWidth, container.offsetHeight);
        this.pixi.renderer.view.style.top = '0px';

        var offsetX = (container.offsetWidth - container.offsetHeight * 3) / 2;
        this.characterContainer.position.x = offsetX;
        debugger;
        this.characterContainer.position.y = 0;
        this.characterContainer.scale.set(this.scale);
    }

    update() {
        this.pixi.render();
        this.multiSequencer.update();

        // Animate all characters when playing
        if (this.multiSequencer.playing) {
            for (var i = 0, l = this.pairs.length; i < l; i++) {
                var pair = this.pairs[i];
                
                // Use the individual sequencer for each character instead of activeSequencer
                var sequencer = this.multiSequencer.sequencers[i];
                if (sequencer) {
                    var b = sequencer.position * sequencer.timeSignature;
                    // Animate all characters with slight delays for visual effect
                    pair.characterSmall.setBob(b + 0.075 + (i * 0.1));
                }
                pair.characterSmall.update();
            }
        } else {
            // Update characters even when not playing
            for (var i = 0, l = this.pairs.length; i < l; i++) {
                this.pairs[i].characterSmall.update();
            }
        }
    }

    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        
        // Update button text if it exists
        const playButton = document.getElementById('playButton');
        if (playButton) {
            playButton.textContent = '⏸️ Pause';
            playButton.classList.add('playing');
        }
        
        if (this.multiSequencer) {
            this.multiSequencer.play();
            // Start train animation
            this.multiSequencer.startTrainAnimation();
        }
        
        this.startPlayheadAnimation();
    }

    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        // Update button text if it exists
        const playButton = document.getElementById('playButton');
        if (playButton) {
            playButton.textContent = '▶️ Play';
            playButton.classList.remove('playing');
        }
        
        if (this.multiSequencer) {
            this.multiSequencer.pause();
            // Stop train animation
            this.multiSequencer.stopTrainAnimation();
        }
        
        this.stopPlayheadAnimation();
        this.resetPlayhead();
    }

    startPlayheadAnimation() {
        const playhead = document.getElementById('playhead');
        if (!playhead) return;
        
        playhead.style.transition = 'left 4s linear';
        playhead.style.left = '100%';
        
        setTimeout(() => {
            if (this.isPlaying) {
                playhead.style.transition = 'none';
                playhead.style.left = '0%';
                setTimeout(() => {
                    if (this.isPlaying) {
                        this.startPlayheadAnimation();
                    }
                }, 50);
            }
        }, 4000);
    }

    stopPlayheadAnimation() {
        const playhead = document.getElementById('playhead');
        if (playhead) {
            playhead.style.transition = 'none';
        }
    }

    resetPlayhead() {
        const playhead = document.getElementById('playhead');
        if (playhead) {
            playhead.style.left = '0%';
        }
    }

    clearAll() {
        if (this.multiSequencer && this.multiSequencer.placedNotes) {
            for (let row = 0; row < 4; row++) {
                this.multiSequencer.placedNotes[row] = [];
            }
            
            const placedNotes = document.querySelectorAll('.placed-note');
            placedNotes.forEach(note => note.remove());
            
            this.multiSequencer.updateSequencerFromNotes();
        }
        
        this.showFeedback('All notes cleared from the train! 🗑️', 'info');
    }

    showFeedback(message, type) {
        let feedback = document.querySelector('.feedback-message');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'feedback-message';
            feedback.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: bold;
                z-index: 1000;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(feedback);
        }
        
        feedback.textContent = message;
        feedback.style.background = type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff';
        feedback.style.opacity = '1';
        
        setTimeout(() => {
            feedback.style.opacity = '0';
        }, 3000);
    }
}

// Initialize the rhythm game
window.rhythmGame = new RhythmGame();

// Make rhythm game available to MultiSequencer
if (window.multiSequencer) {
    window.multiSequencer.rhythmGame = window.rhythmGame;
}

// Initialize audio context on first user interaction
document.addEventListener('click', function initAudio() {
    if (window.rhythmGame) {
        window.rhythmGame.initAudio();
    }
    document.removeEventListener('click', initAudio);
}, { once: true });