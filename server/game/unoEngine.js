// =============================================================================
// SALOON UNO ENGINE - Standard 108 Card Rules with Fast Saloon Bot AI
// =============================================================================

const COLORS = ["red", "blue", "green", "yellow"];

function buildUnoDeck() {
  const deck = [];
  let idCounter = 1;

  COLORS.forEach(color => {
    // One '0' per color
    deck.push({ id: `c_${idCounter++}`, color, value: "0", type: "number" });

    // Two of 1-9 per color
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: `c_${idCounter++}`, color, value: String(n), type: "number" });
      deck.push({ id: `c_${idCounter++}`, color, value: String(n), type: "number" });
    }

    // Two of each action card per color: Skip, Reverse, Draw 2
    for (let a = 0; a < 2; a++) {
      deck.push({ id: `c_${idCounter++}`, color, value: "skip", type: "skip" });
      deck.push({ id: `c_${idCounter++}`, color, value: "reverse", type: "reverse" });
      deck.push({ id: `c_${idCounter++}`, color, value: "+2", type: "draw2" });
    }
  });

  // 4 Wild and 4 Wild Draw 4
  for (let w = 0; w < 4; w++) {
    deck.push({ id: `c_${idCounter++}`, color: "wild", value: "wild", type: "wild" });
    deck.push({ id: `c_${idCounter++}`, color: "wild", value: "+4", type: "wild4" });
  }

  return deck;
}

