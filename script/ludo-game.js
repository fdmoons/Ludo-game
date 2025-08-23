// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyAG87kxJWSsOWvx_nFEBdSbYIgJKgGDJ6Q",
  authDomain: "ludofree-67c14.firebaseapp.com",
  projectId: "ludofree-67c14",
  storageBucket: "ludofree-67c14.firebasestorage.app",
  messagingSenderId: "400295435194",
  appId: "1:400295435194:web:d625640d2fdbec69af1b83",
  databaseURL: "https://ludofree-67c14-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let playerNo = 0; // (red=1, green=2, yellow=3, blue=4)
let playerName = null;
let diceBoxId = null;
let preDiceBoxId = null;
let rndmNo = null;
let countSix = 0;
let cut = false;
let pass = false;
let flag = false;
let noOfPlayer = 4; // Default
let winningOrder = [];
let sound = true;
let roomId = null;
let myPlayerId = null;
let isTeamMode = false;
let teamColors = {};

// Audio Variables
let rollAudio = new Audio("../music/diceRollingSound.mp3");
let openAudio = new Audio("../music/open-sound.wav");
let jumpAudio = new Audio("../music/jump-sound.mp3");
let cutAudio = new Audio("../music/cut-sound.wav");
let passAudio = new Audio("../music/pass-sound.mp3");
let winAudio = new Audio("../music/win-sound.mp3");

// Object Declarations
function Position(length) {
  for (let i = 1; i <= length; i++) {
    this[i] = [];
  }
}

function Player(startPoint, endPoint) {
  this.inArea = [];
  this.outArea = [];
  this.privateArea = [];
  this.winArea = [];
  this.startPoint = startPoint;
  this.endPoint = endPoint;
  this.privateAreaPos = new Position(5);
}

let players = {
  rPlayer: new Player("out1", "out51"),
  gPlayer: new Player("out14", "out12"),
  yPlayer: new Player("out27", "out25"),
  bPlayer: new Player("out40", "out38"),
};

let outAreaPos = new Position(52);

// Firebase Room Logic
function joinRoom() {
  const code = $("#roomCode").val().trim();
  if (!code) {
    $("#roomStatus").text("कोड डालें!");
    return;
  }
  roomId = code;
  myPlayerId = Math.random().toString(36).substring(2, 10); // Unique player ID

  db.ref(`rooms/${roomId}`).once('value', (snapshot) => {
    let room = snapshot.val() || { players: [], gameState: {}, started: false };
    if (room.players.length >= 4) {
      $("#roomStatus").text("रूम फुल है!");
      return;
    }
    room.players.push({ id: myPlayerId, colors: [] });
    db.ref(`rooms/${roomId}`).set(room);
    $("#roomStatus").text("कनेक्टेड! खिलाड़ियों का इंतज़ार...");

    // Listen for room updates
    db.ref(`rooms/${roomId}`).on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      if (data.started) {
        $("#roomBox").hide();
        $("#noOfplayerBox").show();
        $("#startGame").show();
        noOfPlayer = data.players.length;
        assignColors(data.players);
        if (data.gameState.currentPlayer === myPlayerId) {
          switchDiceBoxId();
          switchPlayerName();
          enableDice();
        }
      } else if (data.players.length >= 2) {
        setTimeout(() => {
          if (!data.started) {
            db.ref(`rooms/${roomId}/started`).set(true);
          }
        }, 30000);
      }
    });
  });
}

function assignColors(playersList) {
  isTeamMode = $("#teamMode").is(":checked");
  const colors = ['rPlayer', 'gPlayer', 'yPlayer', 'bPlayer'];
  playersList.forEach((p, index) => {
    if (p.id === myPlayerId) {
      playerNo = index + 1;
      if (isTeamMode && playersList.length === 2) {
        teamColors[p.id] = index === 0 ? ['rPlayer', 'gPlayer'] : ['yPlayer', 'bPlayer'];
      } else {
        teamColors[p.id] = [colors[index]];
      }
    }
  });
}

function enableDice() {
  if (diceBoxId && teamColors[myPlayerId].includes(playerName)) {
    $(diceBoxId).addClass("startDiceRoll");
    $(diceBoxId).one("click", function () {
      rollDice(diceBoxId);
    });
  }
}

