// Variables
let playerNo = 0; // (red = 1, green = 2, yellow = 3, blue = 4)
let playerName = null;
let diceBoxId = null;
let preDiceBoxId = null;
let rndmNo = null;
let countSix = 0;
let cut = false;
let pass = false;
let flag = false;
let noOfPlayer = 2; // Default to 2 players for you and your friend
let winningOrder = [];
let sound = true;
let roomId = null; // Store current room ID
let currentPlayerId = null; // Store unique player ID

let rollAudio = new Audio("../music/diceRollingSound.mp3");
let openAudio = new Audio("../music/open-sound.wav");
let jumpAudio = new Audio("../music/jump-sound.mp3");
let cutAudio = new Audio("../music/cut-sound.wav");
let passAudio = new Audio("../music/pass-sound.mp3");
let winAudio = new Audio("../music/win-sound.mp3");

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAT0a7Bx54I_vXBVU4xUF7xr7dJd9o13Jc",
    authDomain: "ludo-king-305fe.firebaseapp.com",
    databaseURL: "https://ludo-king-305fe-default-rtdb.firebaseio.com",
    projectId: "ludo-king-305fe",
    storageBucket: "ludo-king-305fe.firebasestorage.app",
    messagingSenderId: "896536185977",
    appId: "1:896536185977:web:566a10a11c9bd3f2b918a8",
    measurementId: "G-02733W6HCF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

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

// Firebase Functions
function initializeRoom(roomCode) {
    const roomRef = db.ref('rooms/' + roomCode);
    roomRef.set({
        players: {},
        gameState: {
            playerNo: 0,
            noOfPlayer: noOfPlayer,
            winningOrder: [],
            playersData: {
                rPlayer: new Player("out1", "out51"),
                gPlayer: new Player("out14", "out12"),
                yPlayer: new Player("out27", "out25"),
                bPlayer: new Player("out40", "out38")
            },
            outAreaPos: new Position(52)
        }
    });
}

function joinRoom(roomCode) {
    const roomRef = db.ref('rooms/' + roomCode);
    roomRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            roomId = roomCode;
            currentPlayerId = db.ref('rooms/' + roomCode + '/players').push().key;
            db.ref('rooms/' + roomCode + '/players/' + currentPlayerId).set({
                id: currentPlayerId,
                joinedAt: Date.now()
            });
            $("#room-code-container").css("display", "none");
            $("#noOfplayerBox").css("display", "block");
            $("#startGame").css("display", "block");
            syncGameState();
        } else {
            alert("Invalid Room Code!");
        }
    });
}

function createRoom() {
    roomId = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit code
    initializeRoom(roomId);
    currentPlayerId = db.ref('rooms/' + roomId + '/players').push().key;
    db.ref('rooms/' + roomId + '/players/' + currentPlayerId).set({
        id: currentPlayerId,
        joinedAt: Date.now()
    });
    $("#roomCode").val(roomId);
    $("#room-code-container").css("display", "none");
    $("#noOfplayerBox").css("display", "block");
    $("#startGame").css("display", "block");
    alert("Room Created! Code: " + roomId);
}

function syncGameState() {
    const roomRef = db.ref('rooms/' + roomId);
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.gameState) {
            playerNo = data.gameState.playerNo;
            noOfPlayer = data.gameState.noOfPlayer;
            winningOrder = data.gameState.winningOrder;
            players = data.gameState.playersData;
            outAreaPos = data.gameState.outAreaPos;
            switchPlayerName();
            switchDiceBoxId();
            updateBoard();
            // Enable dice only for current player's turn
            if ((playerNo === 1 && currentPlayerId === data.players[Object.keys(data.players)[0]].id) ||
                (playerNo === 2 && currentPlayerId === data.players[Object.keys(data.players)[1]].id)) {
                $(diceBoxId).addClass("startDiceRoll");
                $(diceBoxId).one("click", function () {
                    rollDice(diceBoxId);
                });
            } else {
                $(diceBoxId).removeClass("startDiceRoll");
                $(diceBoxId).off("click");
            }
        }
    });
}

function updateGameState() {
    if (roomId) {
        db.ref('rooms/' + roomId + '/gameState').set({
            playerNo: playerNo,
            noOfPlayer: noOfPlayer,
            winningOrder: winningOrder,
            playersData: players,
            outAreaPos: outAreaPos
        });
    }
}

