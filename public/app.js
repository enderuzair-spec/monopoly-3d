// Monopoly 3D Deluxe Client Controller

const socket = io();
window.socket = socket;

// Persistent Session Token for Graceful Disconnect/Rejoin
let sessionToken = localStorage.getItem("monopoly_session_token");
if (!sessionToken) {
  sessionToken = "sess_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now();
  try {
    localStorage.setItem("monopoly_session_token", sessionToken);
  } catch (e) {
    console.warn("localStorage unavailable for session token");
  }
}

let scene3D = null;
let myPlayer = null;
let currentRoomId = null;
let gameState = null;
let selectedToken = "🎩";
let currentCamMode = "auto";

Object.defineProperty(window, "currentRoomId", { get: () => currentRoomId, set: (v) => { currentRoomId = v; } });
Object.defineProperty(window, "myPlayer", { get: () => myPlayer, set: (v) => { myPlayer = v; } });
Object.defineProperty(window, "gameState", { get: () => gameState, set: (v) => { gameState = v; } });
window.renderPropertyPortfolio = renderPropertyPortfolio;
window.showDrawnCardModal = showDrawnCardModal;

// Full authentic property deed specifications and GROUP_MEMBERS are loaded from tilesData.js

// DOM References
const lobbyScreen = document.getElementById("lobbyScreen");
const lobbyInitialView = document.getElementById("lobbyInitialView");
const lobbyWaitingView = document.getElementById("lobbyWaitingView");
const gameScreen = document.getElementById("gameScreen");
const threeContainer = document.getElementById("threeContainer");

const playerNameInput = document.getElementById("playerNameInput");
const joinRoomCodeInput = document.getElementById("joinRoomCodeInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const displayRoomCode = document.getElementById("displayRoomCode");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const lobbyPlayersList = document.getElementById("lobbyPlayersList");
const playerCount = document.getElementById("playerCount");
const addBotBtn = document.getElementById("addBotBtn");
const startGameBtn = document.getElementById("startGameBtn");
const hostLobbyControls = document.getElementById("hostLobbyControls");
const nonHostLobbyNotice = document.getElementById("nonHostLobbyNotice");
const spectatorBanner = document.getElementById("spectatorBanner");
const hudRightSidebar = document.getElementById("hudRightSidebar");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const openSidebarBtn = document.getElementById("openSidebarBtn");

const gameRoomCode = document.getElementById("gameRoomCode");
const headerShareBtn = document.getElementById("headerShareBtn");
const turnIndicator = document.getElementById("turnIndicator");
const camModeBtn = document.getElementById("camModeBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const saveGameBtn = document.getElementById("saveGameBtn");

const openResumeModalBtn = document.getElementById("openResumeModalBtn");
const savedGamesModal = document.getElementById("savedGamesModal");
const closeSavedGamesModalBtn = document.getElementById("closeSavedGamesModalBtn");
const savedGamesList = document.getElementById("savedGamesList");
const loadSaveFileInput = document.getElementById("loadSaveFileInput");
const uploadSaveFileBtn = document.getElementById("uploadSaveFileBtn");
const refreshSavesBtn = document.getElementById("refreshSavesBtn");

const rentBanner = document.getElementById("rentBanner");
const rentToastDesc = document.getElementById("rentToastDesc");

const gamePrompt = document.getElementById("gamePrompt");
const rollDiceBtn = document.getElementById("rollDiceBtn");
const buyPropertyBtn = document.getElementById("buyPropertyBtn");
const auctionBtn = document.getElementById("auctionBtn");
const payJailBtn = document.getElementById("payJailBtn");
const useJailCardBtn = document.getElementById("useJailCardBtn");
const endTurnBtn = document.getElementById("endTurnBtn");

const cardDisplay = document.getElementById("cardDisplay");
const cardTypeTag = document.getElementById("cardTypeTag");
const cardBodyText = document.getElementById("cardBodyText");
const dismissCardBtn = document.getElementById("dismissCardBtn");

// Authentic Physical Drawn Card Modal
const cardModalBackdrop = document.getElementById("cardModalBackdrop");
const closeCardDrawnBtn = document.getElementById("closeCardDrawnBtn");
const physicalDrawnCard = document.getElementById("physicalDrawnCard");
const drawnCardTypeLabel = document.getElementById("drawnCardTypeLabel");
const drawnCardEmblemIcon = document.getElementById("drawnCardEmblemIcon");
const drawnCardInstructionText = document.getElementById("drawnCardInstructionText");
const drawnCardFlavor = document.getElementById("drawnCardFlavor");
const dismissDrawnCardBtn = document.getElementById("dismissDrawnCardBtn");

const auctionOverlay = document.getElementById("auctionOverlay");
const auctionPropName = document.getElementById("auctionPropName");
const auctionCurrentBid = document.getElementById("auctionCurrentBid");
const auctionLeader = document.getElementById("auctionLeader");
const bid10Btn = document.getElementById("bid10Btn");
const bid50Btn = document.getElementById("bid50Btn");
const bid100Btn = document.getElementById("bid100Btn");
const passAuctionBtn = document.getElementById("passAuctionBtn");
const auctionTimeLeft = document.getElementById("auctionTimeLeft");
const auctionTimerBadge = document.getElementById("auctionTimerBadge");
const auctionStatusBanner = document.getElementById("auctionStatusBanner");

const debtOverlay = document.getElementById("debtOverlay");
const debtInfoText = document.getElementById("debtInfoText");
const settleDebtBtn = document.getElementById("settleDebtBtn");
const bankruptBtn = document.getElementById("bankruptBtn");

const playersHudList = document.getElementById("playersHudList");
const hudPlayerCount = document.getElementById("hudPlayerCount");
const gameLogList = document.getElementById("gameLogList");
const chatMessagesList = document.getElementById("chatMessagesList");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const openPropertiesBtn = document.getElementById("openPropertiesBtn");
const propertiesModal = document.getElementById("propertiesModal");
const closePropertiesModal = document.getElementById("closePropertiesModal");
const propertyPortfolioList = document.getElementById("propertyPortfolioList");

const openTradeBtn = document.getElementById("openTradeBtn");
const tradeModal = document.getElementById("tradeModal");
const closeTradeModal = document.getElementById("closeTradeModal");
const tradeTargetSelect = document.getElementById("tradeTargetSelect");
const tradeOfferCash = document.getElementById("tradeOfferCash");
const tradeRequestCash = document.getElementById("tradeRequestCash");
const tradeMyPropertiesList = document.getElementById("tradeMyPropertiesList");
const tradeTargetPropertiesList = document.getElementById("tradeTargetPropertiesList");
const submitTradeBtn = document.getElementById("submitTradeBtn");

const tradeIncomingModal = document.getElementById("tradeIncomingModal");
const incomingTradeSummary = document.getElementById("incomingTradeSummary");
const incomingTheyOffer = document.getElementById("incomingTheyOffer");
const incomingTheyRequest = document.getElementById("incomingTheyRequest");
const acceptTradeBtn = document.getElementById("acceptTradeBtn");
const declineTradeBtn = document.getElementById("declineTradeBtn");

const deedModal = document.getElementById("deedModal");
const closeDeedModal = document.getElementById("closeDeedModal");
const titleDeedCard = document.getElementById("titleDeedCard");
const deedHeader = document.getElementById("deedHeader");
const deedPropName = document.getElementById("deedPropName");
const deedBody = document.getElementById("deedBody");

const victoryModal = document.getElementById("victoryModal");
const winnerName = document.getElementById("winnerName");
const playAgainBtn = document.getElementById("playAgainBtn");

// Check URL query e.g. ?room=GAME-ABCD
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get("room");
if (roomParam) {
  joinRoomCodeInput.value = roomParam.toUpperCase();
}

// Token Selection
document.querySelectorAll(".token-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".token-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedToken = btn.getAttribute("data-token");
  });
});

// Sound Toggle
let soundOn = true;
soundToggleBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  window.sounds.enabled = soundOn;
  soundToggleBtn.textContent = soundOn ? "🔊" : "🔇";
});

// 3D Camera Mode Toggle (Auto, Table View, Table Overview, Free Orbit)
const CAM_PRESETS = [
  { id: "auto", label: "🎥 Cam: Auto" },
  { id: "saloon", label: "🎲 Cam: Table View" },
  { id: "overview", label: "🗺️ Cam: Overview" },
  { id: "free", label: "🎮 Cam: Free Orbit" }
];
let camPresetIndex = 0;

camModeBtn.addEventListener("click", () => {
  camPresetIndex = (camPresetIndex + 1) % CAM_PRESETS.length;
  currentCamMode = CAM_PRESETS[camPresetIndex].id;
  camModeBtn.textContent = CAM_PRESETS[camPresetIndex].label;
  if (scene3D) scene3D.setCameraMode(currentCamMode);
});

// Game Mode Selection in Lobby (Monopoly 3D active, Uno locked behind Coming Soon)
let selectedGameMode = "monopoly";
const modeMonopolyBtn = document.getElementById("modeMonopolyBtn");
const modeUnoBtn = document.getElementById("modeUnoBtn");
const lobbyGameModeBadge = document.getElementById("lobbyGameModeBadge");

modeMonopolyBtn?.addEventListener("click", () => {
  selectedGameMode = "monopoly";
  modeMonopolyBtn.classList.add("selected");
});

modeUnoBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("🃏 Saloon Uno is locked and coming soon! We are currently focusing on perfecting Monopoly 3D.");
});

function updateLobbyModeUI(mode) {
  selectedGameMode = "monopoly";
  if (lobbyGameModeBadge) {
    lobbyGameModeBadge.textContent = "🎲 Monopoly 3D";
    lobbyGameModeBadge.style.background = "#854d0e";
    lobbyGameModeBadge.style.color = "#fef08a";
  }
}

// Create Room
createRoomBtn.addEventListener("click", () => {
  const name = playerNameInput.value.trim() || "Host";
  socket.emit("create_room", { name, token: selectedToken, gameType: selectedGameMode, sessionToken }, (res) => {
    if (res.success) {
      currentRoomId = res.roomId;
      myPlayer = res.player;
      updateLobbyModeUI(res.gameType || selectedGameMode);
      switchToLobbyWaiting(res.roomId);
    }
  });
});

// Join Room
joinRoomBtn.addEventListener("click", () => {
  const name = playerNameInput.value.trim() || "Player";
  const code = joinRoomCodeInput.value.trim().toUpperCase();
  if (!code) return alert("Please enter a room code!");
  currentRoomId = code;

  socket.emit("join_room", { roomId: code, name, token: selectedToken, sessionToken }, (res) => {
    if (res.error) {
      currentRoomId = null;
      alert(res.error);
    } else {
      currentRoomId = res.roomId;
      if (res.isSpectator) {
        myPlayer = { id: socket.id, name: name + " (Spectator)", isSpectator: true };
        spectatorBanner?.classList.remove("hidden");
      } else {
        myPlayer = res.player;
      }
      switchToLobbyWaiting(res.roomId);
    }
  });
});

// Auto-Reconnection & Grace Handling
socket.on("connect", () => {
  if (currentRoomId && sessionToken) {
    socket.emit("join_room", { roomId: currentRoomId, sessionToken }, (res) => {
      if (res && res.player) {
        myPlayer = res.player;
      }
    });
  }
});

// Kicked by Host Notification
socket.on("kicked_from_room", (data) => {
  alert(data?.reason || "You have been removed from the lobby by the room host.");
  window.location.reload();
});

// Add AI Bot
addBotBtn.addEventListener("click", () => {
  if (currentRoomId) socket.emit("add_bot", { roomId: currentRoomId });
});