// Switch Functions
function switchDiceBoxId() {
  (playerNo == 1 && (diceBoxId = "#redDice")) ||
    (playerNo == 2 && (diceBoxId = "#greenDice")) ||
    (playerNo == 3 && (diceBoxId = "#yellowDice")) ||
    (playerNo == 4 && (diceBoxId = "#blueDice"));
}

function switchPlayerName() {
  (playerNo == 1 && (playerName = "rPlayer")) ||
    (playerNo == 2 && (playerName = "gPlayer")) ||
    (playerNo == 3 && (playerName = "yPlayer")) ||
    (playerNo == 4 && (playerName = "bPlayer"));
}

// Get Functions
function getNoFromValue(value) {
  return +value.match(/\d+/);
}

function getColorFromValue(value) {
  return value.charAt(0);
}

function getRotateValue(color) {
  let rotate = null;
  (color == "g" && (rotate = "-45deg")) ||
    (color == "y" && (rotate = "-135deg")) ||
    (color == "b" && (rotate = "-225deg")) ||
    (color == "r" && (rotate = "-315deg"));
  return rotate;
}

function getUpdatedWHoutAreaPos(noInId) {
  let posLength = outAreaPos[noInId].length;
  let wh = [];
  if (posLength > 0) {
    wh[0] = 100 / posLength;
    wh[1] = 100 / posLength;
    for (const cValue of outAreaPos[noInId]) {
      $("." + cValue).css({
        width: wh[0] + "%",
        height: wh[1] + "%",
        display: "inline-block",
      });
    }
  }
  return wh;
}

function getUpdatedWHprivateAreaPos(noInId) {
  let wh = [];
  let privateAreaLength = players[playerName].privateAreaPos[noInId].length;
  if (privateAreaLength > 0) {
    wh[0] = 100 / privateAreaLength;
    wh[1] = 100 / privateAreaLength;
    for (const cValue of players[playerName].privateAreaPos[noInId]) {
      $("." + cValue).css({
        width: wh[0] + "%",
        height: wh[1] + "%",
        display: "inline-block",
      });
    }
  }
  return wh;
}

function reUpdateOutAreaWH(...classArr) {
  for (const classV of classArr) {
    let theId = $("." + classV).parent().attr("id");
    let noInId = getNoFromValue(theId);
    getUpdatedWHoutAreaPos(noInId);
  }
}

function reUpdatePrivateAreaWH(...classArr) {
  for (const classV of classArr) {
    let theId = $("." + classV).parent().attr("id");
    let noInId = getNoFromValue(theId);
    getUpdatedWHprivateAreaPos(noInId);
  }
}

// Check Functions
function check52(id) {
  return getNoFromValue(id) == 52;
}

function checkOutAreaEnd(id) {
  return getNoFromValue(id) == getNoFromValue(players[playerName].endPoint);
}

function checkprivateAreaEnd(id) {
  return getNoFromValue(id) == 5;
}

// Add and Remove Functions
function removeAllGlow(...area) {
  for (const areaValue of area) {
    for (const classValue of players[playerName][areaValue]) {
      $("." + classValue).removeClass("glow");
    }
  }
}

function removeAllEvent(...area) {
  for (const areaValue of area) {
    for (const classValue of players[playerName][areaValue]) {
      $("." + classValue).off();
    }
  }
}

function addToArea(addValue, pName, areaName) {
  players[pName][areaName].push(addValue);
  db.ref(`rooms/${roomId}/gameState/players`).set(players);
}

function removeFromArea(removeValue, pName, areaName) {
  let newArr = players[pName][areaName].filter(val => val != removeValue);
  players[pName][areaName] = newArr;
  db.ref(`rooms/${roomId}/gameState/players`).set(players);
}

function removeFromPrivateAreaPos(posValue, classValue, pName) {
  let newPrivateAreaPosArr = players[pName].privateAreaPos[posValue].filter(cValue => cValue != classValue);
  players[pName].privateAreaPos[posValue] = newPrivateAreaPosArr;
  db.ref(`rooms/${roomId}/gameState/players`).set(players);
}