function shuffleDeck(arr) {
  const deck = [...arr];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

class UnoEngine {
  constructor(roomId, onStateChange) {
    this.roomId = roomId;
    this.gameType = "uno";
    this.onStateChange = onStateChange || (() => {});
    this.status = "waiting"; // "waiting", "in_progress", "ended"
    this.players = [];
    this.turnIndex = 0;
    this.direction = 1; // 1 = clockwise, -1 = counter-clockwise
    this.drawPile = [];
    this.discardPile = [];
    this.activeColor = "red";
    this.activeCard = null;
    this.logs = [];
    this.winner = null;
    this.unoShouts = new Set(); // playerIds who called UNO
    this.lastCardEvent = null;
    this.botTurnTimeout = null;
  }

  log(msg) {
    const entry = { text: msg, time: new Date().toLocaleTimeString() };
    this.logs.push(entry);
    if (this.logs.length > 80) this.logs.shift();
  }

  emitChange() {
    this.onStateChange(this.getPublicState());
  }

  addPlayer({ id, name, token, color, isBot = false }) {
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

    const player = {
      id,
      name: (name || "").trim() || `Player ${this.players.length + 1}`,
      token: chosenToken,
      color: chosenColor,
      isBot,
      connected: true,
      hand: []
    };

    this.players.push(player);
    this.log(`${player.name} joined Saloon Uno.`);
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
    } else {
      p.connected = false;
      this.log(`${p.name} disconnected.`);
    }
    this.emitChange();
  }

  startGame() {
    if (this.players.length < 2) return { error: "Need at least 2 players to start" };
    this.status = "in_progress";
    this.drawPile = shuffleDeck(buildUnoDeck());
    this.discardPile = [];
    this.unoShouts.clear();
    this.direction = 1;
    this.turnIndex = 0;
    this.winner = null;

    // Deal 7 cards to each player
    this.players.forEach(p => {
      p.hand = this.drawPile.splice(0, 7);
    });

    // Flip top card for discard pile (must not be a wild+4 at start)
    let firstCard = this.drawPile.shift();
    while (firstCard.type === "wild4") {
      this.drawPile.push(firstCard);
      this.drawPile = shuffleDeck(this.drawPile);
      firstCard = this.drawPile.shift();
    }

    this.discardPile.push(firstCard);
    this.activeCard = firstCard;
    this.activeColor = (firstCard.color === "wild") ? COLORS[Math.floor(Math.random() * COLORS.length)] : firstCard.color;

    this.log(`Saloon Uno started! First card is ${firstCard.color.toUpperCase()} ${firstCard.value}.`);
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  getCurrentPlayer() {
    return this.players[this.turnIndex];
  }

  getNextPlayerIndex(offset = 1) {
    const len = this.players.length;
    let next = (this.turnIndex + this.direction * offset) % len;
    if (next < 0) next += len;
    return next;
  }

  drawCardsFromDeck(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length <= 1) break;
        const top = this.discardPile.pop();
        this.drawPile = shuffleDeck(this.discardPile);
        this.discardPile = [top];
      }
      if (this.drawPile.length > 0) {
        drawn.push(this.drawPile.shift());
      }
    }
    return drawn;
  }

  isCardPlayable(card) {
    if (!this.activeCard) return false;
    if (card.color === "wild" || card.type === "wild" || card.type === "wild4") return true;
    if (card.color === this.activeColor) return true;
    if (card.value === this.activeCard.value) return true;
    return false;
  }

  playCard(playerId, cardId, chosenColor = null) {
    if (this.status !== "in_progress") return { error: "Game not in progress" };
    const player = this.getCurrentPlayer();
    if (!player || player.id !== playerId) return { error: "Not your turn" };

    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { error: "Card not in hand" };
    const card = player.hand[cardIdx];

    if (!this.isCardPlayable(card)) {
      return { error: `Cannot play ${card.color} ${card.value} on ${this.activeColor} ${this.activeCard.value}` };
    }

    // Play card
    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);
    this.activeCard = card;

    // Check UNO shout penalty if player now has 1 card but didn't call UNO
    if (player.hand.length === 1 && !this.unoShouts.has(player.id)) {
      this.log(`⚠️ ${player.name} forgot to shout UNO and was caught! (+2 penalty cards)`);
      const penalty = this.drawCardsFromDeck(2);
      player.hand.push(...penalty);
    }

    // Win condition check
    if (player.hand.length === 0) {
      this.status = "ended";
      this.winner = player;
      this.log(`🏆 VICTORY! ${player.name} played their last card and WON Saloon Uno!`);
      this.emitChange();
      return { success: true, won: true };
    }

    // Handle Card Effects
    let skipNext = false;
    let nextDraw = 0;

    if (card.type === "wild" || card.type === "wild4") {
      const validColor = COLORS.includes(chosenColor) ? chosenColor : COLORS[Math.floor(Math.random() * COLORS.length)];
      this.activeColor = validColor;
      this.log(`${player.name} played ${card.type === "wild4" ? "WILD DRAW 4" : "WILD"} and chose ${validColor.toUpperCase()}!`);
      if (card.type === "wild4") {
        nextDraw = 4;
        skipNext = true;
      }
    } else {
      this.activeColor = card.color;
      if (card.type === "skip") {
        skipNext = true;
        this.log(`${player.name} played SKIP!`);
      } else if (card.type === "reverse") {
        if (this.players.length === 2) {
          skipNext = true; // 2 players: reverse acts like skip
        } else {
          this.direction *= -1;
        }
        this.log(`${player.name} played REVERSE! Turn order is now ${this.direction === 1 ? "Clockwise" : "Counter-Clockwise"}.`);
      } else if (card.type === "draw2") {
        nextDraw = 2;
        skipNext = true;
        this.log(`${player.name} played DRAW 2!`);
      } else {
        this.log(`${player.name} played ${card.color.toUpperCase()} ${card.value}.`);
      }
    }

    // Apply draw penalties to victim
    if (nextDraw > 0) {
      const victimIdx = this.getNextPlayerIndex(1);
      const victim = this.players[victimIdx];
      const drawn = this.drawCardsFromDeck(nextDraw);
      victim.hand.push(...drawn);
      this.log(`💥 ${victim.name} drew ${nextDraw} cards and lost their turn!`);
    }

    // Advance Turn
    const advanceBy = skipNext ? 2 : 1;
    this.turnIndex = this.getNextPlayerIndex(advanceBy);

    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  drawCard(playerId) {
    if (this.status !== "in_progress") return { error: "Game not in progress" };
    const player = this.getCurrentPlayer();
    if (!player || player.id !== playerId) return { error: "Not your turn" };

    const drawn = this.drawCardsFromDeck(1);
    if (drawn.length > 0) {
      player.hand.push(drawn[0]);
      this.log(`${player.name} drew a card from the deck.`);
      
      // If drawn card is playable, check if it can be played or player passes
      // Advance turn automatically if card drawn
      this.turnIndex = this.getNextPlayerIndex(1);
      this.emitChange();
      this.checkBotTurn();
      return { success: true, drawnCard: drawn[0] };
    }

    this.turnIndex = this.getNextPlayerIndex(1);
    this.emitChange();
    this.checkBotTurn();
    return { success: true };
  }

  shoutUno(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: "Player not found" };
    this.unoShouts.add(playerId);
    this.log(`🔥 ${player.name} SHOUTED: "UNO!"`);
    this.emitChange();
    return { success: true };
  }

  // Fast Bot AI
  checkBotTurn() {
    if (this.status !== "in_progress") return;
    const player = this.getCurrentPlayer();
    if (!player || !player.isBot) return;

    if (this.botTurnTimeout) {
      clearTimeout(this.botTurnTimeout);
      this.botTurnTimeout = null;
    }

    const botDelay = 1200 + Math.random() * 800;
    this.botTurnTimeout = setTimeout(() => {
      if (this.status !== "in_progress") return;
      const cur = this.getCurrentPlayer();
      if (!cur || cur.id !== player.id) return;

      // Shout UNO if bot will have 1 card left
      if (player.hand.length === 2) {
        this.shoutUno(player.id);
      }

      // Find playable cards
      const playable = player.hand.filter(c => this.isCardPlayable(c));

      if (playable.length > 0) {
        // Strategic priority: Action cards > matching color number cards > Wild
        let chosen = playable.find(c => c.type === "draw2" || c.type === "skip" || c.type === "reverse");
        if (!chosen) chosen = playable.find(c => c.color === this.activeColor && c.type === "number");
        if (!chosen) chosen = playable.find(c => c.type === "number");
        if (!chosen) chosen = playable[0];

        // Pick color if Wild
        let chosenColor = "red";
        if (chosen.type === "wild" || chosen.type === "wild4") {
          // Count colors in hand
          const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
          player.hand.forEach(c => {
            if (counts[c.color] !== undefined) counts[c.color]++;
          });
          chosenColor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        }

        this.playCard(player.id, chosen.id, chosenColor);
      } else {
        // Draw card
        this.drawCard(player.id);
      }
    }, botDelay);
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      gameType: "uno",
      status: this.status,
      turnIndex: this.turnIndex,
      direction: this.direction,
      activeColor: this.activeColor,
      activeCard: this.activeCard,
      drawPileCount: this.drawPile.length,
      discardPileCount: this.discardPile.length,
      winner: this.winner,
      logs: this.logs.slice(-30),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        token: p.token,
        color: p.color,
        isBot: p.isBot,
        connected: p.connected,
        cardCount: p.hand ? p.hand.length : 0,
        hand: p.hand || [] // Clean client hand filtering handled per-socket
      }))
    };
  }
}

module.exports = UnoEngine;
