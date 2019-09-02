'use strict';

/* ---------- system ---------- */

const SYS_VER = '0.0.2';
const SYS_TITLE = 'FPV Enhancer (prototype) Ver.' + SYS_VER;
const DEBUG_ENABLED = false;

var sysFrameRate, sysSkipFrame;
var fpsCalcFrames, fpsCalcStTime, fpsCalcEdTime;

var getElement = function (id) {
  var obj = document.getElementById(id);
  if (obj == null) {
    console.error('cannot get object: ' + id);
  }
  return obj;
}

var drawSysStat = function () {
  fpvCanvas.fillStyle = 'white';
  fpvCanvas.font = '24px arial';
  fpvCanvas.fillText(SYS_TITLE, 5, 29);
  fpvCanvas.fillStyle = 'yellow';
  fpvCanvas.font = '16px arial';
  fpvCanvas.fillText(sysFrameRate + ' fps',
                     VIDEO_WIDTH - 50, VIDEO_HEIGHT - 5);
}

var update = function () {
  // framerate
  if (sysSkipFrame == true) {
    sysSkipFrame = false;
    window.requestAnimationFrame(update);
    return;
  }
  var t1, t2;
  t1 = new Date().getTime();
  fpsCalcEdTime = t1;
  fpsCalcFrames++;
  // main
  readPropo();
  drawCanvasVideo();
  detectArMarkers();
  drawCanvasLayer();
  // framerate
  if (fpsCalcEdTime - fpsCalcStTime >= 1000) {
    sysFrameRate = fpsCalcFrames;
    fpsCalcFrames = 0;
    fpsCalcStTime = fpsCalcEdTime;
  }
  /* xxx for debug
  t2 = new Date().getTime();
  console.log(t2 - t1); // xxx for debug
  if ((t2 - t1) < 17) {
    sysSkipFrame = true; // xxx for debug
  }
  */
  window.requestAnimationFrame(update);
}

var initSystem = function () {
  // environment
  var ua = window.navigator.userAgent.toLowerCase();
  if (ua.indexOf('chrome') === -1) {
    console.error('invalid user-agent: ' + ua);
    alert('Please use Google Chrome');
    return;
  }
  // fps
  sysSkipFrame = false;
  sysFrameRate = 0;
  fpsCalcFrames = 0;
}

var init = function () {
  initSystem();
  initVideo();
  initCanvas();
  initPropo();
  initAr();
  fpsCalcStTime = new Date().getTime();
  window.requestAnimationFrame(update);
}

window.onload = function () {
  init();
}

/* ---------- canvas ---------- */

const ELMID_FPVCANV = 'fpv_canvas';
var fpvCanvas;

var drawCanvasVideo = function () {
  drawVideo();
}
var drawCanvasLayer = function () {
  drawAr();
  drawPropo();
  drawSysStat();
}

var initCanvas = function () {
  var cve = getElement(ELMID_FPVCANV);
  cve.width = VIDEO_WIDTH;
  cve.height = VIDEO_HEIGHT;
  fpvCanvas = cve.getContext('2d');
}

/* ---------- video ---------- */

const VIDEO_DEV_NAME = 'USB2.0 PC CAMERA';
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const ELMID_FPVSRC = 'fpv_source';

var videoFound, videoReady, videoSource;

var drawVideo = function () {
  if (videoReady == true) {
    fpvCanvas.drawImage(videoSource, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  } else {
    // bluescreen
    fpvCanvas.fillStyle = "rgb(0, 0, 127)";
    fpvCanvas.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  }
}

var attachVideoStream = function (did) {
  var constraints = {
    audio: false,
    video: {
      deviceId: did
    }
  };
  navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
      videoSource.srcObject = stream;
      videoReady = true;
    }).catch(function (err) {
      console.error('getUserMedia ERROR: ' + err);
    });
}

var initVideo = function () {
  videoFound = false;
  videoReady = false;
  videoSource = getElement(ELMID_FPVSRC);
  navigator.mediaDevices.enumerateDevices()
    .then(function (devices) {
      devices.forEach(function (dev) {
        if (videoFound == true || dev.kind != 'videoinput') {
          return;
        }
        if (dev.label === '') {
          console.error('cannot access camera');
          alert('Please allow camera access');
          return;
        }
        console.log(dev.label, dev.deviceId);
        if (dev.label.indexOf(VIDEO_DEV_NAME) !== -1) {
          videoFound = true;
          attachVideoStream(dev.deviceId);
          console.log(' -> attached');
        } else {
          console.log(' -> skipped');
        }
      });
      if (videoFound == false) {
        alert('No FPV receiver');
      }
    })
    .catch(function (err) {
      console.error('enumerateDevide ERROR: ' + err);
    });
}

/* ---------- propo ---------- */

const PROPO_BG_STYLE = "rgba(0, 0, 0, 0.5)";
const PROPO_BG_WIDTH = 260;
const PROPO_BG_HEIGHT = 140;
const PROPO_BG_X = (VIDEO_WIDTH - PROPO_BG_WIDTH) / 2;
const PROPO_BG_Y = VIDEO_HEIGHT - PROPO_BG_HEIGHT;
const PROPO_IN_MIN = -0.8;
const PROPO_IN_MAX = 0.8;
const PROPO_POS_OFFSET = 9;
const PROPO_POS_MIN = 0;
const PROPO_POS_MAX = 98;
const PROPO_L_XMIN = PROPO_BG_X + 20;
const PROPO_L_XMAX = PROPO_L_XMIN + PROPO_POS_MAX;
const PROPO_L_YMIN = PROPO_BG_Y + 20;
const PROPO_L_YMAX = PROPO_L_YMIN + PROPO_POS_MAX;
const PROPO_R_XMIN = PROPO_BG_X + 140;
const PROPO_R_XMAX = PROPO_R_XMIN + PROPO_POS_MAX;
const PROPO_R_YMIN = PROPO_L_YMIN;
const PROPO_R_YMAX = PROPO_L_YMAX;