function addToPrivateAreaPos(posValue, classValue, pName) {
  players[pName].privateAreaPos[posValue].push(classValue);
  db.ref(`rooms/${roomId}/gameState/players`).set(players);
}

function addToOutAreaPos(posValue, classValue) {
  outAreaPos[posValue].push(classValue);
  db.ref(`rooms/${roomId}/gameState/outAreaPos`).set(outAreaPos);
}

function removeFromOutAreaPos(posValue, classValue) {
  let newPosArr = outAreaPos[posValue].filter(cValue => cValue != classValue);
  outAreaPos[posValue] = newPosArr;
  db.ref(`rooms/${roomId}/gameState/outAreaPos`).set(outAreaPos);
}

// Main Functions
function nextPlayer() {
  if (winningOrder.length == noOfPlayer - 1) {
    setTimeout(restartGame, 1000);
    return;
  }
  if (playerNo == 4) playerNo = 0;
  if ((rndmNo != 5 && cut != true && pass != true) || countSix == 3) {
    playerNo++;
    countSix = 0;
    preDiceBoxId = null;
  }
  if (cut == true || pass == true) {
    countSix = 0;
    preDiceBoxId = null;
    pass = false;
    cut = false;
  }
  if (diceBoxId != null) $(diceBoxId).removeClass("showDice");
  switchDiceBoxId();
  switchPlayerName();
  if (players[playerName].winArea.length == 4 || 
      (players[playerName].inArea.length == 0 && 
       players[playerName].outArea.length == 0 && 
       players[playerName].privateArea.length == 0)) {
    if (rndmNo == 5) rndmNo = null;
    nextPlayer();
  } else {
    db.ref(`rooms/${roomId}/gameState`).update({
      currentPlayer: myPlayerId,
      playerNo,
      playerName
    });
    if (teamColors[myPlayerId].includes(playerName)) {
      enableDice();
    }
  }
}

function rollDice(idValue) {
  let pX = 0;
  let pY = 0;
  $(idValue).removeClass("startDiceRoll").addClass("rollDice");
  if (sound) {
    rollAudio.play();
    rollAudio.playbackRate = 3.2;
  }
  let timerId = setInterval(() => {
    (pX == 100 && ((pX = 0), (pY = pY + 25))) || (pX = pX + 20);
    $(idValue).css({
      "background-position-x": pX + "%",
      "background-position-y": pY + "%",
    });
    if (pY == 100 && pX == 100) {
      clearInterval(timerId);
      showDice(idValue);
      db.ref(`rooms/${roomId}/gameState`).update({ rndmNo });
      if (rndmNo == 5 && countSix != 3) {
        if (players[playerName].outArea.length == 0 && players[playerName].inArea.length > 0) {
          autoOpen(players[playerName].inArea.length);
        } else {
          openPawn();
          movePawnOnOutArea();
          updatePlayer();
        }
      } else if (rndmNo < 5) {
        movePawnOnOutArea();
        movePawnOnPrivateArea();
        updatePlayer();
      } else {
        setTimeout(nextPlayer, 500);
      }
    }
  }, 20);
}

function showDice(idValue) {
  const pXpYarr = [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]];
  rndmNo = Math.floor(Math.random() * 6);
  if ((preDiceBoxId == null || preDiceBoxId == idValue) && rndmNo == 5) {
    countSix++;
  }
  let pX = pXpYarr[rndmNo][0];
  let pY = pXpYarr[rndmNo][1];
  $(idValue).removeClass("rollDice").addClass("showDice");
  $(idValue).css({
    "background-position-x": pX + "%",
    "background-position-y": pY + "%",
  });
  preDiceBoxId = idValue;
}

function openPawn() {
  let inAreaLength = players[playerName].inArea.length;
  let outAreaLength = players[playerName].outArea.length;
  if (inAreaLength == 0) return;
  if (outAreaLength == 0) {
    setTimeout(() => autoOpen(inAreaLength), 500);
  } else {
    manuallyOpen();
  }
}

