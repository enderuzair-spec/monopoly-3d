const { BOARD, GROUP_MEMBERS } = require("./boardData");
const { CHANCE_CARDS, COMMUNITY_CHEST_CARDS, shuffle } = require("./cards");

class MonopolyEngine {
  constructor(roomId, onStateChange) {
    this.roomId = roomId;
    this.onStateChange = onStateChange || (() => {});
    this.status = "waiting"; // 'waiting', 'in_progress', 'ended'
    this.players = [];
    this.turnIndex = 0;
    this.turnPhase = "roll"; // 'roll', 'action', 'auction', 'debt'
    this.dice = [1, 1];
    this.lastRollDoubles = false;
    this.consecutiveDoubles = 0;
    
    // Properties state: index matches tile id (0..39)
    this.properties = BOARD.map(tile => {
      if (tile.type === "property" || tile.type === "railroad" || tile.type === "utility") {
        return {
          id: tile.id,
          owner: null,
          houses: 0, // 0..4 = houses, 5 = hotel
          mortgaged: false
        };
      }
      return null;
    });

    this.chanceDeck = shuffle(CHANCE_CARDS);
    this.chestDeck = shuffle(COMMUNITY_CHEST_CARDS);

    this.auctionState = null;
    this.pendingDebt = null;
    this.activeTrade = null;
    this.logs = [];
    this.winner = null;
    this.activeCard = null; // latest card drawn for UI display
    this.lastMove = null; // for 3D hop animation
    this.rollId = 0; // unique roll counter to guarantee 3D dice trigger

    // Host, Spectators & Reconnection Session Management
    this.hostId = null;
    this.spectators = new Map();
    this.graceTimers = new Map();
    this.auctionTimer = null;
    this.botAuctionTimeout = null;
  }


  triggerGameEvent(type, title, message, icon = "📢") {
    this.lastGameEvent = {
      id: "evt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      type,
      title,
      message,
      icon,
      timestamp: Date.now()
    };
  }

  log(msg) {
    const entry = { text: msg, time: new Date().toLocaleTimeString() };
    this.logs.push(entry);
    if (this.logs.length > 80) this.logs.shift();
  }

  // ================= MONOPOLY CASH BILL & WALLET SYSTEM =================
  calculateBillsTotal(bills) {
    if (!bills) return 0;
    return (
      (bills[1] || 0) * 1 +
      (bills[5] || 0) * 5 +
      (bills[10] || 0) * 10 +
      (bills[20] || 0) * 20 +
      (bills[50] || 0) * 50 +
      (bills[100] || 0) * 100 +
      (bills[500] || 0) * 500
    );
  }