function updateBoard() {
    $(".pawn-box div, .out-area div div, .win-pawn-box div").remove();
    for (const pName in players) {
        for (const pawn of players[pName].inArea) {
            const no = getNoFromValue(pawn);
            const color = getColorFromValue(pawn);
            $(`#in-${color}-${no}`).append(`<div class='${pawn}'></div>`);
        }
    }
    for (let i = 1; i <= 52; i++) {
        const pawns = outAreaPos[i];
        const wh = getUpdatedWHoutAreaPos(i);
        for (const pawn of pawns) {
            $(`#out${i}`).append(`<div class="${pawn}" style="width:${wh[0]}%;height:${wh[1]}%;"></div>`);
        }
    }
    for (const pName in players) {
        for (let i = 1; i <= 5; i++) {
            const pawns = players[pName].privateAreaPos[i];
            const wh = getUpdatedWHprivateAreaPos(i);
            for (const pawn of pawns) {
                const color = getColorFromValue(pawn);
                $(`#${color}-out-${i}`).append(`<div class="${pawn}" style="width:${wh[0]}%;height:${wh[1]}%;"></div>`);
            }
        }
    }
    for (const pName in players) {
        const color = pName.charAt(0);
        updateWinAreaCss(pName, color);
    }
}

// Existing Functions (Modified for Firebase)
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
        wh[0] = 100 / players[playerName].privateAreaPos[noInId].length;
        wh[1] = 100 / players[playerName].privateAreaPos[noInId].length;
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

function check52(id) {
    if (getNoFromValue(id) == 52) return true;
    return false;
}

function checkOutAreaEnd(id) {
    if (getNoFromValue(id) == getNoFromValue(players[playerName].endPoint)) {
        return true;
    }
    return false;
}

function checkprivateAreaEnd(id) {
    if (getNoFromValue(id) == 5) {
        return true;
    }
    return false;
}

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
}

function removeFromArea(removeValue, pName, areaName) {
    let newArr = [];
    for (const classValue of players[pName][areaName]) {
        if (classValue != removeValue) {
            newArr.push(classValue);
        }
    }
    players[pName][areaName] = newArr;
}

function removeFromPrivateAreaPos(posValue, classValue, pName) {
    let newPrivateAreaPosArr = [];
    for (const cValue of players[pName].privateAreaPos[posValue]) {
        if (cValue != classValue) {
            newPrivateAreaPosArr.push(cValue);
        }
    }
    players[pName].privateAreaPos[posValue] = newPrivateAreaPosArr;
}

function addToPrivateAreaPos(posValue, classValue, pName) {
    players[pName].privateAreaPos[posValue].push(classValue);
}

function addToOutAreaPos(posValue, classValue) {
    outAreaPos[posValue].push(classValue);
}

function removeFromOutAreaPos(posValue, classValue) {
    let newPosArr = [];
    for (const cValue of outAreaPos[posValue]) {
        if (cValue != classValue) {
            newPosArr.push(cValue);
        }
    }
    outAreaPos[posValue] = newPosArr;
}

function nextPlayer() {
    if (winningOrder.length == noOfPlayer - 1) {
        setTimeout(function () {
            restartGame();
        }, 1000);
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
    if (
        players[playerName].winArea.length == 4 ||
        (players[playerName].inArea.length == 0 &&
            players[playerName].outArea.length == 0 &&
            players[playerName].privateArea.length == 0)
    ) {
        if (rndmNo == 5) {
            rndmNo = null;
        }
        nextPlayer();
    } else {
        updateGameState();
    }
}

function rollDice(idValue) {
    let pX = 0;
    let pY = 0;
    $(idValue).removeClass("startDiceRoll").addClass("rollDice");
    if (sound == true) {
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
            if (rndmNo == 5 && countSix != 3) {
                if (players[playerName].outArea.length == 0 && players[playerName].inArea.length > 0) {
                    openPawn();
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
                setTimeout(function () {
                    nextPlayer();
                }, 500);
            }
            updateGameState();
        }
    }, 20);
}