function manuallyOpen() {
  for (const classValue of players[playerName].inArea) {
    $("." + classValue).addClass("glow");
    $("." + classValue).one("click", function () {
      reUpdateOutAreaWH(...players[playerName].outArea);
      reUpdatePrivateAreaWH(...players[playerName].privateArea);
      open(classValue);
    });
  }
}

function autoOpen(inAreaLength) {
  let openClassValue = players[playerName].inArea[Math.floor(Math.random() * inAreaLength)];
  open(openClassValue);
}

function open(openClassValue) {
  let startPoint = players[playerName].startPoint;
  let audioDuration = 500;
  removeAllGlow("inArea", "outArea");
  removeAllEvent("inArea", "outArea");
  removeFromArea(openClassValue, playerName, "inArea");
  addToArea(openClassValue, playerName, "outArea");
  addToOutAreaPos(getNoFromValue(startPoint), openClassValue);
  $("." + openClassValue).remove();
  let noInId = getNoFromValue(startPoint);
  let w = getUpdatedWHoutAreaPos(noInId)[0];
  let h = getUpdatedWHoutAreaPos(noInId)[1];
  if (sound) {
    audioDuration = openAudio.duration * 1000;
    openAudio.play();
  }
  $("#" + startPoint).append(
    `<div class="${openClassValue}" style="width:${w}%; height:${h}%;"></div>`
  );
  setTimeout(nextPlayer, audioDuration);
}

function movePawnOnOutArea() {
  let outAreaLength = players[playerName].outArea.length;
  if (outAreaLength == 0) return;
  if (outAreaLength == 1 && rndmNo != 5 && players[playerName].privateArea.length == 0) {
    autoMoveOnOutArea();
  } else {
    manuallyMoveOnOutArea();
  }
}

function manuallyMoveOnOutArea() {
  let idArr = [];
  for (const classValue of players[playerName].outArea) {
    let idValue = $("." + classValue).parent().attr("id");
    if (idArr.includes(idValue)) continue;
    for (const cValue of outAreaPos[getNoFromValue(idValue)]) {
      if (cValue != classValue) $("." + cValue).css("display", "none");
    }
    $("." + classValue).css({
      width: "100%",
      height: "100%",
      display: "inline-block",
    });
    idArr.push(idValue);
    $("." + classValue).addClass("glow");
    $("." + classValue).one("click", function () {
      reUpdateOutAreaWH(...players[playerName].outArea);
      reUpdatePrivateAreaWH(...players[playerName].privateArea);
      moveOnOutArea(classValue);
    });
  }
}

function autoMoveOnOutArea() {
  moveOnOutArea(players[playerName].outArea[0]);
}