// Start Game
startGameBtn.addEventListener("click", () => {
  if (currentRoomId) {
    socket.emit("start_game", { roomId: currentRoomId }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }
});

function copyLink() {
  const link = `${window.location.origin}/?room=${currentRoomId}`;
  navigator.clipboard.writeText(link).then(() => {
    alert(`Invite link copied to clipboard!\n${link}`);
  }).catch(() => {
    prompt("Copy this link to invite friends:", link);
  });
}
copyInviteBtn.addEventListener("click", copyLink);
headerShareBtn.addEventListener("click", copyLink);

function switchToLobbyWaiting(roomId) {
  lobbyInitialView.classList.add("hidden");
  lobbyWaitingView.classList.remove("hidden");
  displayRoomCode.textContent = roomId;
  if (gameState) renderLobbyWaiting(gameState);
}

// Game State Updates
let lastDiceRoll = null;
let lastRollId = 0;
let lastShownRentTimestamp = 0;

let lastShownGameEventId = null;

function showEventToast(title, desc, icon = "📢", type = "info") {
  if (!rentBanner) return;
  const iconEl = document.getElementById("eventToastIcon");
  const titleEl = document.getElementById("eventToastTitle");
  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (rentToastDesc) rentToastDesc.textContent = desc;

  rentBanner.classList.remove("hidden");

  // Play appropriate synthesized sound
  if (window.sounds) {
    if (type === "rent") window.sounds.playRent();
    else if (type === "buy" || type === "go") window.sounds.playCash();
    else if (type === "jail") window.sounds.playJail();
    else if (type === "card") window.sounds.playCard();
    else window.sounds.playStep();
  }

  clearTimeout(window._eventToastTimer);
  window._eventToastTimer = setTimeout(() => {
    rentBanner.classList.add("hidden");
  }, 3200);
}

function showRentToast(rentEvent) {
  if (!rentEvent) return;
  const amount = rentEvent.amount ?? rentEvent.rent ?? 0;
  const payer = rentEvent.payerName || "Player";
  const creditor = rentEvent.creditorName || rentEvent.ownerName || "Owner";
  const prop = rentEvent.propertyName || rentEvent.reason || "Property";
  showEventToast("RENT PAID", `${payer} paid ${amount} rent to ${creditor} for ${prop}!`, "💰", "rent");
}

function handlePostLanding(state) {
  if (!state || state.status !== "in_progress") return;
  const currentP = state.players ? state.players[state.turnIndex] : null;
  if (!currentP) return;
  const isMyTurn = myPlayer && (myPlayer.id === currentP.id);
  const tile = TILES_DEF[currentP.position];

  if (tile && (tile.type === "property" || tile.type === "railroad" || tile.type === "utility")) {
    const prop = state.properties[tile.id];
    if (prop && !prop.owner) {
      if (isMyTurn) {
        // FOR YOUR PLAYER: Show full Title Deed card modal with close button
        showTitleDeed(tile.id, { canBuy: currentP.money >= tile.cost, cost: tile.cost });
      } else {
        // FOR OTHER PLAYERS: Only a small banner on top
        showEventToast("UNOWNED PROPERTY", `${currentP.name} landed on ${tile.name} ($${tile.cost})`, "🏛️", "info");
      }
    }
  } else if (tile && (tile.type === "chance" || tile.type === "community_chest")) {
    if (scene3D && scene3D.animateDrawCard) {
      scene3D.animateDrawCard(tile.type);
    }
  }
}

let lastShownActiveCardText = null;

socket.on("game_state", (state) => {
  // Ignore updates if not in a room or if state is from a different room
  if (!currentRoomId || state.roomId !== currentRoomId) {
    return;
  }

  gameState = state;
  if (state.players) {
    const updated = state.players.find(p => 
      (myPlayer && p.id === myPlayer.id) ||
      (sessionToken && p.sessionToken === sessionToken) ||
      (p.id === socket.id)
    );
    if (updated) myPlayer = updated;
  }
  if (propertiesModal && !propertiesModal.classList.contains("hidden")) {
    renderPropertyPortfolio();
  }

  if (state.status === "waiting") {
    renderLobbyWaiting(state);
  } else if (state.status === "in_progress" || state.status === "ended") {
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    // Initialize 3D Scene if not already running
    if (!scene3D) {
      try {
        scene3D = new Monopoly3DScene(threeContainer);
        window.scene3D = scene3D;
        scene3D.setCameraMode(currentCamMode);
      } catch (err) {
        console.error("Error initializing 3D Scene:", err);
      }
    }

    try {
      if (state.gameType === "uno") {
        unoGameArea?.classList.remove("hidden");
        hideAllActionButtons();
        openCashDrawerBtn?.classList.add("hidden");
        openPropertiesBtn?.classList.add("hidden");
        openTradeBtn?.classList.add("hidden");
        saveGameBtn?.classList.add("hidden");
        tutorialCoachBox?.classList.add("hidden");
        renderUnoGame(state);
      } else {
        unoGameArea?.classList.add("hidden");
        openCashDrawerBtn?.classList.remove("hidden");
        openPropertiesBtn?.classList.remove("hidden");
        openTradeBtn?.classList.remove("hidden");
        saveGameBtn?.classList.remove("hidden");
        applyCoachPreference();
        render3DGame(state);
        updateCashDrawerUI(state);
        updateCoachGuidance(state);
        checkAfkAction(state);
      }
    } catch (err) {
      console.error("Error in game render:", err);
    }
  }
});

function renderLobbyWaiting(state) {
  if (state.gameType) updateLobbyModeUI(state.gameType);
  playerCount.textContent = state.players.length;
  lobbyPlayersList.innerHTML = "";

  const isHost = (myPlayer?.id === state.hostId) || (myPlayer?.isHost) || (state.players.length > 0 && state.players[0].id === myPlayer?.id);

  if (hostLobbyControls && nonHostLobbyNotice) {
    if (isHost) {
      hostLobbyControls.classList.remove("hidden");
      nonHostLobbyNotice.classList.add("hidden");
    } else {
      hostLobbyControls.classList.add("hidden");
      nonHostLobbyNotice.classList.remove("hidden");
    }
  }

  state.players.forEach(p => {
    const isThisPlayerHost = (p.id === state.hostId) || p.isHost;
    const row = document.createElement("div");
    row.className = "lobby-player-row";
    row.style.borderLeftColor = p.color;
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">${p.token}</span>
        <strong>${p.name}</strong>
        ${isThisPlayerHost ? '<span class="host-badge">👑 HOST</span>' : ''}
        ${p.isBot ? '<span style="font-size:11px;background:#334155;padding:2px 8px;border-radius:6px;">AI BOT</span>' : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#10b981;font-weight:700;font-size:13px;">READY</span>
        ${isHost && p.id !== myPlayer?.id ? `<button class="kick-player-btn" data-player-id="${p.id}" title="Kick player from lobby">✕ Kick</button>` : ''}
      </div>
    `;
    lobbyPlayersList.appendChild(row);
  });

  // Attach kick button listeners
  lobbyPlayersList.querySelectorAll(".kick-player-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute("data-player-id");
      if (targetId && currentRoomId) {
        socket.emit("kick_player", { roomId: currentRoomId, targetPlayerId: targetId });
      }
    });
  });

  if (state.players.length >= 2) {
    startGameBtn.removeAttribute("disabled");
  } else {
    startGameBtn.setAttribute("disabled", "true");
  }
}

function render3DGame(state) {
  gameRoomCode.textContent = state.roomId;
  const currentP = state.players[state.turnIndex];
  const isMyTurn = myPlayer && currentP && (
    myPlayer.id === currentP.id ||
    (sessionToken && (myPlayer.sessionToken === currentP.sessionToken || currentP.sessionToken === sessionToken))
  );

  // Sync 3D Scene Entities with strict dice-settled sequencing
  if (scene3D) {
    scene3D.syncProperties(state.properties, state.players);

    // Trigger 3D Dice Roll Animation on state change
    if (state.rollId && lastRollId !== state.rollId) {
      lastRollId = state.rollId;
      scene3D.roll3DDice(state.dice[0], state.dice[1], () => {
        // Tokens wait for dice to settle before hopping
        scene3D.syncPlayers(state.players, state.lastMove, () => {
          handlePostLanding(state);
        });
      });
      if (window.sounds) window.sounds.playDice();
    } else if (!scene3D.isRolling) {
      scene3D.syncPlayers(state.players, null);
      if (state.dice && state.dice.length >= 2) {
        scene3D.setDiceFaces(state.dice[0], state.dice[1]);
      }
    }

    // Cinematic Camera focus on active token
    if (currentP) {
      scene3D.focusOnPlayerToken(currentP.id);
    }
  }

  // Floating Game Event Toast Notification (Restricted to Rent & Drawn Cards)
  if (state.lastGameEvent && state.lastGameEvent.id !== lastShownGameEventId) {
    lastShownGameEventId = state.lastGameEvent.id;
    if (state.lastGameEvent.type === "rent" || state.lastGameEvent.type === "card") {
      showEventToast(state.lastGameEvent.title, state.lastGameEvent.message, state.lastGameEvent.icon, state.lastGameEvent.type);
    }
  } else if (state.lastRentEvent && state.lastRentEvent.timestamp !== lastShownRentTimestamp) {
    lastShownRentTimestamp = state.lastRentEvent.timestamp;
    showRentToast(state.lastRentEvent);
  }

  // Turn Header
  if (state.status === "ended") {
    turnIndicator.textContent = `🏆 VICTORY - ${state.winner?.name} WON!`;
    victoryModal.classList.remove("hidden");
    winnerName.textContent = state.winner?.name || "Player";
    window.sounds.playVictory();
    if (window.confetti) {
      window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  } else {
    turnIndicator.textContent = isMyTurn ? "👉 YOUR TURN TO ACT" : `⏳ ${currentP?.name}'s Turn`;
    turnIndicator.style.borderColor = currentP?.color || "#3b82f6";
  }

  // Action Buttons
  hideAllActionButtons();

  if (isMyTurn && state.status === "in_progress") {
    if (state.turnPhase === "roll") {
      rollDiceBtn.removeAttribute("disabled");
      rollDiceBtn.classList.remove("hidden");
      gamePrompt.textContent = "Roll the dice to make your move!";
      if (currentP.inJail) {
        if (currentP.money >= 50) payJailBtn.classList.remove("hidden");
        if (currentP.jailCards > 0) useJailCardBtn.classList.remove("hidden");
        gamePrompt.textContent = "You are in Jail! Roll doubles, pay $50 fine, or use a Get Out of Jail card.";
      }
    } else if (state.turnPhase === "action") {
      const tile = TILES_DEF[currentP.position];
      const prop = state.properties[tile.id];

      if (prop && !prop.owner && currentP.money >= tile.cost) {
        buyPropertyBtn.classList.remove("hidden");
        buyPropertyBtn.textContent = `💰 Buy ${tile.name} ($${tile.cost})`;
        auctionBtn.classList.remove("hidden");
        gamePrompt.textContent = `You landed on ${tile.name}! Purchase it or send it to public auction.`;
      } else {
        gamePrompt.textContent = "Manage your property empire or click End Turn.";
      }

      endTurnBtn.classList.remove("hidden");
      endTurnBtn.textContent = state.lastRollDoubles ? "🎲 Extra Roll (Doubles!)" : "✓ End Turn";
    }
  } else {
    gamePrompt.textContent = `${currentP?.name} is deciding their move...`;
  }

  // Auction Overlay
  if (state.turnPhase === "auction" && state.auctionState) {
    auctionOverlay.classList.remove("hidden");
    auctionPropName.textContent = state.auctionState.tileName;
    auctionCurrentBid.textContent = `$${state.auctionState.currentBid}`;
    const leader = state.players.find(p => p.id === state.auctionState.highestBidderId);
    auctionLeader.textContent = leader ? `High bidder: ${leader.name}` : "No bids yet";

    if (auctionTimeLeft) {
      auctionTimeLeft.textContent = state.auctionState.timeLeft ?? 15;
    }

    const isHighestBidder = (myPlayer?.id === state.auctionState.highestBidderId);
    const hasPassed = state.auctionState.passedPlayerIds.includes(myPlayer?.id);
    const canAfford10 = myPlayer ? (myPlayer.money >= state.auctionState.currentBid + 10) : false;
    const canAfford50 = myPlayer ? (myPlayer.money >= state.auctionState.currentBid + 50) : false;
    const canAfford100 = myPlayer ? (myPlayer.money >= state.auctionState.currentBid + 100) : false;

    if (auctionStatusBanner) {
      if (myPlayer?.isSpectator) {
        auctionStatusBanner.textContent = "👁️ Spectating live public auction...";
        auctionStatusBanner.className = "auction-status-banner";
      } else if (isHighestBidder) {
        auctionStatusBanner.textContent = "⭐ You are the highest bidder! Waiting for timer or passes...";
        auctionStatusBanner.className = "auction-status-banner winning";
      } else if (hasPassed) {
        auctionStatusBanner.textContent = "❌ You passed on this auction. Spectating...";
        auctionStatusBanner.className = "auction-status-banner passed";
      } else {
        auctionStatusBanner.textContent = "⏱️ Place your bid or pass before time expires!";
        auctionStatusBanner.className = "auction-status-banner active";
      }
    }

    if (hasPassed || myPlayer?.bankrupt || isHighestBidder || myPlayer?.isSpectator) {
      bid10Btn.setAttribute("disabled", "true");
      bid50Btn.setAttribute("disabled", "true");
      if (bid100Btn) bid100Btn.setAttribute("disabled", "true");
      passAuctionBtn.setAttribute("disabled", "true");
    } else {
      if (canAfford10) bid10Btn.removeAttribute("disabled"); else bid10Btn.setAttribute("disabled", "true");
      if (canAfford50) bid50Btn.removeAttribute("disabled"); else bid50Btn.setAttribute("disabled", "true");
      if (bid100Btn) {
        if (canAfford100) bid100Btn.removeAttribute("disabled"); else bid100Btn.setAttribute("disabled", "true");
      }
      passAuctionBtn.removeAttribute("disabled");
    }
  } else {
    auctionOverlay.classList.add("hidden");
  }

  // Spectator View Mode Restrictions
  if (myPlayer?.isSpectator) {
    spectatorBanner?.classList.remove("hidden");
    turnIndicator.textContent = `👁️ Spectating — ⏳ ${currentP?.name}'s Turn`;
    gamePrompt.textContent = `Match in progress. Spectating active table (${state.players.length} players).`;
    hideAllActionButtons();
    document.getElementById("centerControls")?.classList.add("hidden");
    tutorialCoachBox?.classList.add("hidden");
    openTradeBtn?.classList.add("hidden");
    openCashDrawerBtn?.classList.add("hidden");
    saveGameBtn?.classList.add("hidden");
  } else {
    document.getElementById("centerControls")?.classList.remove("hidden");
  }

  // Debt Overlay
  if (state.turnPhase === "debt" && state.pendingDebt) {
    if (state.pendingDebt.playerId === myPlayer?.id) {
      debtOverlay.classList.remove("hidden");
      debtInfoText.textContent = `You owe $${state.pendingDebt.amount} for ${state.pendingDebt.reason}! (Your cash: $${myPlayer.money}). Mortgage properties or sell houses to raise cash.`;
      window.sounds.playJail();
    } else {
      debtOverlay.classList.add("hidden");
    }
  } else {
    debtOverlay.classList.add("hidden");
  }

  // Active Card Notification (Authentic Drawn Card for YOUR player, Top Toast for others)
  if (state.activeCard) {
    if (lastShownActiveCardText !== state.activeCard.text) {
      lastShownActiveCardText = state.activeCard.text;
      const isChance = state.activeCard.type === "Chance";
      const icon = isChance ? "❓" : "🧰";

      if (isMyTurn) {
        showDrawnCardModal(state.activeCard);
      } else {
        showEventToast(state.activeCard.type.toUpperCase(), state.activeCard.text, icon, "card");
      }
    }
  } else {
    lastShownActiveCardText = null;
    hideDrawnCardModal();
  }
  cardDisplay.classList.add("hidden");

  // Trade Proposal Modal
  if (state.activeTrade && state.activeTrade.toId === myPlayer?.id) {
    renderIncomingTrade(state.activeTrade, state);
  } else {
    tradeIncomingModal.classList.add("hidden");
  }

  // Render Players HUD List
  renderPlayersHUD(state);

  // Render Logs
  renderLogs(state.logs);
}

function hideAllActionButtons() {
  rollDiceBtn.classList.add("hidden");
  buyPropertyBtn.classList.add("hidden");
  auctionBtn.classList.add("hidden");
  payJailBtn.classList.add("hidden");
  useJailCardBtn.classList.add("hidden");
  endTurnBtn.classList.add("hidden");
}

// Action Button Event Listeners
rollDiceBtn.addEventListener("click", () => {
  deedModal.classList.add("hidden");
  rollDiceBtn.setAttribute("disabled", "true");
  // 3D Physical Dice roll numbers: what physically rolls IS what is played!
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  socket.emit("roll_dice", { roomId: currentRoomId, d1, d2, sessionToken, playerId: myPlayer?.id });

  // Failsafe timer: if server doesn't advance within 2.5s, re-enable roll button
  clearTimeout(window._rollFailsafeTimer);
  window._rollFailsafeTimer = setTimeout(() => {
    if (gameState && gameState.turnPhase === "roll") {
      rollDiceBtn.removeAttribute("disabled");
      rollDiceBtn.classList.remove("hidden");
    }
  }, 2500);
});

buyPropertyBtn.addEventListener("click", () => {
  deedModal.classList.add("hidden");
  socket.emit("buy_property", { roomId: currentRoomId, sessionToken, playerId: myPlayer?.id });
  window.sounds.playCash();
  if (scene3D) scene3D.spawnGoldCoinFountain();
});

auctionBtn.addEventListener("click", () => {
  deedModal.classList.add("hidden");
  if (gameState) {
    const currentP = gameState.players[gameState.turnIndex];
    socket.emit("start_auction", { roomId: currentRoomId, propertyId: currentP.position, sessionToken, playerId: myPlayer?.id });
  }
});

payJailBtn.addEventListener("click", () => {
  deedModal.classList.add("hidden");
  socket.emit("pay_jail_fine", { roomId: currentRoomId, sessionToken, playerId: myPlayer?.id });
});

useJailCardBtn.addEventListener("click", () => {
  deedModal.classList.add("hidden");
  socket.emit("use_jail_card", { roomId: currentRoomId, sessionToken, playerId: myPlayer?.id });
});

endTurnBtn.addEventListener("click", () => {
  deedModal.classList.add("hidden");
  socket.emit("end_turn", { roomId: currentRoomId, sessionToken, playerId: myPlayer?.id });
});

socket.on("action_error", (data) => {
  console.warn("Server action error:", data);
  if (data?.action === "roll_dice") {
    rollDiceBtn.removeAttribute("disabled");
    rollDiceBtn.classList.remove("hidden");
  }
  showEventToast("ACTION NOTICE", data.error || "Action could not be completed.", "⚠️", "info");
});
dismissCardBtn.addEventListener("click", () => cardDisplay.classList.add("hidden"));

function showDrawnCardModal(card) {
  if (!cardModalBackdrop || !physicalDrawnCard) return;
  const isChance = card.type === "Chance";
  physicalDrawnCard.className = `physical-drawn-card ${isChance ? "chance-card-theme" : "chest-card-theme"}`;
  if (drawnCardTypeLabel) drawnCardTypeLabel.textContent = isChance ? "CHANCE" : "COMMUNITY CHEST";
  if (drawnCardEmblemIcon) drawnCardEmblemIcon.textContent = isChance ? "❓" : "🧰";
  if (drawnCardInstructionText) drawnCardInstructionText.textContent = card.text || "Follow card instructions.";
  if (drawnCardFlavor) drawnCardFlavor.textContent = isChance ? "TAKE A RIDE WITH DESTINY" : "COMMUNITY WEALTH & CHARITY";
  cardModalBackdrop.classList.remove("hidden");
  if (window.sounds && typeof window.sounds.playCard === "function") window.sounds.playCard(isChance ? "chance" : "community");
}

function hideDrawnCardModal() {
  if (cardModalBackdrop) cardModalBackdrop.classList.add("hidden");
}

closeCardDrawnBtn?.addEventListener("click", hideDrawnCardModal);
dismissDrawnCardBtn?.addEventListener("click", hideDrawnCardModal);
cardModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === cardModalBackdrop) hideDrawnCardModal();
});