function showDice(idValue) {
    let pX = null;
    let pY = null;
    const pXpYarr = [
        [0, 0],
        [100, 0],
        [0, 50],
        [100, 50],
        [0, 100],
        [100, 100],
    ];
    rndmNo = Math.floor(Math.random() * 6);
    if ((preDiceBoxId == null || preDiceBoxId == idValue) && rndmNo == 5) {
        countSix++;
    }
    pX = pXpYarr[rndmNo][0];
    pY = pXpYarr[rndmNo][1];
    $(idValue).removeClass("rollDice");
    $(idValue).addClass("showDice");
    $(idValue).css({
        "background-position-x": pX + "%",
        "background-position-y": pY + "%",
    });
    preDiceBoxId = idValue;
}

function openPawn() {
    let inAreaLength = players[playerName].inArea.length;
    let outAreaLength = players[playerName].outArea.length;
    if (inAreaLength == 0) {
        updateGameState();
        return;
    } else {
        if (outAreaLength == 0) {
            setTimeout(() => autoOpen(inAreaLength), 500);
        } else {
            manuallyOpen();
        }
    }
}

function manuallyOpen() {
    for (const classValue of players[playerName].inArea) {
        $("." + classValue).addClass("glow");
        $("." + classValue).one("click", function () {
            reUpdateOutAreaWH(...players[playerName].outArea);
            reUpdatePrivateAreaWH(...players[playerName].privateArea);
            open(classValue, 0);
            updateGameState();
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
    if (sound == true) {
        audioDuration = openAudio.duration * 1000;
        openAudio.play();
    }
    $("#" + startPoint).append(
        `<div class="${openClassValue}" style="width:${w}%; height:${h}%;"></div>`
    );
    setTimeout(function () {
        nextPlayer();
    }, audioDuration);
}

function movePawnOnOutArea() {
    let outAreaLength = players[playerName].outArea.length;
    if (outAreaLength == 0) {
        updateGameState();
        return;
    } else {
        if (
            outAreaLength == 1 &&
            rndmNo != 5 &&
            players[playerName].privateArea.length == 0
        ) {
            autoMoveOnOutArea();
        } else {
            manuallyMoveOnOutArea();
        }
    }
}

function manuallyMoveOnOutArea() {
    let idArr = [];
    for (const classValue of players[playerName].outArea) {
        let idValue = $("." + classValue).parent().attr("id");
        if (idArr.includes(idValue)) {
            continue;
        } else {
            for (const cValue of outAreaPos[getNoFromValue(idValue)]) {
                if (cValue != classValue) {
                    $("." + cValue).css("display", "none");
                }
            }
            $("." + classValue).css({
                width: 100 + "%",
                height: 100 + "%",
                display: "inline-block",
            });
            idArr.push(idValue);
            $("." + classValue).addClass("glow");
            $("." + classValue).one("click", function () {
                reUpdateOutAreaWH(...players[playerName].outArea);
                reUpdatePrivateAreaWH(...players[playerName].privateArea);
                moveOnOutArea(classValue);
                updateGameState();
            });
        }
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
            if (sound == true) {
                jumpAudio.play();
            }
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
                    if (sound == true) {
                        winAudioPlay = true;
                        winAudio.play();
                    }
                    updateWinningOrder(playerName);
                    showWinningBadge();
                }
                if (sound == true && winAudioPlay == false) {
                    passAudio.play();
                    passAudioPlay = true;
                }
            } else {
                noInId++;
                newId = color + "-out-" + noInId;
                oldId = newId;
                addToPrivateAreaPos(noInId, moveingClassValue, playerName);
                wh = getUpdatedWHprivateAreaPos(noInId);
                if (sound == true) {
                    jumpAudio.play();
                }
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
            if (sound == true) {
                jumpAudio.play();
            }
            $("#" + newId).append(
                `<div class="${moveingClassValue}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`
            );
        }
        if (count == rndmNo) {
            clearInterval(timerId);
            cutPawn(noInId, moveingClassValue);
            if (sound == true && winAudioPlay == true) {
                winAudio.onended = () => {
                    nextPlayer();
                };
            } else if (sound == true && passAudioPlay == true) {
                passAudio.onended = () => {
                    nextPlayer();
                };
            } else {
                setTimeout(() => nextPlayer(), 500);
            }
        }
    }, 500);
}