function moveOnOutArea(cValue) {
  let count = -1;
  let idValue = $("." + cValue).parent().attr("id");
  let noInId = getNoFromValue(idValue);
  let newId = "out" + noInId;
  let oldId = newId;
  let wh = [];
  let moveingClassValue = cValue;
  let color = getColorFromValue(moveingClassValue);
  let winAudioPlay = false;
  let passAudioPlay = false;
  removeAllGlow("inArea", "outArea", "privateArea");
  removeAllEvent("inArea", "outArea", "privateArea");
  let timerId = setInterval(function () {
    if (checkOutAreaEnd(newId)) {
      count++;
      removeFromOutAreaPos(noInId, moveingClassValue);
      removeFromArea(moveingClassValue, playerName, "outArea");
      $("." + moveingClassValue).remove();
      wh = getUpdatedWHoutAreaPos(noInId);
      noInId = 1;
      newId = color + "-out-" + noInId;
      oldId = newId;
      addToArea(moveingClassValue, playerName, "privateArea");
      addToPrivateAreaPos(noInId, moveingClassValue, playerName);
      wh = getUpdatedWHprivateAreaPos(noInId);
      if (sound) jumpAudio.play();
      $("#" + newId).append(
        `<div class="${moveingClassValue}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`
      );
    } else if (players[playerName].privateArea.includes(moveingClassValue)) {
      count++;
      $("." + moveingClassValue).remove();
      removeFromPrivateAreaPos(noInId, moveingClassValue, playerName);
      wh = getUpdatedWHprivateAreaPos(noInId);
      if (checkprivateAreaEnd(oldId)) {
        pass = true;
        removeFromArea(moveingClassValue, playerName, "privateArea");
        addToArea(moveingClassValue, playerName, "winArea");
        sendToWinArea(moveingClassValue, playerName, color);
        if (players[playerName].winArea.length == 4) {
          if (sound) {
            winAudioPlay = true;
            winAudio.play();
          }
          updateWinningOrder(playerName);
          showWinningBadge();
        }
        if (sound && !winAudioPlay) {
          passAudio.play();
          passAudioPlay = true;
        }
      } else {
        noInId++;
        newId = color + "-out-" + noInId;
        oldId = newId;
        addToPrivateAreaPos(noInId, moveingClassValue, playerName);
        wh = getUpdatedWHprivateAreaPos(noInId);
        if (sound) jumpAudio.play();
        $("#" + newId).append(
          `<div class="${moveingClassValue}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`
        );
      }
    } else {
      count++;
      $("." + moveingClassValue).remove();
      removeFromOutAreaPos(noInId, moveingClassValue);
      wh = getUpdatedWHoutAreaPos(noInId);
      if (check52(oldId)) {
        noInId = 1;
        newId = "out" + noInId;
        oldId = newId;
      } else {
        noInId++;
        newId = "out" + noInId;
        oldId = newId;
      }
      addToOutAreaPos(noInId, moveingClassValue);
      wh = getUpdatedWHoutAreaPos(noInId);
      if (sound) jumpAudio.play();
      $("#" + newId).append(
        `<div class="${moveingClassValue}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`
      );
    }
    if (count == rndmNo) {
      clearInterval(timerId);
      cutPawn(noInId, moveingClassValue);
      if (sound && winAudioPlay) {
        winAudio.onended = () => nextPlayer();
      } else if (sound && passAudioPlay) {
        passAudio.onended = () => nextPlayer();
      } else {
        setTimeout(() => nextPlayer(), 500);
      }
    }
  }, 500);
}

function movePawnOnPrivateArea() {
  let privateAreaLength = players[playerName].privateArea.length;
  let outAreaLength = players[playerName].outArea.length;
  if (privateAreaLength == 0 || rndmNo == 5) return;
  let moveingClassArr = [];
  for (const cValue of players[playerName].privateArea) {
    let idValue = $("." + cValue).parent().attr("id");
    let noInId = getNoFromValue(idValue);
    if (rndmNo <= 5 - noInId) {
      moveingClassArr.push(cValue);
    }
  }
  if (moveingClassArr.length == 0) {
    flag = false;
    return;
  } else if (outAreaLength == 0 && moveingClassArr.length == 1) {
    flag = true;
    autoMoveOnPrivateArea(moveingClassArr);
  } else {
    flag = true;
    manuallyMoveOnPrivateArea(moveingClassArr);
  }
}

function manuallyMoveOnPrivateArea(moveingClassArr) {
  let idArr = [];
  for (const classValue of moveingClassArr) {
    let idValue = $("." + classValue).parent().attr("id");
    if (idArr.includes(idValue)) continue;
    for (const cValue of players[playerName].privateAreaPos[getNoFromValue(idValue)]) {
      if (cValue != classValue) $("." + cValue).css("display", "none");
    }
    $("." + classValue).css({
      width: "100%",
      height: "100%",
      display: "inline-block",
    });
    idArr.push(idValue);
    $("." + classValue).addClass("glow");
    $("." + classValue).one("click", function () {
      reUpdateOutAreaWH(...players[playerName].outArea);
      reUpdatePrivateAreaWH(...players[playerName].privateArea);
      moveOnPrivateArea(classValue);
    });
  }
}

function autoMoveOnPrivateArea(moveingClassArr) {
  moveOnPrivateArea(moveingClassArr[0]);
}