// Auction
bid10Btn.addEventListener("click", () => {
  if (gameState?.auctionState) {
    socket.emit("place_bid", { roomId: currentRoomId, amount: gameState.auctionState.currentBid + 10, sessionToken, playerId: myPlayer?.id });
    window.sounds?.playCash();
  }
});

bid50Btn.addEventListener("click", () => {
  if (gameState?.auctionState) {
    socket.emit("place_bid", { roomId: currentRoomId, amount: gameState.auctionState.currentBid + 50, sessionToken, playerId: myPlayer?.id });
    window.sounds?.playCash();
  }
});

bid100Btn?.addEventListener("click", () => {
  if (gameState?.auctionState) {
    socket.emit("place_bid", { roomId: currentRoomId, amount: gameState.auctionState.currentBid + 100, sessionToken, playerId: myPlayer?.id });
    window.sounds?.playCash();
  }
});

passAuctionBtn.addEventListener("click", () => socket.emit("pass_bid", { roomId: currentRoomId, sessionToken, playerId: myPlayer?.id }));

// Collapsible Sidebar Controls
closeSidebarBtn?.addEventListener("click", () => {
  hudRightSidebar?.classList.add("collapsed");
  openSidebarBtn?.classList.remove("hidden");
});

openSidebarBtn?.addEventListener("click", () => {
  hudRightSidebar?.classList.remove("collapsed");
  openSidebarBtn?.classList.add("hidden");
});

// Debt
settleDebtBtn.addEventListener("click", () => socket.emit("pay_debt", { roomId: currentRoomId }));
bankruptBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to declare bankruptcy and forfeit your assets?")) {
    socket.emit("declare_bankruptcy", { roomId: currentRoomId });
    window.sounds.playJail();
  }
});

// Render Players HUD
function renderPlayersHUD(state) {
  hudPlayerCount.textContent = state.players.length;
  playersHudList.innerHTML = "";

  state.players.forEach((p, idx) => {
    const isCurrent = idx === state.turnIndex;
    const card = document.createElement("div");
    card.className = `player-hud-card ${isCurrent ? "active-turn" : ""} ${p.bankrupt ? "bankrupt" : ""}`;
    card.style.borderLeft = `4px solid ${p.color}`;

    const ownedProps = (state.properties || []).filter(pr => pr && pr.owner === p.id);
    const propsCount = ownedProps.length;

    let propPillsHtml = "";
    if (ownedProps.length > 0) {
      propPillsHtml = '<div class="player-prop-pills">';
      ownedProps.forEach(pr => {
        const t = TILES_DEF[pr.id];
        const color = t ? (t.color || (t.type === "railroad" ? "#334155" : "#eab308")) : "#64748b";
        let devBadge = "";
        if (pr.houses === 5) devBadge = "🏨";
        else if (pr.houses > 0) devBadge = ` (${pr.houses}H)`;
        propPillsHtml += `<span class="player-prop-pill" style="background:${color};" title="${t ? t.name : 'Property'}${devBadge}" onclick="window.showTitleDeedModal(${pr.id})"></span>`;
      });
      propPillsHtml += '</div>';
    }

    const isUno = state.gameType === "uno";
    const balanceText = isUno ? `🃏 ${p.cardCount || (p.hand ? p.hand.length : 0)}` : `$${p.money}`;
    const badgeText = isUno
      ? (p.cardCount === 1 ? '<span style="color:#ef4444;font-weight:900;">🔥 UNO!</span>' : `${p.cardCount || (p.hand ? p.hand.length : 0)} Cards`)
      : (p.bankrupt ? '<span style="color:#ef4444;font-weight:700;">BANKRUPT</span>' : `Props: ${propsCount} ${p.inJail ? '• 🔒 JAIL' : ''}`);

    card.innerHTML = `
      <div class="player-info-left" style="width: 100%;">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="player-avatar" style="background:${p.color}">${p.token}</div>
            <div class="player-details">
              <div class="name">${p.name} ${p.isBot ? "🤖" : ""} ${p.id === myPlayer?.id ? "<strong>(You)</strong>" : ""}</div>
              <div class="badges">${badgeText}</div>
            </div>
          </div>
          <div class="player-balance">${balanceText}</div>
        </div>
        ${!isUno ? propPillsHtml : ''}
      </div>
    `;
    playersHudList.appendChild(card);
  });
}

