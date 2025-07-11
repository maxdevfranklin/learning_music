var musicbox = {};
musicbox.config = {};
musicbox.config.cymbals = {};
musicbox.config.triangle = {};
musicbox.config.conga = {};
musicbox.config.woodblock = {};
let mute_config = 0;
let anim_mute_config = 1;
let tempCharacter = null;
let prevBpm = null;
selectedCharacter = 0;
let timeDelay = 1;

// Add these variables at the top of the file with other global variables
let wasAudioPlaying = false;
let wasCharacterPlaying = false;
let wasWavesAnimating = false;

musicbox.Animation = function (data, framerate) {
  this.data = data;
  this.duration = data.duration / 1000;
};

musicbox.Animation.FRAME_DURATION = 1 / 30;

musicbox.Animation.prototype.at = function (t, dim) {
  var frame = t / musicbox.Animation.FRAME_DURATION;
  var frameLowIndex = ~~frame;
  var frameHighIndex = frameLowIndex + 1;

  var l = frame - frameLowIndex;

  var frameLow = this.data.frameData[frameLowIndex].val[dim];
  var frameHigh =
    this.data.frameData[
      Math.min(this.data.frameData.length - 1, frameHighIndex)
    ].val[dim];

  return aaf.utils.math.lerp(frameLow, frameHigh, l);
};

musicbox.Character = function (opts) {
  aaf.utils.Events.mixTo(this);

  this.scale = 300 / 72;

  this.groups = {};
  this.sprites = {};
  this.animations = {};
  this.timelines = {};
  this.hitboxes = {};

  this.container = new PIXI.Container();

  this.lookDirection = {
    x: 0,
    y: 0,
  };

  // Build the groups and sprites
  // -------------------------------

  if (opts.legs) {
    this.makeLegs(opts);
  }

  this.groups.body = new PIXI.Container();
  this.container.addChild(this.groups.body);

  if (opts.body) {
    this.makeBody(opts);
  }

  if (opts.face) {
    this.makeFace(opts);
  }

  this.makeEyes(opts);

  if (opts.front && !opts.front.behindArms) {
    this.makeFront(opts);
  }

  // hitboxes

  if (opts.hitbox) {
    for (var key in opts.hitbox) {
      this.defineHitbox(opts.hitbox[key], key);
    }
  }

  // arms, strike animations

  if (opts.armLeft) {
    this.makeArm(opts, "Left");
  }

  if (opts.armRight) {
    this.makeArm(opts, "Right");
  }

  if (opts.front && opts.front.behindArms) {
    this.makeFront(opts);
  }

  if (opts.armLeft && opts.armRight.back) {
    this.groups.body.addChild(this.groups.armLeft);
  }

  // Make both-armed strike GSAP timelines
  // -------------------------------

  if (opts.strikeBoth && !aaf.common.url.defaultPose) {
    this.timelines.strikeBoth = new TimelineLite({ paused: true });

    if (opts.armLeft) {
      var tl = this.makeStrikeTimeline(opts, "Left", false);
      this.timelines.strikeBoth.add(tl, 0);
    }

    if (opts.armRight) {
      var tr = this.makeStrikeTimeline(opts, "Right", false);
      this.timelines.strikeBoth.add(tr, 0);
    }

    this.timelines.strikeBoth.time(0.0001);
    this.anticipationBoth = opts.strikeBoth.anticipation;
  }

  // kick in the first animation frames

  if (opts.strikeLeft && !aaf.common.url.defaultPose) {
    this.timelines.strikeLeft.time(0.0001);
    this.anticipationLeft = opts.strikeLeft.anticipation;
  }

  if (opts.strikeRight && !aaf.common.url.defaultPose) {
    this.timelines.strikeRight.time(0.0001);
    this.anticipationRight = opts.strikeRight.anticipation;
  }

  // values for update method, programmatic gyrating etc ...

  this.bob = 0;
  this.bobInfluence = 0;
  this.targetBobInfluence = 0;

  this.breatheSpeed = aaf.random(0.8, 1.2) * 2;
  this.breatheOffset = aaf.random();

  this.breathe = 0;
  this.breatheInfluence = 1;
};

musicbox.Character.getAssetList = function (charOpts) {
  var assets = [];

  for (var i in charOpts) {
    var layer = charOpts[i];

    if (layer.texture) {
      assets.push(layer.texture);
    }

    if (layer.animation) {
      if (layer.animation.rotation) {
        assets.push(layer.animation.rotation.file);
      }

      if (layer.animation.position) {
        assets.push(layer.animation.position.file);
      }
    }
  }

  return assets;
};

// Per-frame animation functions
// -------------------------------

musicbox.Character.prototype.setBob = function (pct) {
  this.targetBobInfluence = 1;
  this.bob = pct;
};

musicbox.Character.prototype.stopBobbing = function (pct) {
  this.targetBobInfluence = 0;
};

musicbox.Character.prototype.update = function () {
  this.groups.body.position.y = 0;
  this.groups.armLeft.position.y = this.armLeftRestY;
  this.groups.armRight.position.y = this.armRightRestY;
  this.eyes.sprite.position.x = 0;
  this.eyes.sprite.position.y = 0;

  // Bob
  // -------------------------------

  // made from several abs'd sine waves with different amplitudes and phase

  var t = (this.bob - 0.1) * Math.PI;
  this.bobInfluence += (this.targetBobInfluence - this.bobInfluence) * 0.05;

  this.groups.body.position.y +=
    -Math.abs(Math.sin(t) * 2) * 5 * this.bobInfluence;
  this.groups.armLeft.position.y +=
    -Math.abs(Math.sin(t - 0.35) * 2) * 5 * this.bobInfluence;
  this.groups.armRight.position.y +=
    -Math.abs(Math.sin(t - 0.3) * 2) * 5 * this.bobInfluence;
  this.eyes.sprite.position.y +=
    -Math.abs(Math.sin(t + 0.35) * 2) * 1.5 * this.bobInfluence;

  // Breathe
  // -------------------------------

  // similar but way smaller amplitude and not abs'd

  this.breathe += aaf.common.loop.delta * this.breatheSpeed;
  var breatheInfluence = 1 - this.bobInfluence;
  var t = this.breathe + this.breatheOffset;

  this.groups.body.position.y += -Math.sin(t) * 2.75;
  this.groups.armLeft.position.y += -Math.sin(t - 0.35) * 2.75;
  this.groups.armRight.position.y += -Math.sin(t - 0.3) * 2.75;
  this.eyes.sprite.position.y += -Math.sin(t + 0.35) * 1.5;

  // Look direction
  // -------------------------------

  //     this.lookDirection.x = window.innerWidth / 2 - aaf.common.pointer.x;
  //     this.lookDirection.y = window.innerHeight / 2 - aaf.common.pointer.y;
  // //
  this.eyes.sprite.position.x += this.lookDirection.x;
  this.eyes.sprite.position.y += this.lookDirection.y;

  this.eyes.mask.position.x = this.eyes.sprite.position.x;
  this.eyes.mask.position.y = this.eyes.sprite.position.y;

  if (this.sprites.face) {
    this.sprites.face.x =
      this.eyes.sprite.position.x * 0.5 * this.eyes.container.scale.x;
    this.sprites.face.y =
      this.eyes.sprite.position.y * 0.7 * this.eyes.container.scale.y;
  }

  // the "front" layer is annoying because it needs to be between
  // arms and in front of body. but it doesn't respect any of this
  // bouncing motion ....

  if (this.sprites.front) {
    this.sprites.front.position.y =
      this.frontRestY - this.groups.body.position.y;
  }
};

// Construct character
// -------------------------------

musicbox.Character.prototype.defineHitbox = function (opts, key) {
  var hitbox = new PIXI.Graphics();

  hitbox.alpha = aaf.common.url.boolean("hitbox") ? 0.5 : 0;

  hitbox.beginFill(~~(Math.random() * 0xffffff));
  hitbox.drawRect(opts.x, opts.y, opts.width, opts.height);
  hitbox.endFill();

  hitbox.hitArea = new PIXI.Rectangle(opts.x, opts.y, opts.width, opts.height);

  hitbox.interactive = true;

  var _this = this;

  var down = function () {
    _this.fire("down", key);
    _this.fire(key + "down");
  };

  var up = function () {
    _this.fire("up", key);
    _this.fire(key + "up");
  };

  hitbox.mousedown = down;
  hitbox.mouseup = up;

  hitbox.touchstart = down;
  hitbox.touchend = up;

  this.hitboxes[key] = hitbox;

  this.container.addChild(hitbox);
};

musicbox.Character.prototype.makeFace = function (opts) {
  this.groups.face = new PIXI.Container();
  this.sprites.face = new PIXI.Sprite(aaf.assets(opts.face.texture));

  this.groups.face.addChild(this.sprites.face);
  this.groups.body.addChild(this.groups.face);

  this.groups.face.pivot.x = this.sprites.face.texture.width / 2;
  this.groups.face.pivot.y = this.sprites.face.texture.height / 2;

  aaf.utils.extend(this.groups.face.position, opts.face.position);

  this.groups.face.position.x += this.sprites.body.position.x;
};

musicbox.Character.prototype.makeBody = function (opts) {
  this.sprites.body = new PIXI.Sprite(aaf.assets(opts.body.texture));

  this.groups.body.addChild(this.sprites.body);

  this.sprites.body.pivot.x = this.sprites.body.texture.width / 2;
  this.sprites.body.pivot.y = this.sprites.body.texture.height / 2;

  this.sprites.body.position.x = opts.body.position.x;
  this.sprites.body.position.y = opts.body.position.y;
};