function movePawnOnPrivateArea() {
    let privateAreaLength = players[playerName].privateArea.length;
    let outAreaLength = players[playerName].outArea.length;
    if (privateAreaLength == 0 || rndmNo == 5) {
        updateGameState();
        return;
    } else {
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
            updateGameState();
            return;
        } else if (outAreaLength == 0 && moveingClassArr.length == 1) {
            flag = true;
            autoMoveOnPrivateArea(moveingClassArr);
        } else {
            flag = true;
            manuallyMoveOnPrivateArea(moveingClassArr);
        }
    }
}

function manuallyMoveOnPrivateArea(moveingClassArr) {
    let idArr = [];
    for (const classValue of moveingClassArr) {
        let idValue = $("." + classValue).parent().attr("id");
        if (idArr.includes(idValue)) {
            continue;
        } else {
            for (const cValue of players[playerName].privateAreaPos[getNoFromValue(idValue)]) {
                if (cValue != classValue) {
                    $("." + cValue).css("display", "none");
                }
            }
            $("." + classValue).css({
                width: 100 + "%",
                height: 100 + "%",
                display: "inline-block",
            });
            idArr.push(idValue);
            $("." + classValue).addClass("glow");
            $("." + classValue).one("click", function () {
                reUpdateOutAreaWH(...players[playerName].outArea);
                reUpdatePrivateAreaWH(...players[playerName].privateArea);
                moveOnPrivateArea(classValue);
                updateGameState();
            });
        }
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
                if (sound == true) {
                    winAudioPlay = true;
                    winAudio.play();
                }
                updateWinningOrder(playerName);
                showWinningBadge();
            }
            if (sound == true && winAudioPlay == false) {
                passAudio.play();
                passAudioPlay = true;
            }
        } else {
            noInId++;
            newId = color + "-out-" + noInId;
            oldId = newId;
            addToPrivateAreaPos(noInId, moveingClassValue, playerName);
            wh = getUpdatedWHprivateAreaPos(noInId);
            if (sound == true) {
                jumpAudio.play();
            }
            $("#" + newId).append(
                `<div class="${moveingClassValue}" style="width:${wh[0]}%; height:${wh[1]}%;"></div>`
            );
        }
        if (count == rndmNo) {
            clearInterval(timerId);
            if (sound == true && winAudioPlay == true) {
                winAudio.onended = () => {
                    nextPlayer();
                };
            } else if (sound == true && passAudioPlay == true) {
                passAudio.onended = () => {
                    nextPlayer();
                };
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
        } else if (players[playerName].outArea.length > 0) {
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
}

function updateWinAreaCss(pName, color) {
    let x = null;
    let y = null;
    const winAreaPxPY = [
        [[380, 380]],
        [
            [380, 380],
            [305, 305],
        ],
        [
            [380, 380],
            [230, 380],
            [380, 230],
        ],
        [
            [380, 380],
            [230, 380],
            [305, 305],
            [380, 230],
        ],
    ];
    let i = 0;
    let rotateValue = getRotateValue(color);
    let winAreaLength = players[pName].winArea.length;
    for (const classValue of players[pName].winArea) {
        x = winAreaPxPY[winAreaLength - 1][i][0];
        y = winAreaPxPY[winAreaLength - 1][i][1];
        i++;
        $("." + classValue).css({
            transform: `translate(${x}%, ${y}%) rotate(${rotateValue})`,
        });
    }
}

function updateWinningOrder(pName) {
    if (players[pName].winArea.length == 4) {
        winningOrder.push(pName);
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
    let imageName = null;
    (winNo == 0 && (imageName = "win1")) ||
    (winNo == 1 && (imageName = "win2")) ||
    (winNo == 2 && (imageName = "win3"));
    return `url(../images/${imageName}.png)`;
}

function cutPawn(noInId, moveingClassValue) {
    if (players[playerName].outArea.includes(moveingClassValue)) {
        if ([1, 48, 9, 22, 35, 14, 27, 40].includes(noInId)) {
            return;
        } else {
            let colorInClass = getColorFromValue(moveingClassValue);
            let targetClass = null;
            for (const cValve of outAreaPos[noInId]) {
                if (colorInClass != getColorFromValue(cValve)) {
                    targetClass = cValve;
                }
            }
            if (targetClass != null) {
                $("." + targetClass).remove();
                if (sound == true) {
                    cutAudio.play();
                }
                colorInClass = getColorFromValue(targetClass);
                let pName = colorInClass + "Player";
                removeFromArea(targetClass, pName, "outArea");
                addToArea(target