  addCash(player, amount) {
    if (!player || amount <= 0) return;
    if (!player.bills) {
      player.bills = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0 };
    }
    let remaining = amount;
    for (const d of [500, 100, 50, 20, 10, 5, 1]) {
      const count = Math.floor(remaining / d);
      if (count > 0) {
        player.bills[d] = (player.bills[d] || 0) + count;
        remaining -= count * d;
      }
    }
    player.money = this.calculateBillsTotal(player.bills);
  }

  deductCash(player, amount) {
    if (!player || amount <= 0) return false;
    if (!player.bills) {
      player.bills = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0 };
    }
    const total = this.calculateBillsTotal(player.bills);
    if (total < amount) return false;

    let remaining = amount;
    const toDeduct = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0 };

    for (const d of [500, 100, 50, 20, 10, 5, 1]) {
      const canUse = Math.min(Math.floor(remaining / d), player.bills[d] || 0);
      if (canUse > 0) {
        toDeduct[d] = canUse;
        remaining -= canUse * d;
      }
    }

    if (remaining === 0) {
      for (const d of [500, 100, 50, 20, 10, 5, 1]) {
        player.bills[d] -= toDeduct[d];
      }
      player.money = this.calculateBillsTotal(player.bills);
      return true;
    }

    // Smallest larger bill to break at bank
    let breakDenom = null;
    for (const d of [1, 5, 10, 20, 50, 100, 500]) {
      if (d > remaining && (player.bills[d] || 0) > (toDeduct[d] || 0)) {
        breakDenom = d;
        break;
      }
    }

    if (breakDenom) {
      for (const d of [500, 100, 50, 20, 10, 5, 1]) {
        player.bills[d] -= toDeduct[d];
      }
      player.bills[breakDenom]--;
      const change = breakDenom - remaining;
      this.addCash(player, change);
      player.money = this.calculateBillsTotal(player.bills);
      return true;
    }

    // Fallback: break highest available note repeatedly
    const highest = [500, 100, 50, 20, 10, 5].find(d => (player.bills[d] || 0) > 0);
    if (highest) {
      this.breakBill(player, highest);
      return this.deductCash(player, amount);
    }

    player.money = Math.max(0, player.money - amount);
    return true;
  }

  breakBill(player, denom) {
    denom = Number(denom);
    if (!player || !player.bills || (player.bills[denom] || 0) <= 0) {
      return { error: `No $${denom} bills in cash drawer to break.` };
    }
    player.bills[denom]--;
    const breakdown = {
      500: [ { d: 100, c: 3 }, { d: 50, c: 2 }, { d: 20, c: 4 }, { d: 10, c: 2 } ],
      100: [ { d: 50, c: 1 }, { d: 20, c: 2 }, { d: 10, c: 1 } ],
      50:  [ { d: 20, c: 2 }, { d: 10, c: 1 } ],
      20:  [ { d: 10, c: 1 }, { d: 5, c: 1 }, { d: 1, c: 5 } ],
      10:  [ { d: 5, c: 1 }, { d: 1, c: 5 } ],
      5:   [ { d: 1, c: 5 } ]
    };
    const pack = breakdown[denom];
    if (pack) {
      pack.forEach(({ d, c }) => {
        player.bills[d] = (player.bills[d] || 0) + c;
      });
    } else {
      player.bills[denom]++;
      return { error: `Cannot break $${denom} note.` };
    }
    player.money = this.calculateBillsTotal(player.bills);
    this.log(`🏦 ${player.name} broke a $${denom} bill at the Bank into smaller change.`);
    this.emitChange();
    return { success: true, bills: player.bills, money: player.money };
  }

  addPlayer({ id, sessionToken, name, token, color, isBot = false }) {
    if (this.status !== "waiting") return { error: "Game already in progress" };
    if (this.players.length >= 6) return { error: "Room is full (max 6 players)" };

    const ALL_TOKENS = ["🎩", "🚗", "🚢", "👞", "🧵", "✈️"];
    const ALL_COLORS = ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#00ACC1"];

    const takenTokens = new Set(this.players.map(p => p.token));
    const takenColors = new Set(this.players.map(p => p.color));

    let chosenToken = token;
    if (!chosenToken || takenTokens.has(chosenToken)) {
      chosenToken = ALL_TOKENS.find(t => !takenTokens.has(t)) || ALL_TOKENS[0];
    }

    let chosenColor = color;
    if (!chosenColor || takenColors.has(chosenColor)) {
      chosenColor = ALL_COLORS.find(c => !takenColors.has(c)) || ALL_COLORS[0];
    }

    const isFirstHuman = !isBot && !this.players.some(p => !p.isBot);
    const player = {
      id,
      sessionToken: sessionToken || id,
      name: (name || "").trim() || `Player ${this.players.length + 1}`,
      token: chosenToken,
      color: chosenColor,
      money: 1500,
      bills: { 1: 5, 5: 5, 10: 5, 20: 6, 50: 2, 100: 2, 500: 2 },
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
      isBot,
      connected: true,
      disconnectExpires: null
    };

    if (isFirstHuman && !this.hostId) {
      this.hostId = player.id;
    }

    this.players.push(player);
    this.log(`${player.name} joined the game.`);
    this.emitChange();
    return { success: true, player };
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return;

    const p = this.players[idx];
    if (this.status === "waiting") {
      this.players.splice(idx, 1);
      this.log(`${p.name} left the lobby.`);
      if (this.hostId === playerId) {
        const nextHost = this.players.find(pl => !pl.isBot);
        this.hostId = nextHost ? nextHost.id : null;
      }
      this.emitChange();
    } else {
      // 60-second grace period for in-game disconnects
      p.connected = false;
      p.disconnectExpires = Date.now() + 60000;
      this.log(`⚠️ ${p.name} disconnected. Holding seat for 60 seconds...`);
      this.emitChange();

      if (this.graceTimers && this.graceTimers.has(p.id)) {
        clearTimeout(this.graceTimers.get(p.id));
      }
      if (!this.graceTimers) this.graceTimers = new Map();

      const timer = setTimeout(() => {
        this.graceTimers.delete(p.id);
        if (!p.connected && !p.bankrupt) {
          p.isBot = true;
          if (!p.name.includes("(AI)")) p.name += " (AI)";
          p.disconnectExpires = null;
          this.log(`⏱️ ${p.name} did not reconnect within 60s. An AI Bot has taken over their seat.`);
          this.emitChange();

          if (this.status === "in_progress") {
            if (this.getCurrentPlayer()?.id === p.id) {
              this.checkBotTurn();
            }
            if (this.turnPhase === "auction" && this.auctionState) {
              this.checkBotAuction();
            }
          }
        }
      }, 60000);

      this.graceTimers.set(p.id, timer);
    }
  }

  reconnectPlayer(newSocketId, sessionToken, name) {
    const player = this.players.find(p => 
      (sessionToken && p.sessionToken === sessionToken) ||
      (name && p.name.replace(" (AI)", "").trim().toLowerCase() === name.trim().toLowerCase())
    );
    if (!player) return null;

    if (this.graceTimers && this.graceTimers.has(player.id)) {
      clearTimeout(this.graceTimers.get(player.id));
      this.graceTimers.delete(player.id);
    }

    if (this.hostId === player.id) {
      this.hostId = newSocketId;
    }

    player.id = newSocketId;
    player.connected = true;
    player.disconnectExpires = null;
    if (player.name.includes("(AI)")) {
      player.name = player.name.replace(" (AI)", "");
      player.isBot = false;
    }

    this.log(`🎉 ${player.name} reconnected successfully!`);
    this.emitChange();
    return player;
  }

  kickPlayer(requestSocketId, targetPlayerId) {
    if (requestSocketId !== this.hostId) {
      return { error: "Only the room host can kick players or bots." };
    }
    if (requestSocketId === targetPlayerId) {
      return { error: "Host cannot kick themselves." };
    }
    const idx = this.players.findIndex(p => p.id === targetPlayerId);
    if (idx === -1) return { error: "Player not found." };

    const target = this.players[idx];
    this.players.splice(idx, 1);
    this.log(`👢 ${target.name} was removed from the lobby by the host.`);
    this.emitChange();
    return { success: true, target };
  }

  addSpectator(socketId, name) {
    if (!this.spectators) this.spectators = new Map();
    this.spectators.set(socketId, { id: socketId, name: name || "Spectator", isSpectator: true });
    this.log(`👁️ ${name || "A spectator"} joined to watch the match.`);
    this.emitChange();
  }

  removeSpectator(socketId) {
    if (this.spectators && this.spectators.has(socketId)) {
      this.spectators.delete(socketId);
      this.emitChange();
    }
  }

  startGame() {
    if (this.players.length < 2) return { error: "Need at least 2 players to start" };
    this.status = "in_progress";
    this.turnIndex = 0;
    this.turnPhase = "roll";
    this.log(`Game started! ${this.getCurrentPlayer().name}'s turn to roll.`);
    this.auctionAttemptedThisTurn = false;
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  getCurrentPlayer() {
    return this.players[this.turnIndex];
  }

  resolvePlayer(identifier, sessionToken = null) {
    if (!identifier && !sessionToken) return null;
    return this.players.find(p =>
      (identifier && p.id === identifier) ||
      (sessionToken && p.sessionToken === sessionToken) ||
      (identifier && p.sessionToken === identifier)
    );
  }

  isPlayerTurn(player, identifier, sessionToken = null) {
    if (!player) return false;
    const match = (player.id === identifier) ||
                  (sessionToken && player.sessionToken === sessionToken) ||
                  (identifier && player.sessionToken === identifier);
    if (match && identifier && player.id !== identifier) {
      // Re-bind to active socket ID seamlessly if it was a transient drop
      player.id = identifier;
      player.connected = true;
      player.disconnectExpires = null;
    }
    return match;
  }

  getNextActivePlayerIndex(startIdx) {
    let next = (startIdx + 1) % this.players.length;
    let count = 0;
    while (this.players[next].bankrupt && count < this.players.length) {
      next = (next + 1) % this.players.length;
      count++;
    }
    return next;
  }

  // Rolling the dice
  rollDice(playerId, forceD1 = null, forceD2 = null, sessionToken = null) {
    const player = this.getCurrentPlayer();
    if (!player || !this.isPlayerTurn(player, playerId, sessionToken)) return { error: "Not your turn" };
    if (this.turnPhase !== "roll") return { error: "Cannot roll right now" };

    // Immediately lock phase to prevent multiple roll events
    this.turnPhase = "action";
    this.rollId++;
    this.auctionAttemptedThisTurn = false;

    const d1 = (forceD1 && forceD1 >= 1 && forceD1 <= 6) ? forceD1 : Math.floor(Math.random() * 6) + 1;
    const d2 = (forceD2 && forceD2 >= 1 && forceD2 <= 6) ? forceD2 : Math.floor(Math.random() * 6) + 1;
    this.dice = [d1, d2];
    const isDoubles = (d1 === d2);
    this.lastRollDoubles = isDoubles;

    this.log(`${player.name} rolled a ${d1} and ${d2} (Total: ${d1 + d2})${isDoubles ? " - DOUBLES!" : ""}`);

    if (player.inJail) {
      if (isDoubles) {
        player.inJail = false;
        player.jailTurns = 0;
        this.lastRollDoubles = false; // Breaking out of jail via doubles does not grant an extra roll
        this.consecutiveDoubles = 0;
        this.log(`${player.name} rolled doubles and broke out of Jail!`);
        this.advancePlayer(player, d1 + d2);
      } else {
        player.jailTurns++;
        if (player.jailTurns >= 3) {
          this.log(`${player.name} failed 3 attempts to roll doubles in jail and must pay $50.`);
          this.chargePlayer(player, 50, null, "Jail Release Fee", () => {
            player.inJail = false;
            player.jailTurns = 0;
            this.advancePlayer(player, d1 + d2);
          });
        } else {
          this.log(`${player.name} remains in Jail (turn ${player.jailTurns}/3).`);
          this.turnPhase = "action";
        }
      }
    } else {
      if (isDoubles) {
        this.consecutiveDoubles++;
        if (this.consecutiveDoubles >= 3) {
          this.log(`${player.name} rolled 3 doubles in a row and is sent to Jail!`);
          this.sendToJail(player);
          this.emitChange();
          return { success: true };
        }
      } else {
        this.consecutiveDoubles = 0;
      }

      this.advancePlayer(player, d1 + d2);
    }

    this.auctionAttemptedThisTurn = false;
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  advancePlayer(player, spaces) {
    const oldPos = player.position;
    const newPos = (oldPos + spaces) % 40;
    this.lastMove = { playerId: player.id, from: oldPos, to: newPos, spaces, timestamp: Date.now() };

    // Passed GO?
    if (newPos < oldPos) {
      this.addCash(player, 200);
      this.log(`${player.name} passed GO and collected $200.`);
    }

    player.position = newPos;
    this.handleTileLanding(player, newPos);
  }

  movePlayerTo(player, targetIndex, passGoCollect = true, extra = {}) {
    const oldPos = player.position;
    this.lastMove = { playerId: player.id, from: oldPos, to: targetIndex, spaces: (targetIndex - oldPos + 40) % 40, timestamp: Date.now() };
    if (passGoCollect && targetIndex < oldPos) {
      this.addCash(player, 200);
      this.log(`${player.name} passed GO and collected $200.`);
    }
    player.position = targetIndex;
    this.handleTileLanding(player, targetIndex, extra);
    this.emitChange();
  }

  handleTileLanding(player, tileIndex, extra = {}) {
    const tile = BOARD[tileIndex];
    this.activeCard = null;
    this.turnPhase = "action"; // Default to action phase on landing

    if (tile.type === "corner") {
      if (tileIndex === 30) {
        // Go To Jail
        this.log(`${player.name} landed on Go To Jail!`);
        this.sendToJail(player);
        return;
      }
      this.turnPhase = "action";
    } else if (tile.type === "tax") {
      this.log(`${player.name} landed on ${tile.name} and owes $${tile.amount}.`);
      this.chargePlayer(player, tile.amount, null, tile.name, () => {
        this.turnPhase = "action";
      });
    } else if (tile.type === "chance") {
      this.turnPhase = "action";
      const card = this.drawChanceCard();
      this.activeCard = { type: "Chance", text: card.text };
      this.log(`${player.name} drew Chance: "${card.text}"`);
      this.triggerGameEvent("card", "CHANCE CARD", `${player.name} drew: "${card.text}"`, "❓");
      card.action(this, player);
    } else if (tile.type === "chest") {
      this.turnPhase = "action";
      const card = this.drawChestCard();
      this.activeCard = { type: "Community Chest", text: card.text };
      this.log(`${player.name} drew Community Chest: "${card.text}"`);
      this.triggerGameEvent("card", "COMMUNITY CHEST", `${player.name} drew: "${card.text}"`, "🧰");
      card.action(this, player);
    } else if (tile.type === "property" || tile.type === "railroad" || tile.type === "utility") {
      const prop = this.properties[tileIndex];
      if (!prop.owner) {
        // Unowned property - player can buy or auction
        this.turnPhase = "action";
      } else if (prop.owner === player.id) {
        // Own property
        this.turnPhase = "action";
      } else {
        // Owned by someone else
        const owner = this.players.find(p => p.id === prop.owner);
        if (prop.mortgaged) {
          this.log(`${tile.name} is mortgaged. No rent owed.`);
          this.turnPhase = "action";
        } else {
          let rent = this.calculateRent(tileIndex, extra);
          this.log(`${player.name} landed on ${tile.name} (owned by ${owner.name}) and owes $${rent} rent.`);
          this.chargePlayer(player, rent, owner.id, `Rent for ${tile.name}`, () => {
            this.turnPhase = "action";
          });
        }
      }
    }
  }

  calculateRent(tileIndex, extra = {}) {
    const tile = BOARD[tileIndex];
    const prop = this.properties[tileIndex];
    const ownerId = prop.owner;

    if (tile.type === "property") {
      if (prop.houses > 0) {
        return tile.rents[prop.houses];
      }
      // Check full color group monopoly
      const groupTiles = GROUP_MEMBERS[tile.group];
      const ownsAll = groupTiles.every(tid => this.properties[tid].owner === ownerId);
      return ownsAll ? tile.rents[0] * 2 : tile.rents[0];
    }

    if (tile.type === "railroad") {
      const rrGroup = GROUP_MEMBERS.railroad;
      const count = rrGroup.filter(tid => this.properties[tid].owner === ownerId).length;
      let baseRent = tile.rents[Math.max(0, count - 1)] || 25;
      if (extra.doubleRent) baseRent *= 2;
      return baseRent;
    }

    if (tile.type === "utility") {
      const utilGroup = GROUP_MEMBERS.utility;
      const count = utilGroup.filter(tid => this.properties[tid].owner === ownerId).length;
      const diceSum = this.dice[0] + this.dice[1];
      const multiplier = extra.utilityMultiplier || (count === 2 ? 10 : 4);
      return diceSum * multiplier;
    }

    return 0;
  }

  drawChanceCard() {
    if (this.chanceDeck.length === 0) {
      this.chanceDeck = shuffle(CHANCE_CARDS);
    }
    return this.chanceDeck.shift();
  }

  drawChestCard() {
    if (this.chestDeck.length === 0) {
      this.chestDeck = shuffle(COMMUNITY_CHEST_CARDS);
    }
    return this.chestDeck.shift();
  }

  sendToJail(player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.consecutiveDoubles = 0;
    this.turnPhase = "action";
    this.log(`${player.name} is now locked in Jail.`);
  }

  payJailFine(playerId, sessionToken = null) {
    const player = this.getCurrentPlayer();
    if (!player || !this.isPlayerTurn(player, playerId, sessionToken) || !player.inJail) return { error: "Cannot pay fine" };
    if (player.money < 50) return { error: "Not enough money to pay $50 jail fine" };

    this.deductCash(player, 50);
    player.inJail = false;
    player.jailTurns = 0;
    this.log(`${player.name} paid $50 to get out of Jail.`);
    this.emitChange();
    return { success: true };
  }

  useJailCard(playerId, sessionToken = null) {
    const player = this.getCurrentPlayer();
    if (!player || !this.isPlayerTurn(player, playerId, sessionToken) || !player.inJail) return { error: "Cannot use card" };
    if (!player.jailCards || player.jailCards < 1) return { error: "No Get Out of Jail Free cards" };

    player.jailCards--;
    player.inJail = false;
    player.jailTurns = 0;
    this.log(`${player.name} used a Get Out of Jail Free card!`);
    this.emitChange();
    return { success: true };
  }

  buyProperty(playerId, sessionToken = null) {
    const player = this.getCurrentPlayer();
    if (!player || !this.isPlayerTurn(player, playerId, sessionToken)) return { error: "Not your turn" };
    const tile = BOARD[player.position];
    if (!tile || (tile.type !== "property" && tile.type !== "railroad" && tile.type !== "utility")) {
      return { error: "Tile cannot be purchased" };
    }

    const prop = this.properties[tile.id];
    if (prop.owner) return { error: "Property is already owned" };
    if (player.money < tile.cost) return { error: "Not enough money" };

    this.deductCash(player, tile.cost);
    prop.owner = player.id;
    this.log(`${player.name} purchased ${tile.name} for ${tile.cost}.`);
    this.auctionAttemptedThisTurn = false;
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  // Auction System - Resilient with 15s Countdown Timer & Multi-Increment Bidding
  startAuction(propertyId) {
    const tile = BOARD[propertyId];
    if (!tile) return { error: "Invalid tile" };
    const prop = this.properties[propertyId];
    if (prop.owner) return { error: "Property already owned" };

    if (this.auctionTimer) {
      clearInterval(this.auctionTimer);
      this.auctionTimer = null;
    }
    if (this.botAuctionTimeout) {
      clearTimeout(this.botAuctionTimeout);
      this.botAuctionTimeout = null;
    }

    this.auctionState = {
      propertyId,
      tileName: tile.name,
      currentBid: 10,
      highestBidderId: null,
      passedPlayerIds: [],
      timeLeft: 15
    };

    this.turnPhase = "auction";
    this.log(`🔨 Auction started for ${tile.name}! Opening bid: $10 (15s timer).`);
    this.emitChange();

    // 1-second countdown interval
    this.auctionTimer = setInterval(() => {
      if (!this.auctionState) {
        if (this.auctionTimer) {
          clearInterval(this.auctionTimer);
          this.auctionTimer = null;
        }
        return;
      }

      this.auctionState.timeLeft--;
      if (this.auctionState.timeLeft <= 0) {
        if (this.auctionTimer) {
          clearInterval(this.auctionTimer);
          this.auctionTimer = null;
        }
        this.log(`⏱️ Auction timer expired for ${this.auctionState.tileName}!`);
        this.concludeAuction();
      } else {
        this.emitChange();
      }
    }, 1000);

    this.checkBotAuction();
    return { success: true };
  }

  placeBid(playerId, bidAmount) {
    if (!this.auctionState) return { error: "No active auction" };
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) return { error: "Invalid player" };
    if (this.auctionState.highestBidderId === playerId) {
      return { error: "You are already the highest bidder" };
    }
    if (this.auctionState.passedPlayerIds.includes(playerId)) {
      return { error: "You already passed on this auction" };
    }
    if (bidAmount <= this.auctionState.currentBid) {
      return { error: "Bid must be higher than current bid" };
    }
    if (player.money < bidAmount) {
      return { error: "Not enough money" };
    }

    this.auctionState.currentBid = bidAmount;
    this.auctionState.highestBidderId = player.id;
    this.auctionState.timeLeft = 15; // Reset 15s timer on every new bid!
    this.log(`🔨 ${player.name} bid $${bidAmount} on ${this.auctionState.tileName}! (Clock reset to 15s)`);
    this.emitChange();
    this.checkBotAuction();
    return { success: true };
  }

  passBid(playerId) {
    if (!this.auctionState) return { error: "No active auction" };
    if (this.auctionState.highestBidderId === playerId) {
      return { error: "Highest bidder cannot pass" };
    }

    if (!this.auctionState.passedPlayerIds.includes(playerId)) {
      this.auctionState.passedPlayerIds.push(playerId);
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        this.log(`${player.name} passed on the auction.`);
      }
    }

    const activePlayers = this.players.filter(p => !p.bankrupt && p.connected !== false);
    const remainingBidders = activePlayers.filter(p => 
      !this.auctionState.passedPlayerIds.includes(p.id) && p.id !== this.auctionState.highestBidderId
    );

    if (remainingBidders.length === 0) {
      this.concludeAuction();
    } else {
      this.emitChange();
      this.checkBotAuction();
    }

    return { success: true };
  }

  concludeAuction() {
    if (this.auctionTimer) {
      clearInterval(this.auctionTimer);
      this.auctionTimer = null;
    }
    if (this.botAuctionTimeout) {
      clearTimeout(this.botAuctionTimeout);
      this.botAuctionTimeout = null;
    }
    if (!this.auctionState) return;

    if (this.auctionState.highestBidderId) {
      const winner = this.players.find(p => p.id === this.auctionState.highestBidderId);
      const prop = this.properties[this.auctionState.propertyId];
      if (winner && prop) {
        this.deductCash(winner, this.auctionState.currentBid);
        prop.owner = winner.id;
        this.log(`🏆 Auction WON! ${winner.name} won ${this.auctionState.tileName} for $${this.auctionState.currentBid}.`);
      }
    } else {
      this.log(`Auction ended with no bids. ${this.auctionState.tileName} remains with the Bank.`);
    }

    this.auctionState = null;
    this.turnPhase = "action";
    this.emitChange();
    this.checkBotTurn();
  }

  // Housing development (build / sell)
  buildHouse(playerId, propertyId) {
    const tile = BOARD[propertyId];
    if (!tile || tile.type !== "property") return { error: "Cannot build on this space" };
    const prop = this.properties[propertyId];
    if (prop.owner !== playerId) return { error: "You do not own this property" };

    const group = GROUP_MEMBERS[tile.group];
    const ownsAll = group.every(tid => this.properties[tid].owner === playerId && !this.properties[tid].mortgaged);
    if (!ownsAll) return { error: "You must own all unmortgaged properties in color group to build" };

    if (prop.houses >= 5) return { error: "Already reached Hotel (max development)" };

    // Even development check: cannot build if this property has more houses than any other in the group
    const minHousesInGroup = Math.min(...group.map(tid => this.properties[tid].houses));
    if (prop.houses > minHousesInGroup) {
      return { error: "Must build evenly across all properties in the group" };
    }

    const player = this.players.find(p => p.id === playerId);
    if (player.money < tile.houseCost) return { error: "Not enough money" };

    this.deductCash(player, tile.houseCost);
    prop.houses++;
    const structure = prop.houses === 5 ? "a Hotel" : `House #${prop.houses}`;
    this.log(`${player.name} built ${structure} on ${tile.name} for $${tile.houseCost}.`);
    this.emitChange();
    return { success: true };
  }

  sellHouse(playerId, propertyId) {
    const tile = BOARD[propertyId];
    if (!tile || tile.type !== "property") return { error: "Invalid property" };
    const prop = this.properties[propertyId];
    if (prop.owner !== playerId) return { error: "You do not own this property" };
    if (prop.houses <= 0) return { error: "No houses on this property" };

    const group = GROUP_MEMBERS[tile.group];
    const maxHousesInGroup = Math.max(...group.map(tid => this.properties[tid].houses));
    if (prop.houses < maxHousesInGroup) {
      return { error: "Must break down houses evenly across color group" };
    }

    const refund = Math.floor(tile.houseCost / 2);
    const player = this.players.find(p => p.id === playerId);
    this.addCash(player, refund);
    prop.houses--;
    this.log(`${player.name} sold a structure on ${tile.name} and received $${refund}.`);
    this.emitChange();
    return { success: true };
  }

  mortgageProperty(playerId, propertyId) {
    const tile = BOARD[propertyId];
    const prop = this.properties[propertyId];
    if (!prop || prop.owner !== playerId) return { error: "You do not own this property" };
    if (prop.mortgaged) return { error: "Already mortgaged" };

    if (tile.group && GROUP_MEMBERS[tile.group]) {
      const hasHouses = GROUP_MEMBERS[tile.group].some(tid => this.properties[tid].houses > 0);
      if (hasHouses) return { error: "Must sell all houses in group before mortgaging" };
    }

    const player = this.players.find(p => p.id === playerId);
    this.addCash(player, tile.mortgage);
    prop.mortgaged = true;
    this.log(`${player.name} mortgaged ${tile.name} for $${tile.mortgage}.`);
    this.emitChange();
    return { success: true };
  }

  unmortgageProperty(playerId, propertyId) {
    const tile = BOARD[propertyId];
    const prop = this.properties[propertyId];
    if (!prop || prop.owner !== playerId) return { error: "You do not own this property" };
    if (!prop.mortgaged) return { error: "Not mortgaged" };

    const cost = Math.round(tile.mortgage * 1.1); // 10% interest
    const player = this.players.find(p => p.id === playerId);
    if (player.money < cost) return { error: `Need $${cost} to unmortgage (includes 10% fee)` };

    this.deductCash(player, cost);
    prop.mortgaged = false;
    this.log(`${player.name} unmortgaged ${tile.name} for $${cost}.`);
    this.emitChange();
    return { success: true };
  }

  // Debt & Bankruptcy Management
  chargePlayer(player, amount, creditorId, reason, onPaidCallback) {
    if (player.money >= amount) {
      this.deductCash(player, amount);
      if (creditorId) {
        const creditor = this.players.find(p => p.id === creditorId);
        if (creditor) this.addCash(creditor, amount);
        this.lastRentEvent = {
          id: "rent_" + Date.now(),
          payerId: player.id,
          payerName: player.name,
          creditorId,
          creditorName: creditor ? creditor.name : "Player",
          ownerName: creditor ? creditor.name : "Player",
          amount,
          rent: amount,
          reason,
          propertyName: reason,
          timestamp: Date.now()
        };
        this.triggerGameEvent("rent", "RENT PAID", `${player.name} paid $${amount} rent to ${creditor ? creditor.name : 'Owner'} at ${reason}!`, "💰");
      }
      this.log(`${player.name} paid $${amount} for ${reason}.`);
      if (onPaidCallback) onPaidCallback();
      this.emitChange();
      return;
    }

    // Player does not have enough cash: enter DEBT state
    this.pendingDebt = {
      playerId: player.id,
      amount,
      creditorId,
      reason,
      onPaidCallback
    };
    this.turnPhase = "debt";
    this.log(`⚠️ ${player.name} owes $${amount} for ${reason} but only has $${player.money}! Must raise funds or declare bankruptcy.`);
    this.emitChange();
    this.checkBotDebt();
  }

  payDebt(playerId) {
    if (!this.pendingDebt || this.pendingDebt.playerId !== playerId) return { error: "No pending debt" };
    const player = this.players.find(p => p.id === playerId);
    if (player.money < this.pendingDebt.amount) {
      return { error: `Still short $${this.pendingDebt.amount - player.money}. Sell houses or mortgage properties.` };
    }

    this.deductCash(player, this.pendingDebt.amount);
    if (this.pendingDebt.creditorId) {
      const creditor = this.players.find(p => p.id === this.pendingDebt.creditorId);
      if (creditor) this.addCash(creditor, this.pendingDebt.amount);
    }

    this.log(`${player.name} settled debt of $${this.pendingDebt.amount} for ${this.pendingDebt.reason}.`);
    const cb = this.pendingDebt.onPaidCallback;
    this.pendingDebt = null;
    this.turnPhase = "action";
    if (cb) cb();
    this.auctionAttemptedThisTurn = false;
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  declareBankruptcy(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) return { error: "Cannot declare bankruptcy" };

    player.bankrupt = true;
    player.money = 0;
    player.bills = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0 };
    this.log(`🚨 ${player.name} DECLARED BANKRUPTCY!`);

    const creditorId = this.pendingDebt ? this.pendingDebt.creditorId : null;
    const creditor = creditorId ? this.players.find(p => p.id === creditorId) : null;

    // Forfeit properties
    this.properties.forEach(prop => {
      if (prop && prop.owner === playerId) {
        if (creditor) {
          prop.owner = creditor.id;
          this.log(`Transferred ${BOARD[prop.id].name} to ${creditor.name}.`);
        } else {
          // Reset to bank
          prop.owner = null;
          prop.houses = 0;
          prop.mortgaged = false;
        }
      }
    });

    if (creditor && player.jailCards > 0) {
      creditor.jailCards = (creditor.jailCards || 0) + player.jailCards;
      player.jailCards = 0;
    }

    this.pendingDebt = null;

    // Check game over
    const active = this.players.filter(p => !p.bankrupt);
    if (active.length === 1) {
      this.status = "ended";
      this.winner = active[0];
      this.log(`🏆 GAME OVER! ${this.winner.name} is the winner of Monopoly!`);
      this.emitChange();
      return { success: true };
    }

    // Advance turn if it was player's turn
    if (this.getCurrentPlayer().id === playerId) {
      this.turnIndex = this.getNextActivePlayerIndex(this.turnIndex);
      this.turnPhase = "roll";
      this.consecutiveDoubles = 0;
      this.log(`Next turn: ${this.getCurrentPlayer().name}.`);
    }

    this.auctionAttemptedThisTurn = false;
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  // Trading System
  proposeTrade(fromId, { toId, offerMoney = 0, offerProperties = [], offerCards = 0, requestMoney = 0, requestProperties = [], requestCards = 0 }) {
    const from = this.players.find(p => p.id === fromId);
    const to = this.players.find(p => p.id === toId);
    if (!from || !to || from.bankrupt || to.bankrupt) return { error: "Invalid players for trade" };
    if (from.money < offerMoney) return { error: "You don't have enough money to offer that amount" };

    // Validate property ownership
    for (const pid of offerProperties) {
      if (this.properties[pid].owner !== fromId) return { error: "You do not own offered property" };
      if (this.properties[pid].houses > 0) return { error: "Cannot trade properties with houses" };
    }
    for (const pid of requestProperties) {
      if (this.properties[pid].owner !== toId) return { error: "Target player does not own requested property" };
      if (this.properties[pid].houses > 0) return { error: "Cannot trade properties with houses" };
    }

    this.activeTrade = {
      id: "tr_" + Date.now(),
      fromId,
      toId,
      offerMoney: Number(offerMoney) || 0,
      offerProperties,
      offerCards: Number(offerCards) || 0,
      requestMoney: Number(requestMoney) || 0,
      requestProperties,
      requestCards: Number(requestCards) || 0,
      status: "pending"
    };

    this.log(`${from.name} proposed a trade to ${to.name}.`);
    this.emitChange();
    this.checkBotTrade();
    return { success: true, trade: this.activeTrade };
  }

  respondTrade(playerId, accept) {
    if (!this.activeTrade) return { error: "No active trade" };
    if (this.activeTrade.toId !== playerId && this.activeTrade.fromId !== playerId) return { error: "Not party to trade" };

    const from = this.players.find(p => p.id === this.activeTrade.fromId);
    const to = this.players.find(p => p.id === this.activeTrade.toId);

    if (!accept) {
      this.log(`${to.name} declined the trade offer from ${from.name}.`);
      this.activeTrade = null;
      this.emitChange();
      return { success: true };
    }

    // Execute Trade
    if (from.money < this.activeTrade.offerMoney || to.money < this.activeTrade.requestMoney) {
      this.activeTrade = null;
      return { error: "One of the players no longer has enough cash for trade" };
    }

    if (this.activeTrade.offerMoney > 0) {
      this.deductCash(from, this.activeTrade.offerMoney);
      this.addCash(to, this.activeTrade.offerMoney);
    }
    if (this.activeTrade.requestMoney > 0) {
      this.deductCash(to, this.activeTrade.requestMoney);
      this.addCash(from, this.activeTrade.requestMoney);
    }

    this.activeTrade.offerProperties.forEach(pid => {
      this.properties[pid].owner = to.id;
    });
    this.activeTrade.requestProperties.forEach(pid => {
      this.properties[pid].owner = from.id;
    });

    from.jailCards -= this.activeTrade.offerCards;
    to.jailCards += this.activeTrade.offerCards;
    to.jailCards -= this.activeTrade.requestCards;
    from.jailCards += this.activeTrade.requestCards;

    this.log(`🤝 Trade completed successfully between ${from.name} and ${to.name}!`);
    this.activeTrade = null;
    this.emitChange();
    return { success: true };
  }

  endTurn(playerId, sessionToken = null) {
    const player = this.getCurrentPlayer();
    if (!player || !this.isPlayerTurn(player, playerId, sessionToken)) return { error: "Not your turn" };
    if (this.turnPhase === "roll") return { error: "Must roll dice before ending turn" };
    if (this.turnPhase === "debt") return { error: "Must resolve debt or declare bankruptcy before ending turn" };
    if (this.turnPhase === "auction") return { error: "Auction in progress" };

    if (this.lastRollDoubles && !player.inJail && this.consecutiveDoubles < 3) {
      this.turnPhase = "roll";
      this.lastRollDoubles = false; // consume doubles grant so next roll is evaluated fresh
      this.log(`${player.name} rolled doubles and gets an extra turn!`);
    } else {
      this.consecutiveDoubles = 0;
      this.lastRollDoubles = false;
      this.turnIndex = this.getNextActivePlayerIndex(this.turnIndex);
      this.turnPhase = "roll";
      this.activeCard = null;
      this.log(`Turn ended. ${this.getCurrentPlayer().name}'s turn.`);
    }

    this.auctionAttemptedThisTurn = false;
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  calculateRepairs(player, houseCost, hotelCost) {
    let total = 0;
    this.properties.forEach(prop => {
      if (prop && prop.owner === player.id) {
        if (prop.houses === 5) total += hotelCost;
        else total += prop.houses * houseCost;
      }
    });
    return total;
  }

  emitChange() {
    this.onStateChange(this.getPublicState());
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      status: this.status,
      hostId: this.hostId,
      spectatorsCount: this.spectators ? this.spectators.size : 0,
      players: this.players.map(p => ({
        ...p,
        isHost: (p.id === this.hostId)
      })),
      turnIndex: this.turnIndex,
      turnPhase: this.turnPhase,
      dice: this.dice,
      lastRollDoubles: this.lastRollDoubles,
      properties: this.properties,
      auctionState: this.auctionState,
      pendingDebt: this.pendingDebt,
      activeTrade: this.activeTrade,
      logs: this.logs.slice(-30),
      winner: this.winner,
      activeCard: this.activeCard,
      lastMove: this.lastMove,
      rollId: this.rollId,
      lastRentEvent: this.lastRentEvent || null,
      lastGameEvent: this.lastGameEvent || null
    };
  }

  // BOT AI AUTOMATION - Deliberate video-game pacing
  checkBotTurn() {
    if (this.status !== "in_progress") return;
    const player = this.getCurrentPlayer();
    if (!player || !player.isBot || player.bankrupt) return;

    if (this.botTurnTimeout) {
      clearTimeout(this.botTurnTimeout);
      this.botTurnTimeout = null;
    }

    if (this.turnPhase === "roll") {
      this.botTurnTimeout = setTimeout(() => {
        if (this.status !== "in_progress") return;
        const cur = this.getCurrentPlayer();
        if (!cur || cur.id !== player.id || this.turnPhase !== "roll") return;

        if (player.inJail) {
          if (player.jailCards > 0) {
            this.useJailCard(player.id);
          } else if (player.money > 400) {
            this.payJailFine(player.id);
          }
        }
        this.rollDice(player.id);
      }, 2200);
    } else if (this.turnPhase === "action") {
      // Allow full client animation: 1.2s dice roll + (rollSum * 240ms) tile hops + 1.2s landing pause
      const rollSum = (this.dice && this.dice.length >= 2) ? (this.dice[0] + this.dice[1]) : 7;
      const clientAnimDuration = 1200 + (rollSum * 240) + 1200;

      this.botTurnTimeout = setTimeout(() => {
        if (this.status !== "in_progress") return;
        const cur = this.getCurrentPlayer();
        if (!cur || cur.id !== player.id || this.turnPhase !== "action") return;

        const tile = BOARD[player.position];
        if (tile && (tile.type === "property" || tile.type === "railroad" || tile.type === "utility")) {
          const prop = this.properties[tile.id];
          if (!prop.owner && !this.auctionAttemptedThisTurn) {
            if (player.money >= tile.cost + 150) {
              this.buyProperty(player.id);
            } else {
              this.auctionAttemptedThisTurn = true;
              this.startAuction(tile.id);
              return;
            }
          }
        }

        this.botDevelopProperties(player);

        this.botTurnTimeout = setTimeout(() => {
          if (this.status !== "in_progress") return;
          const cur2 = this.getCurrentPlayer();
          if (cur2 && cur2.id === player.id && this.turnPhase === "action") {
            this.endTurn(player.id);
          }
        }, 1200);
      }, clientAnimDuration);

      // Watchdog failsafe: Ensure bot never gets permanently stuck
      if (this.botWatchdog) clearTimeout(this.botWatchdog);
      this.botWatchdog = setTimeout(() => {
        if (this.status !== "in_progress") return;
        const curW = this.getCurrentPlayer();
        if (curW && curW.isBot && curW.id === player.id && this.turnPhase === "action") {
          console.warn(`[Bot Watchdog] Auto-ending stalled turn for ${curW.name}`);
          this.endTurn(player.id);
        }
      }, 10000);
    }
  }

    botDevelopProperties(player) {
    for (const groupName of Object.keys(GROUP_MEMBERS)) {
      if (groupName === "railroad" || groupName === "utility") continue;
      const groupTiles = GROUP_MEMBERS[groupName];
      const ownsAll = groupTiles.every(tid => this.properties[tid].owner === player.id && !this.properties[tid].mortgaged);
      if (ownsAll) {
        for (const tid of groupTiles) {
          const tile = BOARD[tid];
          const prop = this.properties[tid];
          if (prop.houses < 5 && player.money > tile.houseCost + 300) {
            this.buildHouse(player.id, tid);
          }
        }
      }
    }
  }

  checkBotAuction() {
    if (!this.auctionState) return;
    if (this.botAuctionTimeout) {
      clearTimeout(this.botAuctionTimeout);
      this.botAuctionTimeout = null;
    }

    const eligibleBots = this.players.filter(p => 
      p.isBot && 
      !p.bankrupt && 
      p.connected !== false && 
      !this.auctionState.passedPlayerIds.includes(p.id) && 
      p.id !== this.auctionState.highestBidderId
    );

    if (eligibleBots.length === 0) {
      const remainingBidders = this.players.filter(p => 
        !p.bankrupt && 
        p.connected !== false && 
        !this.auctionState.passedPlayerIds.includes(p.id) && 
        p.id !== this.auctionState.highestBidderId
      );
      if (remainingBidders.length === 0 && this.auctionState.highestBidderId) {
        this.concludeAuction();
      }
      return;
    }

    const bot = eligibleBots[0];
    const tile = BOARD[this.auctionState.propertyId];
    if (!tile) return;

    this.botAuctionTimeout = setTimeout(() => {
      if (!this.auctionState) return;
      const maxValuation = Math.floor(tile.cost * 0.85);
      const nextBid = this.auctionState.currentBid + (this.auctionState.currentBid < 50 ? 10 : 20);

      if (nextBid <= maxValuation && bot.money >= nextBid) {
        this.placeBid(bot.id, nextBid);
      } else {
        this.passBid(bot.id);
      }
    }, 1400);
  }

  checkBotDebt() {
    if (!this.pendingDebt) return;
    const player = this.players.find(p => p.id === this.pendingDebt.playerId);
    if (!player || !player.isBot) return;

    setTimeout(() => {
      // Bot mortgages unbuilt properties to raise funds
      const owned = this.properties.filter(p => p && p.owner === player.id && !p.mortgaged && p.houses === 0);
      for (const p of owned) {
        if (player.money >= this.pendingDebt.amount) break;
        this.mortgageProperty(player.id, p.id);
      }

      if (player.money >= this.pendingDebt.amount) {
        this.payDebt(player.id);
      } else {
        this.declareBankruptcy(player.id);
      }
    }, 2600);
  }

  checkBotTrade() {
    if (!this.activeTrade) return;
    const target = this.players.find(p => p.id === this.activeTrade.toId);
    if (!target || !target.isBot) return;

    setTimeout(() => {
      if (!this.activeTrade || this.activeTrade.toId !== target.id) return;
      let offerScore = this.activeTrade.offerMoney;
      this.activeTrade.offerProperties.forEach(pid => {
        const tile = BOARD[pid];
        let val = tile ? tile.cost : 150;
        if (tile && tile.group && GROUP_MEMBERS[tile.group]) {
          const grp = GROUP_MEMBERS[tile.group];
          const botCount = grp.filter(id => id !== pid && this.properties[id].owner === target.id).length;
          if (botCount === grp.length - 1) val *= 2.5; // Complete monopoly bonus!
        }
        offerScore += val;
      });

      let requestScore = this.activeTrade.requestMoney;
      this.activeTrade.requestProperties.forEach(pid => {
        const tile = BOARD[pid];
        let val = tile ? tile.cost : 150;
        if (tile && tile.group && GROUP_MEMBERS[tile.group]) {
          const grp = GROUP_MEMBERS[tile.group];
          const botCount = grp.filter(id => this.properties[id].owner === target.id).length;
          if (botCount === grp.length) val *= 3.0; // Don't break monopoly!
        }
        requestScore += val;
      });

      const accept = (offerScore >= requestScore && target.money >= this.activeTrade.requestMoney);
      this.log(`🤖 ${target.name} evaluated trade: ${accept ? "ACCEPTED" : "DECLINED"}`);
      this.respondTrade(target.id, accept);
    }, 2000);
  }

  exportState() {
    return {
      roomId: this.roomId,
      status: this.status,
      players: this.players,
      turnIndex: this.turnIndex,
      turnPhase: this.turnPhase,
      dice: this.dice,
      lastRollDoubles: this.lastRollDoubles,
      properties: this.properties,
      auctionState: this.auctionState,
      pendingDebt: this.pendingDebt,
      activeTrade: this.activeTrade,
      logs: this.logs,
      winner: this.winner,
      activeCard: this.activeCard,
      lastMove: this.lastMove,
      rollId: this.rollId,
      saveTimestamp: Date.now()
    };
  }

  loadState(savedData) {
    if (!savedData) return;
    this.roomId = savedData.roomId || this.roomId;
    this.status = savedData.status || this.status;
    this.players = savedData.players || this.players;
    this.turnIndex = savedData.turnIndex !== undefined ? savedData.turnIndex : this.turnIndex;
    this.turnPhase = savedData.turnPhase || this.turnPhase;
    this.dice = savedData.dice || this.dice;
    this.lastRollDoubles = savedData.lastRollDoubles || false;
    this.properties = savedData.properties || this.properties;
    this.auctionState = savedData.auctionState || null;
    this.pendingDebt = savedData.pendingDebt || null;
    this.activeTrade = savedData.activeTrade || null;
    this.logs = savedData.logs || [];
    this.winner = savedData.winner || null;
    this.activeCard = savedData.activeCard || null;
    this.lastMove = savedData.lastMove || null;
    this.rollId = (savedData.rollId || 0) + 1;
    this.log(`📂 Game resumed from saved state!`);
    this.emitChange();
    this.checkBotTurn();
  }

    executeDevAction(action, payload = {}) {
    if (action === "set_money") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        if (payload.isDelta) {
          p.money = Math.max(0, p.money + (Number(payload.amount) || 0));
        } else {
          p.money = Math.max(0, Number(payload.amount) || 0);
        }
        this.log(`🛠️ [DEV] Updated ${p.name}'s cash to $${p.money}`);
      }
    } else if (action === "teleport") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p && payload.tileId !== undefined) {
        const target = Math.max(0, Math.min(39, Number(payload.tileId)));
        this.log(`🛠️ [DEV] Teleported ${p.name} to ${BOARD[target].name}`);
        this.movePlayerTo(p, target, false);
        return { success: true };
      }
    } else if (action === "force_roll") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        this.turnPhase = "roll";
        return this.rollDice(p.id, Number(payload.d1) || 1, Number(payload.d2) || 1);
      }
    } else if (action === "trigger_card") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        if (payload.type === "chance" || payload.deck === "chance") {
          const card = this.drawChanceCard();
          this.activeCard = { type: "Chance", text: card.text };
          this.log(`🛠️ [DEV] Triggered Chance: "${card.text}"`);
          card.action(this, p);
        } else {
          const card = this.drawChestCard();
          this.activeCard = { type: "Community Chest", text: card.text };
          this.log(`🛠️ [DEV] Triggered Community Chest: "${card.text}"`);
          card.action(this, p);
        }
      }
    } else if (action === "give_monopoly") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        [37, 39].forEach(tid => {
          if (this.properties[tid]) {
            this.properties[tid].owner = p.id;
            this.properties[tid].houses = 0;
            this.properties[tid].hotel = false;
            this.properties[tid].mortgaged = false;
          }
        });
        this.log(`🛠️ [DEV] Granted Park Place & Boardwalk to ${p.name}`);
      }
    } else if (action === "build_hotel") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      const tid = (payload.tileId !== undefined) ? Number(payload.tileId) : (p ? p.position : 39);
      if (this.properties[tid]) {
        this.properties[tid].houses = 5;
        this.properties[tid].hotel = true;
        this.log(`🛠️ [DEV] Built Grand Hotel on ${BOARD[tid].name}`);
      }
    } else if (action === "force_jail") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        this.sendToJail(p);
      }
    } else if (action === "release_jail") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        p.inJail = false;
        p.jailTurns = 0;
        this.log(`🛠️ [DEV] Released ${p.name} from Jail.`);
      }
    } else if (action === "give_jail_card") {
      const p = this.players.find(pl => pl.id === payload.playerId) || this.getCurrentPlayer();
      if (p) {
        p.jailCards = (p.jailCards || 0) + 1;
        this.log(`🛠️ [DEV] Granted Get Out of Jail Free card to ${p.name}`);
      }
    } else if (action === "add_cash_all") {
      const amount = Number(payload.amount) || 1000;
      this.players.forEach(pl => {
        if (!pl.bankrupt) pl.money += amount;
      });
      this.log(`🛠️ [DEV] Distributed $${amount} stimulus check to all players!`);
    }
    return { success: true };
  }
}

module.exports = MonopolyEngine;