musicbox.Character.prototype.makeEyes = function (opts) {
  this.eyes = new musicbox.CharacterEyes();

  if (opts.eyes && opts.eyes.position) {
    aaf.utils.extend(this.eyes.container.position, opts.eyes.position);
    this.eyes.container.position.x += opts.body.position.x; // eyes to be relative

    if (opts.eyes.scale) {
      this.eyes.container.scale.set(opts.eyes.scale);
    }

    if (opts.eyes.color !== undefined) {
      this.eyes.sprite.tint = opts.eyes.color;
    }
  } else {
    this.eyes.container.position.x = opts.body.position.x;
    this.eyes.container.position.y = -200;
  }

  this.groups.body.addChild(this.eyes.container);
};

musicbox.Character.prototype.makeLegs = function (opts) {
  this.sprites.legs = new PIXI.Sprite(aaf.assets(opts.legs.texture));

  this.container.addChild(this.sprites.legs);

  this.sprites.legs.pivot.x = this.sprites.legs.texture.width / 2;
  this.sprites.legs.pivot.y = this.sprites.legs.texture.height / 2;

  this.sprites.legs.position.x = opts.legs.position.x;
  this.sprites.legs.position.y = opts.legs.position.y;
};

musicbox.Character.prototype.makeFront = function (opts) {
  this.sprites.front = new PIXI.Sprite(aaf.assets(opts.front.texture));

  this.groups.body.addChild(this.sprites.front);

  this.sprites.front.pivot.x = this.sprites.front.texture.width / 2;
  this.sprites.front.pivot.y = this.sprites.front.texture.height / 2;

  this.sprites.front.position.x = opts.front.position.x;
  this.sprites.front.position.y = opts.front.position.y;

  this.frontRestY = opts.front.position.y;
};

// Arms and their animations
// -------------------------------

musicbox.Character.prototype.makeArm = function (opts, side) {
  var stickOpts = opts["stick" + side];
  var strikeOpts = opts["strike" + side];
  var armOpts = opts["arm" + side];

  var groupArm = (this.groups["arm" + side] = new PIXI.Container());
  var spriteArm = (this.sprites["arm" + side] = new PIXI.Sprite(
    aaf.assets(armOpts.texture)
  ));

  groupArm.position.x = armOpts.position.x * this.scale;
  groupArm.position.y = armOpts.position.y * this.scale;

  this["arm" + side + "RestY"] = groupArm.position.y * this.scale;

  spriteArm.pivot.x = spriteArm.texture.width / 2;
  spriteArm.pivot.y = spriteArm.texture.height / 2;

  if (!stickOpts || !stickOpts.behindArms) {
    groupArm.addChild(spriteArm);
  }

  if (stickOpts) {
    var groupStick = (this.groups["stick" + side] = new PIXI.Container());
    var spriteStick = (this.sprites["stick" + side] = new PIXI.Sprite(
      aaf.assets(stickOpts.texture)
    ));

    spriteStick.pivot.x = spriteStick.texture.width / 2;
    spriteStick.pivot.y = spriteStick.texture.height / 2;

    groupStick.position.x = stickOpts.position.x * this.scale;
    groupStick.position.y = stickOpts.position.y * this.scale;

    groupArm.addChild(groupStick);
    groupStick.addChild(spriteStick);
  }

  if (stickOpts && stickOpts.behindArms) {
    groupArm.addChild(spriteArm);
  }

  this.groups.body.addChild(groupArm);

  if (strikeOpts) {
    var timeline = (this.timelines["strike" + side] = this.makeStrikeTimeline(
      opts,
      side,
      true
    ));
  }
};

musicbox.Character.prototype.makeStrikeTimeline = function (
  opts,
  side,
  paused
) {
  var armOpts = opts["arm" + side];
  var stickOpts = opts["stick" + side];
  var strikeOpts = opts.strikeBoth || opts["strike" + side];

  var progress = { t: 0 };
  var timeline = new TimelineLite({ paused: paused });
  var _this = this;

  var armRotationJson = aaf.assets(armOpts.animation.rotation.file);
  var armRotationLayer = armOpts.animation.rotation.layer;
  var armRotationAnimation = new musicbox.Animation(
    armRotationJson[armRotationLayer]
  );

  var stickRotationAnimation;

  if (stickOpts && stickOpts.animation.rotation) {
    var stickRotationJson = aaf.assets(stickOpts.animation.rotation.file);
    var stickRotationLayer = stickOpts.animation.rotation.layer;
    stickRotationAnimation = new musicbox.Animation(
      stickRotationJson[stickRotationLayer]
    );
  }

  timeline.to(
    progress,

    armRotationAnimation.duration,

    {
      t: armRotationAnimation.duration,

      onUpdate: function () {
        _this.groups["arm" + side].rotation =
          (armRotationAnimation.at(progress.t, 0) * Math.PI) / 180;

        if (stickRotationAnimation) {
          _this.groups["stick" + side].rotation =
            (stickRotationAnimation.at(progress.t, 0) * Math.PI) / 180;
        }

        // if ( armOpts.animation.position ) {
        // _this.groups[ 'arm' + side ].position.x = armOpts.animation.position.at( progress.t, 0 );
        // _this.groups[ 'arm' + side ].position.y = armOpts.animation.position.at( progress.t, 1 );
        // }
      },
    }
  );

  return timeline;
};

// GSAP strike timelines
// -------------------------------

musicbox.Character.prototype.strikeLeft = function (time) {
  time = time || this.anticipationLeft;
  this.timelines.strikeLeft &&
    this.timelines.strikeLeft.timeScale(this.anticipationLeft / time).restart();
};

musicbox.Character.prototype.strikeRight = function (time) {
  time = time || this.anticipationRight;
  this.timelines.strikeRight &&
    this.timelines.strikeRight
      .timeScale(this.anticipationRight / time)
      .restart();
};

musicbox.Character.prototype.strikeBoth = function (time) {
  time = time || this.anticipationBoth;
  this.timelines.strikeBoth &&
    this.timelines.strikeBoth.timeScale(this.anticipationBoth / time).restart();
};

musicbox.CharacterEyes = function () {
  this.container = new PIXI.Container();

  this.sprite = new PIXI.Sprite(aaf.assets("texture/slices_eyes.png"));
  this.sprite.pivot.x = this.sprite.texture.width / 2;
  this.sprite.pivot.y = this.sprite.texture.height / 2;

  this.mask = new PIXI.Graphics();
  this.mask.beginFill();
  this.mask.drawRect(
    0,
    0,
    this.sprite.texture.width,
    this.sprite.texture.height
  );
  this.mask.endFill();

  aaf.utils.extend(this.mask.pivot, this.sprite.pivot);

  this.container.addChild(this.mask);
  this.container.addChild(this.sprite);

  this.sprite.mask = this.mask;

  var blink = 1;

  Object.defineProperty(this, "blink", {
    get: function () {
      return blink;
    },

    set: function (b) {
      blink = b;
      this.mask.scale.y = blink;
    },
  });

  this.blinkTimeline = new TimelineMax({
    onComplete: this.onComplete,
    onCompleteScope: this,
  });

  this.blinkTimeline.to(this, 0.075, { blink: 0 });
  this.blinkTimeline.to(this, 0.1, { blink: 1 }, "+=0.1");
};

musicbox.CharacterEyes.prototype.getRepeatDelay = function () {
  var r = aaf.random();

  return aaf.utils.math.lerp(4.0, 0.5, r * r * r);
};

musicbox.CharacterEyes.prototype.onComplete = function () {
  if (aaf.random.chance(0.1)) {
    // double blink
    this.blinkTimeline.timeScale(1.2);
    this.blinkTimeline.delay(0);
  } else {
    this.blinkTimeline.timeScale(aaf.random(0.8, 1.1));
    this.blinkTimeline.delay(this.getRepeatDelay());
  }

  this.blinkTimeline.restart(true);
};
musicbox.CharacterPair = function (charSmall) {
  // this.characterBig = charBig;
  this.characterSmall = charSmall;

  this.container = new PIXI.Container();

  // this.container.addChild( this.characterBig.container );
  this.container.addChild(this.characterSmall.container);

  this.left = this.left.bind(this);
  this.right = this.right.bind(this);
  this.small = this.small.bind(this);

  // this.adoringLookTimeline = new TimelineMax( {
  //     onComplete: this.onAdoringLookComplete,
  //     onCompleteScope: this
  // } );

  // if ( aaf.common.url.look ) {
  //     this.adoringLookTimeline.delay( 1 );
  // } else {
  //     this.adoringLookTimeline.delay( 5 );
  // }

  // this.adoringLookTimeline.to( this.characterBig.lookDirection, 1.2, { x: 25 * 2, y: 9 * 2, ease: Quad.inOut }, 0 );
  // this.adoringLookTimeline.to( this.characterBig.lookDirection, 1.0, { x: 0, y: 0, ease: Quad.inOut }, 3.0 );

  // this.adoringLookTimeline.to( this.characterSmall.lookDirection, 1.0, { x: -20 * 2, y: -5 * 2, ease: Quad.inOut }, 0 );
  // this.adoringLookTimeline.to( this.characterSmall.lookDirection, 1.0, { x: 0, y: 0, ease: Quad.inOut }, 3.0 );
};

// musicbox.CharacterPair.prototype.onAdoringLookComplete = function() {

//     if ( aaf.common.url.look ) {
//         this.adoringLookTimeline.delay( 1 );
//     } else {
//         this.adoringLookTimeline.delay( aaf.random( 15, 30 ) );
//     }

//     this.adoringLookTimeline.restart( true );

// };