var rollVal, pitchVal, thrVal, yawVal;
var propoCordImg, propoPosImg;

var drawPropo = function () {
  // -- calc --
  var tmp, lx, ly, rx, ry;
  // yaw
  tmp = Math.min(Math.max(yawVal, PROPO_IN_MIN), PROPO_IN_MAX);
  tmp = calcPosition(tmp);
  lx = PROPO_L_XMIN + tmp - PROPO_POS_OFFSET;
  // throttle
  tmp = Math.min(Math.max(thrVal, PROPO_IN_MIN), PROPO_IN_MAX);
  tmp = calcPosition(tmp);
  ly = PROPO_L_YMAX - tmp - PROPO_POS_OFFSET;
  // roll
  tmp = Math.min(Math.max(rollVal, PROPO_IN_MIN), PROPO_IN_MAX);
  tmp = calcPosition(tmp);
  rx = PROPO_R_XMIN + tmp - PROPO_POS_OFFSET;
  // pitch
  tmp = Math.min(Math.max(pitchVal, PROPO_IN_MIN), PROPO_IN_MAX);
  tmp = calcPosition(tmp);
  ry = PROPO_R_YMAX - tmp - PROPO_POS_OFFSET;
  // -- draw --
  // background
  fpvCanvas.fillStyle = PROPO_BG_STYLE;
  fpvCanvas.fillRect(PROPO_BG_X, PROPO_BG_Y, PROPO_BG_WIDTH, PROPO_BG_HEIGHT);
  // cordinate
  fpvCanvas.drawImage(propoCordImg, PROPO_BG_X, PROPO_BG_Y);
  // position
  fpvCanvas.drawImage(propoPosImg, lx, ly);
  fpvCanvas.drawImage(propoPosImg, rx, ry);
}

var calcPosition = function (input) {
  return PROPO_POS_MIN + ((PROPO_POS_MAX - PROPO_POS_MIN) * ((input - PROPO_IN_MIN) / (PROPO_IN_MAX - PROPO_IN_MIN)));
}

var readPropo = function () {
  var list = navigator.getGamepads();
  if (list.length == 0) {
    return;
  }
  var pad = list[0];
  if (pad == null || pad.axes == null) {
    return;
  }
  var log;
  if (DEBUG_ENABLED == true) {
    log = 'input:';
  }
  for (var i = 0; i < pad.axes.length; i++) {
    switch (i) {
    case 0: // roll
      rollVal = pad.axes[i].toFixed(3);
      break;
    case 1: // pitch
      pitchVal = pad.axes[i].toFixed(3);
      break;
    case 2: // throttle
      thrVal = pad.axes[i].toFixed(3);
      break;
    case 4: // yaw (!3)
      yawVal = pad.axes[i].toFixed(3);
      break;
    }
    if (DEBUG_ENABLED == true) {
      log = log + ' ' + pad.axes[i].toFixed(3);
    }
  }
  if (DEBUG_ENABLED == true) {
    console.log(log);
  }
}

var initPropo = function () {
  // image
  propoCordImg = new Image();
  propoPosImg = new Image();
  propoCordImg.src = "img/propo_cord.png";
  propoPosImg.src = "img/propo_pos.png";
  // input
  rollVal = 0;
  pitchVal = 0;
  thrVal = -1;
  yawVal = 0;
}

/* ---------- AR ---------- */

var arDetector, arMarkers;

var drawArCorners = function (context, markers) {
  var corners, corner, i, j;
  context.lineWidth = 3;
  for (i = 0; i !== markers.length; ++i) {
    corners = markers[i].corners;

    context.strokeStyle = "red";
    context.beginPath();
    for (j = 0; j !== corners.length; ++j) {
      corner = corners[j];
      context.moveTo(corner.x, corner.y);
      corner = corners[(j + 1) % corners.length];
      context.lineTo(corner.x, corner.y);
    }
    context.stroke();
    context.closePath();

    context.strokeStyle = "green";
    context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
  }
}

var drawArIds = function (context, markers) {
  var corners, corner, x, y, i, j;
  context.strokeStyle = "blue";
  context.lineWidth = 1;
  for (i = 0; i !== markers.length; ++i) {
    corners = markers[i].corners;
    x = Infinity;
    y = Infinity;
    for (j = 0; j !== corners.length; ++j) {
      corner = corners[j];
      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }
    context.strokeText(markers[i].id, x, y)
  }
}

var drawAr = function () {
  drawArCorners(fpvCanvas, arMarkers);
  drawArIds(fpvCanvas, arMarkers);
}

var detectArMarkers = function () {
  var imgdata = fpvCanvas.getImageData(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  arMarkers = arDetector.detect(imgdata);  
  // console.log(arMarkers); // xxx for debug
}

var initAr = function () {
  arDetector = new AR.Detector();
}