function moveOnPrivateArea(cValue) {
  let idValue = $("." + cValue).parent().attr("id");
  let moveingClassValue = cValue;
  let noInId = getNoFromValue(idValue);
  let color = getColorFromValue(moveingClassValue);
  let count = -1;
  let newId = color + "-out-" + noInId;
  let oldId = newId;
  let wh = [];
  let winAudioPlay = false;
  let passAudioPlay = false;
  removeAllGlow("inArea", "outArea", "privateArea");
  removeAllEvent("inArea", "outArea", "privateArea");
  let timerId = setInterval(function () {
    count++;
    $("." + moveingClassValue).remove();
    removeFromPrivateAreaPos(noInId, moveingClassValue, playerName);
    wh = getUpdatedWHprivateAreaPos(noInId);
    if (checkprivateAreaEnd(oldId)) {
      pass = true;
      removeFromArea(moveingClassValue, playerName, "privateArea");
      addToArea(moveingClassValue, playerName, "winArea");
      sendToWinArea(moveingClassValue, playerName, color);
      if (players[playerName].winArea.length == 4) {
        if (sound) {
          winAudioPlay = true;
          winAudio.play();
        }
        updateWinningOrder(playerName);
        showWinningBadge();
      }
      if (sound && !winAudioPlay) {
        passAudio.play();
        passAudioPlay = true;
      }
    } else {
      noInId++;
      newId = color + "-out-" + noInId;
      oldId = newId;
      addToPrivateAreaPos(noInId, moveingClassValue, playerName);
      wh = getUpdatedWHprivateAreaPos(noInId);
      if (sound) jumpAudio.play();
      $("#" + newId).append(
        `<div class="${moveingClassValue}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`
      );
    }
    if (count == rndmNo) {
      clearInterval(timerId);
      if (sound && winAudioPlay) {
        winAudio.onended = () => nextPlayer();
      } else if (sound && passAudioPlay) {
        passAudio.onended = () => nextPlayer();
      } else {
        setTimeout(() => nextPlayer(), 500);
      }
    }
  }, 500);
}

function updatePlayer() {
  if (players[playerName].inArea.length == 4 && rndmNo < 5) {
    setTimeout(() => nextPlayer(), 500);
    return;
  }
  if (players[playerName].winArea.length < 4) {
    if (flag == true) {
      flag = false;
      return;
    } else if (
      rndmNo == 5 &&
      players[playerName].outArea.length == 0 &&
      players[playerName].inArea.length == 0
    ) {
      setTimeout(() => nextPlayer(), 500);
      return;
    } else if (
      players[playerName].inArea.length > 0 &&
      flag == false &&
      rndmNo < 5
    ) {
      setTimeout(() => nextPlayer(), 500);
      return;
    } else if (
      players[playerName].inArea.length > 0 &&
      flag == false &&
      rndmNo == 5
    ) {
      return;
    } else {
      setTimeout(() => nextPlayer(), 500);
      return;
    }
  } else {
    setTimeout(() => nextPlayer(), 500);
    return;
  }
}

function sendToWinArea(cValue, pName, color) {
  $("#" + color + "-win-pawn-box").append(`<div class="${cValue}"></div>`);
  updateWinAreaCss(pName, color);
  db.ref(`rooms/${roomId}/gameState/players`).set(players);
}

function updateWinAreaCss(pName, color) {
  const winAreaPxPY = [
    [[380, 380]],
    [[380, 380], [305, 305]],
    [[380, 380], [230, 380], [380, 230]],
    [[380, 380], [230, 380], [305, 305], [380, 230]],
  ];
  let i = 0;
  let rotateValue = getRotateValue(color);
  let winAreaLength = players[pName].winArea.length;
  for (const classValue of players[pName].winArea) {
    let x = winAreaPxPY[winAreaLength - 1][i][0];
    let y = winAreaPxPY[winAreaLength - 1][i][1];
    i++;
    $("." + classValue).css({
      transform: `translate(${x}%, ${y}%) rotate(${rotateValue})`,
    });
  }
}

function updateWinningOrder(pName) {
  if (players[pName].winArea.length == 4) {
    winningOrder.push(pName);
    db.ref(`rooms/${roomId}/gameState/winningOrder`).set(winningOrder);
  }
}

function showWinningBadge() {
  if (winningOrder.length > 0) {
    let idValue = winningOrder[winningOrder.length - 1];
    let url = getBadgeImage(winningOrder.length - 1);
    $("#" + idValue).append(
      `<div class="badge-box" style="background-image: ${url};"></div>`
    );
  }
}