musicbox.CharacterPair.prototype.left = function (t) {
  // this.characterBig.strikeLeft( t );
};

musicbox.CharacterPair.prototype.right = function (t) {
  // this.characterBig.strikeRight( t );
};

musicbox.CharacterPair.prototype.small = function (t) {
  this.characterSmall.strikeBoth(t);
};

var defaults = aaf.utils.defaults;

musicbox.EasyPIXI = function (options) {
  options = defaults(options, {
    fullscreen: true,

    width: window.innerWidth, // ignored if fullscreen is true
    height: window.innerHeight, // ignored if fullscreen is true

    antialiasing: aaf.common.ua.pixelRatio === 1,
    resolution: aaf.common.ua.pixelRatio,
    // backgroundColor: 0x3e1ac8,
    transparent: true,

    container: document.getElementById("container"),
  });

  PIXI.ticker.shared.autoStart = false;
  PIXI.ticker.shared.stop();

  this.renderer = PIXI.autoDetectRenderer(options.width, options.height, {
    antialias: true,
    transparent: true,
    resolution: options.resolution,
    // backgroundColor: options.backgroundColor,
  });

  this.stage = new PIXI.Container();

  if (options.fullscreen) {
    window.addEventListener("resize", this.resizeFullscreen.bind(this));
    this.resizeFullscreen();
  } else {
    this.setSize(options.width, options.height);
  }

  this.render();
  // options.container.appendChild( this.renderer.view );
};

musicbox.EasyPIXI.prototype.resizeFullscreen = function () {
  this.setSize(window.innerWidth, window.innerHeight);
};

musicbox.EasyPIXI.prototype.setSize = function (width, height) {
  this.width = width / 2;
  this.height = height;

  this.renderer.resize(width, height);
  this.renderer.view.style.width = width + "px";
  this.renderer.view.style.height = height + "px";
};

musicbox.EasyPIXI.prototype.render = function () {
  this.renderer.render(this.stage);
};
musicbox.MultiSequencer = function (sequencers) {
  this.sequencers = [];
  // this.activeSequencerIndex = 0;
  // this.activeSequencer = undefined;

  this.domElement = document.createElement("div");
  this.domElement.className = "multi-sequencer";

  for (var i = 0, l = sequencers.length; i < l; i++) {
    var sequencer = sequencers[i];
    sequencer.active = false;
    sequencer.index = i;
    sequencer.parentMultiSequencer = this;
    this.sequencers.push(sequencer);
    // this.domElement.appendChild( sequencer.domElement );
  }

  // this.setActiveSequencer(this.sequencers[0]);

  this.playing = false;

  this.play = this.play.bind(this);

  Tone.Transport.loop = true;

  this.transportStarted = false;

  // Train-related properties
  this.trainContainer = null;
  this.placedNotes = {
    0: [],
    1: [],
    2: [],
    3: [] 
  };
  this.noteTypes = [
    { name: 'eighth', color: '#FFD700', width: 1, instrument: 'woodblock', character: 'chicken' },
    { name: 'quarter', color: '#FF4444', width: 2, instrument: 'conga', character: 'dog' },
    { name: 'half', color: '#44FF44', width: 4, instrument: 'triangle', character: 'pig' },
    { name: 'whole', color: '#4444FF', width: 8, instrument: 'cymbals', character: 'crocodile' }
  ];
};

aaf.utils.Events.mixTo(musicbox.MultiSequencer.prototype);

musicbox.MultiSequencer.prototype.update = function () {
  if (this.playing && this.sequencers) {
    // Update all sequencers instead of just the active one
    this.sequencers.forEach(sequencer => {
      if (sequencer && sequencer.update) {
        sequencer.update();
      }
    });
  }
};

// musicbox.MultiSequencer.prototype.setActiveSequencer = function (seq) {
//   var playing = this.playing;

//   clearTimeout(this.playTimeout);

//   if (playing) {
//     this.pause(true);
//   }

//   if (this.activeSequencer) {
//     this.activeSequencer.active = false;
//     this.activeSequencer.domElement.classList.remove("active");
//   } else {
//   this.activeSequencer = seq;
//   this.activeSequencer.domElement.classList.add("active");
//   }


//   if (playing) {
//     this.play();
//   }

//   var prevIndex = this.activeSequencerIndex;

//   this.fire("change", this.activeSequencerIndex, prevIndex);

//   this.activeSequencerIndex = this.sequencers.indexOf(seq);

//   this.activeSequencer.active = true;
// };

// musicbox.MultiSequencer.prototype.prev = function () {};

// musicbox.MultiSequencer.prototype.next = function () {
//   var i = (this.activeSequencerIndex + 1) % this.sequencers.length;
//   this.setActiveSequencer(this.sequencers[i]);
// };

musicbox.MultiSequencer.prototype.play = function () {
  if (anim_mute_config) {
    this.domElement.classList.add("playing");
    this.domElement.classList.remove("suspended");
  }
  
  // Show playhead
  this.showPlayhead();
  
  // Start all sequencers instead of just the active one
  if (this.sequencers) {
    this.sequencers.forEach(sequencer => {
      if (sequencer && sequencer.start) {
        sequencer.start();
      }
    });
  }
  
  this.playing = true;
  this.fire("play");
};

musicbox.MultiSequencer.prototype.pause = function (suspend) {
  if (suspend) {
    this.domElement.classList.add("suspended");
  }

  this.domElement.classList.remove("playing");

  // Hide playhead
  this.hidePlayhead();

  // Stop all sequencers instead of just the active one
  if (this.sequencers) {
    this.sequencers.forEach(sequencer => {
      if (sequencer && sequencer.stop) {
        sequencer.stop();
      }
    });
  }

  this.playing = false;
  this.fire("pause");
};

musicbox.MultiSequencer.prototype.updatePlayheadFromSequencer = function(sequencerIndex, stepNumber) {
  // Update playhead position based on the sequencer's step number
  this.updatePlayheadPosition(stepNumber + 1);
};

// Train creation and management methods
// -------------------------------

musicbox.MultiSequencer.prototype.createRhythmTrain = function(container) {
  if (this.trainContainer) {
    return this.trainContainer;
  }

  // Create the train container
  this.trainContainer = document.createElement('div');
  this.trainContainer.className = 'rhythm-train-container';
  this.trainContainer.style.cssText = `
    width: 100%;
    background: lightslategrey;
    border-radius: 15px;
    padding: 20px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
    position: relative;
  `;

  // Create train header
  // var trainHeader = document.createElement('div');
  // trainHeader.innerHTML = '🚂 Rhythm Train';
  // trainHeader.style.cssText = `
  //   text-align: center;
  //   font-size: 24px;
  //   font-weight: bold;
  //   color: white;
  //   margin-bottom: 20px;
  //   text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  // `;
  // this.trainContainer.appendChild(trainHeader);

  var carriageContainer = document.createElement('div');
  carriageContainer.className = 'rhythm-carriage-container';
  carriageContainer.style.cssText = `
    display: flex;
    gap: 25px;
    align-items: flex-start;
    justify-content: center;
    flex-wrap: wrap;
    position: relative;
  `;
  
  // Create 4 train carriages (groups)
  for (var group = 0; group < 4; group++) {
    var carriage = this.createTrainCarriage(group);
    carriageContainer.appendChild(carriage);
  }
  this.trainContainer.appendChild(carriageContainer);

  // Create playhead
  this.createPlayhead();

  // Create note palette
  this.createNotePalette();

  // Add to container
  if (container) {
    container.appendChild(this.trainContainer);
  }

  return this.trainContainer;
};

