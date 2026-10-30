const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const MonopolyEngine = require("./game/monopolyEngine");
const UnoEngine = require("./game/unoEngine");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Security and anti-redirect headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://fonts.gstatic.com data: blob:;"
  );
  next();
});

app.use(express.static(path.join(__dirname, "../public")));
app.use(express.json());
app.get("/favicon.ico", (req, res) => res.status(204).end());

// In-memory room store: roomId -> MonopolyEngine
const rooms = new Map();

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GAME-${code}`;
}

function getOrCreateRoom(roomId) {
  let engine = rooms.get(roomId);
  if (!engine) {
    engine = new MonopolyEngine(roomId, (state) => {
      io.to(roomId).emit("game_state", state);
    });
    rooms.set(roomId, engine);
  }
  return engine;
}

// Socket.IO event handlers
io.on("connection", (socket) => {
  let currentRoomId = null;
  let currentPlayerId = null;

  // Create new game room (Monopoly 3D active; Uno locked behind Coming Soon)
  socket.on("create_room", ({ name, token, color, sessionToken }, callback) => {
    const roomId = generateRoomId();
    currentRoomId = roomId;
    currentPlayerId = socket.id;

    socket.join(roomId);
    const engine = new MonopolyEngine(roomId, (state) => {
      io.to(roomId).emit("game_state", state);
    });
    rooms.set(roomId, engine);
    const res = engine.addPlayer({
      id: socket.id,
      sessionToken: sessionToken || socket.id,
      name: name || "Host",
      token,
      color,
      isBot: false
    });

    if (callback) callback({ success: true, roomId, player: res.player, gameType: "monopoly" });
    io.to(roomId).emit("game_state", engine.getPublicState());
  });

  // Switch Game Mode in Lobby (Monopoly 3D <-> Saloon Uno)
  socket.on("switch_game_type", ({ roomId, gameType }, callback) => {
    const oldEngine = rooms.get(roomId);
    if (!oldEngine || oldEngine.status !== "waiting") return;
    const players = oldEngine.players;
    let newEngine;
    if (gameType === "uno") {
      newEngine = new UnoEngine(roomId, (state) => {
        io.to(roomId).emit("game_state", state);
      });
    } else {
      newEngine = new MonopolyEngine(roomId, (state) => {
        io.to(roomId).emit("game_state", state);
      });
    }
    newEngine.players = players;
    rooms.set(roomId, newEngine);
    io.to(roomId).emit("game_state", newEngine.getPublicState());
    if (callback) callback({ success: true, gameType: newEngine.gameType });
  });

  // Saloon Uno: Play Card
  socket.on("play_uno_card", ({ roomId, cardId, chosenColor }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine || !engine.playCard) return;
    const res = engine.playCard(socket.id, cardId, chosenColor);
    if (callback) callback(res);
  });

  // Saloon Uno: Draw Card
  socket.on("draw_uno_card", ({ roomId }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine || !engine.drawCard) return;
    const res = engine.drawCard(socket.id);
    if (callback) callback(res);
  });

  // Saloon Uno: Shout UNO!
  socket.on("shout_uno", ({ roomId }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine || !engine.shoutUno) return;
    const res = engine.shoutUno(socket.id);
    if (callback) callback(res);
  });

  // Join existing room
  socket.on("join_room", ({ roomId, name, token, color, sessionToken }, callback) => {
    const cleanRoomId = (roomId || "").trim().toUpperCase();
    const engine = rooms.get(cleanRoomId);

    if (!engine) {
      if (callback) callback({ error: "Room not found. Check the room code." });
      return;
    }

    currentRoomId = cleanRoomId;
    currentPlayerId = socket.id;
    socket.join(cleanRoomId);

    // 1. Check if reconnecting existing player (by sessionToken or name)
    if (engine.reconnectPlayer) {
      const reconnected = engine.reconnectPlayer(socket.id, sessionToken, name);
      if (reconnected) {
        if (callback) callback({ success: true, roomId: cleanRoomId, player: reconnected, reconnected: true });
        io.to(cleanRoomId).emit("game_state", engine.getPublicState());
        return;
      }
    }

    // 2. If match already in progress and NOT a reconnecting player -> Join as Spectator!
    if (engine.status !== "waiting") {
      if (engine.addSpectator) {
        engine.addSpectator(socket.id, name);
      }
      if (callback) callback({
        success: true,
        roomId: cleanRoomId,
        isSpectator: true,
        player: { id: socket.id, name: name || "Spectator", isSpectator: true }
      });
      io.to(cleanRoomId).emit("game_state", engine.getPublicState());
      return;
    }

    // 3. Normal lobby join
    const res = engine.addPlayer({
      id: socket.id,
      sessionToken: sessionToken || socket.id,
      name,
      token,
      color,
      isBot: false
    });

    if (res.error) {
      if (callback) callback({ error: res.error });
      return;
    }

    if (callback) callback({ success: true, roomId: cleanRoomId, player: res.player });
    io.to(cleanRoomId).emit("game_state", engine.getPublicState());
  });

  // Host: Kick player or bot from room
  socket.on("kick_player", ({ roomId, targetPlayerId }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine || !engine.kickPlayer) return;
    const res = engine.kickPlayer(socket.id, targetPlayerId);
    if (res.success && res.target) {
      io.to(targetPlayerId).emit("kicked_from_room", { message: "You were removed from the lobby by the host." });
    }
    if (callback) callback(res);
  });

  // Leave active game room (Return to Main Menu)
  socket.on("leave_room", ({ roomId }, callback) => {
    const rId = roomId || currentRoomId;
    if (rId) {
      socket.leave(rId);
      const engine = rooms.get(rId);
      if (engine) {
        engine.removePlayer(socket.id);
        if (engine.players.length === 0 || engine.players.every(p => !p.connected && !p.isBot)) {
          if (engine.botTurnTimeout) clearTimeout(engine.botTurnTimeout);
          rooms.delete(rId);
        } else {
          io.to(rId).emit("game_state", engine.getPublicState());
        }
      }
    }
    currentRoomId = null;
    currentPlayerId = null;
    if (callback) callback({ success: true });
  });

  // Add AI Bot to room with guaranteed unique character model
  socket.on("add_bot", ({ roomId }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine) return;
    if (engine.players.length >= 6) {
      if (callback) callback({ error: "Room is full (max 6 players)" });
      return;
    }

    const ALL_TOKENS = ["🎩", "🚗", "🚢", "👞", "🧵", "✈️"];
    const TOKEN_NAMES = {
      "🎩": "Tycoon Bot 🎩",
      "🚗": "Roadster Bot 🚗",
      "🚢": "Captain Bot 🚢",
      "👞": "Ranger Bot 👞",
      "🧵": "Tailor Bot 🧵",
      "✈️": "Aviator Bot ✈️"
    };

    const takenTokens = new Set(engine.players.map(p => p.token));
    const availableToken = ALL_TOKENS.find(t => !takenTokens.has(t)) || ALL_TOKENS[0];
    const botName = TOKEN_NAMES[availableToken] || "Investor Bot 🤖";

    const res = engine.addPlayer({
      id: "bot_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: botName,
      token: availableToken,
      isBot: true
    });

    if (callback) callback(res);
  });

  // Start the game
  socket.on("start_game", ({ roomId }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine) return;
    const res = engine.startGame();
    if (callback) callback(res);
  });

  // Game action: Roll Dice (supports physical roll numbers from 3D physics)
  socket.on("roll_dice", ({ roomId, d1, d2 }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.rollDice(socket.id, d1, d2);
  });

  // Game action: Buy Property
  socket.on("buy_property", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.buyProperty(socket.id);
  });

  // Game action: Start Auction for current property
  socket.on("start_auction", ({ roomId, propertyId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.startAuction(propertyId);
  });

  // Game action: Place Bid in auction
  socket.on("place_bid", ({ roomId, amount }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.placeBid(socket.id, amount);
  });

  // Game action: Pass in auction
  socket.on("pass_bid", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.passBid(socket.id);
  });

  // Game action: Build house
  socket.on("build_house", ({ roomId, propertyId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.buildHouse(socket.id, propertyId);
  });

  // Game action: Sell house
  socket.on("sell_house", ({ roomId, propertyId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.sellHouse(socket.id, propertyId);
  });

  // Game action: Mortgage
  socket.on("mortgage_property", ({ roomId, propertyId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.mortgageProperty(socket.id, propertyId);
  });

  // Game action: Unmortgage
  socket.on("unmortgage_property", ({ roomId, propertyId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.unmortgageProperty(socket.id, propertyId);
  });

  // Game action: Pay jail fine
  socket.on("pay_jail_fine", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.payJailFine(socket.id);
  });

  // Game action: Use jail card
  socket.on("use_jail_card", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.useJailCard(socket.id);
  });

  // Game action: Pay debt
  socket.on("pay_debt", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.payDebt(socket.id);
  });

  // Game action: Declare bankruptcy
  socket.on("declare_bankruptcy", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.declareBankruptcy(socket.id);
  });

  // Game action: Break Bill at Bank
  socket.on("break_bill", ({ roomId, denomination }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine) return;
    const player = engine.players.find(p => p.id === socket.id);
    if (!player) return;
    const res = engine.breakBill(player, denomination);
    if (callback) callback(res);
  });

  // Game action: Propose Trade
  socket.on("propose_trade", ({ roomId, tradeData }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.proposeTrade(socket.id, tradeData);
  });

  // Game action: Respond to Trade (accept/reject)
  socket.on("respond_trade", ({ roomId, accept }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.respondTrade(socket.id, accept);
  });

  // Save Game to persistent file
  socket.on("save_game", ({ roomId }, callback) => {
    const engine = rooms.get(roomId);
    if (!engine) {
      if (callback) callback({ error: "Game room not found" });
      return;
    }
    const savedDir = path.join(__dirname, "saved_games");
    if (!fs.existsSync(savedDir)) fs.mkdirSync(savedDir, { recursive: true });
    const saveState = engine.exportState();
    const saveFile = path.join(savedDir, `${roomId}.json`);
    fs.writeFileSync(saveFile, JSON.stringify(saveState, null, 2), "utf8");
    engine.log(`💾 Game saved to file (${roomId}.json)!`);
    io.to(roomId).emit("game_state", engine.getPublicState());
    if (callback) callback({ success: true, roomId, timestamp: saveState.saveTimestamp });
  });

  // List available saved games
  socket.on("list_saved_games", (callback) => {
    const savedDir = path.join(__dirname, "saved_games");
    if (!fs.existsSync(savedDir)) {
      if (callback) callback({ saves: [] });
      return;
    }
    const files = fs.readdirSync(savedDir).filter(f => f.endsWith(".json"));
    const saves = files.map(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(savedDir, file), "utf8"));
        return {
          roomId: data.roomId,
          playersCount: data.players ? data.players.length : 0,
          players: (data.players || []).map(p => ({ name: p.name, token: p.token, color: p.color, isBot: p.isBot })),
          timestamp: data.saveTimestamp || Date.now()
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    if (callback) callback({ saves });
  });

  // Load / Resume a saved game
  socket.on("load_saved_game", ({ roomId, playerName, saveState }, callback) => {
    const savedDir = path.join(__dirname, "saved_games");
    if (!fs.existsSync(savedDir)) fs.mkdirSync(savedDir, { recursive: true });
    const saveFile = path.join(savedDir, `${roomId}.json`);
    if (saveState) {
      try {
        fs.writeFileSync(saveFile, JSON.stringify(saveState, null, 2), "utf8");
      } catch (err) {
        console.error("Error writing saveState:", err);
      }
    }
    if (!fs.existsSync(saveFile)) {
      if (callback) callback({ error: "Saved game file not found" });
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(saveFile, "utf8"));
      let engine = rooms.get(roomId);
      if (!engine) {
        engine = new MonopolyEngine({
          roomId,
          onStateChange: (state) => io.to(roomId).emit("game_state", state)
        });
        rooms.set(roomId, engine);
      }
      engine.loadState(data);
      socket.join(roomId);
      currentRoomId = roomId;

      // Map this connection to human player
      const human = engine.players.find(p => !p.isBot);
      if (human) {
        human.id = socket.id;
        human.connected = true;
        if (playerName) human.name = playerName;
      }

      io.to(roomId).emit("game_state", engine.getPublicState());
      if (callback) callback({ success: true, roomId, player: human });
    } catch (err) {
      if (callback) callback({ error: "Failed to load save: " + err.message });
    }
  });

  // Game action: End Turn
  socket.on("end_turn", ({ roomId }) => {
    const engine = rooms.get(roomId);
    if (engine) engine.endTurn(socket.id);
  });

  // Developer Mode Action Handler (Passcode: 125)
  socket.on("dev_action", ({ roomId, password, action, payload }, callback) => {
    if (password !== "125") {
      if (callback) callback({ error: "Access Denied: Invalid Developer Passcode" });
      return;
    }
    const engine = rooms.get(roomId);
    if (!engine) {
      if (callback) callback({ error: "Room not found" });
      return;
    }
    const devPayload = { ...(payload || {}), playerId: socket.id };
    const res = engine.executeDevAction(action, devPayload);
    io.to(roomId).emit("game_state", engine.getPublicState());
    if (callback) callback(res || { success: true });
  });

  // Chat message
  socket.on("send_chat", ({ roomId, message }) => {
    const engine = rooms.get(roomId);
    if (!engine) return;
    const cleanMsg = (typeof message === "string" ? message.slice(0, 300) : "").trim();
    if (!cleanMsg) return;
    const player = engine.players.find(p => p.id === socket.id);
    const sender = player ? player.name : "Spectator";
    io.to(roomId).emit("chat_message", {
      sender,
      message: cleanMsg,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
  });

  // Disconnect & Spectator Cleanup
  socket.on("disconnect", () => {
    if (currentRoomId) {
      const engine = rooms.get(currentRoomId);
      if (engine) {
        if (engine.removeSpectator) engine.removeSpectator(socket.id);
        engine.removePlayer(socket.id);
        // Clean up empty rooms only if abandoned in lobby or all human players left for good
        if (engine.status === "waiting" && (engine.players.length === 0 || engine.players.every(p => !p.connected && !p.isBot))) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`===========================================`);
  console.log(`🎲 MONOPOLY ONLINE SERVER RUNNING`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`===========================================`);
});