function getBadgeImage(winNo) {
  let imageName = winNo == 0 ? "win1" : winNo == 1 ? "win2" : "win3";
  return `url(../images/${imageName}.png)`;
}

function cutPawn(noInId, moveingClassValue) {
  if (players[playerName].outArea.includes(moveingClassValue)) {
    if ([1, 48, 9, 22, 35, 14, 27, 40].includes(noInId)) return;
    let colorInClass = getColorFromValue(moveingClassValue);
    let targetClass = null;
    for (const cValve of outAreaPos[noInId]) {
      if (colorInClass != getColorFromValue(cValve)) {
        targetClass = cValve;
      }
    }
    if (targetClass != null) {
      $("." + targetClass).remove();
      if (sound) cutAudio.play();
      colorInClass = getColorFromValue(targetClass);
      let pName = colorInClass + "Player";
      removeFromArea(targetClass, pName, "outArea");
      addToArea(targetClass, pName, "inArea");
      removeFromOutAreaPos(noInId, targetClass);
      let noInClass = getNoFromValue(targetClass);
      $(`#in-${colorInClass}-${noInClass}`).append(
        `<div class='${colorInClass}-pawn${noInClass}'></div>`
      );
      cut = true;
      getUpdatedWHoutAreaPos(noInId);
    }
  }
}

function startGame() {
  if (isTeamMode && noOfPlayer === 2) {
    setPawn("r", "g", "y", "b");
  } else if (noOfPlayer == 2) {
    setPawn("r", "y");
  } else if (noOfPlayer == 3) {
    setPawn("r", "g", "y");
  } else {
    setPawn("r", "g", "y", "b");
  }
  $("main").css("display", "block");
  db.ref(`rooms/${roomId}/gameState`).update({
    players,
    outAreaPos,
    started: true
  });
  nextPlayer();
}

function setPawn(...color) {
  for (const colorName of color) {
    players[colorName + "Player"].inArea = [
      colorName + "-pawn1",
      colorName + "-pawn2",
      colorName + "-pawn3",
      colorName + "-pawn4",
    ];
    for (let i = 1; i <= 4; i++)
      $(`#in-${colorName}-${i}`).append(
        `<div class='${colorName}-pawn${i}'></div>`
      );
  }
  db.ref(`rooms/${roomId}/gameState/players`).set(players);
}

$("#connectBtn").click(joinRoom);

$("#twoPlayer").click(function () {
  $(".selected").removeClass("selected");
  $(this).addClass("selected");
  noOfPlayer = 2;
});

$("#threePlayer").click(function () {
  $(".selected").removeClass("selected");
  $(this).addClass("selected");
  noOfPlayer = 3;
});

$("#fourPlayer").click(function () {
  $(".selected").removeClass("selected");
  $(this).addClass("selected");
  noOfPlayer = 4;
});

$("#startGame").click(function () {
  $("#home-container").css("display", "none");
  startGame();
});

function resetPawn(...color) {
  for (const colorName of color) {
    for (let i = 1; i <= 4; i++) {
      $(`.${colorName}-pawn${i}`).remove();
    }
  }
}

function restartGame() {
  $("#home-container").css("display", "block");
  $("main").css("display", "none");
  $("." + "badge-box").remove();
  if (noOfPlayer == 2 && !isTeamMode) {
    resetPawn("r", "y");
  } else if (noOfPlayer == 3) {
    resetPawn("r", "g", "y");
  } else {
    resetPawn("r", "g", "y", "b");
  }
  $(diceBoxId).removeClass("startDiceRoll showDice").off();
  players = {
    rPlayer: new Player("out1", "out51"),
    gPlayer: new Player("out14", "out12"),
    yPlayer: new Player("out27", "out25"),
    bPlayer: new Player("out40", "out38"),
  };
  outAreaPos = new Position(52);
  playerNo = 0;
  playerName = null;
  diceBoxId = null;
  preDiceBoxId = null;
  rndmNo = null;
  countSix = 0;
  cut = false;
  pass = false;
  flag = false;
  winningOrder = [];
  db.ref(`rooms/${roomId}`).remove();
}