musicbox.MultiSequencer.prototype.createPlayhead = function() {
  // Create playhead container
  this.playheadContainer = document.createElement('div');
  this.playheadContainer.className = 'train-playhead-container';
  this.playheadContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 10;
  `;

  // Create playhead element
  this.playhead = document.createElement('div');
  this.playhead.className = 'train-playhead';
  this.playhead.style.cssText = `
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(to bottom, #FFD700, #FFA500);
    border-radius: 2px;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
    transition: left 0.444444s linear;
    visibility: none;
    z-index: 11;
  `;

  // Add playhead to container
  this.playheadContainer.appendChild(this.playhead);
  this.trainContainer.appendChild(this.playheadContainer);
  this.hidePlayhead();

  // Initialize playhead position
  this.updatePlayheadPosition(0);
};

musicbox.MultiSequencer.prototype.updatePlayheadPosition = function(stepNumber) {
  if (!this.playhead) return;

  var last = false;
  if (stepNumber % 32 == 0 && stepNumber != 0) {
    last = true;
    console.log("last true");
    stepNumber = 30;
  }
  var carriageNum = Math.floor(stepNumber / 8);
  var currentCarriage = document.getElementsByClassName("train-carriage")[carriageNum];


  if (currentCarriage) {
    var train = document.getElementsByClassName("rhythm-train-container")[0];

    var noteNum = Math.floor((stepNumber % 8) / 2);
    var currentNote = currentCarriage.getElementsByClassName("beat-markers")[0].getElementsByClassName("beat")[noteNum];
  
    var boundingBox = currentNote.getBoundingClientRect();
  
    var position = boundingBox.left;
    if (stepNumber % 2 == 1) {
      position = boundingBox.left + (boundingBox.width / 2);
    }
    if (last) {
      position = boundingBox.right;
    }
  
    this.playhead.style.left = (position - train.getBoundingClientRect().left) + 'px';

    // Add glow effect when playing
    if (this.playing) {
      this.playhead.style.boxShadow = '0 0 15px rgba(255, 215, 0, 1)';
    } else {
      this.playhead.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.8)';
    }
  }

};

musicbox.MultiSequencer.prototype.resetPlayhead = function() {
  this.updatePlayheadPosition(0);
};

musicbox.MultiSequencer.prototype.hidePlayhead = function() {
  if (this.playhead) {
    this.playhead.style.opacity = '0';
  }
};

musicbox.MultiSequencer.prototype.showPlayhead = function() {
  if (this.playhead) {
    this.playhead.style.opacity = '1';
  }
};

musicbox.MultiSequencer.prototype.createTrainCarriage = function(groupIndex) {
  var carriage = document.createElement('div');
  carriage.className = 'train-carriage';
  carriage.dataset.group = groupIndex;
  carriage.style.cssText = `
    flex: 1;
    background: rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 15px;
    border: 2px solid rgba(255,255,255,0.2);
    position: relative;
    transition: transform 0.3s ease;
    min-width: 200px;
  `;

  // Carriage header
  var carriageHeader = document.createElement('div');
  carriageHeader.className = 'carriage-header';
  carriageHeader.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    color: white;
    font-weight: bold;
    font-size: 16px;
  `;
  
  // var carriageIcon = document.createElement('span');
  // carriageIcon.style.cssText = `
  //   font-size: 24px;
  //   margin-right: 10px;
  // `;
  // carriageIcon.textContent = '🚃';
  
  // var carriageTitle = document.createElement('span');
  // carriageTitle.textContent = `Carriage ${groupIndex + 1}`;
  
  // carriageHeader.appendChild(carriageIcon);
  // carriageHeader.appendChild(carriageTitle);
  // carriage.appendChild(carriageHeader);

  // Create 4 rows for this carriage (4 players)
  for (var row = 0; row < 4; row++) {
    var trainRow = this.createTrainRow(row, groupIndex);
    carriage.appendChild(trainRow);
  }

  // Add carriage wheels positioned under and outside
  var wheels = document.createElement('div');
  wheels.className = 'carriage-wheels';
  wheels.dataset.group = groupIndex;
  wheels.style.cssText = `
    position: absolute;
    bottom: -20px;
    left: -10px;
    right: -10px;
    display: flex;
    justify-content: space-between;
    z-index: 2;
    padding: 0 20px;
  `;
  
  // Left wheels
  var leftWheels = document.createElement('div');
  leftWheels.className = 'left-wheels';
  leftWheels.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  for (var i = 0; i < 2; i++) {
    var wheel = document.createElement('div');
    wheel.className = 'wheel left-wheel';
    wheel.dataset.group = groupIndex;
    wheel.style.cssText = `
      width: 40px;
      height: 40px;
      background: #333;
      border-radius: 50%;
      border: 2px solid #666;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: transform 0.1s linear;
    `;
    leftWheels.appendChild(wheel);
  }
  
  // Right wheels
  var rightWheels = document.createElement('div');
  rightWheels.className = 'right-wheels';
  rightWheels.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  for (var i = 0; i < 2; i++) {
    var wheel = document.createElement('div');
    wheel.className = 'wheel right-wheel';
    wheel.dataset.group = groupIndex;
    wheel.style.cssText = `
      width: 40px;
      height: 40px;
      background: #333;
      border-radius: 50%;
      border: 2px solid #666;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: transform 0.1s linear;
    `;
    rightWheels.appendChild(wheel);
  }
  
  wheels.appendChild(leftWheels);
  wheels.appendChild(rightWheels);
  
  carriage.appendChild(wheels);

  // Add connector to the right of this carriage (except for the last one)
  if (groupIndex < 3) { // Only add connector if not the last carriage
    var connector = this.createCarriageConnector(groupIndex);
    carriage.appendChild(connector);
  }

  return carriage;
};

musicbox.MultiSequencer.prototype.createCarriageConnector = function(groupIndex) {
  var connector = document.createElement('div');
  connector.className = 'carriage-connector';
  connector.dataset.group = groupIndex;
  connector.style.cssText = `
    position: absolute;
    top: 50%;
    right: -25px;
    transform: translateY(-50%);
    width: 25px;
    height: 8px;
    background: linear-gradient(90deg, #666, #999, #666);
    border-radius: 4px;
    z-index: 3;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `;

  // Add connector details
  var connectorDetail = document.createElement('div');
  connectorDetail.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    background: #333;
    border-radius: 50%;
  `;
  connector.appendChild(connectorDetail);

  // Add connector animation
  connector.style.animation = `connectorGlow 2s ease-in-out infinite`;
  connector.style.animationDelay = `${groupIndex * 0.3}s`;

  return connector;
};

// Add train animation methods
musicbox.MultiSequencer.prototype.addTrainCSSAnimations = function() {
  // Check if animations are already added
  if (document.getElementById('train-animations')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'train-animations';
  style.textContent = `
    @keyframes carriageMove {
      0%, 100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-3px);
      }
    }
    
    @keyframes wheelRotate {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    
    @keyframes connectorGlow {
      0%, 100% {
        opacity: 0.7;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      50% {
        opacity: 1;
        box-shadow: 0 2px 8px rgba(255,255,255,0.3);
      }
    }
    
    .train-carriage.playing {
      animation: carriageMove 2s ease-in-out infinite;
    }
    
    .wheel.playing {
      animation: wheelRotate 1s linear infinite;
    }
    
    .carriage-connector.playing {
      animation: connectorGlow 2s ease-in-out infinite;
    }
  `;
  
  document.head.appendChild(style);
};

musicbox.MultiSequencer.prototype.startTrainAnimation = function() {
  const carriages = document.querySelectorAll('.train-carriage');
  const wheels = document.querySelectorAll('.wheel');
  const connectors = document.querySelectorAll('.carriage-connector');
  
  // Add carriage movement animation
  carriages.forEach((carriage, index) => {
    carriage.style.animation = `carriageMove 2s ease-in-out infinite`;
    carriage.style.animationDelay = `${index * 0.2}s`;
  });
  
  // Add wheel rotation animation
  wheels.forEach((wheel, index) => {
    wheel.style.animation = `wheelRotate 1s linear infinite`;
    // wheel.style.animationDelay = `${index * 0.1}s`;
  });
  
  // Add connector glow animation
  connectors.forEach((connector, index) => {
    connector.style.animation = `connectorGlow 2s ease-in-out infinite`;
    connector.style.animationDelay = `${index * 0.3}s`;
  });
  
  // Add CSS animations if not already added
  this.addTrainCSSAnimations();
};

musicbox.MultiSequencer.prototype.stopTrainAnimation = function() {
  const carriages = document.querySelectorAll('.train-carriage');
  const wheels = document.querySelectorAll('.wheel');
  const connectors = document.querySelectorAll('.carriage-connector');
  
  // Stop carriage movement
  carriages.forEach(carriage => {
    carriage.style.animation = 'none';
  });
  
  // Stop wheel rotation
  wheels.forEach(wheel => {
    wheel.style.animation = 'none';
  });
  
  // Stop connector glow
  connectors.forEach(connector => {
    connector.style.animation = 'none';
  });
};

musicbox.MultiSequencer.prototype.createTrainRow = function(row, groupIndex) {
  var rowContainer = document.createElement('div');
  rowContainer.className = 'train-row';
  rowContainer.dataset.row = row;
  rowContainer.dataset.group = groupIndex;
  rowContainer.dataset.instrument = this.noteTypes[row % 4].instrument;
  rowContainer.dataset.character = this.noteTypes[row % 4].character;
  rowContainer.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
  `;

  // Player/Character indicator
  // var playerIndicator = document.createElement('div');
  // playerIndicator.className = 'player-indicator';
  // playerIndicator.style.cssText = `
  //   width: 25px;
  //   height: 25px;
  //   background: ${this.noteTypes[row % 4].color};
  //   border-radius: 50%;
  //   display: flex;
  //   align-items: center;
  //   justify-content: center;
  //   font-size: 12px;
  //   margin-right: 10px;
  //   color: white;
  //   font-weight: bold;
  //   border: 2px solid rgba(255,255,255,0.3);
  // `;
  // playerIndicator.textContent = `P${(row % 4) + 1}`;
  // rowContainer.appendChild(playerIndicator);

  // Instrument icon
  // var instrumentIcon = document.createElement('div');
  // instrumentIcon.className = 'instrument-icon';
  // instrumentIcon.style.cssText = `
  //   width: 25px;
  //   height: 25px;
  //   background: ${this.noteTypes[row % 4].color};
  //   border-radius: 50%;
  //   display: flex;
  //   align-items: center;
  //   justify-content: center;
  //   font-size: 16px;
  //   margin-right: 10px;
  //   color: white;
  //   font-weight: bold;
  // `;
  // instrumentIcon.innerHTML = this.getInstrumentIcon(row % 4);
  // rowContainer.appendChild(instrumentIcon);

  // Train track
  var trainTrack = document.createElement('div');
  trainTrack.className = 'train-track';
  trainTrack.style.cssText = `
    flex: 1;
    background: #F5DEB3;
    border-radius: 6px;
    position: relative;
    border: 2px solid #DEB887;
  `;

  // Beat markers (4 beats per carriage)
  var beatMarkers = document.createElement('div');
  beatMarkers.className = 'beat-markers';
  beatMarkers.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    display: flex;
    align-items: center;
  `;

  // Create 4 beat markers for this carriage
  for (var beat = 0; beat < 4; beat++) {
    var beatMarker = document.createElement('div');
    beatMarker.className = 'beat';
    beatMarker.style.cssText = `
      flex: 1;
      height: 100%;
      border-right: 1px solid #DEB887;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #8B4513;
      font-weight: bold;
    `;
    beatMarker.textContent = beat + 1;
    beatMarkers.appendChild(beatMarker);
  }

  trainTrack.appendChild(beatMarkers);

  // Drop zone
  var dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';
  dropZone.dataset.accepts = this.noteTypes[row % 4].name;
  dropZone.dataset.group = groupIndex;
  dropZone.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    cursor: pointer;
    background-color: ${this.noteTypes[row % 4].color}55;
  `;

  // Add event listeners
  dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
  dropZone.addEventListener('drop', this.handleDrop.bind(this));
  dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
  dropZone.addEventListener('click', this.handleZoneClick.bind(this));

  trainTrack.appendChild(dropZone);
  rowContainer.appendChild(trainTrack);

  return rowContainer;
};

musicbox.MultiSequencer.prototype.createNotePalette = function() {
  var palette = document.createElement('div');
  palette.className = 'note-palette';
  palette.style.cssText = `
    margin-top: 25px;
    padding: 15px;
    background: #F5F5DC;
    border-radius: 10px;
    text-align: center;
  `;

  // Create main content container with flexbox
  var mainContainer = document.createElement('div');
  mainContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 20px;
    justify-content: center;
  `;

  // Create control buttons container
  var controlButtons = document.createElement('div');
  controlButtons.className = 'control-buttons';
  controlButtons.style.cssText = `
    display: flex;
    gap: 10px;
    min-width: 120px;
  `;

  // Play button
  var playButton = document.createElement('button');
  playButton.id = 'playButton';
  playButton.className = 'play-btn';
  playButton.textContent = '▶️ Play';
  playButton.style.cssText = `
    padding: 10px 15px;
    background: grey;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  // playButton.addEventListener('mouseover', () => {
  //   playButton.style.background = '#45a049';
  // });
  // playButton.addEventListener('mouseout', () => {
  //   playButton.style.background = '#4CAF50';
  // });
  playButton.addEventListener('click', () => {
    if (window.rhythmGame) {
      this.playing ? window.rhythmGame.stop() : window.rhythmGame.play();
    }
  });

  // Stop button
  var stopButton = document.createElement('button');
  stopButton.id = 'stopButton';
  stopButton.className = 'stop-btn';
  stopButton.textContent = '⏹️ Stop';
  stopButton.style.cssText = `
    padding: 10px 15px;
    background: grey;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  // stopButton.addEventListener('mouseover', () => {
  //   stopButton.style.background = '#da190b';
  // });
  // stopButton.addEventListener('mouseout', () => {
  //   stopButton.style.background = '#f44336';
  // });
  stopButton.addEventListener('click', () => {
    if (window.rhythmGame) {
      window.rhythmGame.stop();
    }
  });

  // Clear button
  var clearButton = document.createElement('button');
  clearButton.id = 'clearButton';
  clearButton.className = 'clear-btn';
  clearButton.textContent = '🗑️ Clear All';
  clearButton.style.cssText = `
    padding: 10px 15px;
    background: grey;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
  // clearButton.addEventListener('mouseover', () => {
  //   clearButton.style.background = '#e68900';
  // });
  // clearButton.addEventListener('mouseout', () => {
  //   clearButton.style.background = '#ff9800';
  // });
  clearButton.addEventListener('click', () => {
    if (window.rhythmGame) {
      window.rhythmGame.clearAll();
    }
  });

  // Add buttons to control container
  controlButtons.appendChild(playButton);
  controlButtons.appendChild(stopButton);
  controlButtons.appendChild(clearButton);

  // Create note container
  var noteContainer = document.createElement('div');
  noteContainer.style.cssText = `
    display: flex;
    justify-content: center;
    flex: 1;
    gap: 20px;
    flex-wrap: wrap;
  `;

  // var paletteTitle = document.createElement('h3');
  // paletteTitle.textContent = '🎼 Drag Notes to the Train!';
  // paletteTitle.style.cssText = `
  //   margin: auto 0;
  //   color: #8B4513;
  //   font-size: 18px;
  // `;
  // noteContainer.appendChild(paletteTitle);

  this.noteTypes.forEach(function(noteType, index) {
    var noteElement = document.createElement('div');
    noteElement.className = 'note-block ' + noteType.name + '-note';
    noteElement.dataset.noteType = noteType.name;
    noteElement.draggable = true;
    noteElement.style.cssText = `
      width: 80px;
      height: 50px;
      background: ${noteType.color};
      border: 2px solid #333;
      border-radius: 8px;
      cursor: grab;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: black;
      font-weight: bold;
      font-size: 20px;
      transition: transform 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    
    // Add note symbol
    var symbol = '';
    switch (noteType.name) {
      case 'eighth': 
        symbol = '♪'; 
        noteElement.style.width = "40px";
        break;
      case 'quarter': 
        symbol = '♩'; 
        noteElement.style.width = "80px";
        break;
      case 'half': 
        symbol = '𝅗𝅥'; 
        noteElement.style.width = "160px";
        break;
      case 'whole': 
        symbol = '○'; 
        noteElement.style.width = "320px";
        break;
    }
    noteElement.innerHTML = symbol + '<div style="font-size: 13px; margin-top: 2px;">' + noteType.name + '</div>';
    
    noteElement.addEventListener('dragstart', this.handleDragStart.bind(this));
    noteElement.addEventListener('dragend', this.handleDragEnd.bind(this));
    
    noteContainer.appendChild(noteElement);
  }.bind(this));

  // Add control buttons and note container to main container
  mainContainer.appendChild(controlButtons);
  mainContainer.appendChild(noteContainer);

  palette.appendChild(mainContainer);
  this.trainContainer.appendChild(palette);
};

musicbox.MultiSequencer.prototype.getInstrumentIcon = function(row) {
  const icons = ['🔨', '🥁', '🔺', '🥽'];
  return icons[row] || '🎵';
};

musicbox.MultiSequencer.prototype.handleDragStart = function(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.noteType);
  e.target.style.opacity = '0.5';
};

musicbox.MultiSequencer.prototype.handleDragEnd = function(e) {
  e.target.style.opacity = '1';
};

musicbox.MultiSequencer.prototype.handleDragOver = function(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
  // e.currentTarget.dataset.background = e.currentTarget.style.backgroundColor;
  // e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
};

musicbox.MultiSequencer.prototype.handleDragLeave = function(e) {
  e.currentTarget.classList.remove('drag-over');
  // e.currentTarget.style.backgroundColor = e.currentTarget.dataset.background;
};

musicbox.MultiSequencer.prototype.handleDrop = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  // e.currentTarget.style.background = '';
  
  const noteType = e.dataTransfer.getData('text/plain');
  var dropZone = e.currentTarget;
  if (dropZone.classList.contains('placed-note')) {
    dropZone = dropZone.closest('.drop-zone');
  }
  const acceptedType = dropZone.dataset.accepts;
  
  if (noteType === acceptedType) {
    const row = parseInt(dropZone.closest('.train-row').dataset.row);
    this.addNoteToRow(row, noteType, e.offsetX);
  } else {
    this.showFeedback('Wrong train car! Try the correct colored row for this note.', 'error');
  }
};

musicbox.MultiSequencer.prototype.handleZoneClick = function(e) {
  var dropZone = e.currentTarget;
  if (dropZone.classList.contains('placed-note')) {
    dropZone = dropZone.closest('.drop-zone');
  }
  const rect = dropZone.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const row = parseInt(dropZone.closest('.train-row').dataset.row);
  
  // Check if clicking on an existing note to remove it
  const existingNote = this.findNoteAtPosition(row, clickX, dropZone);
  if (existingNote) {
    this.removeNote(row, existingNote.id);
  }
};

musicbox.MultiSequencer.prototype.addNoteToRow = function(row, noteType, xPosition) {
  // Find the specific drop zone that was clicked by using the event target
  var dropZone = event.target; // Use the actual drop zone that received the drop
  if (dropZone.classList.contains('placed-note')) {
    dropZone = dropZone.closest('.drop-zone');
  }
  const zoneWidth = dropZone.offsetWidth;
  
  // Calculate position as percentage
  const positionPercent = (xPosition / zoneWidth) * 100;
  
  // Snap to grid based on note type
  let snappedPosition = this.snapToGrid(positionPercent, noteType);
  
  // Check for overlaps
  if (this.checkOverlap(row, snappedPosition, noteType, dropZone)) {
    this.showFeedback('Notes overlap! Try a different position on the train.', 'error');
    return;
  }
  
  const noteId = Date.now() + Math.random();
  const noteData = {
    id: noteId,
    type: noteType,
    position: snappedPosition,
    row: row,
    group: parseInt(dropZone.dataset.group)
  };
  
  // Initialize placedNotes array if it doesn't exist
  if (!this.placedNotes) {
    this.placedNotes = {};
  }
  if (!this.placedNotes[row]) {
    this.placedNotes[row] = [];
  }
  
  this.placedNotes[row].push(noteData);
  this.renderNote(noteData, dropZone);
  this.updateSequencerFromNotes();
  this.showFeedback(`Note added to Carriage ${noteData.group + 1}! 🚂`, 'success');
};

musicbox.MultiSequencer.prototype.checkOverlap = function(row, position, noteType, dropZone) {
  const noteWidth = this.getNoteWidth(noteType);
  const noteEnd = position + noteWidth;
  
  if (!this.placedNotes || !this.placedNotes[row]) {
    return false;
  }
  
  return this.placedNotes[row].some(note => {
    // Only check notes in the same group/carriage
    if (note.group !== parseInt(dropZone.dataset.group)) {
      return false;
    }
    
    const existingWidth = this.getNoteWidth(note.type);
    const existingEnd = note.position + existingWidth;
    
    return (position < existingEnd && noteEnd > note.position);
  });
};

musicbox.MultiSequencer.prototype.renderNote = function(noteData, dropZone) {
  const noteElement = document.createElement('div');
  noteElement.className = `placed-note ${noteData.type}`;
  noteElement.dataset.noteId = noteData.id;
  noteElement.style.cssText = `
    position: absolute;
    top: 2px;
    left: ${noteData.position}%;
    width: ${this.getNoteWidth(noteData.type)}%;
    height: calc(100% - 4px);
    background: ${this.noteTypes[noteData.row % 4].color};
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: black;
    font-weight: bold;
    font-size: 25px;
    cursor: pointer;
    z-index: 1;
    border: 1px solid rgb(50,50,50);
  `;
  
  // Add note symbol
  let symbol = '';
  switch (noteData.type) {
    case 'eighth': symbol = '♪'; break;
    case 'quarter': symbol = '♩'; break;
    case 'half': symbol = '𝅗𝅥'; break;
    case 'whole': symbol = '○'; break;
  }
  noteElement.textContent = symbol;
  
  // Add click to remove functionality
  noteElement.addEventListener('click', (e) => {
    e.stopPropagation();
    this.removeNote(noteData.row, noteData.id);
  });
  
  dropZone.appendChild(noteElement);
};

musicbox.MultiSequencer.prototype.findNoteAtPosition = function(row, xPosition, dropZone) {
  const zoneWidth = dropZone.offsetWidth;
  const positionPercent = (xPosition / zoneWidth) * 100;
  
  if (!this.placedNotes || !this.placedNotes[row]) {
    return null;
  }
  
  return this.placedNotes[row].find(note => {
    // Only check notes in the same group/carriage
    if (note.group !== parseInt(dropZone.dataset.group)) {
      return false;
    }
    
    const noteStart = note.position;
    const noteEnd = note.position + this.getNoteWidth(note.type);
    return positionPercent >= noteStart && positionPercent <= noteEnd;
  });
};

musicbox.MultiSequencer.prototype.removeNote = function(row, noteId) {
  // Remove from data
  this.placedNotes[row] = this.placedNotes[row].filter(note => note.id !== noteId);
  
  // Remove from DOM
  const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
  if (noteElement) {
    noteElement.remove();
  }
  
  this.updateSequencerFromNotes();
  this.showFeedback('Note removed from the train! 🗑️', 'info');
};

musicbox.MultiSequencer.prototype.updateSequencerFromNotes = function() {
  // Convert placed notes to sequencer tracks
  for (var row = 0; row < 4; row++) {
    var track = new Array(16).fill(0);
    
    this.placedNotes[row].forEach(note => {
      const beatIndex = Math.floor(note.position / 6.25); // 6.25% per beat
      const noteWidth = this.getNoteWidth(note.type);
      const noteBeats = Math.ceil(noteWidth / 6.25);
      
      for (var i = 0; i < noteBeats && beatIndex + i < 16; i++) {
        track[beatIndex + i] = 1;
      }
    });
    
    // Update the sequencer track
    if (this.sequencers[row]) {
      this.sequencers[row].tracks[0] = track;
    }
  }
  
  // Don't trigger character animations here - they should only trigger during playback
};

musicbox.MultiSequencer.prototype.showFeedback = function(message, type) {
  // Create or update feedback element
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
  
  // Hide after 3 seconds
  setTimeout(() => {
    feedback.style.opacity = '0';
  }, 3000);
};

musicbox.MultiSequencer.prototype.snapToGrid = function(position, noteType) {
  const gridSize = 25; // 4 beats = 100% / 4 = 25% per beat
  
  switch (noteType) {
    case 'eighth':
      return Math.floor(position / (gridSize / 2)) * (gridSize / 2);
    case 'quarter':
      return Math.floor(position / gridSize) * gridSize;
    case 'half':
      return Math.floor(position / (gridSize * 2)) * (gridSize * 2);
    case 'whole':
      return Math.floor(position / (gridSize * 4)) * (gridSize * 4);
    default:
      return position;
  }
};

musicbox.MultiSequencer.prototype.getNoteWidth = function(noteType) {
  switch (noteType) {
    case 'eighth': return 12.5; // 0.5 beat
    case 'quarter': return 25; // 1 beat
    case 'half': return 50; // 2 beats
    case 'whole': return 100; // 4 beats
    default: return 25;
  }
};

musicbox.Sequencer = function (opts) {
  opts = aaf.utils.defaults(opts, {
    listeners: [
      aaf.common.noop,
      // aaf.common.noop,
      // aaf.common.noop
    ],

    symbols: [
      "assets/image/ui_timpani1.svg",
      // 'assets/image/ui_timpani2.svg',
      // 'assets/image/ui_timpani3.svg'
    ],

    tracks: [],
    randomize: true, // ignored if tracks are provided

    beats: 32,
    timeSignature: 8,
    bpm: 50,
  });

  this.samples = opts.samples;
  this.beats = opts.beats;
  this.timeSignature = opts.timeSignature;
  this.bpm = opts.bpm;

  this.tracks = [];

  this.position = 0;
  this.playing = false;

  var samplePaths = {};
  var synthParams = {
    envelope: {
      // release: 0.2
    },
  };

  this.listeners = opts.listeners;
  this.trackNames = [];

  this.animateNoteListeners = {};
  this.needsAnimate = {};

  for (var i = 0, l = this.samples.length; i < l; i++) {
    var track;

    if (opts.tracks) {
      track = opts.tracks[i];
    } else if (opts.randomize) {
      track = aaf.utils.array.fill(new Array(this.beats), false);

      for (var j = 0, k = track.length; j < k; j++) {
        track[j] = aaf.random.chance();
      }
    } else {
      track = aaf.utils.array.fill(new Array(this.beats), false);
    }

    this.tracks.push(track);

    this.trackNames.push(i.toString());
    samplePaths[i.toString()] = this.samples[i];

    this.needsAnimate[i] = aaf.utils.array.fill(new Array(this.beats), false);

    // Bound versions of each animate note method so we're not instantiating them every beat.
    var listeners = [];
    this.animateNoteListeners[i] = listeners;

    for (var b = 0; b < this.beats; b++) {
      listeners[b] = this.animateNote.bind(this, i, b);
    }
  }

  this.onInterval = this.onInterval.bind(this);

  this.stepNumber = 0;
  this.dragOperation = true;

  this.sampler = new Tone.PolySynth(1, Tone.Sampler, samplePaths, synthParams);
  this.sampler.noGC();

  this.buildDom(opts);

  // further hackiness, sequencer-padding-horizontal * 2 = 40
  // defined in sequencer.styl
  this.sequencerInnerWidth = this.domElement.offsetWidth - 40;

  this.sampler.toMaster();
};

musicbox.Sequencer.UI_MODE = aaf.common.url.ui || "css";
musicbox.Sequencer.USE_CSS_TRANSITIONS = aaf.common.url.boolean(
  "transition",
  true
);

// Audio
// -------------------------------

musicbox.Sequencer.prototype.start = function () {
  // hack: belongs in resize. sequencer-padding-horizontal * 2 = 40
  // defined in sequencer.styl
  this.sequencerInnerWidth = this.domElement.offsetWidth - 40;

  this.stepNumber = 0;

  // Reset playhead position
  if (this.parentMultiSequencer) {
    this.parentMultiSequencer.resetPlayhead();
  }

  var intervalLength = (this.beats / this.timeSignature) * 4 + "n";

  Tone.Transport.loopEnd = this.beats + "*8n";

  Tone.Transport.clear(this.intervalID);
  this.intervalID = Tone.Transport.scheduleRepeat(this.onInterval, "16n");
  this.time = 0;

  this.startTime = Tone.context.currentTime;
  this.prevTime = this.startTime;

  this.playing = true;

  Tone.Transport.timeSignature = this.timeSignature;

  // console.log('debug number', document.getElementById('BPMnumber').innerHTML);
  Tone.Transport.bpm.value = this.bpm;
  // Tone.Transport.bpm.value = document.getElementById("BPMnumber").innerHTML / 2;
  this.measureLength = Tone.Transport.notationToSeconds("1m");

  this.sampler.volume.cancelScheduledValues();

  Tone.Transport.start();

  //this.sampler.volume.value = -100;
  //this.sampler.volume.setRampPoint();
  //this.sampler.volume.linearRampToValueAtTime( 0, '+4n' )
};

musicbox.Sequencer.prototype.stop = function () {
  this.playing = false;

  for (var i = 0, l = this.tracks.length; i < l; i++) {
    for (var j = 0; j < this.beats; j++) {
      this.triggerAnimation(i, j, false);
    }
  }

  this.sampler.volume.cancelScheduledValues();

  // this.sampler.volume.setRampPoint();
  // this.sampler.volume.linearRampToValueAtTime( -100, '+4n' )

  Tone.Transport.stop();
};

musicbox.Sequencer.prototype.animateNote = function (track, beat) {
  this.needsAnimate[track][beat] = true;

  setTimeout(
    function () {
      this.needsAnimate[track][beat] = false;
    }.bind(this),
    this.sampler.toSeconds("16n") * 1000
  );
};

musicbox.Sequencer.prototype.onInterval = function (time) {
  if (!this.playing) return;

  // see if there's any active beats at this step number
  var millis = (time - Tone.Transport.currentTime) * 1000;

  // Update playhead position
  if (this.parentMultiSequencer) {
    this.parentMultiSequencer.updatePlayheadFromSequencer(this.index, this.stepNumber);
  }

  var group = Math.floor(this.stepNumber / this.timeSignature);
  var position = (this.stepNumber % this.timeSignature) * 12.5;
  var noteIndex = this.parentMultiSequencer.placedNotes[Math.abs(this.index - 3)].findIndex(note => note.group == group && note.position == position);
  if (noteIndex !== -1) {
    // this.parentMultiSequencer.placedNotes[this.index].splice(noteIndex, 1);
    this.sampler.triggerAttackRelease(this.trackNames["0"], "1n", time);

    // TODO: create these listeners up front.
    var listener = this.animateNote.bind( this, 0, this.stepNumber );
    // var listener = this.listeners[i];

    // schedule beat animation
    setTimeout(this.animateNoteListeners[0][this.stepNumber], millis);
    listener(0.1);
    
    // Trigger character animation if rhythm game is available
    if (window.rhythmGame && window.rhythmGame.pairs) {
      // Find which character this sequencer corresponds to
      var sequencerIndex = window.multiSequencer.sequencers.indexOf(this);
      if (sequencerIndex !== -1 && window.rhythmGame.pairs[sequencerIndex]) {
        var pair = window.rhythmGame.pairs[sequencerIndex];
        // Trigger the character animation
        pair.small(0.085);
      }
    }
  }

  // advance step number

  this.stepNumber++;
  this.stepNumber %= this.beats;
};

// UI
// -------------------------------

musicbox.Sequencer.prototype.update = function () {
  if (!this.playing) return;

  // Android gives really shitty audio update rates, makes the playhead look choppy.
  // Check to see if the audio context reports two of the same currentTimes in a row
  // and then manually smooth the playhead using loop delta.

  var t = Tone.context.currentTime;

  // if ( t === this.prevTime ) {
  //     this.time += aaf.common.loop.delta;
  // } else {
  //     this.time = Math.max( t, this.time );
  // }

  this.prevTime = t;

  // update sequencer "position" ( 0-1 progress through the measure )

  this.position = Tone.Transport.progress; //( this.time - this.startTime ) / this.measureLength % 1;

  // update playhead display

  if (musicbox.Sequencer.UI_MODE === "css") this.updateStyles();
};

musicbox.Sequencer.prototype.updateStyles = function () {
  var str = "translate3d(";
  str += this.position * this.sequencerInnerWidth;
  str += "px, 0, 0 )";

  for (var i in this.needsAnimate) {
    for (var j in this.needsAnimate[i]) {
      var val = this.needsAnimate[i][j];
      if (val !== undefined) {
        this.triggerAnimation(i, j, val);
      }
    }
  }

  this.playhead.style.transform = this.playhead.style.webkitTransform = str;

  for (var i in this.needsAnimate) {
    for (var j in this.needsAnimate[i]) {
      this.needsAnimate[i][j] = undefined;
    }
  }
};

musicbox.Sequencer.prototype.triggerAnimation = function (i, j, val) {
  var symbol = this.slotElements[i][j].__symbol;

  symbol.style.webkitTransform = symbol.style.transform = val
    ? "scale( 1.5 )"
    : "";

  symbol.style.webkitTransitionDuration = symbol.style.transitionDuration =
    val || !musicbox.Sequencer.USE_CSS_TRANSITIONS ? "0s" : "";
};

musicbox.Sequencer.prototype.buildDom = function (opts) {
  this.domElement = document.createElement("div");
  this.domElement.className = "sequencer";

  this.slotElements = [];

  // create track rows

  for (var track = 0, l = this.tracks.length; track < l; track++) {
    var row = document.createElement("div");
    row.className = "row";

    var elements = [];

    // create track beat slots

    for (var beat = 0; beat < this.beats; beat++) {
      var slot = document.createElement("div");
      slot.className = "slot";

      var symbol = document.createElement("div");
      symbol.style.backgroundImage = "url( " + opts.symbols[track] + " )";
      symbol.className = "symbol";

      // convenience access to per-beat get/setter methods
      slot.__symbol = symbol;
      slot.__setBeat = this.setBeat.bind(this, track, beat, slot);
      slot.__getBeat = this.getBeat.bind(this, track, beat);

      var toggle = this.touchSlot.bind(this, track, beat, slot);

      // update initial display
      slot.__setBeat(this.tracks[track][beat], true);

      slot.appendChild(symbol);
      row.appendChild(slot);
      elements.push(slot);

      slot.addEventListener(
        aaf.common.ua.touch ? "touchstart" : "mousedown",
        toggle,
        false
      );
    }

    this.domElement.appendChild(row);
    this.slotElements.push(elements);
  }

  // playhead

  this.playhead = document.createElement("div");
  this.playhead.className = "playhead";

  // this.domElement.appendChild( this.playhead );

  // make drag listener

  var hover, prevHover;

  // lil hacky, set by multisequencer
  this.active = true;

  aaf.common.pointer.on(
    "drag",
    function (x, y) {
      if (!this.active) return;

      prevHover = hover;
      hover = document.elementFromPoint(x, y);

      // __setBeat is sort of dirty duck typing to make sure we're
      // even talking about a slot on the sequencer.
      if (hover && hover !== prevHover && hover.__setBeat) {
        hover.__setBeat(this.dragOperation);
      }
    },
    this
  );
};

musicbox.Sequencer.prototype.touchSlot = function (track, beat, el, val) {
  this.dragOperation = this.toggleBeat(track, beat, el, val);
};

musicbox.Sequencer.prototype.setBeat = function (
  track,
  beat,
  el,
  val,
  suppressSample
) {
  var same = this.tracks[track][beat] === val;

  this.tracks[track][beat] = val;
  el.__symbol.classList.toggle("active", val);

  if (val && !same && !this.playing && suppressSample !== true) {
    this.triggerSample(track);
    this.listeners[track](0.15);
  }

  return val;
};

musicbox.Sequencer.prototype.triggerSample = function (track, vel) {
  if (vel === undefined) {
    vel = 1;
  }
  if (!this.playing)
    Tone.Transport.clear(this.intervalID);
  this.sampler.volume.value = 0; // volume is in dB so this actually unmutes
  this.sampler.triggerAttackRelease(
    this.trackNames[track],
    "1n",
    Tone.context.currentTime,
    vel
  );
};

musicbox.Sequencer.prototype.getBeat = function (track, beat) {
  return this.tracks[track][beat];
};

musicbox.Sequencer.prototype.toggleBeat = function (track, beat, el) {
  return this.setBeat(track, beat, el, !this.getBeat(track, beat));
};

// Perform mobile touchstart operations
(function () {
  var ua = navigator.userAgent;
  var isTouch = "ontouchstart" in document.documentElement;
  var ios = ua.match(/iPhone|iPad|iPod/i);
  var outerDiv = document.createElement("div");
  var innerDiv = document.createElement("div");

  var style = document.createElement("style");
  style.innerText = "#start:active, #start:focus { transform: scale(1.1); };";
  document.head.appendChild(style);

  if (isTouch || ios) {
    outerDiv.style.top = 0;
    outerDiv.style.left = 0;
    outerDiv.style.position = "absolute";
    outerDiv.style.height = "100%";
    outerDiv.style.width = "100%";
    outerDiv.style.textAlign = "center";
    outerDiv.style.zIndex = 99999;

    innerDiv.style.borderRadius = "5px";
    innerDiv.style.font = "normal 4vmin/6vmin Poppins, Helvetica, Arial";
    innerDiv.style.color = "white";
    innerDiv.style.margin = "0 auto";
    innerDiv.style.zIndex = 999;
    innerDiv.style.textAlign = "center";
    innerDiv.style.padding = "10px";

    if (ios) {
      innerDiv.style.background = "#707070";
      innerDiv.style.marginTop = "15%";
      innerDiv.style.width = "75%";
      innerDiv.innerText =
        "Heads up — if you have your iOS device in Silent Mode, audio playback is affected.";
    } else {
      outerDiv.style.display = "flex";
      outerDiv.style.alignItems = "center";
      outerDiv.style.background = "#fff";
      innerDiv.style.padding = "0";
      innerDiv.id = "start";
      innerDiv.style.width = "5pc";
      innerDiv.style.height = "5pc";
      innerDiv.style.display = "flex";
      innerDiv.style.alignItems = "center";
      innerDiv.style.justifyContent = "center";
      innerDiv.style.lineHeight = "5pc";
      innerDiv.style.backgroundColor = "#fff";
      innerDiv.style.boxShadow = "0 0 10px 0 rgba(0, 0, 0, 0.4)";
      innerDiv.style.borderRadius = "50%";
      innerDiv.style.color = "#646464";
      innerDiv.style.transition = "transform .05s ease-in";
      innerDiv.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/><path d="M0 0h24v24H0z" fill="none"/></svg>';
    }

    outerDiv.appendChild(innerDiv);
    document.body.appendChild(outerDiv);
  }

  var start = !ios && isTouch ? document.querySelector("#start") : window;
  var event = !ios && isTouch ? "touchend" : "touchstart";

  start.addEventListener(
    event,
    function firstTouch() {
      innerDiv.style.display = "none";

      setTimeout(function () {
        outerDiv.style.display = "none";
      }, 50);

      if (Tone.context.state !== "running") {
        Tone.context.resume();
      }

      start.removeEventListener(event, firstTouch, false);
    },
    false
  );
})();

musicbox.config.conga.characterSmall = {
  position: {
    x: 380,
    y: 350,
  },

  eyes: {
    position: {
      x: 0,
      y: -165,
    },
    scale: 0.79,
    color: 0x100d11,
  },

  hitbox: {
    small: {
      x: -70,
      y: -500,
      width: 500,
      height: 900,
    },
  },

  strikeBoth: {
    anticipation: 0.15,
  },

  armLeft: {
    texture: "texture/slices_dog-little-arm-left.png",
    position: { x: 0, y: 0 },
    animation: {
      rotation: {
        file: "json/conga-little-arms.json",
        layer: "C_guy2 armL-rotation",
      },
    },
  },

  stickLeft: {
    texture: "texture/slices_dog-little-stick-left.png",
    position: { x: -16, y: 10 },
    behindArms: true,
    animation: {
      rotation: {
        file: "json/conga-little-arms.json",
        layer: "C_guy2 stickL-rotation",
      },
    },
  },

  armRight: {
    texture: "texture/slices_dog-little-arm-right.png",
    position: { x: 85, y: 0 },
    back: true,
    animation: {
      rotation: {
        file: "json/conga-little-arms.json",
        layer: "C_guy2 armR-rotation",
      },
    },
  },

  face: {
    texture: "texture/slices_dog-little-face.png",
    position: { x: -0, y: -80 },
  },

  body: {
    texture: "texture/slices_dog-little-body.png",
    position: { x: 160, y: 200 },
  },

  legs: {
    texture: "texture/slices_dog-little-legs.png",
    position: { x: 160, y: 220 },
  },
};

musicbox.config.conga.sequencer = {
  // beats: 12,
  // timeSignature: 6,
  bpm: 40,

  samples: [
    "assets/sample/conga-cowbell.mp3",
    // 'assets/sample/conga-high.mp3',
    // 'assets/sample/conga-low.mp3'
  ],

  symbols: [
    "assets/image/ui_congas1.svg",
    // 'assets/image/ui_congas2.svg',
    // 'assets/image/ui_congas3.svg'
  ],

  order: [
    "small",
    // 'left',
    // 'right'
  ],

  tracks: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // [0,0,0,0,0,0,0,0,0,0,0,0],// [0,0,0,1,0,0,0,0,1,0,0,1],
    // [0,0,0,0,0,0,0,0,0,0,0,0]// [1,0,0,0,0,0,1,1,0,0,1,0]
  ],
};

musicbox.config.cymbals.characterSmall = {
  position: {
    x: 420,
    y: 320,
  },

  eyes: {
    position: {
      x: -25,
      y: -195,
    },
    scale: 1.13,
    color: 0x100d11,
  },

  hitbox: {
    small: {
      x: -100,
      y: -500,
      width: 650,
      height: 900,
    },
  },

  strikeBoth: {
    anticipation: 0.15,
  },

  armLeft: {
    texture: "texture/slices_crocodile-little-arm-left.png",
    position: { x: 0, y: 0 },
    animation: {
      rotation: {
        file: "json/crocodile-little-arms.json",
        layer: "C_guy2 armL-rotation",
      },
    },
  },

  stickRight: {
    texture: "texture/slices_crocodile-little-stick-right.png",
    position: { x: 18, y: -15 },
    behindArms: true,
    animation: {
      rotation: {
        file: "json/crocodile-little-arms.json",
        layer: "C_guy2 mallet-rotation",
      },
    },
  },

  armRight: {
    texture: "texture/slices_crocodile-little-arm-right.png",
    position: { x: 50, y: 3 },
    animation: {
      rotation: {
        file: "json/crocodile-little-arms.json",
        layer: "C_guy2 armR-rotation",
      },
    },
  },

  body: {
    texture: "texture/slices_crocodile-little-body.png",
    position: { x: 150, y: 180 },
  },

  // front: {
  //   texture: "texture/slices_bass-drum.png",
  //   position: { x: 150, y: 350 },
  // },

  legs: {
    texture: "texture/slices_crocodile-little-legs.png",
    position: { x: 120, y: 220 },
  },
};

musicbox.config.cymbals.sequencer = {
  // beats: 8,
  // timeSignature: 4,
  bpm: 40,

  samples: [
    // 'assets/sample/kit-hat.mp3',
    // 'assets/sample/kit-snare.mp3',
    "assets/sample/crymbal1.mp3",
  ],
  symbols: [
    // 'assets/image/ui_drums1.svg',
    // 'assets/image/ui_drums2.svg',
    "assets/image/ui_drums3.svg",
  ],

  order: [
    // 'right',
    // 'left',
    "small",
  ],

  tracks: [
    // [0,0,0,0,0,0,0,0], // [1,1,1,1,1,1,1,1],
    // [0,0,0,0,0,0,0,0], // [0,0,1,0,0,0,1,0],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
};

musicbox.config.triangle.characterSmall = {
  position: {
    x: 450,
    y: 470,
  },

  eyes: {
    position: {
      x: 0,
      y: -210,
    },
    scale: 0.79,
    color: 0x100d11,
  },

  hitbox: {
    small: {
      x: -150,
      y: -500,
      width: 650,
      height: 900,
    },
  },

  face: {
    texture: "texture/slices_pig-little-face.png",
    position: { x: 0, y: -170 },
  },

  strikeBoth: {
    sample: "sample/timpani-triangle.mp3",
    anticipation: 0.25,
  },

  armLeft: {
    texture: "texture/slices_pig-little-arm-left.png",
    position: { x: 0, y: 0 },
    animation: {
      rotation: {
        file: "json/timpani-little-arms.json",
        layer: "C_guy2 armL-rotation",
      },
    },
  },

  stickLeft: {
    texture: "texture/slices_timpani-little-stick-left.png",
    position: { x: -5, y: 12 },
    animation: {
      rotation: {
        file: "json/timpani-little-arms.json",
        layer: "C_guy2 stickL-rotation",
      },
    },
  },

  armRight: {
    texture: "texture/slices_pig-little-arm-right.png",
    position: { x: 58, y: 0 },
    animation: {
      rotation: {
        file: "json/timpani-little-arms.json",
        layer: "C_guy2 armR-rotation",
      },
    },
  },

  stickRight: {
    texture: "texture/slices_timpani-little-stick-right.png",
    position: { x: 15, y: -5 },
    animation: {
      rotation: {
        file: "json/timpani-little-arms.json",
        layer: "C_guy2 chime holder-rotation",
      },
    },
  },

  body: {
    texture: "texture/slices_pig-little-body.png",
    position: { x: 120, y: 135 },
  },

  legs: {
    texture: "texture/slices_pig-little-legs.png",
    position: { x: 125, y: 120 },
  },
};

musicbox.config.triangle.sequencer = {
  // beats: 6,
  // timeSignature: 3,
  bpm: 40,

  samples: [
    "assets/sample/triangle2.mp3",
    // 'assets/sample/timpani-high.mp3',
    // 'assets/sample/timpani-low.mp3'
  ],

  symbols: [
    "assets/image/ui_timpani1.svg",
    // 'assets/image/ui_timpani2.svg',
    // 'assets/image/ui_timpani3.svg'
  ],

  order: [
    "small",
    // 'left',
    // 'right'
  ],

  tracks: [
    [0, 0, 0, 0, 0, 0], // [1,0,0,0,0,0],
    // [0,0,0,0,0,0], // [0,1,1,0,1,1],
    // [1,0,0,0,1,0]
  ],
};

musicbox.config.woodblock.characterSmall = {
  position: {
    x: 450,
    y: 460,
  },

  strikeBoth: {
    anticipation: 0.25,
  },

  hitbox: {
    small: {
      x: -110,
      y: -500,
      width: 530,
      height: 800,
    },
  },

  armLeft: {
    texture: "texture/slices_chicken-little-arm-left.png",
    position: { x: 1, y: 1 },
    animation: {
      rotation: {
        file: "json/robot-little-arms.json",
        layer: "guy2 armL-rotation",
      },
    },
  },

  stickLeft: {
    texture: "texture/slices_chicken-little-stick-left.png",
    position: { x: 10, y: 8 },
    behindArms: true,
    animation: {
      rotation: {
        file: "json/robot-little-arms.json",
        layer: "guy2 stickL-rotation",
      },
    },
  },

  armRight: {
    texture: "texture/slices_chicken-little-arm-right.png",
    position: { x: 55, y: 0 },
    animation: {
      rotation: {
        file: "json/robot-little-arms.json",
        layer: "guy2 armR-rotation",
      },
    },
  },

  stickRight: {
    texture: "texture/slices_chicken-little-stick-right.png",
    position: { x: -9, y: 15 },
    behindArms: true,
    animation: {
      rotation: {
        file: "json/robot-little-arms.json",
        layer: "guy2 stickR-rotation",
      },
    },
  },

  body: {
    texture: "texture/slices_chicken-little-body.png",
    position: { x: 120, y: 135 },
  },

  legs: {
    texture: "texture/slices_chicken-little-legs.png",
    position: { x: 120, y: 118 },
  },

  face: {
    texture: "texture/slices_chicken-little-face.png",
    position: { x: -5, y: -200 },
  },

  eyes: {
    position: { x: 0, y: -200 },
    scale: 0.79,
    color: 0x100d11,
  },
};

musicbox.config.woodblock.sequencer = {
  // beats: 10,
  // timeSignature: 5,
  bpm: 40,

  samples: [
    "assets/sample/robot-clave.mp3",
    // 'assets/sample/robot-high.mp3',
    // 'assets/sample/robot-low.mp3'
  ],

  symbols: [
    "assets/image/ui_woodblocks1.svg",
    // 'assets/image/ui_woodblocks2.svg',
    // 'assets/image/ui_woodblocks3.svg'
  ],

  order: [
    "small",
    // 'right',
    // 'left'
  ],

  tracks: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // [0,0,0,0,0,0,0,0,0,0],
    // [0,0,0,0,0,0,0,0,0,0]
  ],
};