// Render Logs & Chat
function renderLogs(logs) {
  if (!logs) return;
  gameLogList.innerHTML = "";
  logs.forEach(item => {
    const row = document.createElement("div");
    row.className = "log-item";
    row.innerHTML = `<span class="time">${item.time}</span> ${item.text}`;
    gameLogList.appendChild(row);
  });
  gameLogList.scrollTop = gameLogList.scrollHeight;
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text && currentRoomId) {
    socket.emit("send_chat", { roomId: currentRoomId, message: text });
    chatInput.value = "";
  }
});

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

socket.on("chat_message", ({ sender, message, time }) => {
  const row = document.createElement("div");
  row.className = "log-item";
  const safeTime = escapeHTML(time);
  const safeSender = escapeHTML(sender);
  const safeMsg = escapeHTML(message);
  row.innerHTML = `<span class="time">${safeTime}</span> <strong>${safeSender}:</strong> ${safeMsg}`;
  chatMessagesList.appendChild(row);
  chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-tab");
    document.getElementById(target).classList.add("active");
  });
});

// ================= AUTHENTIC 3D TITLE DEED VIEWER =================
window.onTileClicked = function(tileId) {
  showTitleDeed(tileId);
};
window.showTitleDeedModal = function(tileId, options) {
  showTitleDeed(tileId, options);
};

function showTitleDeed(tileId, options) {
  const tile = TILES_DEF[tileId];
  if (!tile || (tile.type !== "property" && tile.type !== "railroad" && tile.type !== "utility")) return;

  deedModal.classList.remove("hidden");
  deedPropName.textContent = tile.name.toUpperCase();
  deedHeader.style.backgroundColor = tile.color || "#1e293b";

  const prop = gameState?.properties ? gameState.properties[tileId] : null;
  let statusBannerHtml = "";

  if (prop && prop.owner) {
    const ownerP = gameState.players ? gameState.players.find(p => p.id === prop.owner) : null;
    statusBannerHtml = `
      <div style="margin-bottom:10px;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,0.18);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;">
        <span>OWNER:</span>
        <span style="color:${ownerP?.color || '#3b82f6'};">${ownerP?.token || ''} ${ownerP?.name || 'Player'}</span>
        ${prop.mortgaged ? '<span style="color:#ef4444;">(MORTGAGED)</span>' : (prop.houses === 5 ? '<span>🏨 HOTEL</span>' : (prop.houses > 0 ? `<span>(${prop.houses}H)</span>` : ''))}
      </div>
    `;
  } else {
    statusBannerHtml = `
      <div style="margin-bottom:10px;padding:6px 10px;border-radius:6px;background:rgba(16,185,129,0.15);color:#10b981;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;">
        <span>STATUS:</span>
        <span>UNOWNED • $${tile.cost}</span>
      </div>
    `;
  }

  let buyBtnHtml = "";
  if (options && options.canBuy) {
    buyBtnHtml = `<button id="deedQuickBuyBtn" class="btn btn-success" style="width:100%;margin-top:10px;padding:8px 14px;font-weight:800;font-size:14px;box-shadow:0 4px 12px rgba(16,185,129,0.4);">💰 Buy This Property ($${tile.cost})</button>`;
  }

  if (tile.type === "property") {
    const rents = tile.rents || [10, 50, 150, 450, 625, 750];
    const houseCost = tile.houseCost || 100;
    const mortgage = tile.mortgage || Math.floor((tile.cost || 100) / 2);
    const d = {
      rent: rents[0],
      h1: rents[1],
      h2: rents[2],
      h3: rents[3],
      h4: rents[4],
      hotel: rents[5],
      houseCost,
      mortgage
    };
    deedBody.innerHTML = `
      ${statusBannerHtml}
      <div class="deed-rent-main">RENT $${d.rent}</div>
      <div class="deed-row"><span>With 1 House</span><strong>$${d.h1}</strong></div>
      <div class="deed-row"><span>With 2 Houses</span><strong>$${d.h2}</strong></div>
      <div class="deed-row"><span>With 3 Houses</span><strong>$${d.h3}</strong></div>
      <div class="deed-row"><span>With 4 Houses</span><strong>$${d.h4}</strong></div>
      <div class="deed-row" style="font-weight:800;color:#dc2626;"><span>With HOTEL</span><strong>$${d.hotel}</strong></div>
      <div class="deed-divider"></div>
      <div class="deed-row"><span>Mortgage Value</span><strong>$${d.mortgage}</strong></div>
      <div class="deed-row"><span>Houses Cost Each</span><strong>$${d.houseCost}</strong></div>
      <div class="deed-row"><span>Hotels, $${d.houseCost} plus 4 houses</span></div>
      <div class="deed-footer">If a player owns ALL lots of any Color-Group, the rent of unimproved lots in that group is DOUBLED.</div>
      ${buyBtnHtml}
    `;
  } else if (tile.type === "railroad") {
    deedBody.innerHTML = `
      ${statusBannerHtml}
      <div style="font-size:32px;margin-bottom:6px;">🚂</div>
      <div class="deed-rent-main">RENT $25</div>
      <div class="deed-row"><span>If 2 Railroads are owned</span><strong>$50</strong></div>
      <div class="deed-row"><span>If 3 Railroads are owned</span><strong>$100</strong></div>
      <div class="deed-row"><span>If 4 Railroads are owned</span><strong>$200</strong></div>
      <div class="deed-divider"></div>
      <div class="deed-row"><span>Mortgage Value</span><strong>$100</strong></div>
      ${buyBtnHtml}
    `;
  } else if (tile.type === "utility") {
    deedBody.innerHTML = `
      ${statusBannerHtml}
      <div style="font-size:32px;margin-bottom:6px;">💡</div>
      <div style="font-weight:700;margin-bottom:8px;">UTILITY DEED</div>
      <p style="font-size:12px;margin-bottom:8px;">If ONE Utility is owned, rent is 4 times amount shown on dice.</p>
      <p style="font-size:12px;margin-bottom:8px;">If BOTH Utilities are owned, rent is 10 times amount shown on dice.</p>
      <div class="deed-divider"></div>
      <div class="deed-row"><span>Mortgage Value</span><strong>$75</strong></div>
      ${buyBtnHtml}
    `;
  }

  const quickBuyBtn = document.getElementById("deedQuickBuyBtn");
  if (quickBuyBtn) {
    quickBuyBtn.addEventListener("click", () => {
      socket.emit("buy_property", { roomId: currentRoomId });
      if (window.sounds) window.sounds.playCash();
      if (scene3D) scene3D.spawnGoldCoinFountain();
      deedModal.classList.add("hidden");
    });
  }
}

closeDeedModal.addEventListener("click", () => deedModal.classList.add("hidden"));
deedModal.addEventListener("click", (e) => {
  if (e.target === deedModal) deedModal.classList.add("hidden");
});

// 3D Card Interactive Tilt
deedModal.addEventListener("mousemove", (e) => {
  const card = titleDeedCard;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  const rotX = -(y / rect.height) * 16;
  const rotY = (x / rect.width) * 16;
  card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
});

deedModal.addEventListener("mouseleave", () => {
  titleDeedCard.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
});

// ================= PROPERTY PORTFOLIO & DEVELOPMENT MODAL =================
openPropertiesBtn.addEventListener("click", () => {
  if (!gameState || !myPlayer) return;
  renderPropertyPortfolio();
  propertiesModal.classList.remove("hidden");
});

closePropertiesModal.addEventListener("click", () => propertiesModal.classList.add("hidden"));

function renderPropertyPortfolio() {
  const propertyPortfolioList = document.getElementById("propertyPortfolioList");
  const jailCardsContainer = document.getElementById("jailCardsContainer");
  if (!propertyPortfolioList) return;

  // 1. Render Special Assets / Jail Cards
  if (jailCardsContainer) {
    jailCardsContainer.innerHTML = "";
    const jailCardsCount = myPlayer?.jailCards || 0;
    if (jailCardsCount > 0) {
      const jCard = document.createElement("div");
      jCard.className = "jail-card-item";
      jCard.innerHTML = `
        <div class="jail-card-emblem">🗝️</div>
        <div class="jail-card-info">
          <div class="jail-card-title">GET OUT OF JAIL FREE</div>
          <div class="jail-card-desc">This card may be kept until needed, traded with players, or played to immediately leave Jail without paying the $50 fine.</div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px;">
            <span class="jail-card-badge">OWNED: ${jailCardsCount} CARD${jailCardsCount > 1 ? 'S' : ''}</span>
            ${myPlayer?.inJail ? `<button id="useJailCardPortfolioBtn" class="btn btn-sm btn-success">🗝️ Play Card to Escape Jail</button>` : ''}
          </div>
        </div>
      `;
      jailCardsContainer.appendChild(jCard);

      const useBtn = document.getElementById("useJailCardPortfolioBtn");
      if (useBtn) {
        useBtn.addEventListener("click", () => {
          socket.emit("use_jail_card", { roomId: currentRoomId });
          propertiesModal.classList.add("hidden");
        });
      }
    } else {
      jailCardsContainer.innerHTML = `
        <div class="jail-card-empty">
          <div style="font-size:22px;margin-bottom:4px;">🔒</div>
          <div style="font-weight:700;">No Get Out of Jail Free Cards in inventory.</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Draw from Chance or Community Chest, or acquire via player Trade.</div>
        </div>
      `;
    }
  }

  // 2. Render Property Visual Title Deed Cards
  propertyPortfolioList.innerHTML = "";
  const myProps = (gameState?.properties || []).filter(p => p && p.owner === myPlayer?.id);

  if (myProps.length === 0) {
    propertyPortfolioList.innerHTML = '<p style="color:#94a3b8;grid-column: 1 / -1;padding:16px 0;">You do not own any properties yet. Roll dice, land on unowned spaces, or win auctions!</p>';
    return;
  }

  myProps.forEach(prop => {
    const tile = TILES_DEF[prop.id];
    if (!tile) return;
    const card = document.createElement("div");
    card.className = `title-deed-mini-card ${prop.mortgaged ? 'mortgaged' : ''}`;

    let devBadge = '<span style="color:#64748b;">Unimproved</span>';
    if (prop.houses === 5) {
      devBadge = '<span style="color:#dc2626;font-weight:800;">🏨 Hotel (Max)</span>';
    } else if (prop.houses > 0) {
      devBadge = `<span style="color:#16a34a;font-weight:800;">🏠 ${'🏠'.repeat(prop.houses - 1)} (${prop.houses}H)</span>`;
    }

    // Check if player owns complete color monopoly
    let ownsMonopoly = false;
    const groupMembersLookup = window.GROUP_MEMBERS || {};
    if (tile.group && groupMembersLookup[tile.group]) {
      const grp = groupMembersLookup[tile.group];
      ownsMonopoly = grp.every(tid => gameState.properties[tid]?.owner === myPlayer?.id && !gameState.properties[tid]?.mortgaged);
    }

    let currentRent = 0;
    if (tile.type === "property") {
      if (prop.houses > 0) currentRent = tile.rents[prop.houses];
      else currentRent = ownsMonopoly ? tile.rents[0] * 2 : tile.rents[0];
    } else if (tile.type === "railroad") {
      const rrCount = [5, 15, 25, 35].filter(id => gameState.properties[id]?.owner === myPlayer?.id).length;
      currentRent = 25 * Math.pow(2, Math.max(0, rrCount - 1));
    } else if (tile.type === "utility") {
      currentRent = "4x / 10x Dice";
    }

    const houseCost = tile.houseCost || 100;
    const mortgageVal = tile.mortgage || Math.floor((tile.cost || 100) / 2);

    card.innerHTML = `
      <div class="mini-deed-header" style="background:${tile.color || '#334155'};">
        <div class="mini-deed-label">TITLE DEED</div>
        <div class="mini-deed-name">${tile.name.toUpperCase()}</div>
      </div>
      <div class="mini-deed-body">
        <div class="mini-deed-status">
          <span>STATUS:</span>
          <span>${prop.mortgaged ? '<strong style="color:#ef4444;">MORTGAGED</strong>' : devBadge}</span>
        </div>
        <div class="mini-deed-rent">RENT: $${currentRent}</div>
        <div class="mini-deed-detail-row"><span>Purchase Cost:</span><strong>$${tile.cost || 0}</strong></div>
        <div class="mini-deed-detail-row"><span>Mortgage Value:</span><strong>$${mortgageVal}</strong></div>
        ${tile.type === "property" ? `<div class="mini-deed-detail-row"><span>House Cost:</span><strong>$${houseCost}</strong></div>` : ''}
        ${ownsMonopoly ? `<div style="font-size:10px;font-weight:800;color:#16a34a;margin-top:4px;">⭐ FULL MONOPOLY OWNED</div>` : ''}
      </div>
      <div class="mini-deed-actions">
        ${tile.type === "property" && !prop.mortgaged ? `
          ${prop.houses < 5 ? `<button class="btn btn-sm btn-success build-btn" data-id="${prop.id}" ${!ownsMonopoly ? 'title="Must own full color group to build"' : ''}>+ Buy ${prop.houses === 4 ? 'Hotel' : 'House'} ($${houseCost})</button>` : ''}
          ${prop.houses > 0 ? `<button class="btn btn-sm btn-outline sell-btn" data-id="${prop.id}">- Sell ${prop.houses === 5 ? 'Hotel' : 'House'} (+$${Math.floor(houseCost / 2)})</button>` : ''}
        ` : ''}
        ${!prop.mortgaged && prop.houses === 0 ? `
          <button class="btn btn-sm btn-outline mort-btn" data-id="${prop.id}">Mortgage (+$${mortgageVal})</button>
        ` : ''}
        ${prop.mortgaged ? `
          <button class="btn btn-sm btn-warning unmort-btn" data-id="${prop.id}">Unmortgage (-$${Math.round(tile.cost * 0.55)})</button>
        ` : ''}
      </div>
    `;

    propertyPortfolioList.appendChild(card);
  });

  // Re-attach listeners
  propertyPortfolioList.querySelectorAll(".build-btn").forEach(b => {
    b.addEventListener("click", () => {
      const pid = Number(b.getAttribute("data-id"));
      socket.emit("build_house", { roomId: currentRoomId, propertyId: pid });
      setTimeout(renderPropertyPortfolio, 350);
    });
  });

  propertyPortfolioList.querySelectorAll(".sell-btn").forEach(b => {
    b.addEventListener("click", () => {
      const pid = Number(b.getAttribute("data-id"));
      socket.emit("sell_house", { roomId: currentRoomId, propertyId: pid });
      setTimeout(renderPropertyPortfolio, 350);
    });
  });

  propertyPortfolioList.querySelectorAll(".mort-btn").forEach(b => {
    b.addEventListener("click", () => {
      const pid = Number(b.getAttribute("data-id"));
      socket.emit("mortgage_property", { roomId: currentRoomId, propertyId: pid });
      setTimeout(renderPropertyPortfolio, 350);
    });
  });

  propertyPortfolioList.querySelectorAll(".unmort-btn").forEach(b => {
    b.addEventListener("click", () => {
      const pid = Number(b.getAttribute("data-id"));
      socket.emit("unmortgage_property", { roomId: currentRoomId, propertyId: pid });
      setTimeout(renderPropertyPortfolio, 350);
    });
  });
}