$("#restart").click(function () {
  $("#alertBox").css("display", "block");
});

$("#ok").click(function () {
  restartGame();
  $("#alertBox").css("display", "none");
});

$("#cancel").click(function () {
  $("#alertBox").css("display", "none");
});

function soundSettings() {
  sound = !sound;
  $("#sound").css("background-image", sound ? "url(../images/sound-on.svg)" : "url(../images/sound-off.svg)");
}

$("#sound").click(soundSettings);

let elem = document.documentElement;
function openFullscreen() {
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
  $("#fullscreen").css("display", "none");
  $("#exitfullscreen").css("display", "inline-block");
}

function joinRoom() {
  const code = $("#roomCode").val().trim();
  if (!code) {
    $("#roomStatus").text("कोड डालें!");
    return;
  }
  console.log("Attempting to connect to room:", code); // डिबग लॉग
  roomId = code;
  myPlayerId = Math.random().toString(36).substring(2, 10);
  console.log("My Player ID:", myPlayerId); // डिबग लॉग
  db.ref(`rooms/${roomId}`).once('value', (snapshot) => {
    console.log("Snapshot data:", snapshot.val()); // डिबग लॉग
    let room = snapshot.val() || { players: [], gameState: {}, started: false };
    if (room.players.length >= 4) {
      $("#roomStatus").text("रूम फुल है!");
      return;
    }
    room.players.push({ id: myPlayerId, colors: [] });
    db.ref(`rooms/${roomId}`).set(room)
      .then(() => {
        console.log("Room data set successfully"); // डिबग लॉग
        $("#roomStatus").text("कनेक्टेड! खिलाड़ियों का इंतज़ार...");
      })
      .catch((error) => {
        console.error("Firebase set error:", error); // एरर लॉग
        $("#roomStatus").text("एरर: कनेक्शन फेल! " + error.message);
      });
    // ... बाकी कोड (on value लिसनर)
  }).catch((error) => {
    console.error("Firebase read error:", error); // एरर लॉग
    $("#roomStatus").text("एरर: डेटा पढ़ने में समस्या! " + error.message);
  });
}

    
function closeFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
  $("#exitfullscreen").css("display", "none");
  $("#fullscreen").css("display", "inline-block");
}

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    $("#fullscreen").css("display", "none");
    $("#exitfullscreen").css("display", "inline-block");
  } else {
    $("#exitfullscreen").css("display", "none");
    $("#fullscreen").css("display", "inline-block");
  }
});

$("#fullscreen").click(openFullscreen);
$("#exitfullscreen").click(closeFullscreen);

// Sync game state from Firebase
db.ref(`rooms/${roomId}/gameState`).on('value', (snapshot) => {
  const state = snapshot.val();
  if (!state) return;
  players = state.players || players;
  outAreaPos = state.outAreaPos || outAreaPos;
  winningOrder = state.winningOrder || winningOrder;
  playerNo = state.playerNo || playerNo;
  playerName = state.playerName || playerName;
  rndmNo = state.rndmNo || rndmNo;
  // Update UI
  for (let color of ['r', 'g', 'y', 'b']) {
    let pName = color + "Player";
    for (let pawn of players[pName].inArea) {
      let no = getNoFromValue(pawn);
      $(`#in-${color}-${no}`).append(`<div class="${pawn}"></div>`);
    }
    for (let pawn of players[pName].outArea) {
      let pos = outAreaPos.findIndex(arr => arr.includes(pawn)) + 1;
      let wh = getUpdatedWHoutAreaPos(pos);
      $(`#out${pos}`).append(`<div class="${pawn}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`);
    }
    for (let pawn of players[pName].privateArea) {
      let pos = players[pName].privateAreaPos.findIndex(arr => arr.includes(pawn)) + 1;
      let wh = getUpdatedWHprivateAreaPos(pos);
      $(`#${color}-out-${pos}`).append(`<div class="${pawn}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`);
    }
    for (let pawn of players[pName].winArea) {
      $(`#${color}-win-pawn-box`).append(`<div class="${pawn}"></div>`);
      updateWinAreaCss(pName, color);
    }
  }
  if (state.currentPlayer === myPlayerId) {
    enable