// ================= TRADING MODAL =================
openTradeBtn.addEventListener("click", () => {
  if (!gameState || !myPlayer) return;
  renderTradeSetup();
  tradeModal.classList.remove("hidden");
});

closeTradeModal.addEventListener("click", () => tradeModal.classList.add("hidden"));

function renderTradeSetup() {
  tradeTargetSelect.innerHTML = "";
  const otherPlayers = gameState.players.filter(p => p.id !== myPlayer.id && !p.bankrupt);
  otherPlayers.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} ($${p.money})`;
    tradeTargetSelect.appendChild(opt);
  });

  updateTradePropertyCheckboxes();
  tradeTargetSelect.addEventListener("change", updateTradePropertyCheckboxes);
}

function updateTradePropertyCheckboxes() {
  const targetId = tradeTargetSelect.value;
  tradeMyPropertiesList.innerHTML = "";
  tradeTargetPropertiesList.innerHTML = "";

  const myProps = gameState.properties.filter(p => p && p.owner === myPlayer.id && p.houses === 0);
  myProps.forEach(p => {
    const tile = TILES_DEF[p.id];
    const div = document.createElement("label");
    div.className = "checkbox-item";
    div.innerHTML = `<input type="checkbox" name="myProp" value="${p.id}"> ${tile.name}`;
    tradeMyPropertiesList.appendChild(div);
  });

  const targetProps = gameState.properties.filter(p => p && p.owner === targetId && p.houses === 0);
  targetProps.forEach(p => {
    const tile = TILES_DEF[p.id];
    const div = document.createElement("label");
    div.className = "checkbox-item";
    div.innerHTML = `<input type="checkbox" name="targetProp" value="${p.id}"> ${tile.name}`;
    tradeTargetPropertiesList.appendChild(div);
  });
}

submitTradeBtn.addEventListener("click", () => {
  const targetId = tradeTargetSelect.value;
  const offerCash = Number(tradeOfferCash.value) || 0;
  const requestCash = Number(tradeRequestCash.value) || 0;

  const offerProps = Array.from(tradeMyPropertiesList.querySelectorAll("input:checked")).map(cb => Number(cb.value));
  const requestProps = Array.from(tradeTargetPropertiesList.querySelectorAll("input:checked")).map(cb => Number(cb.value));

  socket.emit("propose_trade", {
    roomId: currentRoomId,
    tradeData: {
      toId: targetId,
      offerMoney: offerCash,
      offerProperties: offerProps,
      requestMoney: requestCash,
      requestProperties: requestProps
    }
  });

  tradeModal.classList.add("hidden");
  alert("Deal proposal transmitted!");
});

function renderIncomingTrade(trade, state) {
  tradeIncomingModal.classList.remove("hidden");
  const fromP = state.players.find(p => p.id === trade.fromId);
  incomingTradeSummary.textContent = `${fromP?.name} is proposing a deal with you!`;

  let offerList = [];
  if (trade.offerMoney > 0) offerList.push(`Cash: $${trade.offerMoney}`);
  trade.offerProperties.forEach(pid => offerList.push(TILES_DEF[pid].name));
  incomingTheyOffer.innerHTML = offerList.length ? offerList.map(item => `<div>• ${item}</div>`).join("") : "<em>Nothing</em>";

  let reqList = [];
  if (trade.requestMoney > 0) reqList.push(`Cash: $${trade.requestMoney}`);
  trade.requestProperties.forEach(pid => reqList.push(TILES_DEF[pid].name));
  incomingTheyRequest.innerHTML = reqList.length ? reqList.map(item => `<div>• ${item}</div>`).join("") : "<em>Nothing</em>";
}

acceptTradeBtn.addEventListener("click", () => {
  socket.emit("respond_trade", { roomId: currentRoomId, accept: true });
  tradeIncomingModal.classList.add("hidden");
  window.sounds.playCash();
  if (scene3D) scene3D.spawnGoldCoinFountain();
});

declineTradeBtn.addEventListener("click", () => {
  socket.emit("respond_trade", { roomId: currentRoomId, accept: false });
  tradeIncomingModal.classList.add("hidden");
});

playAgainBtn.addEventListener("click", () => {
  window.history.replaceState({}, document.title, window.location.pathname);
  window.location.reload();
});

// ================= DEVELOPER TOOLS PANEL (Passcode: 125) =================
const openDevToolsBtn = document.getElementById("openDevToolsBtn");
const devModal = document.getElementById("devModal");
const closeDevModalBtn = document.getElementById("closeDevModalBtn");
const devLockScreen = document.getElementById("devLockScreen");
const devControlsScreen = document.getElementById("devControlsScreen");
const devPassInput = document.getElementById("devPassInput");
const devUnlockBtn = document.getElementById("devUnlockBtn");
const devPassError = document.getElementById("devPassError");
const devTeleportSelect = document.getElementById("devTeleportSelect");
const devTeleportBtn = document.getElementById("devTeleportBtn");
const devStimulusBtn = document.getElementById("devStimulusBtn");
const devDie1 = document.getElementById("devDie1");
const devDie2 = document.getElementById("devDie2");
const devForceRollBtn = document.getElementById("devForceRollBtn");
const devDrawChanceBtn = document.getElementById("devDrawChanceBtn");
const devDrawChestBtn = document.getElementById("devDrawChestBtn");
const devSendJailBtn = document.getElementById("devSendJailBtn");
const devReleaseJailBtn = document.getElementById("devReleaseJailBtn");
const devGiveMonopolyBtn = document.getElementById("devGiveMonopolyBtn");
const devBuildHotelCurrentBtn = document.getElementById("devBuildHotelCurrentBtn");

let isDevUnlocked = false;

function populateDevTeleportSelect() {
  if (!devTeleportSelect || devTeleportSelect.options.length > 0) return;
  const defs = window.TILES_DEF || TILES_DEF;
  if (!defs) return;
  defs.forEach(tile => {
    const opt = document.createElement("option");
    opt.value = tile.id;
    opt.textContent = `${tile.id}: ${tile.name} (${tile.type})`;
    devTeleportSelect.appendChild(opt);
  });
}

function openDevModal() {
  if (!devModal) return;
  devModal.classList.remove("hidden");
  if (isDevUnlocked) {
    devLockScreen?.classList.add("hidden");
    devControlsScreen?.classList.remove("hidden");
    populateDevTeleportSelect();
  } else {
    devLockScreen?.classList.remove("hidden");
    devControlsScreen?.classList.add("hidden");
    devPassError?.classList.add("hidden");
    if (devPassInput) {
      devPassInput.value = "";
      devPassInput.focus();
    }
  }
}

function handleDevUnlock() {
  const code = devPassInput ? devPassInput.value.trim() : "";
  if (code === "125") {
    isDevUnlocked = true;
    devLockScreen?.classList.add("hidden");
    devControlsScreen?.classList.remove("hidden");
    populateDevTeleportSelect();
  } else {
    devPassError?.classList.remove("hidden");
  }
}

openDevToolsBtn?.addEventListener("click", () => {
  settingsModal?.classList.add("hidden");
  openDevModal();
});
closeDevModalBtn?.addEventListener("click", () => devModal?.classList.add("hidden"));
devUnlockBtn?.addEventListener("click", handleDevUnlock);
devPassInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleDevUnlock();
});

devTeleportBtn?.addEventListener("click", () => {
  const tileId = parseInt(devTeleportSelect.value);
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "teleport",
    payload: { tileId }
  });
});

document.querySelectorAll(".dev-money-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const amt = btn.getAttribute("data-amt");
    const setVal = btn.getAttribute("data-set");
    if (amt) {
      socket.emit("dev_action", {
        roomId: currentRoomId,
        password: "125",
        action: "set_money",
        payload: { amount: parseInt(amt), isDelta: true }
      });
    } else if (setVal) {
      socket.emit("dev_action", {
        roomId: currentRoomId,
        password: "125",
        action: "set_money",
        payload: { amount: parseInt(setVal), isDelta: false }
      });
    }
  });
});

devStimulusBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "add_cash_all",
    payload: { amount: 1000 }
  });
});

devForceRollBtn?.addEventListener("click", () => {
  const d1 = parseInt(devDie1.value);
  const d2 = parseInt(devDie2.value);
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "force_roll",
    payload: { d1, d2 }
  });
});

devDrawChanceBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "trigger_card",
    payload: { type: "chance" }
  });
});

devDrawChestBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "trigger_card",
    payload: { type: "community_chest" }
  });
});

devSendJailBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "force_jail"
  });
});

devReleaseJailBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "release_jail"
  });
});

devGiveMonopolyBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "give_monopoly"
  });
});

devBuildHotelCurrentBtn?.addEventListener("click", () => {
  socket.emit("dev_action", {
    roomId: currentRoomId,
    password: "125",
    action: "build_hotel"
  });
});

// ================= PERSISTENT SAVE & RESUME SYSTEM =================
if (saveGameBtn) {
  saveGameBtn.addEventListener("click", () => {
    if (!currentRoomId) return alert("No active game room to save!");
    socket.emit("save_game", { roomId: currentRoomId }, (res) => {
      if (res && res.error) {
        alert("Error saving game: " + res.error);
      } else {
        if (window.sounds) window.sounds.playSave();
        // Export local JSON backup
        if (gameState) {
          try {
            const blob = new Blob([JSON.stringify(gameState, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Monopoly3D_Save_${currentRoomId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error("Local save download err:", e);
          }
        }
        if (gamePrompt) gamePrompt.textContent = `💾 Game saved successfully! (Room: ${currentRoomId}) Snapshot stored on server.`;
      }
    });
  });
}

function openResumeModal() {
  if (!savedGamesModal) return;
  savedGamesModal.classList.remove("hidden");
  loadSavedGamesList();
}

function loadSavedGamesList() {
  if (!savedGamesList) return;
  savedGamesList.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">Fetching saves...</div>';
  socket.emit("list_saved_games", (res) => {
    savedGamesList.innerHTML = "";
    const saves = (res && res.saves) ? res.saves : [];
    if (saves.length === 0) {
      savedGamesList.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">No server save files found. You can upload an exported .json save file below!</div>';
      return;
    }
    saves.forEach(s => {
      const item = document.createElement("div");
      item.className = "saved-game-item";
      const dateStr = new Date(s.timestamp).toLocaleString();
      item.innerHTML = `
        <div class="saved-game-info">
          <div class="saved-game-title">Room: ${s.roomId} (${s.playersCount} Players)</div>
          <div class="saved-game-meta">Saved: ${dateStr}</div>
        </div>
        <button class="btn btn-sm btn-primary resume-btn" data-room="${s.roomId}">Resume</button>
      `;
      savedGamesList.appendChild(item);
    });

    savedGamesList.querySelectorAll(".resume-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const rId = btn.getAttribute("data-room");
        resumeRoom(rId);
      });
    });
  });
}

function resumeRoom(roomId, saveState) {
  const name = playerNameInput.value.trim() || "Player";
  socket.emit("load_saved_game", { roomId, playerName: name, saveState }, (res) => {
    if (res && res.error) {
      alert("Error loading save: " + res.error);
    } else {
      currentRoomId = res.roomId;
      myPlayer = res.player;
      if (savedGamesModal) savedGamesModal.classList.add("hidden");
      if (window.sounds) window.sounds.playSave();
    }
  });
}

if (openResumeModalBtn) openResumeModalBtn.addEventListener("click", openResumeModal);
if (closeSavedGamesModalBtn) closeSavedGamesModalBtn.addEventListener("click", () => savedGamesModal?.classList.add("hidden"));
savedGamesModal?.addEventListener("click", (e) => {
  if (e.target === savedGamesModal) savedGamesModal.classList.add("hidden");
});
if (refreshSavesBtn) refreshSavesBtn.addEventListener("click", loadSavedGamesList);
if (uploadSaveFileBtn && loadSaveFileInput) {
  uploadSaveFileBtn.addEventListener("click", () => loadSaveFileInput.click());
  loadSaveFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        const roomId = data.roomId || "RESUME-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        data.roomId = roomId;
        resumeRoom(roomId, data);
      } catch (err) {
        alert("Invalid save file: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}

// ================= INTERACTIVE RULES & TUTORIAL SYSTEM =================
const openRulesBtn = document.getElementById("openRulesBtn");
const sidebarOpenModalBtn = document.getElementById("sidebarOpenModalBtn");
const rulesModal = document.getElementById("rulesModal");
const closeRulesModalBtn = document.getElementById("closeRulesModalBtn");
const tutorialCoachBox = document.getElementById("tutorialCoachBox");
const toggleCoachBtn = document.getElementById("toggleCoachBtn");
const coachText = document.getElementById("coachText");
const coachTipsCheckbox = document.getElementById("coachTipsCheckbox");

let coachEnabled = localStorage.getItem("monopoly_coach_tips") !== "false";

function applyCoachPreference() {
  if (!tutorialCoachBox) return;
  if (coachEnabled) {
    tutorialCoachBox.classList.remove("hidden");
    tutorialCoachBox.style.display = "";
    tutorialCoachBox.classList.remove("minimized");
    if (toggleCoachBtn) {
      toggleCoachBtn.textContent = "Tips: ON";
      toggleCoachBtn.style.color = "#7dd3fc";
    }
  } else {
    // Completely hide tutorial coach from screen when tips are OFF
    tutorialCoachBox.classList.add("hidden");
    tutorialCoachBox.style.display = "none";
    if (toggleCoachBtn) {
      toggleCoachBtn.textContent = "Tips: OFF";
      toggleCoachBtn.style.color = "#94a3b8";
    }
  }
  if (coachTipsCheckbox) {
    coachTipsCheckbox.checked = coachEnabled;
  }
}
applyCoachPreference();

toggleCoachBtn?.addEventListener("click", () => {
  coachEnabled = !coachEnabled;
  localStorage.setItem("monopoly_coach_tips", coachEnabled ? "true" : "false");
  applyCoachPreference();
  if (coachEnabled) updateCoachGuidance(gameState);
});

// Open / Close Rules Modal
function openRulesModal(defaultTab = "rulesQuick") {
  const modal = document.getElementById("rulesModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  switchRulesTab(defaultTab);
}

openRulesBtn?.addEventListener("click", () => openRulesModal("rulesQuick"));
sidebarOpenModalBtn?.addEventListener("click", () => openRulesModal("rulesSimulator"));
closeRulesModalBtn?.addEventListener("click", () => document.getElementById("rulesModal")?.classList.add("hidden"));
document.getElementById("rulesModal")?.addEventListener("click", (e) => {
  const modal = document.getElementById("rulesModal");
  if (e.target === modal) modal.classList.add("hidden");
});

// Category Tab Switching inside Rules Modal
function switchRulesTab(tabId) {
  document.querySelectorAll(".rules-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-rules-tab") === tabId);
  });
  document.querySelectorAll(".rules-section-content").forEach(sec => {
    sec.style.display = (sec.id === tabId) ? "block" : "none";
  });
}

document.querySelectorAll(".rules-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-rules-tab");
    switchRulesTab(tabId);
  });
});

// Interactive 5-Stage Walkthrough Simulator
const simSteps = [
  {
    badge: "STEP 1 OF 5",
    title: "Rolling the Bone Dice & Moving",
    visual: "🎲 🎲 ➡️ 📍",
    explanation: "You start on GO with $1,500 cash. On your turn, you toss the bone dice and roll a 3 and 5 (total 8). Your token hops 8 spaces forward and lands on <strong>Vermont Avenue</strong> ($100).",
    nextLabel: "Next: Buying Property →"
  },
  {
    badge: "STEP 2 OF 5",
    title: "Buying Property vs. Live Auction",
    visual: "💰 🏛️ 🔨",
    explanation: "Because Vermont Avenue is unowned, you can <strong>Buy it for $100</strong> to claim its title deed. If you decline, it goes to an open <strong>Auction</strong> where all players can bid starting at just $10!",
    nextLabel: "Next: Collecting Passive Rent →"
  },
  {
    badge: "STEP 3 OF 5",
    title: "Collecting Passive Rent Income",
    visual: "🪙 💸 📈",
    explanation: "Once you own Vermont Ave, every opponent who lands on it must immediately pay you rent! As the game progresses, properties provide continuous passive revenue to fund your empire.",
    nextLabel: "Next: Monopolies & Hotels →"
  },
  {
    badge: "STEP 4 OF 5",
    title: "Completing Monopolies & Building Hotels",
    visual: "⭐ 🏠 🏨 ⭐",
    explanation: "If you acquire all 3 Light Blue properties (Oriental, Vermont, and Connecticut), you hold a <strong>Monopoly</strong>! Rent doubles immediately. You can now build up to 4 Houses, then upgrade to a <strong>Grand Hotel</strong> to charge devastating rent!",
    nextLabel: "Next: High-Stakes Victory →"
  },
  {
    badge: "STEP 5 OF 5",
    title: "Trade, Bankrupt Rivals & Claim Victory!",
    visual: "🤝 🏆 👑",
    explanation: "Use the <strong>Trade</strong> menu to negotiate swaps for missing streets with other players or bots. Drive opponents into debt until they cannot pay, triggering <strong>Bankruptcy</strong>. The last standing player wins!",
    nextLabel: "Restart Walkthrough ↺"
  }
];

let curSimStep = 0;
function renderSimStep(index) {
  curSimStep = (index + simSteps.length) % simSteps.length;
  const s = simSteps[curSimStep];
  const badgeEl = document.getElementById("simStepBadge");
  const titleEl = document.getElementById("simStepTitle");
  const visualEl = document.getElementById("simVisual");
  const explainEl = document.getElementById("simExplanation");
  const prevBtn = document.getElementById("simPrevBtn");
  const nextBtn = document.getElementById("simNextBtn");
  const dots = document.querySelectorAll(".sim-dot");

  if (badgeEl) badgeEl.textContent = s.badge;
  if (titleEl) titleEl.textContent = s.title;
  if (visualEl) visualEl.innerHTML = s.visual;
  if (explainEl) explainEl.innerHTML = s.explanation;
  if (prevBtn) prevBtn.disabled = (curSimStep === 0);
  if (nextBtn) nextBtn.textContent = s.nextLabel;

  dots.forEach((dot, idx) => {
    dot.style.background = (idx === curSimStep) ? "#38bdf8" : "#475569";
  });
}

document.getElementById("simPrevBtn")?.addEventListener("click", () => renderSimStep(curSimStep - 1));
document.getElementById("simNextBtn")?.addEventListener("click", () => renderSimStep(curSimStep + 1));

// Reactive Dynamic Coach Tips during Gameplay
function updateCoachGuidance(state) {
  if (!coachEnabled || !coachText || !state || !myPlayer) return;

  const currentP = state.players ? state.players[state.turnIndex] : null;
  const isMyTurn = currentP && (myPlayer.id === currentP.id);

  if (state.status === "ended") {
    coachText.innerHTML = "🏆 <strong>Game Over:</strong> " + (state.winner?.name || "Player") + " has claimed victory! Click 'Play Another Match' to start a new game.";
    return;
  }

  if (state.turnPhase === "auction" && state.auctionState) {
    coachText.innerHTML = "🔨 <strong>Live Auction:</strong> Bidding is open for <strong>" + state.auctionState.tileName + "</strong> (Current: $" + state.auctionState.currentBid + ")! Place +$10 or +$50 bids to win the property below list price, or click 'Pass' if too expensive.";
    return;
  }

  if (state.turnPhase === "debt" && state.pendingDebt) {
    if (state.pendingDebt.playerId === myPlayer.id) {
      coachText.innerHTML = "⚠️ <strong>Debt Alert:</strong> You owe $" + state.pendingDebt.amount + " (" + state.pendingDebt.reason + ")! Open <strong>Portfolio</strong> to mortgage properties for 50% cash to avoid bankruptcy.";
    } else {
      coachText.innerHTML = "⏳ An opponent is managing debt obligations. If they cannot raise cash, they will go bankrupt!";
    }
    return;
  }

  if (isMyTurn) {
    if (state.turnPhase === "roll") {
      if (currentP.inJail) {
        coachText.innerHTML = "🔒 <strong>In Jail:</strong> You are locked in Jail. You can roll for doubles (free escape), pay $50 bail, or use a Get Out of Jail card. <em>*Tip: You still collect rent while detained!</em>";
      } else {
        coachText.innerHTML = "🎲 <strong>Your Turn to Roll:</strong> Click the golden <strong>Roll Dice</strong> button! Rolling doubles grants an immediate bonus roll (3 doubles in a row sends you to Jail).";
      }
    } else if (state.turnPhase === "action") {
      const tile = TILES_DEF[currentP.position];
      const prop = state.properties ? state.properties[tile.id] : null;

      if (prop && !prop.owner) {
        coachText.innerHTML = "🏠 <strong>Unowned Property:</strong> You landed on <strong>" + tile.name + "</strong> ($" + tile.cost + ")! Click <strong>Buy</strong> to collect rent from opponents, or click <strong>Send to Auction</strong> to let everyone bid starting at $10.";
      } else if (prop && prop.owner === myPlayer.id) {
        coachText.innerHTML = "👑 <strong>Your Property:</strong> You safely landed on your own property! If you hold the complete color group, unimproved rent doubles and you can construct houses.";
      } else if (prop && prop.owner && prop.owner !== myPlayer.id) {
        const ownerP = state.players.find(p => p.id === prop.owner);
        coachText.innerHTML = "💸 <strong>Rent Paid:</strong> You landed on " + (ownerP?.name || "an opponent") + "'s property and paid rent. Acquire more properties to balance your cash flow!";
      } else if (tile.type === "chance" || tile.type === "community_chest") {
        coachText.innerHTML = "📦 <strong>Mystery Card:</strong> You drew a " + (tile.type === "chance" ? "Chance" : "Community Chest") + " card! Cards can grant cash bonuses, advance you to Boardwalk, or assess property repairs.";
      } else if (tile.type === "tax") {
        coachText.innerHTML = "💸 <strong>Tax Assessed:</strong> You paid taxes to the bank. Keep an eye on your cash reserves!";
      } else if (tile.type === "go_to_jail") {
        coachText.innerHTML = "🚨 <strong>Sent to Jail:</strong> You were caught! Move directly to Jail. Do not pass GO, do not collect $200.";
      } else {
        coachText.innerHTML = "✓ <strong>Action Completed:</strong> Review the board, trade with rivals, or click <strong>" + (state.lastRollDoubles ? "Extra Roll (Doubles!)" : "End Turn") + "</strong> to continue.";
      }
    }
  } else {
    coachText.innerHTML = "⏳ <strong>" + (currentP?.name || "Opponent") + "'s Turn:</strong> Observing their move. You can click <strong>Portfolio</strong> to view your deeds or <strong>Trade</strong> to propose deals.";
  }
}

// ================= SETTINGS & AFK AUTO-PLAY SYSTEM =================
const openSettingsBtn = document.getElementById("openSettingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");

const masterVolSlider = document.getElementById("masterVolSlider");
const masterVolVal = document.getElementById("masterVolVal");
const sfxVolSlider = document.getElementById("sfxVolSlider");
const sfxVolVal = document.getElementById("sfxVolVal");
const ambianceVolSlider = document.getElementById("ambianceVolSlider");
const ambianceVolVal = document.getElementById("ambianceVolVal");
const muteAllCheckbox = document.getElementById("muteAllCheckbox");
const ambianceToggleCheckbox = document.getElementById("ambianceToggleCheckbox");

const settingsAfkToggleBtn = document.getElementById("settingsAfkToggleBtn");
const afkSpeedSelect = document.getElementById("afkSpeedSelect");
const afkActiveBanner = document.getElementById("afkActiveBanner");
const afkTakeControlBtn = document.getElementById("afkTakeControlBtn");

const cameraModeSelect = document.getElementById("cameraModeSelect");
const particlesSelect = document.getElementById("particlesSelect");

const settingsSaveGameBtn = document.getElementById("settingsSaveGameBtn");

let afkMode = localStorage.getItem("monopoly_afk_mode") === "true";
let afkDelay = parseInt(localStorage.getItem("monopoly_afk_speed") || "2500", 10);
let afkTimer = null;

// Initialize Audio Settings from localStorage
const storedAmbianceVol = localStorage.getItem("monopoly_ambiance_volume");
const storedAmbianceEnabled = localStorage.getItem("monopoly_ambiance_enabled");
if (window.sounds) {
  if (storedAmbianceVol !== null) {
    window.sounds.setAmbianceVolume(parseFloat(storedAmbianceVol));
  }
  if (storedAmbianceEnabled === "false") {
    window.sounds.ambianceEnabled = false;
  }
}

// User Interaction Audio Unlocker (browser autoplay policy compliant)
function unlockAndStartAudio() {
  if (window.sounds) {
    window.sounds.init();
    if (window.sounds.ambianceEnabled && !window.sounds.ambianceRunning) {
      window.sounds.startAmbiance();
    }
  }
}
window.addEventListener("pointerdown", unlockAndStartAudio);
window.addEventListener("keydown", unlockAndStartAudio);

// Open & Close Settings Modal
function openSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.remove("hidden");
  // Sync values
  if (masterVolSlider && window.sounds) {
    masterVolSlider.value = Math.round(window.sounds.masterVolume * 100);
    masterVolVal.textContent = masterVolSlider.value + "%";
  }
  if (sfxVolSlider && window.sounds) {
    sfxVolSlider.value = Math.round(window.sounds.sfxVolume * 100);
    sfxVolVal.textContent = sfxVolSlider.value + "%";
  }
  if (ambianceVolSlider && window.sounds) {
    ambianceVolSlider.value = Math.round(window.sounds.ambianceVolume * 100);
    ambianceVolVal.textContent = ambianceVolSlider.value + "%";
  }
  if (muteAllCheckbox && window.sounds) {
    muteAllCheckbox.checked = window.sounds.isMuted;
  }
  if (ambianceToggleCheckbox && window.sounds) {
    ambianceToggleCheckbox.checked = window.sounds.ambianceEnabled;
  }
  if (coachTipsCheckbox) {
    coachTipsCheckbox.checked = coachEnabled;
  }
  updateAfkUI();
}

openSettingsBtn?.addEventListener("click", openSettingsModal);
closeSettingsModalBtn?.addEventListener("click", () => settingsModal?.classList.add("hidden"));
settingsModal?.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
});

// ESC Key Toggle
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (settingsModal && !settingsModal.classList.contains("hidden")) {
      settingsModal.classList.add("hidden");
    } else if (rulesModal && !rulesModal.classList.contains("hidden")) {
      rulesModal.classList.add("hidden");
    } else if (propertiesModal && !propertiesModal.classList.contains("hidden")) {
      propertiesModal.classList.add("hidden");
    } else if (tradeModal && !tradeModal.classList.contains("hidden")) {
      tradeModal.classList.add("hidden");
    } else if (devModal && !devModal.classList.contains("hidden")) {
      devModal.classList.add("hidden");
    } else if (gameScreen && !gameScreen.classList.contains("hidden")) {
      openSettingsModal();
    }
  }
});

// Audio Sliders & Toggles
masterVolSlider?.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  masterVolVal.textContent = val + "%";
  if (window.sounds) window.sounds.setMasterVolume(val / 100);
});

sfxVolSlider?.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  sfxVolVal.textContent = val + "%";
  if (window.sounds) window.sounds.setSfxVolume(val / 100);
});

ambianceVolSlider?.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  ambianceVolVal.textContent = val + "%";
  if (window.sounds) {
    window.sounds.setAmbianceVolume(val / 100);
    localStorage.setItem("monopoly_ambiance_volume", (val / 100).toString());
  }
});

muteAllCheckbox?.addEventListener("change", (e) => {
  if (window.sounds) window.sounds.toggleMute(e.target.checked);
});

ambianceToggleCheckbox?.addEventListener("change", (e) => {
  if (window.sounds) {
    window.sounds.toggleAmbiance(e.target.checked);
    localStorage.setItem("monopoly_ambiance_enabled", e.target.checked ? "true" : "false");
  }
});

// Coach Tips Sync
coachTipsCheckbox?.addEventListener("change", (e) => {
  coachEnabled = e.target.checked;
  localStorage.setItem("monopoly_coach_tips", coachEnabled ? "true" : "false");
  applyCoachPreference();
  if (coachEnabled) updateCoachGuidance(gameState);
});

// Camera Mode Select
cameraModeSelect?.addEventListener("change", (e) => {
  const mode = e.target.value;
  currentCamMode = mode;
  if (camModeBtn) camModeBtn.textContent = "🎥 Cam: " + mode.charAt(0).toUpperCase() + mode.slice(1);
  if (scene3D) scene3D.setCameraMode(mode);
});

// Particle Density Select
particlesSelect?.addEventListener("change", (e) => {
  if (scene3D && typeof scene3D.setParticleDensity === "function") {
    scene3D.setParticleDensity(e.target.value);
  }
});

// ================= AFK AUTO-PLAY LOGIC =================
function updateAfkUI() {
  if (settingsAfkToggleBtn) {
    settingsAfkToggleBtn.textContent = afkMode ? "AFK: ON" : "AFK: OFF";
    settingsAfkToggleBtn.style.borderColor = afkMode ? "#10b981" : "#94a3b8";
    settingsAfkToggleBtn.style.color = afkMode ? "#34d399" : "#94a3b8";
    settingsAfkToggleBtn.style.background = afkMode ? "rgba(16, 185, 129, 0.2)" : "transparent";
  }
  if (afkActiveBanner) {
    afkActiveBanner.classList.toggle("hidden", !afkMode);
  }
}

function setAfkMode(enabled) {
  afkMode = enabled;
  localStorage.setItem("monopoly_afk_mode", afkMode ? "true" : "false");
  updateAfkUI();
  if (afkMode) {
    if (window.sounds) window.sounds.playStep();
    checkAfkAction(gameState);
  } else {
    clearTimeout(afkTimer);
    const deedM = document.getElementById("deedModal");
    if (deedM) deedM.classList.add("hidden");
  }
}

settingsAfkToggleBtn?.addEventListener("click", () => setAfkMode(!afkMode));
afkTakeControlBtn?.addEventListener("click", () => setAfkMode(false));

afkSpeedSelect?.addEventListener("change", (e) => {
  afkDelay = parseInt(e.target.value, 10);
  localStorage.setItem("monopoly_afk_speed", String(afkDelay));
});

function scheduleAfkTask(actionFn, delayMs) {
  clearTimeout(afkTimer);
  afkTimer = setTimeout(() => {
    if (!afkMode || !gameState || gameState.status !== "in_progress") return;
    try {
      actionFn();
    } catch (err) {
      console.warn("AFK action error:", err);
    }
  }, delayMs);
}

function checkAfkAction(state) {
  if (!afkMode || !state || state.status !== "in_progress" || !myPlayer) return;

  const currentP = state.players ? state.players[state.turnIndex] : null;
  const isMyTurn = currentP && (myPlayer.id === currentP.id);

  // 1. Live Auction: AFK player does not aggressively bid. Always passes so human auction isn't hijacked.
  if (state.turnPhase === "auction" && state.auctionState) {
    const aState = state.auctionState;
    if (!aState.passedPlayerIds.includes(myPlayer.id)) {
      scheduleAfkTask(() => {
        passAuctionBtn?.click();
      }, afkDelay);
    }
    return;
  }

  // 2. Active Turn Simple Failsafe Plays
  if (isMyTurn) {
    if (state.turnPhase === "roll") {
      scheduleAfkTask(() => {
        if (currentP.inJail) {
          // If has jail card, use it; otherwise just try rolling doubles without paying $50 bail
          if (currentP.jailCards > 0) {
            useJailCardBtn?.click();
          } else {
            rollDiceBtn?.click();
          }
        } else {
          rollDiceBtn?.click();
        }
      }, afkDelay);
    } else if (state.turnPhase === "action") {
      scheduleAfkTask(() => {
        const tile = TILES_DEF[currentP.position];
        const prop = state.properties ? state.properties[tile.id] : null;

        // Dumber purchase logic: only buy low-cost starter properties (<= $160) if having high cash reserve (>= $350)
        // Otherwise, send to auction so other active players can buy it, or end turn
        if (prop && !prop.owner && tile.cost <= 160 && currentP.money >= tile.cost + 350) {
          buyPropertyBtn?.click();
        } else if (prop && !prop.owner && !auctionBtn.classList.contains("hidden")) {
          auctionBtn?.click();
        } else {
          endTurnBtn?.click();
        }
      }, afkDelay + 800);
    } else if (state.turnPhase === "debt") {
      scheduleAfkTask(() => {
        settleDebtBtn?.click();
      }, afkDelay);
    }
  }
}

// ================= RETURN TO MAIN MENU =================
function leaveGameToMainMenu() {
  if (confirm("Are you sure you want to leave this table and return to the main lobby?")) {
    const prevRoomId = currentRoomId;
    // Reset room and player pointers immediately so late server state packets are ignored
    currentRoomId = null;
    myPlayer = null;
    gameState = null;

    if (prevRoomId) {
      socket.emit("leave_room", { roomId: prevRoomId }, () => {});
    }

    // Disable AFK timer
    clearTimeout(afkTimer);
    if (afkMode) {
      afkMode = false;
      updateAfkUI();
    }

    // Hide modals and game screen
    settingsModal?.classList.add("hidden");
    rulesModal?.classList.add("hidden");
    propertiesModal?.classList.add("hidden");
    tradeModal?.classList.add("hidden");
    const deedM = document.getElementById("deedModal");
    if (deedM) deedM.classList.add("hidden");
    if (devModal) devModal.classList.add("hidden");
    if (cardDisplay) cardDisplay.classList.add("hidden");
    gameScreen.classList.add("hidden");

    // Show main lobby create/join view cleanly
    lobbyScreen.classList.remove("hidden");
    const lobbyWaiting = document.getElementById("lobbyWaitingView");
    if (lobbyWaiting) lobbyWaiting.classList.add("hidden");
    const lobbyInitial = document.getElementById("lobbyInitialView");
    if (lobbyInitial) lobbyInitial.classList.remove("hidden");

    // Reset URL
    window.history.replaceState({}, document.title, window.location.pathname);
    if (window.sounds) window.sounds.playStep();
  }
}

settingsSaveGameBtn?.addEventListener("click", () => {
  saveGameBtn?.click();
});

// Initialize Settings UI
updateAfkUI();

// ================= MONOPOLY CASH DRAWER & BANKNOTE REGISTER =================
const openCashDrawerBtn = document.getElementById("openCashDrawerBtn");
const cashDrawerModal = document.getElementById("cashDrawerModal");
const closeCashDrawerBtn = document.getElementById("closeCashDrawerBtn");
const cashDrawerTotalAmount = document.getElementById("cashDrawerTotalAmount");
const banknoteTrayGrid = document.getElementById("banknoteTrayGrid");
const quickBreakLargestBtn = document.getElementById("quickBreakLargestBtn");
const topBarCashVal = document.getElementById("topBarCashVal");

const DENOM_INFO = [
  { denom: 500, label: "$500", class: "banknote-500" },
  { denom: 100, label: "$100", class: "banknote-100" },
  { denom: 50,  label: "$50",  class: "banknote-50" },
  { denom: 20,  label: "$20",  class: "banknote-20" },
  { denom: 10,  label: "$10",  class: "banknote-10" },
  { denom: 5,   label: "$5",   class: "banknote-5" },
  { denom: 1,   label: "$1",   class: "banknote-1" }
];

function updateCashDrawerUI(state) {
  if (!state || !myPlayer) return;
  const currentP = state.players.find(p => p.id === myPlayer.id);
  if (!currentP) return;

  const total = currentP.money || 0;
  if (topBarCashVal) topBarCashVal.textContent = `$${total.toLocaleString()}`;
  if (cashDrawerTotalAmount) cashDrawerTotalAmount.textContent = `$${total.toLocaleString()}`;

  const bills = currentP.bills || { 1: 5, 5: 5, 10: 5, 20: 6, 50: 2, 100: 2, 500: 2 };
  if (!banknoteTrayGrid) return;
  banknoteTrayGrid.innerHTML = "";

  let highestHeld = null;

  DENOM_INFO.forEach(info => {
    const count = bills[info.denom] || 0;
    const subtotal = count * info.denom;
    if (count > 0 && info.denom > 1 && !highestHeld) {
      highestHeld = info.denom;
    }

    const slot = document.createElement("div");
    slot.className = "banknote-slot";
    slot.innerHTML = `
      <div class="monopoly-banknote ${info.class}">
        <div class="banknote-val-top">${info.label}</div>
        <div class="banknote-center">${info.denom}</div>
        <div class="banknote-val-bot">${info.label}</div>
      </div>
      <div class="banknote-count-pill">${count} notes</div>
      <div class="banknote-subtotal">$${subtotal.toLocaleString()}</div>
      ${info.denom > 1 ? `
        <button class="banknote-break-btn" data-denom="${info.denom}" ${count === 0 ? "disabled" : ""}>
          ⚡ Break
        </button>
      ` : `
        <div style="font-size:10px; color:#64748b; height:24px; display:flex; align-items:center;">Smallest</div>
      `}
    `;

    const breakBtn = slot.querySelector(".banknote-break-btn");
    if (breakBtn) {
      breakBtn.addEventListener("click", () => {
        socket.emit("break_bill", { roomId: currentRoomId, denomination: info.denom }, (res) => {
          if (res && res.error) alert(res.error);
          else if (window.sounds) window.sounds.playCash();
        });
      });
    }

    banknoteTrayGrid.appendChild(slot);
  });

  if (quickBreakLargestBtn) {
    if (highestHeld) {
      quickBreakLargestBtn.disabled = false;
      quickBreakLargestBtn.textContent = `⚡ Break Highest Note ($${highestHeld})`;
      quickBreakLargestBtn.onclick = () => {
        socket.emit("break_bill", { roomId: currentRoomId, denomination: highestHeld }, (res) => {
          if (res && res.error) alert(res.error);
          else if (window.sounds) window.sounds.playCash();
        });
      };
    } else {
      quickBreakLargestBtn.disabled = true;
      quickBreakLargestBtn.textContent = `⚡ All Notes Broken`;
    }
  }
}

openCashDrawerBtn?.addEventListener("click", () => {
  cashDrawerModal?.classList.remove("hidden");
  if (gameState) updateCashDrawerUI(gameState);
});

closeCashDrawerBtn?.addEventListener("click", () => {
  cashDrawerModal?.classList.add("hidden");
});

cashDrawerModal?.addEventListener("click", (e) => {
  if (e.target === cashDrawerModal) cashDrawerModal.classList.add("hidden");
});

// ================= SALOON UNO CONTROLLER =================
let pendingWildCardId = null;
const unoGameArea = document.getElementById("unoGameArea");
const unoDrawPile = document.getElementById("unoDrawPile");
const unoDrawActionBtn = document.getElementById("unoDrawActionBtn");
const unoDrawPileCount = document.getElementById("unoDrawPileCount");
const unoDiscardCard = document.getElementById("unoDiscardCard");
const unoActiveColorText = document.getElementById("unoActiveColorText");
const unoDirectionIndicator = document.getElementById("unoDirectionIndicator");
const unoShoutBtn = document.getElementById("unoShoutBtn");
const unoHandCards = document.getElementById("unoHandCards");
const unoHandCount = document.getElementById("unoHandCount");
const unoColorModal = document.getElementById("unoColorModal");

function isUnoPlayable(card, state) {
  if (!state || !state.activeCard) return false;
  if (card.color === "wild" || card.type === "wild" || card.type === "wild4") return true;
  if (card.color === state.activeColor) return true;
  if (card.value === state.activeCard.value) return true;
  return false;
}

function renderUnoGame(state) {
  const currentP = state.players[state.turnIndex];
  const isMyTurn = myPlayer && currentP && (myPlayer.id === currentP.id);

  // Turn Header
  if (state.status === "ended") {
    turnIndicator.textContent = `🏆 VICTORY - ${state.winner?.name} WON SALOON UNO!`;
    victoryModal.classList.remove("hidden");
    winnerName.textContent = state.winner?.name || "Player";
    window.sounds?.playVictory();
  } else {
    turnIndicator.textContent = isMyTurn ? "👉 YOUR TURN TO PLAY OR DRAW" : `⏳ ${currentP?.name}'s Turn`;
    const colorMap = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308" };
    turnIndicator.style.borderColor = colorMap[state.activeColor] || "#3b82f6";
  }

  // Draw pile count
  if (unoDrawPileCount) unoDrawPileCount.textContent = state.drawPileCount || 0;

  // Active Discard Card
  if (unoDiscardCard && state.activeCard) {
    const card = state.activeCard;
    unoDiscardCard.className = `uno-card uno-discard-card ${card.color}`;
    unoDiscardCard.innerHTML = `
      <div class="uno-card-inner">
        <span class="uno-card-corner top-left">${card.value.toUpperCase()}</span>
        <div class="uno-card-center">${card.value.toUpperCase()}</div>
        <span class="uno-card-corner bottom-right">${card.value.toUpperCase()}</span>
      </div>
    `;
  }

  // Active Color
  if (unoActiveColorText) {
    unoActiveColorText.textContent = (state.activeColor || "red").toUpperCase();
    const colorMap = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308" };
    unoActiveColorText.style.color = colorMap[state.activeColor] || "#f8fafc";
  }

  // Turn Direction
  if (unoDirectionIndicator) {
    unoDirectionIndicator.textContent = state.direction === 1 ? "⟳ Clockwise" : "⟲ Counter-Clockwise";
  }

  // Find my player object
  const me = state.players.find(p => p.id === (myPlayer ? myPlayer.id : ""));
  const myCards = me?.hand || [];
  if (unoHandCount) unoHandCount.textContent = myCards.length;

  // Render Hand Cards
  if (unoHandCards) {
    unoHandCards.innerHTML = "";
    myCards.forEach(card => {
      const cardEl = document.createElement("div");
      const playable = isMyTurn && isUnoPlayable(card, state);
      cardEl.className = `uno-card ${card.color} ${playable ? "uno-playable-card" : "uno-unplayable-card"}`;
      cardEl.innerHTML = `
        <div class="uno-card-inner">
          <span class="uno-card-corner top-left">${card.value.toUpperCase()}</span>
          <div class="uno-card-center">${card.value.toUpperCase()}</div>
          <span class="uno-card-corner bottom-right">${card.value.toUpperCase()}</span>
        </div>
      `;

      if (playable) {
        cardEl.addEventListener("click", () => {
          if (card.type === "wild" || card.type === "wild4") {
            pendingWildCardId = card.id;
            unoColorModal.classList.remove("hidden");
          } else {
            socket.emit("play_uno_card", { roomId: currentRoomId, cardId: card.id }, (res) => {
              if (res && res.error) alert(res.error);
              else if (window.sounds) window.sounds.playCard();
            });
          }
        });
      }

      unoHandCards.appendChild(cardEl);
    });
  }

  // Render HUD Opponents
  renderPlayersHUD(state);
  renderLogs(state.logs);
}

// Draw card action (deck click & button)
const triggerDrawUno = () => {
  if (!currentRoomId) return;
  socket.emit("draw_uno_card", { roomId: currentRoomId }, (res) => {
    if (res && res.error) alert(res.error);
    else if (window.sounds) window.sounds.playCard();
  });
};
unoDrawPile?.addEventListener("click", triggerDrawUno);
unoDrawActionBtn?.addEventListener("click", triggerDrawUno);

// Shout UNO action
unoShoutBtn?.addEventListener("click", () => {
  if (!currentRoomId) return;
  socket.emit("shout_uno", { roomId: currentRoomId }, (res) => {
    if (res && res.error) alert(res.error);
    else if (window.sounds) window.sounds.playDice();
  });
});

// Color Chooser for Wild Cards
document.querySelectorAll(".uno-color-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.getAttribute("data-color");
    if (pendingWildCardId && currentRoomId) {
      socket.emit("play_uno_card", {
        roomId: currentRoomId,
        cardId: pendingWildCardId,
        chosenColor: color
      }, (res) => {
        if (res && res.error) alert(res.error);
        else if (window.sounds) window.sounds.playCard();
      });
      pendingWildCardId = null;
    }
    unoColorModal?.classList.add("hidden");
  });
});
