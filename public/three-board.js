// Monopoly 3D Deluxe - Sea of Thieves Atmospheric Gaming Table & Polished Pieces
// Responsive Cinematic Lighting, Real Monopoly Miniatures & Authentic Game Assets

class Monopoly3DScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.tiles = [];
    this.tokens = new Map(); // playerId -> 3D Object
    this.houses = new Map(); // tileId -> Array of 3D Objects
    this.diceMeshes = [];
    this.particleSystems = [];
    this.dustParticles = null;
    this.lanternLight = null;
    this.lanternBulb = null;
    this.candleLights = [];
    this.candleFlames = [];
    this.animatedFlames = []; // flame shaders to animate in real-time
    this.flameCoronas = [];   // soft radial glow sprites
    this.cameraMode = "auto";
    this.isRolling = false;
    this.depressedTiles = new Map(); // tileId -> { current, base } for tactile button pressure plate
    this.boardSize = 22; // world units

    this.tilePositions = [];
    this.textures = {}; // cached procedural textures
    this.loadedModels = {};
    this.modelsReady = false;
    this.pendingPlayers = null;
    this.cameraTarget = new THREE.Vector3(-2.4, 0, 0);

    this.init();
  }

  async init() {
    // 1. Scene with warm moody tavern ambiance
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0906);
    this.scene.fog = new THREE.FogExp2(0x0c0906, 0.012);

    // 2. Camera (nicely centered to allow full view of board & right panel)
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000);
    this.camera.position.set(-2.2, 25, 27);
    this.cameraTarget = new THREE.Vector3(-2.4, 0, 0);
    this.camera.lookAt(this.cameraTarget);

    // 3. Renderer with high dynamic range ACES tone mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls (for free camera mode)
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2.12;
      this.controls.minDistance = 7;
      this.controls.maxDistance = 60;
    }

    // 5. Build high-fidelity procedural textures (wood, felt, coins, chips, flame)
    this.generateProceduralTextures();

    // 6. Atmospheric Lighting (Balanced brightness, no dark spots)
    this.setupSaloonLighting();

    // 7. Atmospheric Air Dust Motes (Subtle and spread wide)
    this.setupAtmosphericDustMotes();

    // 8. Calculate tile transforms FIRST
    this.calculateTileTransforms();

    // 9. Build Environment, Table, Armrest, 3D Board, Props, and Rounded Bone Dice
    this.setupEnvironment();
    this.setupSaloonProps();
    this.build3DBoard();
    this.build3DDice();

    // 10. Preload lightweight models
    await this.preload3DModels();

    // 11. Interaction setup
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.setupInteraction();

    // 12. Animation loop
    window.addEventListener("resize", () => this.onWindowResize());
    this.animate();
  }

  // ================= PRELOAD 3D GLB MODELS =================
  getTokenModelKey(token) {
    if (!token) return "hat";
    if (token === "🎩" || token.includes("hat") || token.includes("Top Hat") || token.includes("🎩")) return "hat";
    if (token === "🚗" || token.includes("car") || token.includes("Roadster") || token.includes("🚗")) return "car";
    if (token === "🚢" || token.includes("ship") || token.includes("Battleship") || token.includes("boat") || token.includes("🚢")) return "ship";
    if (token === "👞" || token.includes("boot") || token.includes("Boot") || token.includes("👞")) return "boot";
    if (token === "🧵" || token.includes("thimble") || token.includes("Thimble") || token.includes("🧵")) return "thimble";
    if (token === "✈️" || token.includes("plane") || token.includes("Airplane") || token.includes("Aviator") || token.includes("✈️")) return "plane";
    return "hat";
  }

  async preload3DModels() {
    if (!THREE.GLTFLoader) return;
    const loader = new THREE.GLTFLoader();

    // Load lightweight assets only (Hat 8KB, Boot 12KB, Thimble 25KB, Plane)
    // Car & Ship use sleek, stylized, lag-free procedural tokens to prevent frame drops
    const modelMap = {
      "hat": "/models/hat.glb",
      "boot": "/models/boot.glb",
      "thimble": "/models/thimble.glb",
      "plane": "/models/airplane.glb"
    };

    const loadModel = (key, url) => {
      return new Promise((resolve) => {
        loader.load(
          url,
          (gltf) => {
            this.loadedModels[key] = gltf.scene;
            resolve();
          },
          null,
          (err) => {
            console.warn(`Failed loading model for ${key}:`, err);
            resolve();
          }
        );
      });
    };

    await Promise.all(Object.entries(modelMap).map(([k, u]) => loadModel(k, u)));
    this.modelsReady = true;

    if (this.pendingPlayers) {
      this.syncPlayers(this.pendingPlayers.players, this.pendingPlayers.lastMove);
      this.pendingPlayers = null;
    }
  }

  // ================= PROCEDURAL HIGH-RES TEXTURES =================
  generateProceduralTextures() {
    // A. Aged Matte Rustic Walnut Table Planks with Natural Wavy Grain & Knots (2048x2048)
    const woodCanvas = document.createElement("canvas");
    woodCanvas.width = 2048;
    woodCanvas.height = 2048;
    const ctx = woodCanvas.getContext("2d");

    // Rich dark walnut base stain
    ctx.fillStyle = "#341f13";
    ctx.fillRect(0, 0, 2048, 2048);

    // Natural wide timber planks (256px wide) with beveled seams
    for (let x = 0; x < 2048; x += 256) {
      ctx.fillStyle = "rgba(10, 5, 2, 0.70)";
      ctx.fillRect(x - 2, 0, 4, 2048);
      ctx.fillStyle = "rgba(95, 60, 36, 0.22)";
      ctx.fillRect(x + 2, 0, 6, 2048);
    }

    // Wood knots (swirling organic growth rings)
    const knots = [
      { x: 380, y: 520, r: 75 },
      { x: 1280, y: 840, r: 90 },
      { x: 820, y: 1680, r: 85 },
      { x: 1720, y: 410, r: 70 },
      { x: 490, y: 1350, r: 80 }
    ];

    knots.forEach(k => {
      for (let ring = 6; ring < k.r; ring += 5) {
        ctx.strokeStyle = ring < 20 ? "rgba(20, 10, 5, 0.55)" : "rgba(35, 18, 9, 0.22)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(k.x, k.y, ring * 0.75, ring, Math.PI / 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Organic undulating wood grain flowing along the planks
    for (let i = 0; i < 3500; i++) {
      const startX = Math.random() * 2048;
      const startY = Math.random() * 2048;
      const len = 140 + Math.random() * 420;
      const w = 1.8 + Math.random() * 3.2;
      const alpha = 0.035 + Math.random() * 0.075;

      ctx.strokeStyle = Math.random() > 0.45 ? ("rgba(18, 9, 4, " + alpha + ")") : ("rgba(98, 64, 40, " + alpha + ")");
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const wave = Math.sin(startY * 0.015) * 12;
      ctx.quadraticCurveTo(startX + wave, startY + len * 0.5, startX + wave * 0.6, startY + len);
      ctx.stroke();
    }

    const woodTex = new THREE.CanvasTexture(woodCanvas);
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(1.5, 1.5);
    woodTex.anisotropy = 16;
    this.textures.woodMap = woodTex;

    // B. Board Center Plush Woven Carpet / Felt Inlay Texture
    const feltCanvas = document.createElement("canvas");
    feltCanvas.width = 1024;
    feltCanvas.height = 1024;
    const fCtx = feltCanvas.getContext("2d");
    fCtx.fillStyle = "#103b1d"; // deep rich woven billiard carpet green
    fCtx.fillRect(0, 0, 1024, 1024);

    // Tight woven textile warp & weft micro-threads
    for (let y = 0; y < 1024; y += 4) {
      fCtx.fillStyle = (y % 8 === 0) ? "rgba(18, 68, 34, 0.50)" : "rgba(8, 38, 16, 0.50)";
      fCtx.fillRect(0, y, 1024, 2);
    }
    for (let x = 0; x < 1024; x += 4) {
      fCtx.fillStyle = (x % 8 === 0) ? "rgba(28, 92, 48, 0.40)" : "rgba(6, 28, 12, 0.40)";
      fCtx.fillRect(x, 0, 2, 1024);
    }

    // Dense plush carpet fibers / wool tufts
    for (let i = 0; i < 28000; i++) {
      const fx = Math.random() * 1024;
      const fy = Math.random() * 1024;
      const r = Math.random();
      fCtx.fillStyle = r > 0.6 ? "rgba(42, 120, 64, 0.25)" : (r > 0.3 ? "rgba(12, 45, 20, 0.28)" : "rgba(65, 145, 88, 0.18)");
      fCtx.fillRect(fx, fy, 2, 2);
    }

    // Classic Monopoly Center Diamond Red Banner
    fCtx.save();
    fCtx.translate(512, 512);
    fCtx.rotate(-Math.PI / 4);

    fCtx.fillStyle = "#a81e1e";
    fCtx.fillRect(-380, -90, 760, 180);
    fCtx.strokeStyle = "#e8c374";
    fCtx.lineWidth = 10;
    fCtx.strokeRect(-380, -90, 760, 180);

    fCtx.fillStyle = "#ffffff";
    fCtx.shadowColor = "rgba(0,0,0,0.6)";
    fCtx.shadowBlur = 12;
    fCtx.font = "900 110px 'Outfit', sans-serif";
    fCtx.textAlign = "center";
    fCtx.textBaseline = "middle";
    fCtx.fillText("MONOPOLY", 0, 0);
    fCtx.restore();

    const feltTex = new THREE.CanvasTexture(feltCanvas);
    feltTex.anisotropy = 16;
    this.textures.feltMap = feltTex;

    // C. Authentic Spanish Gold Doubloon Texture (High-Luster Escudo, Cross & Beaded Rim)
    const coinCanvas = document.createElement("canvas");
    coinCanvas.width = 512;
    coinCanvas.height = 512;
    const cCtx = coinCanvas.getContext("2d");

    const goldGrad = cCtx.createRadialGradient(256, 256, 40, 256, 256, 256);
    goldGrad.addColorStop(0, "#fff8cc"); // Bright golden specular center
    goldGrad.addColorStop(0.35, "#ffd700"); // Pure gold
    goldGrad.addColorStop(0.75, "#f59e0b"); // Warm amber gold
    goldGrad.addColorStop(1, "#92400e"); // Deep antique rim
    cCtx.fillStyle = goldGrad;
    cCtx.beginPath();
    cCtx.arc(256, 256, 250, 0, Math.PI * 2);
    cCtx.fill();

    // Milled beaded outer rim
    cCtx.fillStyle = "#fffbe0";
    cCtx.strokeStyle = "#78350f";
    cCtx.lineWidth = 4;
    const numBeads = 48;
    for (let b = 0; b < numBeads; b++) {
      const angle = (b / numBeads) * Math.PI * 2;
      const bx = 256 + Math.cos(angle) * 236;
      const by = 256 + Math.sin(angle) * 236;
      cCtx.beginPath();
      cCtx.arc(bx, by, 7, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.stroke();
    }

    // Inner embossed ring
    cCtx.strokeStyle = "#b45309";
    cCtx.lineWidth = 8;
    cCtx.beginPath();
    cCtx.arc(256, 256, 185, 0, Math.PI * 2);
    cCtx.stroke();

    // Spanish Jerusalem Cross & Crowns in Quadrants
    cCtx.fillStyle = "#d97706";
    cCtx.strokeStyle = "#78350f";
    cCtx.lineWidth = 6;
    for (let arm = 0; arm < 4; arm++) {
      cCtx.save();
      cCtx.translate(256, 256);
      cCtx.rotate((arm * Math.PI) / 2);
      cCtx.fillRect(-18, 40, 36, 135);
      cCtx.strokeRect(-18, 40, 36, 135);
      cCtx.beginPath();
      cCtx.arc(0, 175, 22, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.stroke();
      cCtx.restore();
    }

    // Center Escudo Royal Medallion
    cCtx.fillStyle = "#fde047";
    cCtx.beginPath();
    cCtx.arc(256, 256, 52, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.stroke();

    cCtx.fillStyle = "#78350f";
    cCtx.font = "900 48px serif";
    cCtx.textAlign = "center";
    cCtx.textBaseline = "middle";
    cCtx.fillText("✠", 256, 256);

    const coinTex = new THREE.CanvasTexture(coinCanvas);
    coinTex.anisotropy = 16;
    this.textures.goldCoinMap = coinTex;

    // D. Authentic High Stakes Casino Poker Chip Texture
    this.textures.casinoChipMaps = {};
    const chipDenoms = [
      { val: "$1", colorKey: "white", bg: "#f8fafc", stripe: "#0284c7", txt: "#0f172a" },
      { val: "$5", colorKey: "red", bg: "#dc2626", stripe: "#ffffff", txt: "#ffffff" },
      { val: "$25", colorKey: "green", bg: "#16a34a", stripe: "#ffffff", txt: "#ffffff" },
      { val: "$100", colorKey: "black", bg: "#1e293b", stripe: "#f59e0b", txt: "#f59e0b" }
    ];

    chipDenoms.forEach(cd => {
      const chipCanvas = document.createElement("canvas");
      chipCanvas.width = 512;
      chipCanvas.height = 512;
      const chCtx = chipCanvas.getContext("2d");

      chCtx.fillStyle = cd.bg;
      chCtx.beginPath();
      chCtx.arc(256, 256, 250, 0, Math.PI * 2);
      chCtx.fill();

      // Outer edge inserts
      chCtx.fillStyle = cd.stripe;
      for (let s = 0; s < 6; s++) {
        chCtx.save();
        chCtx.translate(256, 256);
        chCtx.rotate((s * Math.PI) / 3);
        chCtx.fillRect(-22, -250, 44, 55);
        chCtx.restore();
      }

      // Inner inlay disc
      chCtx.fillStyle = "#1e293b";
      chCtx.beginPath();
      chCtx.arc(256, 256, 150, 0, Math.PI * 2);
      chCtx.fill();
      chCtx.strokeStyle = "#fbbf24";
      chCtx.lineWidth = 8;
      chCtx.stroke();

      chCtx.fillStyle = cd.txt;
      chCtx.font = "900 80px 'Cinzel', serif";
      chCtx.textAlign = "center";
      chCtx.textBaseline = "middle";
      chCtx.fillText(cd.val, 256, 235);

      chCtx.font = "700 28px 'Outfit', sans-serif";
      chCtx.fillStyle = "#94a3b8";
      chCtx.fillText("HIGH STAKES", 256, 305);

      const chipTex = new THREE.CanvasTexture(chipCanvas);
      chipTex.anisotropy = 16;
      this.textures.casinoChipMaps[cd.val] = chipTex;
      this.textures.casinoChipMaps[cd.colorKey] = chipTex;
    });

    // E. Soft Radial Halo Glow Corona Texture (for candle & lantern haze)
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext("2d");
    const gGrad = gCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gGrad.addColorStop(0.0, "rgba(255, 180, 60, 0.60)");
    gGrad.addColorStop(0.25, "rgba(255, 120, 20, 0.25)");
    gGrad.addColorStop(0.65, "rgba(200, 50, 0, 0.06)");
    gGrad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
    gCtx.fillStyle = gGrad;
    gCtx.fillRect(0, 0, 128, 128);

    const glowTex = new THREE.CanvasTexture(glowCanvas);
    this.textures.glowCoronaTex = glowTex;
  }

  // ================= ATMOSPHERIC BALANCED LIGHTING (BRIGHTENED PIECES, NO HARSH SHADOWS) =================
  setupSaloonLighting() {
    // 1. Warm Tavern Ambient Midpoint (Tuned down for deep, atmospheric shadows)
    const hemiLight = new THREE.HemisphereLight(0xffeed8, 0x22130a, 0.16);
    this.scene.add(hemiLight);

    // 2. Subtle Token Specular Fill Light (soft definition without washing out shadows)
    const tokenFill = new THREE.DirectionalLight(0xfff5ea, 0.11);
    tokenFill.position.set(0, 16, 12);
    this.scene.add(tokenFill);

    // 3. Main Overhead Tavern Spotlight (Warm, moody candle-pool)
    this.lanternLight = new THREE.SpotLight(0xffd188, 0.48, 60, Math.PI / 2.5, 0.85, 1.2);
    this.lanternLight.userData = { baseIntensity: 0.48 };
    this.lanternLight.position.set(-2, 22, 2);
    this.lanternLight.target.position.set(-2, 0, 0);
    this.lanternLight.castShadow = true;
    this.lanternLight.shadow.mapSize.width = 1024;
    this.lanternLight.shadow.mapSize.height = 1024;
    this.lanternLight.shadow.camera.near = 5;
    this.lanternLight.shadow.camera.far = 45;
    this.lanternLight.shadow.bias = -0.0003;
    this.scene.add(this.lanternLight);
    this.scene.add(this.lanternLight.target);

    // 4. Subtle warm wood bounce
    const bounceLight = new THREE.PointLight(0x5c3218, 0.14, 30);
    bounceLight.position.set(-2, 3, 0);
    this.scene.add(bounceLight);
  }

  // ================= SPREAD ATMOSPHERIC DUST MOTES (SUBTLE) =================
  setupAtmosphericDustMotes() {
    const particleCount = 50; // low count, zero clutter
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    this.dustMoteData = [];

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 56;
      const y = 0.8 + Math.random() * 16;
      const z = (Math.random() - 0.5) * 56;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.dustMoteData.push({
        baseX: x,
        baseZ: z,
        speedY: 0.002 + Math.random() * 0.004,
        swaySpeed: 0.4 + Math.random() * 1.2,
        seed: Math.random() * 100
      });
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffe6b0,
      size: 0.11,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }

  setParticleDensity(mode) {
    if (!this.dustParticles) return;
    if (mode === "off") {
      this.dustParticles.visible = false;
    } else if (mode === "reduced") {
      this.dustParticles.visible = true;
      this.dustParticles.material.opacity = 0.15;
    } else {
      this.dustParticles.visible = true;
      this.dustParticles.material.opacity = 0.35;
    }
  }

  // ================= 3D ENVIRONMENT, MATTE TABLE & PADDED ARMREST =================
  setupEnvironment() {
    // 1. Heavy Round Saloon Wood Gaming Table (Matte, non-plasticy finish)
    const tableGeo = new THREE.CylinderGeometry(28, 28, 2.0, 64);
    const tableMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodMap,
      roughness: 0.88,
      metalness: 0.04
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = -1.15; // Top surface at y = -0.15
    table.receiveShadow = true;
    this.scene.add(table);

    // 2. Inlaid Polished Brass Table Edge Trim (Sleek brass rim replaces odd wire torus)
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Rich authentic antique brass
      metalness: 0.90,
      roughness: 0.24
    });
    const brassRimGeo = new THREE.CylinderGeometry(28.15, 28.15, 0.40, 64, 1, true);
    const brassRim = new THREE.Mesh(brassRimGeo, brassTrimMat);
    brassRim.position.y = -0.20;
    this.scene.add(brassRim);

    const brassRingGeo = new THREE.RingGeometry(27.3, 28.15, 64);
    const brassTopRing = new THREE.Mesh(brassRingGeo, brassTrimMat);
    brassTopRing.rotation.x = -Math.PI / 2;
    brassTopRing.position.y = -0.147;
    brassTopRing.receiveShadow = true;
    this.scene.add(brassTopRing);

    // 3. Outer Board Dark Mahogany Frame
    const rimGeo = new THREE.BoxGeometry(this.boardSize + 1.2, 0.65, this.boardSize + 1.2);
    const rimMat = new THREE.MeshLambertMaterial({
      map: this.textures.woodMap,
      color: 0x4a2a16
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = -0.25;
    rim.receiveShadow = true;
    rim.castShadow = true;
    this.scene.add(rim);

    // 4. Board Center Casino Green Felt
    const feltGeo = new THREE.BoxGeometry(this.boardSize - 4.8, 0.28, this.boardSize - 4.8);
    const feltMat = new THREE.MeshStandardMaterial({
      map: this.textures.feltMap,
      roughness: 0.95,
      metalness: 0.01
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.y = 0.06;
    felt.receiveShadow = true;
    this.scene.add(felt);
  }

  // ================= SALOON PROPS: CHIPS, ANIMATED FLAMES, TRANS-LUCENT GEMS =================

  createVolumetricSaloonFlame(scale = 1.0) {
    const group = new THREE.Group();
    const flameW = 0.45 * scale;
    const flameH = 0.85 * scale;
    const seed = Math.random() * 10;

    const geo = new THREE.PlaneGeometry(flameW, flameH, 16, 24);
    geo.translate(0, flameH / 2, 0); // anchor base directly to wick

    const vShader = [
      "uniform float uTime;",
      "uniform float uSeed;",
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  vec3 pos = position;",
      "  float t = uTime * 4.2 + uSeed;",
      "  float swayX = (sin(t * 1.6 + pos.y * 2.5) * 0.05 + cos(t * 2.8) * 0.025) * uv.y;",
      "  float stretchY = sin(t * 1.8) * 0.03 * uv.y;",
      "  pos.x += swayX;",
      "  pos.y += stretchY;",
      "  vec4 mvPos = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);",
      "  mvPos.xy += pos.xy;",
      "  mvPos.z += pos.z;",
      "  gl_Position = projectionMatrix * mvPos;",
      "}"
    ].join("\n");

    const fShader = [
      "uniform float uTime;",
      "uniform float uSeed;",
      "varying vec2 vUv;",
      "vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
      "vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
      "vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }",
      "float snoise(vec2 v) {",
      "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);",
      "  vec2 i  = floor(v + dot(v, C.yy) );",
      "  vec2 x0 = v - i + dot(i, C.xx);",
      "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
      "  vec4 x12 = x0.xyxy + C.xxzz;",
      "  x12.xy -= i1;",
      "  i = mod289(i);",
      "  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));",
      "  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);",
      "  m = m*m;",
      "  m = m*m;",
      "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
      "  vec3 h = abs(x) - 0.5;",
      "  vec3 ox = floor(x + 0.5);",
      "  vec3 a0 = x - ox;",
      "  m *= 1.79284291400159 - ( a0*a0 + h*h );",
      "  vec3 g;",
      "  g.x  = a0.x  * x0.x  + h.x  * x0.y;",
      "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
      "  return 130.0 * dot(m, g);",
      "}",
      "void main() {",
      "  vec2 uv = vUv;",
      "  float t = uTime * 3.2 + uSeed;",
      "  vec2 uv1 = vec2(uv.x * 2.8, uv.y * 2.4 - t * 2.0);",
      "  vec2 uv2 = vec2(uv.x * 4.6 + 2.5, uv.y * 3.8 - t * 2.8);",
      "  float n1 = snoise(uv1);",
      "  float n2 = snoise(uv2) * 0.5;",
      "  float noise = n1 + n2;",
      "  float distCenter = abs(uv.x - 0.5) * 2.0;",
      "  float profile = mix(0.18, 0.86, smoothstep(0.0, 0.22, uv.y)) * (1.0 - smoothstep(0.30, 0.96, uv.y));",
      "  float flameMask = profile - distCenter * 0.65 + noise * 0.22 * smoothstep(0.04, 0.45, uv.y);",
      "  float alpha = smoothstep(0.0, 0.26, flameMask);",
      "  alpha *= smoothstep(0.01, 0.12, uv.y);",
      "  alpha *= (1.0 - smoothstep(0.86, 1.0, uv.y));",
      "  if (alpha <= 0.005) { discard; }",
      "  float coreDist = length(vec2((uv.x - 0.5) * 2.4, (uv.y - 0.25) * 1.8));",
      "  float coreHeat = clamp(1.0 - coreDist * 1.3, 0.0, 1.0);",
      "  float heat = clamp(flameMask * 1.4 + coreHeat * 0.6 + noise * 0.10, 0.0, 1.0);",
      "  vec3 colBlue    = vec3(0.12, 0.45, 0.98);",
      "  vec3 colCrimson = vec3(0.85, 0.12, 0.02);",
      "  vec3 colOrange  = vec3(1.00, 0.46, 0.04);",
      "  vec3 colGold    = vec3(1.00, 0.84, 0.20);",
      "  vec3 colWhite   = vec3(1.00, 0.98, 0.92);",
      "  vec3 col = mix(colCrimson, colOrange, smoothstep(0.10, 0.38, heat));",
      "  col = mix(col, colGold, smoothstep(0.38, 0.72, heat));",
      "  col = mix(col, colWhite, smoothstep(0.72, 0.96, heat));",
      "  float blueZone = (1.0 - smoothstep(0.0, 0.18, uv.y)) * smoothstep(0.12, 0.50, distCenter);",
      "  col = mix(col, colBlue, blueZone * 0.80);",
      "  gl_FragColor = vec4(col, alpha);",
      "}"
    ].join("\n");

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: seed }
      },
      vertexShader: vShader,
      fragmentShader: fShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const flameMesh = new THREE.Mesh(geo, mat);
    group.add(flameMesh);

    if (!this.animatedFlames) this.animatedFlames = [];
    this.animatedFlames.push(mat);

    if (this.textures && this.textures.glowCoronaTex) {
      const spriteMat = new THREE.SpriteMaterial({
        map: this.textures.glowCoronaTex,
        color: 0xff9922,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, flameH * 0.45, 0);
      sprite.scale.set(flameW * 2.8, flameW * 2.8, 1);
      group.add(sprite);
      if (!this.flameCoronas) this.flameCoronas = [];
      this.flameCoronas.push({ sprite, baseScale: flameW * 2.8, seed });
    }

    return group;
  }

  setupSaloonProps() {
    this.candleFlames = [];
    const deckThickness = 0.26;
    const cardWidth = 2.4;
    const cardLength = 3.6;

    const edgeCanvas = document.createElement("canvas");
    edgeCanvas.width = 128;
    edgeCanvas.height = 128;
    const edgeCtx = edgeCanvas.getContext("2d");
    edgeCtx.fillStyle = "#ede3cc";
    edgeCtx.fillRect(0, 0, 128, 128);
    edgeCtx.strokeStyle = "#cfc4aa";
    edgeCtx.lineWidth = 2;
    for (let y = 0; y < 128; y += 4) {
      edgeCtx.beginPath();
      edgeCtx.moveTo(0, y);
      edgeCtx.lineTo(128, y);
      edgeCtx.stroke();
    }
    const edgeTex = new THREE.CanvasTexture(edgeCanvas);
    const cardEdgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.85 });

    // 1. Chance Deck: Authentic Rich Orange Card Back
    const chanceTopCanvas = document.createElement("canvas");
    chanceTopCanvas.width = 512;
    chanceTopCanvas.height = 768;
    const cCtx = chanceTopCanvas.getContext("2d");
    cCtx.fillStyle = "#ff7a00";
    cCtx.fillRect(0, 0, 512, 768);
    cCtx.strokeStyle = "#000000";
    cCtx.lineWidth = 16;
    cCtx.strokeRect(12, 12, 488, 744);
    cCtx.fillStyle = "#000000";
    cCtx.font = "900 240px 'Cinzel', serif";
    cCtx.textAlign = "center";
    cCtx.textBaseline = "middle";
    cCtx.fillText("?", 256, 350);
    cCtx.font = "900 56px 'Cinzel', serif";
    cCtx.fillText("CHANCE", 256, 620);
    const chanceTopTex = new THREE.CanvasTexture(chanceTopCanvas);
    chanceTopTex.anisotropy = 16;
    const chanceTopMat = new THREE.MeshStandardMaterial({ map: chanceTopTex, roughness: 0.75 });

    const chanceBaseGeo = new THREE.BoxGeometry(cardWidth, deckThickness, cardLength);
    const chanceMaterials = [cardEdgeMat, cardEdgeMat, chanceTopMat, cardEdgeMat, cardEdgeMat, cardEdgeMat];
    const chanceDeckBase = new THREE.Mesh(chanceBaseGeo, chanceMaterials);
    chanceDeckBase.position.set(-3.6, deckThickness / 2 + 0.12, -3.6);
    chanceDeckBase.rotation.y = Math.PI / 4 + 0.08;
    chanceDeckBase.castShadow = true;
    chanceDeckBase.receiveShadow = true;
    this.scene.add(chanceDeckBase);

    const chanceTopGeo = new THREE.BoxGeometry(cardWidth, 0.02, cardLength);
    const chanceTopMaterials = [cardEdgeMat, cardEdgeMat, chanceTopMat, cardEdgeMat, cardEdgeMat, cardEdgeMat];
    const chanceTopCard = new THREE.Mesh(chanceTopGeo, chanceTopMaterials);
    chanceTopCard.position.set(-3.65, deckThickness + 0.13, -3.55);
    chanceTopCard.rotation.y = Math.PI / 4 + 0.13;
    chanceTopCard.castShadow = true;
    this.scene.add(chanceTopCard);
    this.chanceTopCard = chanceTopCard;

    // 2. Community Chest Deck: Authentic Vibrant Cyan/Blue Card Back
    const chestTopCanvas = document.createElement("canvas");
    chestTopCanvas.width = 512;
    chestTopCanvas.height = 768;
    const chCtx = chestTopCanvas.getContext("2d");
    chCtx.fillStyle = "#0284c7"; // Official vibrant blue
    chCtx.fillRect(0, 0, 512, 768);
    chCtx.strokeStyle = "#ffffff";
    chCtx.lineWidth = 14;
    chCtx.strokeRect(12, 12, 488, 744);
    chCtx.fillStyle = "#facc15"; // Golden treasure chest
    chCtx.fillRect(160, 260, 192, 120);
    chCtx.beginPath();
    chCtx.ellipse(256, 260, 96, 50, 0, Math.PI, 0);
    chCtx.fillStyle = "#eab308";
    chCtx.fill();
    chCtx.fillStyle = "#ffffff";
    chCtx.fillRect(180, 210, 24, 170);
    chCtx.fillRect(308, 210, 24, 170);
    chCtx.fillStyle = "#ffffff";
    chCtx.font = "900 46px 'Cinzel', serif";
    chCtx.textAlign = "center";
    chCtx.fillText("COMMUNITY", 256, 560);
    chCtx.fillText("CHEST", 256, 620);
    const chestTopTex = new THREE.CanvasTexture(chestTopCanvas);
    chestTopTex.anisotropy = 16;
    const chestTopMat = new THREE.MeshStandardMaterial({ map: chestTopTex, roughness: 0.75 });

    const chestBaseGeo = new THREE.BoxGeometry(cardWidth, deckThickness, cardLength);
    const chestMaterials = [cardEdgeMat, cardEdgeMat, chestTopMat, cardEdgeMat, cardEdgeMat, cardEdgeMat];
    const chestDeckBase = new THREE.Mesh(chestBaseGeo, chestMaterials);
    chestDeckBase.position.set(3.6, deckThickness / 2 + 0.12, 3.6);
    chestDeckBase.rotation.y = Math.PI / 4 - 0.05;
    chestDeckBase.castShadow = true;
    chestDeckBase.receiveShadow = true;
    this.scene.add(chestDeckBase);

    const chestTopGeo = new THREE.BoxGeometry(cardWidth, 0.02, cardLength);
    const chestTopMaterials = [cardEdgeMat, cardEdgeMat, chestTopMat, cardEdgeMat, cardEdgeMat, cardEdgeMat];
    const chestTopCard = new THREE.Mesh(chestTopGeo, chestTopMaterials);
    chestTopCard.position.set(3.55, deckThickness + 0.13, 3.65);
    chestTopCard.rotation.y = Math.PI / 4 - 0.10;
    chestTopCard.castShadow = true;
    this.scene.add(chestTopCard);
    this.chestTopCard = chestTopCard;

    // 3. Stacks of Detailed Casino Clay Poker Chips on Table Corners
    const chipGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 32);

    const createChipStack = (count, startX, startZ, chipType) => {
      const topTex = this.textures.casinoChipMaps[chipType];
      const sideMat = new THREE.MeshStandardMaterial({
        color: chipType === "white" ? 0xe2e8f0 : chipType === "red" ? 0x991b1b : chipType === "green" ? 0x166534 : 0x0f172a,
        roughness: 0.6,
        metalness: 0.05
      });
      const topMat = new THREE.MeshStandardMaterial({
        map: topTex,
        roughness: 0.5,
        metalness: 0.08
      });
      const mats = [sideMat, topMat, topMat];

      for (let i = 0; i < count; i++) {
        const chip = new THREE.Mesh(chipGeo, mats);
        const jitterX = (Math.random() - 0.5) * 0.04;
        const jitterZ = (Math.random() - 0.5) * 0.04;
        const chipY = -0.15 + 0.055 + (i * 0.10);
        chip.position.set(startX + jitterX, chipY, startZ + jitterZ);
        chip.rotation.y = Math.random() * Math.PI * 2;
        chip.castShadow = true;
        chip.receiveShadow = true;
        this.scene.add(chip);
      }
    };

    createChipStack(8, 15.2, 14.2, "white");
    createChipStack(6, 16.5, 14.8, "red");
    createChipStack(10, -15.5, 14.5, "green");
    createChipStack(5, -16.6, 13.8, "black");
    createChipStack(9, 15.0, -15.2, "red");

    // 4. White Wax Pillar Candles with Rounded Rims, Dripping Wax & Animated Flames
    const candleWaxMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0ea,
      roughness: 0.45,
      metalness: 0.02
    });

    const createCandle = (x, z, radius, height) => {
      const candleGroup = new THREE.Group();
      candleGroup.position.set(x, 0, z);
      const bodyGeo = new THREE.CylinderGeometry(radius * 0.9, radius, height, 24);
      const body = new THREE.Mesh(bodyGeo, candleWaxMat);
      body.position.y = -0.15 + height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      candleGroup.add(body);

      // Molten candle top rim roundoff
      const rimGeo = new THREE.TorusGeometry(radius * 0.88, radius * 0.10, 10, 24);
      const rim = new THREE.Mesh(rimGeo, candleWaxMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.15 + height - 0.02;
      rim.castShadow = true;
      candleGroup.add(rim);

      // Sunken melted wax pool
      const poolGeo = new THREE.CylinderGeometry(radius * 0.80, radius * 0.82, 0.08, 20);
      const poolMat = new THREE.MeshStandardMaterial({ color: 0xede4d5, roughness: 0.25 });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.y = -0.15 + height - 0.04;
      candleGroup.add(pool);

      // Organic wax drippings running down the sides
      const dripCount = 4;
      for (let d = 0; d < dripCount; d++) {
        const dripAngle = (d / dripCount) * Math.PI * 2 + (d * 0.2);
        const dripLen = 0.6 + (d % 3) * 0.45;
        const dripRad = 0.07;
        const streamGeo = new THREE.CylinderGeometry(dripRad * 0.6, dripRad, dripLen, 8);
        const stream = new THREE.Mesh(streamGeo, candleWaxMat);
        const dripY = -0.15 + height - (dripLen / 2);
        const dripDist = radius * 0.94;
        stream.position.set(Math.cos(dripAngle) * dripDist, dripY, Math.sin(dripAngle) * dripDist);
        stream.castShadow = true;
        candleGroup.add(stream);

        const dropGeo = new THREE.SphereGeometry(dripRad * 1.35, 8, 8);
        const drop = new THREE.Mesh(dropGeo, candleWaxMat);
        drop.position.set(Math.cos(dripAngle) * (dripDist + 0.01), dripY - (dripLen / 2), Math.sin(dripAngle) * (dripDist + 0.01));
        drop.scale.set(1, 1.4, 1);
        drop.castShadow = true;
        candleGroup.add(drop);
      }

      const wickGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
      const wickMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.y = -0.15 + height + 0.17;
      candleGroup.add(wick);

      // Sized larger for upgraded atmosphere
      const flame = this.createVolumetricSaloonFlame(0.65);
      flame.position.y = -0.15 + height + 0.32;
      candleGroup.add(flame);
      this.candleFlames.push(flame);

      this.scene.add(candleGroup);

      const pLight = new THREE.PointLight(0xff9922, 1.2, 12, 1.6);
      pLight.position.set(x, -0.15 + height + 0.5, z);
      pLight.userData = { baseIntensity: 1.2, seed: Math.random() * 10 };
      this.scene.add(pLight);
      this.candleLights.push(pLight);
    };

    createCandle(14.2, -14.2, 0.85, 2.6);
    createCandle(16.0, -13.8, 0.95, 3.4);
    createCandle(-15.8, 11.5, 1.25, 4.3);

    // 5. Antique Brass Kerosene Table Lantern with Grounded Burner & Flame
    const lanternGroup = new THREE.Group();
    const lanternBrassMat = new THREE.MeshStandardMaterial({
      color: 0x99702a,
      metalness: 0.9,
      roughness: 0.25
    });

    const lBase = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.65, 32), lanternBrassMat);
    lBase.position.y = 0.32;
    lBase.castShadow = true;
    lanternGroup.add(lBase);

    // Brass Burner Housing & Slotted Collar inside the glass
    const burnerDome = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.35, 24), lanternBrassMat);
    burnerDome.position.y = 0.78;
    lanternGroup.add(burnerDome);

    const wickCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 16), lanternBrassMat);
    wickCollar.position.y = 1.00;
    lanternGroup.add(wickCollar);

    const lWickMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    const lWick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), lWickMat);
    lWick.position.y = 1.12;
    lanternGroup.add(lWick);

    const lGlassGeo = new THREE.CylinderGeometry(1.05, 1.35, 2.2, 24);
    const lGlassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.15,
      metalness: 0.1
    });
    const lGlass = new THREE.Mesh(lGlassGeo, lGlassMat);
    lGlass.position.y = 1.7;
    lanternGroup.add(lGlass);

    // 4 vertical brass protective cage struts
    for (let c = 0; c < 4; c++) {
      const strutAngle = (c * Math.PI) / 2;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), lanternBrassMat);
      strut.position.set(Math.cos(strutAngle) * 1.32, 1.7, Math.sin(strutAngle) * 1.32);
      lanternGroup.add(strut);
    }

    const lCap = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.45, 0.55, 32), lanternBrassMat);
    lCap.position.y = 2.95;
    lanternGroup.add(lCap);

    // Grounded directly on the burner wick, scaled up for large kerosene lamp
    const lanternFlame = this.createVolumetricSaloonFlame(1.05);
    lanternFlame.position.y = 1.15;
    lanternGroup.add(lanternFlame);
    this.candleFlames.push(lanternFlame);

    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 16), lanternBrassMat);
    loop.position.y = 3.35;
    lanternGroup.add(loop);

    lanternGroup.position.set(-18.5, -0.15, -4.5);
    this.scene.add(lanternGroup);

    // Table Lantern Warm PointLight (Tuned down for moody tavern shadows)
    const tableLanternLight = new THREE.PointLight(0xffaa33, 1.5, 14, 1.5);
    tableLanternLight.position.set(-18.5, 1.3, -4.5);
    tableLanternLight.userData = { baseIntensity: 1.5, seed: 1.8 };
    this.scene.add(tableLanternLight);
    this.candleLights.push(tableLanternLight);

    // 6. Detailed Gold Doubloons on Table (Resting completely above tabletop - NEVER sliced)
    const coinGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.06, 24);
    const goldCoinMat = new THREE.MeshStandardMaterial({
      map: this.textures.goldCoinMap,
      color: 0xffea75,
      metalness: 0.70,
      roughness: 0.26,
      emissive: 0x785304,
      emissiveIntensity: 0.30
    });

    const spawnCoins = (cx, cz, count, radius) => {
      for (let i = 0; i < count; i++) {
        const coin = new THREE.Mesh(coinGeo, goldCoinMat);
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const rx = cx + Math.cos(angle) * dist;
        const rz = cz + Math.sin(angle) * dist;
        // Sits safely above the tabletop (-0.15) so it is NEVER cut in half!
        const coinY = -0.15 + 0.035 + (i * 0.022);
        coin.position.set(rx, coinY, rz);
        coin.rotation.y = Math.random() * Math.PI;
        // Flat on table (no extreme tilts slicing into the wood)
        coin.rotation.x = i === 0 ? 0 : (Math.random() - 0.5) * 0.04;
        coin.rotation.z = i === 0 ? 0 : (Math.random() - 0.5) * 0.04;
        coin.castShadow = true;
        coin.receiveShadow = true;
        this.scene.add(coin);
      }
    };

    spawnCoins(15.2, 13.5, 14, 1.6);
    spawnCoins(-14.8, 13.0, 12, 1.5);
    spawnCoins(14.5, -13.5, 15, 1.6);
    spawnCoins(-14.5, -13.0, 10, 1.4);
    spawnCoins(-16.0, -4.0, 8, 1.2);
    // 7. Rich Solid Faceted Pirate Gemstones (100% Opaque, Rich High-Polish Deeply Saturated Jewels)
    const gemColors = [
      { name: "emerald",  col: 0x008f39, emis: 0x00220c }, // Deep Colombian Emerald
      { name: "ruby",     col: 0xb91c1c, emis: 0x2e0206 }, // Deep Pigeon-Blood Ruby
      { name: "sapphire", col: 0x1d4ed8, emis: 0x04133b }, // Rich Royal Sapphire
      { name: "amethyst", col: 0x7e22ce, emis: 0x1f033b }, // Deep Siberian Amethyst
      { name: "topaz",    col: 0xd97706, emis: 0x361800 }, // Warm Golden Topaz
      { name: "diamond",  col: 0x06b6d4, emis: 0x002730 }, // Deep Paraiba Diamond
      { name: "spinel",   col: 0xbe123c, emis: 0x33020e }, // Deep Ruby-Spinel
      { name: "citrine",  col: 0xc2410c, emis: 0x300c00 }  // Deep Amber Citrine
    ];

    // High metalness (0.65) and mirror polish (roughness 0.03) creates sparkling faceted specular highlights
    const gemMats = gemColors.map(g => new THREE.MeshStandardMaterial({
      color: g.col,
      emissive: g.emis,
      emissiveIntensity: 0.12,
      roughness: 0.03,
      metalness: 0.65
    }));

    const gemGeos = [
      new THREE.DodecahedronGeometry(0.34, 0), // 12-sided faceted jewel
      new THREE.OctahedronGeometry(0.36, 0),   // 8-sided classic diamond cut
      new THREE.IcosahedronGeometry(0.32, 0),  // 20-sided brilliant faceted cut
      new THREE.ConeGeometry(0.34, 0.44, 6)    // 6-sided pointed rose cut
    ];

    const spawnGem = (x, z, typeIndex, geoIndex, scale = 1.0) => {
      const mat = gemMats[typeIndex % gemMats.length];
      const geo = gemGeos[geoIndex % gemGeos.length];
      const gem = new THREE.Mesh(geo, mat);
      gem.position.set(x, -0.05, z);
      gem.rotation.set(0.35 + Math.random() * 0.5, Math.random() * Math.PI * 2, 0.2 + Math.random() * 0.4);
      gem.scale.set(scale, scale, scale);
      gem.castShadow = true;
      gem.receiveShadow = true;
      this.scene.add(gem);
    };

    // Authentic Sea of Thieves treasure hoard scatter: 35 glistening gems!
    // Cluster A: Bottom-Left (Around Candle & Gold Coin Hoard)
    spawnGem(-13.5, 12.2, 0, 0, 1.15); // Emerald
    spawnGem(-14.2, 13.5, 1, 1, 1.25); // Ruby
    spawnGem(-13.8, 14.2, 2, 2, 1.05); // Sapphire
    spawnGem(-14.8, 12.8, 5, 1, 1.10); // Diamond
    spawnGem(-15.2, 13.6, 3, 0, 1.20); // Amethyst
    spawnGem(-13.0, 14.5, 4, 3, 0.95); // Topaz
    spawnGem(-15.6, 14.2, 6, 2, 1.00); // Spinel
    spawnGem(-14.0, 11.8, 7, 1, 1.05); // Citrine
    spawnGem(-14.6, 15.0, 0, 0, 0.90); // Emerald
    spawnGem(-15.0, 12.0, 1, 3, 1.15); // Ruby

    // Cluster B: Left Rim (Around Kerosene Lantern & Coin Piles)
    spawnGem(-17.2, -3.8, 1, 0, 1.25); // Ruby
    spawnGem(-16.5, -4.6, 2, 1, 1.15); // Sapphire
    spawnGem(-18.0, -5.8, 0, 2, 1.05); // Emerald
    spawnGem(-19.2, -4.0, 5, 3, 1.30); // Diamond
    spawnGem(-17.8, -3.0, 4, 0, 1.10); // Topaz
    spawnGem(-16.0, -5.4, 3, 1, 0.95); // Amethyst
    spawnGem(-18.6, -6.0, 7, 2, 1.15); // Citrine
    spawnGem(-16.8, -3.2, 6, 0, 1.00); // Spinel
    spawnGem(-19.5, -5.2, 2, 1, 1.20); // Sapphire
    spawnGem(-17.4, -5.9, 0, 3, 1.05); // Emerald

    // Cluster C: Bottom-Right Rim (Around Brass Compass & High Stakes Chips)
    spawnGem(15.8, 14.2, 0, 0, 1.20); // Emerald
    spawnGem(13.5, 12.5, 1, 1, 1.15); // Ruby
    spawnGem(14.8, 12.0, 2, 2, 1.30); // Sapphire
    spawnGem(16.2, 13.0, 4, 3, 1.05); // Topaz
    spawnGem(15.0, 15.2, 5, 0, 1.25); // Diamond
    spawnGem(14.2, 13.8, 3, 1, 1.10); // Amethyst
    spawnGem(16.8, 12.2, 6, 2, 0.95); // Spinel
    spawnGem(13.8, 14.8, 7, 0, 1.05); // Citrine

    // Cluster D: Top-Left Corner (Near Chips & Felt Edge)
    spawnGem(-14.8, -14.2, 1, 1, 1.20); // Ruby
    spawnGem(-13.5, -13.8, 2, 2, 1.10); // Sapphire
    spawnGem(-15.5, -13.0, 5, 0, 1.25); // Diamond
    spawnGem(-14.0, -15.0, 4, 3, 1.00); // Topaz

    // Cluster E: Top-Right Corner (Near Chips & Wood Rim)
    spawnGem(14.5, -13.5, 3, 0, 1.20); // Amethyst
    spawnGem(13.8, -12.5, 0, 1, 1.15); // Emerald
    spawnGem(15.2, -14.5, 1, 2, 1.05); // Ruby
    spawnGem(14.0, -14.8, 5, 3, 1.10); // Diamond

    // 8. RICH THEMED HIGH-STAKES TAVERN & PIRATE TABLE PROPS (SEA OF THIEVES / RDR1)
    // Perfectly distributed along the West Rim, North Rim, and South Rim so every prop is proudly displayed in view!

    // =========================================================================
    // PROP 1: VINTAGE BRASS MARITIME POCKET COMPASS (Bottom-Right: x=8.2, z=11.2)
    // =========================================================================
    const compassGroup = new THREE.Group();
    const compassBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.92, 0.25, 32),
      lanternBrassMat
    );
    compassBody.castShadow = true;
    compassGroup.add(compassBody);

    const compassLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 12, 24),
      lanternBrassMat
    );
    compassLoop.position.set(0, 0, -0.98);
    compassLoop.rotation.x = Math.PI / 2;
    compassGroup.add(compassLoop);

    const dialCanvas = document.createElement("canvas");
    dialCanvas.width = 512;
    dialCanvas.height = 512;
    const dCtx = dialCanvas.getContext("2d");
    dCtx.fillStyle = "#faf5ea";
    dCtx.fillRect(0, 0, 512, 512);

    dCtx.strokeStyle = "#1e293b";
    dCtx.lineWidth = 6;
    dCtx.beginPath();
    dCtx.arc(256, 256, 240, 0, Math.PI * 2);
    dCtx.stroke();

    dCtx.strokeStyle = "#d97706";
    dCtx.lineWidth = 4;
    dCtx.beginPath();
    dCtx.arc(256, 256, 222, 0, Math.PI * 2);
    dCtx.stroke();

    for (let r = 0; r < 16; r++) {
      const angle = (r * Math.PI) / 8;
      const isMajor = (r % 4 === 0);
      const isSub = (r % 2 === 0);
      const len = isMajor ? 190 : (isSub ? 150 : 120);
      dCtx.save();
      dCtx.translate(256, 256);
      dCtx.rotate(angle);
      dCtx.beginPath();
      dCtx.moveTo(0, 0);
      dCtx.lineTo(-12, -len * 0.4);
      dCtx.lineTo(0, -len);
      dCtx.closePath();
      dCtx.fillStyle = isMajor ? (r === 0 ? "#b91c1c" : "#1e293b") : "#94a3b8";
      dCtx.fill();

      dCtx.beginPath();
      dCtx.moveTo(0, 0);
      dCtx.lineTo(12, -len * 0.4);
      dCtx.lineTo(0, -len);
      dCtx.closePath();
      dCtx.fillStyle = isMajor ? "#64748b" : "#cbd5e1";
      dCtx.fill();
      dCtx.restore();
    }

    dCtx.font = "900 48px 'Cinzel', serif";
    dCtx.textAlign = "center";
    dCtx.textBaseline = "middle";
    dCtx.fillStyle = "#b91c1c";
    dCtx.fillText("N", 256, 42);
    dCtx.fillStyle = "#0f172a";
    dCtx.fillText("S", 256, 470);
    dCtx.fillText("E", 470, 256);
    dCtx.fillText("W", 42, 256);

    const dialTex = new THREE.CanvasTexture(dialCanvas);
    dialTex.anisotropy = 16;
    const dialMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.80, 0.80, 0.02, 32),
      new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.45, metalness: 0.05 })
    );
    dialMesh.position.y = 0.13;
    compassGroup.add(dialMesh);

    const needleGroup = new THREE.Group();
    needleGroup.position.y = 0.15;
    needleGroup.rotation.y = 0.35;

    const northTipMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.6, roughness: 0.2 });
    const southTipMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

    const nArm = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.62, 4), northTipMat);
    nArm.rotation.x = -Math.PI / 2;
    nArm.position.z = -0.31;
    needleGroup.add(nArm);

    const sArm = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.62, 4), southTipMat);
    sArm.rotation.x = Math.PI / 2;
    sArm.position.z = 0.31;
    needleGroup.add(sArm);

    const pivot = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 })
    );
    needleGroup.add(pivot);
    compassGroup.add(needleGroup);

    const glassDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.81, 0.81, 0.04, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        roughness: 0.05,
        metalness: 0.1
      })
    );
    glassDome.position.y = 0.17;
    compassGroup.add(glassDome);

    compassGroup.position.set(1.5, -0.04, 12.4);
    compassGroup.rotation.y = -0.22;
    this.scene.add(compassGroup);


    // =========================================================================
    // PROP 2: ROLLED ANTIQUE PIRATE TREASURE MAP (Bottom-Left Rim: x=-5.2, z=10.9)
    // =========================================================================
    const mapGroup = new THREE.Group();
    const mapRollGeo = new THREE.CylinderGeometry(0.36, 0.36, 3.2, 24);

    const mapCanvas = document.createElement("canvas");
    mapCanvas.width = 512;
    mapCanvas.height = 256;
    const mCtx = mapCanvas.getContext("2d");
    mCtx.fillStyle = "#e8d8b8";
    mCtx.fillRect(0, 0, 512, 256);

    for (let i = 0; i < 500; i++) {
      mCtx.fillStyle = Math.random() > 0.5 ? "rgba(120,70,30,0.08)" : "rgba(255,255,255,0.06)";
      mCtx.fillRect(Math.random() * 512, Math.random() * 256, 4, 4);
    }

    mCtx.strokeStyle = "#4a2810";
    mCtx.lineWidth = 4;
    mCtx.beginPath();
    mCtx.ellipse(150, 120, 75, 45, 0.3, 0, Math.PI * 2);
    mCtx.stroke();
    mCtx.beginPath();
    mCtx.ellipse(340, 140, 85, 55, -0.2, 0, Math.PI * 2);
    mCtx.stroke();

    mCtx.strokeStyle = "#dc2626";
    mCtx.lineWidth = 9;
    mCtx.beginPath();
    mCtx.moveTo(320, 120);
    mCtx.lineTo(360, 160);
    mCtx.moveTo(360, 120);
    mCtx.lineTo(320, 160);
    mCtx.stroke();

    mCtx.strokeStyle = "#7c2d12";
    mCtx.lineWidth = 3;
    mCtx.setLineDash([8, 6]);
    mCtx.beginPath();
    mCtx.moveTo(150, 120);
    mCtx.quadraticCurveTo(230, 60, 320, 130);
    mCtx.stroke();
    mCtx.setLineDash([]);

    const mapTex = new THREE.CanvasTexture(mapCanvas);
    mapTex.anisotropy = 16;
    const mapRollMat = new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.88 });
    const mapRoll = new THREE.Mesh(mapRollGeo, mapRollMat);
    mapRoll.rotation.z = Math.PI / 2;
    mapRoll.castShadow = true;
    mapGroup.add(mapRoll);

    const twineMat = new THREE.MeshStandardMaterial({ color: 0x3d2010, roughness: 0.9 });
    const twine = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 12, 24), twineMat);
    twine.rotation.y = Math.PI / 2;
    mapGroup.add(twine);

    mapGroup.position.set(-5.0, 0.28, 12.0);
    mapGroup.rotation.y = 0.30;
    this.scene.add(mapGroup);


    // =========================================================================
    // PROP 3: PIRATE CAPTAIN'S STEEL DAGGER / DIRK (Left Rim: x=-14.8, z=2.5)
    // =========================================================================
    const daggerGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.95,
      roughness: 0.12
    });

    const bladeGeo = new THREE.BoxGeometry(0.35, 0.055, 2.7);
    const blade = new THREE.Mesh(bladeGeo, steelMat);
    blade.position.z = 1.35;
    blade.castShadow = true;
    daggerGroup.add(blade);

    const tipGeo = new THREE.ConeGeometry(0.175, 0.6, 4);
    const tip = new THREE.Mesh(tipGeo, steelMat);
    tip.rotation.y = Math.PI / 4;
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 2.7 + 0.3;
    tip.scale.set(1, 1, 0.3);
    tip.castShadow = true;
    daggerGroup.add(tip);

    const guardGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.35, 16);
    const guard = new THREE.Mesh(guardGeo, lanternBrassMat);
    guard.rotation.z = Math.PI / 2;
    guard.castShadow = true;
    daggerGroup.add(guard);

    const handleGeo = new THREE.CylinderGeometry(0.15, 0.17, 1.15, 16);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1f150f, roughness: 0.85 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.z = -0.62;
    handle.rotation.x = Math.PI / 2;
    handle.castShadow = true;
    daggerGroup.add(handle);

    const pommelGeo = new THREE.DodecahedronGeometry(0.22);
    const pommel = new THREE.Mesh(pommelGeo, lanternBrassMat);
    pommel.position.z = -1.30;
    pommel.castShadow = true;
    daggerGroup.add(pommel);

    daggerGroup.position.set(-15.4, -0.05, 1.2);
    daggerGroup.rotation.y = -0.75;
    this.scene.add(daggerGroup);


    // =========================================================================
    // PROP 4: PIRATE FLINTLOCK PISTOL (Laying flat on its side on table)
    // =========================================================================
    const pistolGroup = new THREE.Group();
    const walnutMat = new THREE.MeshStandardMaterial({ color: 0x3e2312, roughness: 0.72 });
    const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.92, roughness: 0.22 });

    const stockGeo = new THREE.BoxGeometry(0.35, 0.42, 2.7);
    const stock = new THREE.Mesh(stockGeo, walnutMat);
    stock.position.set(0, 0.15, -0.2);
    stock.castShadow = true;
    pistolGroup.add(stock);

    const gripGeo = new THREE.CylinderGeometry(0.22, 0.30, 1.2, 16);
    const grip = new THREE.Mesh(gripGeo, walnutMat);
    grip.position.set(0, -0.28, -1.3);
    grip.rotation.x = Math.PI / 3.5;
    grip.castShadow = true;
    pistolGroup.add(grip);

    const buttCap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), lanternBrassMat);
    buttCap.position.set(0, -0.70, -1.6);
    buttCap.scale.set(1.1, 0.6, 1.1);
    pistolGroup.add(buttCap);

    const barrelGeo = new THREE.CylinderGeometry(0.14, 0.18, 2.6, 8);
    const barrel = new THREE.Mesh(barrelGeo, gunmetalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.30, 1.2);
    barrel.castShadow = true;
    pistolGroup.add(barrel);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.15, 0.38, 12), gunmetalMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.30, 2.55);
    pistolGroup.add(muzzle);

    const lockplate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.35, 0.70), lanternBrassMat);
    lockplate.position.set(0.20, 0.28, -0.2);
    pistolGroup.add(lockplate);

    const hammer = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16, Math.PI * 1.2), gunmetalMat);
    hammer.position.set(0.22, 0.44, -0.34);
    hammer.rotation.y = Math.PI / 2;
    pistolGroup.add(hammer);

    const tGuard = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 16, Math.PI), lanternBrassMat);
    tGuard.position.set(0, -0.16, -0.45);
    pistolGroup.add(tGuard);

    // Lay completely flat down on side on the table surface (y = -0.04)
    pistolGroup.position.set(-15.4, -0.04, -2.8);
    pistolGroup.rotation.set(0, 0.35, -Math.PI / 2);
    pistolGroup.scale.set(0.95, 0.95, 0.95);
    this.scene.add(pistolGroup);


    // =========================================================================
    // PROP 5: AUTHENTIC LOW-POLY STYLIZED SKULL WITH GLOWING EYES (x=-13.6, z=6.5)
    // =========================================================================
    const skullGroup = new THREE.Group();
    skullGroup.position.set(-13.6, -0.06, 6.5);
    skullGroup.rotation.y = 0.45;
    skullGroup.rotation.x = -0.05;
    skullGroup.rotation.z = -0.08;
    this.scene.add(skullGroup);

    // Glowing Emerald Eye Material & Gems
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 1.35,
      roughness: 0.15,
      metalness: 0.2
    });

    const lEye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), eyeMat);
    lEye.position.set(-0.18, 0.42, 0.22);
    skullGroup.add(lEye);

    const rEye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), eyeMat);
    rEye.position.set(0.18, 0.42, 0.22);
    skullGroup.add(rEye);

    const eyeLight = new THREE.PointLight(0x10b981, 0.90, 3.0, 1.8);
    eyeLight.position.set(0, 0.45, 0.38);
    skullGroup.add(eyeLight);

    if (THREE.GLTFLoader) {
      const gltfLoader = new THREE.GLTFLoader();
      gltfLoader.load('/models/skull.gltf', (gltf) => {
        const skullMesh = gltf.scene;
        skullMesh.scale.set(1.05, 1.05, 1.05);
        skullMesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        skullGroup.add(skullMesh);
      });
    }


    // =========================================================================
    // PROP 6: VINTAGE PIRATE RUM BOTTLE (North Rim Behind Board: x=-2.8, z=-12.5)
    // =========================================================================
    const bottleGroup = new THREE.Group();
    const bottleGlassMat = new THREE.MeshStandardMaterial({
      color: 0x183420,
      transparent: true,
      opacity: 0.75,
      roughness: 0.18,
      metalness: 0.12
    });

    const bBody = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.2, 24), bottleGlassMat);
    bBody.position.y = 1.00;
    bBody.castShadow = true;
    bottleGroup.add(bBody);

    const bShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 1.05, 0.75, 24), bottleGlassMat);
    bShoulder.position.y = 2.45;
    bottleGroup.add(bShoulder);

    const bNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.44, 1.1, 24), bottleGlassMat);
    bNeck.position.y = 3.35;
    bottleGroup.add(bNeck);

    const corkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.95 });
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.45, 16), corkMat);
    cork.position.y = 4.0;
    bottleGroup.add(cork);

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 256;
    labelCanvas.height = 256;
    const lbCtx = labelCanvas.getContext("2d");
    lbCtx.fillStyle = "#ede0cc";
    lbCtx.fillRect(0, 0, 256, 256);
    lbCtx.strokeStyle = "#78350f";
    lbCtx.lineWidth = 6;
    lbCtx.strokeRect(8, 8, 240, 240);
    lbCtx.fillStyle = "#451a03";
    lbCtx.font = "900 28px 'Cinzel', serif";
    lbCtx.textAlign = "center";
    lbCtx.fillText("OLD SALOON", 128, 70);
    lbCtx.font = "900 48px 'Cinzel', serif";
    lbCtx.fillStyle = "#b91c1c";
    lbCtx.fillText("RUM", 128, 130);
    lbCtx.font = "900 22px sans-serif";
    lbCtx.fillStyle = "#78350f";
    lbCtx.fillText("AGED 1888", 128, 185);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.07, 1.07, 1.3, 24, 1, true, -Math.PI / 3, (2 * Math.PI) / 3),
      new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.75, side: THREE.DoubleSide })
    );
    labelMesh.position.y = 1.10;
    bottleGroup.add(labelMesh);

    bottleGroup.position.set(-2.8, -0.15, -12.5);
    bottleGroup.rotation.y = 0.2;
    this.scene.add(bottleGroup);


    // =========================================================================
    // PROP 7: CAST PEWTER & BRASS TAVERN TANKARD WITH FOAM (North Rim: x=2.8, z=-12.2)
    // =========================================================================
    const tankardGroup = new THREE.Group();
    const tankardMat = new THREE.MeshStandardMaterial({
      color: 0x8a7050,
      metalness: 0.86,
      roughness: 0.32
    });

    const tBodyGeo = new THREE.CylinderGeometry(0.90, 1.25, 2.3, 24);
    const tBody = new THREE.Mesh(tBodyGeo, tankardMat);
    tBody.position.y = 1.00;
    tBody.castShadow = true;
    tankardGroup.add(tBody);

    // Frothy Bubbly Beer Foam Head made of overlapping bubbles & spilling foam dollops
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xfffcf0,
      roughness: 0.85,
      metalness: 0.04
    });

    // Base mounded foam bed
    const foamBase = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.88, 0.16, 24), foamMat);
    foamBase.position.y = 2.12;
    tankardGroup.add(foamBase);

    // Bubbly foam spheres clustered across the top rim
    const bubbleOffsets = [
      [0, 2.22, 0, 0.38],
      [0.32, 2.20, 0.22, 0.28],
      [-0.28, 2.20, 0.30, 0.26],
      [0.36, 2.18, -0.25, 0.27],
      [-0.30, 2.19, -0.28, 0.25],
      [0.0, 2.24, 0.40, 0.24],
      [0.0, 2.23, -0.42, 0.23],
      [0.48, 2.16, 0.05, 0.22],
      [-0.46, 2.17, 0.08, 0.22],
      [0.22, 2.26, 0.0, 0.25],
      [-0.20, 2.25, -0.05, 0.24],
      [0.15, 2.27, 0.25, 0.20],
      [-0.18, 2.26, 0.22, 0.21],
      [0.28, 2.22, 0.44, 0.18],
      [-0.35, 2.21, 0.42, 0.17],
      [0.52, 2.15, 0.28, 0.16],
      [-0.50, 2.14, -0.25, 0.16]
    ];

    bubbleOffsets.forEach(([bx, by, bz, br]) => {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(br, 12, 12), foamMat);
      bubble.position.set(bx, by, bz);
      bubble.castShadow = true;
      tankardGroup.add(bubble);
    });

    // Froth drips cascading over the front rim
    const drip1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), foamMat);
    drip1.position.set(-0.70, 2.02, 0.45);
    drip1.scale.set(1, 1.6, 1);
    tankardGroup.add(drip1);

    const drip2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), foamMat);
    drip2.position.set(-0.72, 1.82, 0.46);
    tankardGroup.add(drip2);

    const tHandleGeo = new THREE.TorusGeometry(0.68, 0.13, 12, 24, Math.PI * 1.15);
    const tHandle = new THREE.Mesh(tHandleGeo, tankardMat);
    tHandle.position.set(1.10, 1.00, 0);
    tHandle.rotation.z = -Math.PI / 2;
    tHandle.castShadow = true;
    tankardGroup.add(tHandle);

    tankardGroup.position.set(2.8, -0.15, -12.2);
    tankardGroup.rotation.y = -0.4;
    this.scene.add(tankardGroup);


    // =========================================================================
    // PROP 8: BRASS & LEATHER PIRATE SPYGLASS / TELESCOPE (North Rim: x=-7.5, z=-12.5)
    // =========================================================================
    const spyglassGroup = new THREE.Group();
    const leatherWrapMat = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.78 });

    const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 2.0, 24), leatherWrapMat);
    mainBarrel.rotation.z = Math.PI / 2;
    mainBarrel.castShadow = true;
    spyglassGroup.add(mainBarrel);

    const frontBell = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.55, 24), lanternBrassMat);
    frontBell.rotation.z = Math.PI / 2;
    frontBell.position.x = 1.25;
    frontBell.castShadow = true;
    spyglassGroup.add(frontBell);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.40, 0.40, 0.04, 24),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.6 })
    );
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 1.50;
    spyglassGroup.add(lens);

    const tube1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.2, 24), lanternBrassMat);
    tube1.rotation.z = Math.PI / 2;
    tube1.position.x = -1.45;
    tube1.castShadow = true;
    spyglassGroup.add(tube1);

    const tube2 = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.9, 24), lanternBrassMat);
    tube2.rotation.z = Math.PI / 2;
    tube2.position.x = -2.35;
    tube2.castShadow = true;
    spyglassGroup.add(tube2);

    const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.18, 24), lanternBrassMat);
    eyepiece.rotation.z = Math.PI / 2;
    eyepiece.position.x = -2.85;
    spyglassGroup.add(eyepiece);

    spyglassGroup.position.set(-7.5, 0.22, -12.5);
    spyglassGroup.rotation.y = -0.15;
    this.scene.add(spyglassGroup);


    // =========================================================================
    // PROP 9: JEWELED GOLD CHALICE / GOBLET (North-Right Rim: x=6.8, z=-12.5)
    // =========================================================================
    const chaliceGroup = new THREE.Group();
    const chaliceGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.94,
      roughness: 0.18
    });

    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 1.2, 24, 1, true), chaliceGoldMat);
    cup.position.y = 1.55;
    cup.castShadow = true;
    chaliceGroup.add(cup);

    const wine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.70, 0.70, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x580000, roughness: 0.15 })
    );
    wine.position.y = 1.85;
    chaliceGroup.add(wine);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.95, 16), chaliceGoldMat);
    stem.position.y = 0.65;
    chaliceGroup.add(stem);

    const knop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), chaliceGoldMat);
    knop.position.y = 0.65;
    chaliceGroup.add(knop);

    const baseGeo = new THREE.CylinderGeometry(0.15, 0.65, 0.22, 24);
    const baseMesh = new THREE.Mesh(baseGeo, chaliceGoldMat);
    baseMesh.position.y = 0.11;
    baseMesh.castShadow = true;
    chaliceGroup.add(baseMesh);

    for (let j = 0; j < 6; j++) {
      const stone = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.2, metalness: 0.3 })
      );
      const angle = (j * Math.PI * 2) / 6;
      stone.position.set(Math.cos(angle) * 0.76, 2.05, Math.sin(angle) * 0.76);
      chaliceGroup.add(stone);
    }

    chaliceGroup.position.set(6.8, -0.15, -12.5);
    this.scene.add(chaliceGroup);


    // =========================================================================
    // PROP 10: OPENED BRASS POCKET WATCH WITH CHAIN (Bottom Rim: x=3.8, z=11.2)
    // =========================================================================
    const watchGroup = new THREE.Group();
    const watchBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.60, 0.64, 0.15, 24),
      lanternBrassMat
    );
    watchBody.castShadow = true;
    watchGroup.add(watchBody);

    const watchCanvas = document.createElement("canvas");
    watchCanvas.width = 256;
    watchCanvas.height = 256;
    const wCtx = watchCanvas.getContext("2d");
    wCtx.fillStyle = "#faf6ed";
    wCtx.fillRect(0, 0, 256, 256);
    wCtx.strokeStyle = "#000000";
    wCtx.lineWidth = 4;
    wCtx.beginPath();
    wCtx.arc(128, 128, 118, 0, Math.PI * 2);
    wCtx.stroke();

    const numerals = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    wCtx.font = "900 24px 'Cinzel', serif";
    wCtx.textAlign = "center";
    wCtx.textBaseline = "middle";
    wCtx.fillStyle = "#0f172a";
    numerals.forEach((num, idx) => {
      const a = (idx * Math.PI) / 6 - Math.PI / 2;
      wCtx.fillText(num, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
    });

    wCtx.strokeStyle = "#1e293b";
    wCtx.lineWidth = 5;
    wCtx.beginPath();
    wCtx.moveTo(128, 128);
    wCtx.lineTo(128 + Math.cos(-Math.PI * 0.42) * 55, 128 + Math.sin(-Math.PI * 0.42) * 55);
    wCtx.stroke();
    wCtx.lineWidth = 3.5;
    wCtx.beginPath();
    wCtx.moveTo(128, 128);
    wCtx.lineTo(128 + Math.cos(-Math.PI * 0.15) * 78, 128 + Math.sin(-Math.PI * 0.15) * 78);
    wCtx.stroke();

    const watchDialTex = new THREE.CanvasTexture(watchCanvas);
    const watchDialMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.02, 24),
      new THREE.MeshStandardMaterial({ map: watchDialTex, roughness: 0.5 })
    );
    watchDialMesh.position.y = 0.085;
    watchGroup.add(watchDialMesh);

    for (let c = 0; c < 7; c++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.024, 8, 16), lanternBrassMat);
      const curveX = Math.sin(c * 0.45) * 0.55 + c * 0.20;
      const curveZ = -0.65 - c * 0.22;
      link.position.set(curveX, 0.04, curveZ);
      link.rotation.x = Math.PI / 2;
      link.rotation.y = c * 0.4;
      watchGroup.add(link);
    }

    watchGroup.position.set(3.8, -0.04, 12.3);
    watchGroup.rotation.y = 0.30;
    this.scene.add(watchGroup);


    // =========================================================================
    // PROP 11: CINCH LEATHER COIN POUCH SPILING GOLD (Bottom Rim: x=9.4, z=12.0)
    // =========================================================================
    const pouchGroup = new THREE.Group();
    const pouchMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d14,
      roughness: 0.88,
      metalness: 0.04
    });

    const pouchBody = new THREE.Mesh(new THREE.SphereGeometry(0.92, 16, 16), pouchMat);
    pouchBody.scale.set(1.15, 0.82, 1.05);
    pouchBody.position.y = 0.45;
    pouchBody.castShadow = true;
    pouchGroup.add(pouchBody);

    const pouchNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 0.50, 16), pouchMat);
    pouchNeck.position.y = 0.98;
    pouchGroup.add(pouchNeck);

    const pouchTie = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 8, 16), lanternBrassMat);
    pouchTie.position.y = 0.90;
    pouchTie.rotation.x = Math.PI / 2;
    pouchGroup.add(pouchTie);

    for (let i = 0; i < 5; i++) {
      const spillCoin = new THREE.Mesh(coinGeo, goldCoinMat);
      spillCoin.position.set(0.45 + i * 0.24, 0.02 + i * 0.025, 0.35 + (Math.random() - 0.5) * 0.25);
      spillCoin.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
      spillCoin.castShadow = true;
      pouchGroup.add(spillCoin);
    }

    pouchGroup.position.set(9.4, -0.15, 12.0);
    pouchGroup.rotation.y = -0.50;
    this.scene.add(pouchGroup);


    // =========================================================================
    // PROP 12: FAN OF SALOON PLAYING CARDS - "DEAD MAN'S HAND" (x=-8.6, z=11.0)
    // =========================================================================
    const cardsFanGroup = new THREE.Group();
    const handCards = [
      { rank: "A", suit: "♠", col: "#0f172a" },
      { rank: "8", suit: "♠", col: "#0f172a" },
      { rank: "A", suit: "♣", col: "#0f172a" },
      { rank: "8", suit: "♣", col: "#0f172a" },
      { rank: "Q", suit: "♥", col: "#b91c1c" }
    ];

    handCards.forEach((cData, idx) => {
      const cardCanvas = document.createElement("canvas");
      cardCanvas.width = 256;
      cardCanvas.height = 360;
      const cCtx = cardCanvas.getContext("2d");

      cCtx.fillStyle = "#faf6ed";
      cCtx.fillRect(0, 0, 256, 360);
      cCtx.strokeStyle = "#cbd5e1";
      cCtx.lineWidth = 4;
      cCtx.strokeRect(6, 6, 244, 348);

      cCtx.fillStyle = cData.col;
      cCtx.font = "900 48px 'Cinzel', serif";
      cCtx.fillText(cData.rank, 18, 52);
      cCtx.font = "40px sans-serif";
      cCtx.fillText(cData.suit, 18, 98);

      cCtx.font = "900 120px sans-serif";
      cCtx.textAlign = "center";
      cCtx.textBaseline = "middle";
      cCtx.fillText(cData.suit, 128, 180);

      const cTex = new THREE.CanvasTexture(cardCanvas);
      cTex.anisotropy = 16;
      const cMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.015, 1.75),
        new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.65 })
      );

      const angle = (idx - 2) * 0.16;
      cMesh.rotation.y = angle;
      cMesh.position.set((idx - 2) * 0.40, idx * 0.015, 0);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      cardsFanGroup.add(cMesh);
    });

    cardsFanGroup.position.set(-9.2, -0.04, 12.0);
    cardsFanGroup.rotation.y = 0.20;
    this.scene.add(cardsFanGroup);


    // =========================================================================
    // PROP 13: STAMPED 24K GOLD BULLION INGOT BAR & BANKNOTES
    // =========================================================================
    const goldBarGeo = new THREE.BoxGeometry(1.5, 0.32, 0.75);
    const goldBarMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x4a3500,
      emissiveIntensity: 0.15
    });
    const goldBar = new THREE.Mesh(goldBarGeo, goldBarMat);
    goldBar.position.set(6.6, -0.02, 12.2);
    goldBar.rotation.y = 0.35;
    goldBar.castShadow = true;
    this.scene.add(goldBar);

    const makeCashStack = (x, z, colorHex, angle) => {
      const cashGeo = new THREE.BoxGeometry(1.35, 0.26, 0.68);
      const cashMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85 });
      const stack = new THREE.Mesh(cashGeo, cashMat);
      stack.position.set(x, -0.02, z);
      stack.rotation.y = angle;
      stack.castShadow = true;
      this.scene.add(stack);
    };
    makeCashStack(-11.5, 10.6, 0xf97316, 0.25);  // $500 orange
    makeCashStack(-12.4, 11.2, 0xfacc15, -0.15); // $100 yellow
    makeCashStack(-10.8, 11.4, 0x38bdf8, 0.35);  // $50 blue


    // =========================================================================
    // PROP 14: AUTHENTIC "EYE OF INNOS" GOTHIC FANART AMULET (Bottom-Right Rim: x=13.6, z=8.8)
    // =========================================================================
    const amuletGroup = new THREE.Group();

    // Dark Antique Forged Gothic Bronze / Dragon Gold Material
    const innosMetalMat = new THREE.MeshStandardMaterial({
      color: 0x5a4325,
      metalness: 0.88,
      roughness: 0.34,
      emissive: 0x221305,
      emissiveIntensity: 0.18
    });

    // 1. Procedural Divine Eye of Innos Texture (Fiery Solar Iris with Slit Pupil)
    const eyeCanvas = document.createElement("canvas");
    eyeCanvas.width = 512;
    eyeCanvas.height = 512;
    const eCtx = eyeCanvas.getContext("2d");

    // Fiery solar radial gradient
    const radGrad = eCtx.createRadialGradient(256, 256, 8, 256, 256, 235);
    radGrad.addColorStop(0.00, "#ffffff"); // Blinding divine core of Innos
    radGrad.addColorStop(0.14, "#ffec8b"); // Solar gold
    radGrad.addColorStop(0.38, "#ff6b00"); // Radiant flame amber
    radGrad.addColorStop(0.70, "#b81600"); // Deep magma crimson
    radGrad.addColorStop(0.92, "#4d0800"); // Limbal shadow ring
    radGrad.addColorStop(1.00, "#160200"); // Outer bezel border
    eCtx.fillStyle = radGrad;
    eCtx.fillRect(0, 0, 512, 512);

    // Dynamic solar flares and iris filaments radiating from core
    eCtx.lineWidth = 1.6;
    for (let a = 0; a < 72; a++) {
      const ang = (a / 72) * Math.PI * 2;
      const len = 95 + Math.sin(a * 9) * 45;
      eCtx.strokeStyle = (a % 2 === 0) ? "rgba(255, 240, 150, 0.50)" : "rgba(140, 20, 0, 0.40)";
      eCtx.beginPath();
      eCtx.moveTo(256 + Math.cos(ang) * 22, 256 + Math.sin(ang) * 22);
      eCtx.lineTo(256 + Math.cos(ang) * (22 + len), 256 + Math.sin(ang) * (22 + len));
      eCtx.stroke();
    }

    // Draconic vertical cat-eye / Innos slit pupil
    eCtx.fillStyle = "#0c0200";
    eCtx.beginPath();
    eCtx.ellipse(256, 256, 24, 175, 0, 0, Math.PI * 2);
    eCtx.fill();

    // Pupil golden aura rim
    eCtx.strokeStyle = "rgba(255, 215, 0, 0.65)";
    eCtx.lineWidth = 3.5;
    eCtx.stroke();

    const eyeTex = new THREE.CanvasTexture(eyeCanvas);
    const innosEyeMat = new THREE.MeshStandardMaterial({
      map: eyeTex,
      emissive: 0xff4800,
      emissiveIntensity: 0.95,
      roughness: 0.12,
      metalness: 0.18
    });

    // Central Divine Eye Orb (slightly oblate like a gemstone eye)
    const eyeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), innosEyeMat);
    eyeOrb.scale.set(1.0, 0.62, 1.0);
    eyeOrb.position.set(0, 0.11, 0);
    eyeOrb.rotation.x = -Math.PI / 2;
    amuletGroup.add(eyeOrb);

    // 2. Almond-shaped Inner Eye Socket Bezel
    const socketBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.075, 12, 36),
      innosMetalMat
    );
    socketBezel.position.y = 0.08;
    socketBezel.rotation.x = Math.PI / 2;
    socketBezel.scale.set(1.35, 0.95, 1.0);
    amuletGroup.add(socketBezel);

    // 3. Four Gothic Claw Prongs gripping the Eye from the Bezel
    const prongAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    prongAngles.forEach((ang) => {
      const prong = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 8), innosMetalMat);
      prong.position.set(Math.cos(ang) * 0.44, 0.16, Math.sin(ang) * 0.36);
      prong.rotation.x = Math.PI / 2 + Math.sin(ang) * 0.45;
      prong.rotation.z = -ang;
      amuletGroup.add(prong);
    });

    // 4. Iconic Sweeping Gothic Dragon Horns / Wings Framing the Eye
    // Left Dragon Horn Curve
    const leftHornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, 0.78),
      new THREE.Vector3(-0.70, 0.09, 0.42),
      new THREE.Vector3(-0.96, 0.13, -0.22),
      new THREE.Vector3(-0.72, 0.16, -0.88),
      new THREE.Vector3(-0.28, 0.18, -1.22)
    ]);
    const leftHorn = new THREE.Mesh(
      new THREE.TubeGeometry(leftHornCurve, 24, 0.085, 8, false),
      innosMetalMat
    );
    leftHorn.castShadow = true;
    amuletGroup.add(leftHorn);

    // Left Talon Tip Finial
    const leftTip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 8), innosMetalMat);
    leftTip.position.set(-0.28, 0.18, -1.30);
    leftTip.rotation.x = Math.PI / 3;
    leftTip.rotation.z = Math.PI / 6;
    amuletGroup.add(leftTip);

    // Right Dragon Horn Curve (Symmetric mirror)
    const rightHornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, 0.78),
      new THREE.Vector3(0.70, 0.09, 0.42),
      new THREE.Vector3(0.96, 0.13, -0.22),
      new THREE.Vector3(0.72, 0.16, -0.88),
      new THREE.Vector3(0.28, 0.18, -1.22)
    ]);
    const rightHorn = new THREE.Mesh(
      new THREE.TubeGeometry(rightHornCurve, 24, 0.085, 8, false),
      innosMetalMat
    );
    rightHorn.castShadow = true;
    amuletGroup.add(rightHorn);

    // Right Talon Tip Finial
    const rightTip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 8), innosMetalMat);
    rightTip.position.set(0.28, 0.18, -1.30);
    rightTip.rotation.x = Math.PI / 3;
    rightTip.rotation.z = -Math.PI / 6;
    amuletGroup.add(rightTip);

    // 5. Bottom Gothic Spine / Claw Tail
    const bottomTail = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.45, 8), innosMetalMat);
    bottomTail.position.set(0, 0.05, 0.96);
    bottomTail.rotation.x = -Math.PI / 2.2;
    amuletGroup.add(bottomTail);

    // 6. Top Gothic Bail Loop
    const topBail = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 20), innosMetalMat);
    topBail.position.set(0, 0.08, -1.32);
    topBail.rotation.x = Math.PI / 2;
    amuletGroup.add(topBail);

    // 7. Heavy Forged Gothic Link Chain Draped Across Table
    const chainLinks = 18;
    for (let c = 0; c < chainLinks; c++) {
      const t = (c / (chainLinks - 1)) * 2 - 1; // -1 to +1
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.026, 8, 16), innosMetalMat);
      const lx = t * 1.8 + Math.sin(c * 0.75) * 0.14;
      const lz = -1.32 - Math.abs(t) * 1.9;
      link.position.set(lx, 0.02, lz);
      link.rotation.x = Math.PI / 2;
      link.rotation.y = t * 0.65 + (c % 2 === 0 ? 0.35 : -0.35);
      link.castShadow = true;
      amuletGroup.add(link);
    }

    amuletGroup.position.set(13.6, -0.07, 8.8);
    amuletGroup.rotation.y = -0.35;
    this.scene.add(amuletGroup);

    // Mystical Warm Innos Radiant PointLight (Tuned down for atmospheric tavern shadows)
    const amuletLight = new THREE.PointLight(0xff6600, 0.75, 6.5, 1.6);
    amuletLight.position.set(13.6, 0.35, 8.8);
    amuletLight.userData = { baseIntensity: 0.75, seed: 4.2 };
    this.scene.add(amuletLight);
    this.candleLights.push(amuletLight);
  }

  calculateTileTransforms() {
    const half = this.boardSize / 2;
    const cornerSize = 2.6;
    const regWidth = (this.boardSize - 2 * cornerSize) / 9;

    this.tilePositions = [];

    // Bottom-Right Corner: GO (Tile 0)
    this.tilePositions[0] = { x: half - cornerSize / 2, z: half - cornerSize / 2, rotY: 0, tokenFacingY: -Math.PI / 2, isCorner: true, side: "bottom" };

    // Bottom Row: Tiles 1..9 (Right to Left -> Heading -X)
    for (let i = 1; i <= 9; i++) {
      const x = (half - cornerSize) - (i - 0.5) * regWidth;
      const z = half - cornerSize / 2;
      this.tilePositions[i] = { x, z, rotY: 0, tokenFacingY: -Math.PI / 2, isCorner: false, side: "bottom" };
    }

    // Bottom-Left Corner: Jail (Tile 10)
    this.tilePositions[10] = { x: -(half - cornerSize / 2), z: half - cornerSize / 2, rotY: 0, tokenFacingY: Math.PI, isCorner: true, side: "left" };

    // Left Column: Tiles 11..19 (Bottom to Top -> Heading -Z)
    for (let i = 1; i <= 9; i++) {
      const id = 10 + i;
      const x = -(half - cornerSize / 2);
      const z = (half - cornerSize) - (i - 0.5) * regWidth;
      this.tilePositions[id] = { x, z, rotY: -Math.PI / 2, tokenFacingY: Math.PI, isCorner: false, side: "left" };
    }

    // Top-Left Corner: Free Parking (Tile 20)
    this.tilePositions[20] = { x: -(half - cornerSize / 2), z: -(half - cornerSize / 2), rotY: 0, tokenFacingY: Math.PI / 2, isCorner: true, side: "top" };

    // Top Row: Tiles 21..29 (Left to Right -> Heading +X)
    for (let i = 1; i <= 9; i++) {
      const id = 20 + i;
      const x = -(half - cornerSize) + (i - 0.5) * regWidth;
      const z = -(half - cornerSize / 2);
      this.tilePositions[id] = { x, z, rotY: Math.PI, tokenFacingY: Math.PI / 2, isCorner: false, side: "top" };
    }

    // Top-Right Corner: Go To Jail (Tile 30)
    this.tilePositions[30] = { x: half - cornerSize / 2, z: -(half - cornerSize / 2), rotY: 0, tokenFacingY: 0, isCorner: true, side: "right" };

    // Right Column: Tiles 31..39 (Top to Bottom -> Heading +Z)
    for (let i = 1; i <= 9; i++) {
      const id = 30 + i;
      const x = half - cornerSize / 2;
      const z = -(half - cornerSize) + (i - 0.5) * regWidth;
      this.tilePositions[id] = { x, z, rotY: Math.PI / 2, tokenFacingY: 0, isCorner: false, side: "right" };
    }
  }

  // ================= 3D BOARD TILES ASSEMBLY =================
  build3DBoard() {
    const defs = window.TILES_DEF || (typeof TILES_DEF !== "undefined" ? TILES_DEF : []);
    const cornerSize = 2.6;
    const regWidth = (this.boardSize - 2 * cornerSize) / 9;

    // Shared geometries: dramatically reduces memory & draw calls for silky-smooth Free Cam
    const cornerGeo = new THREE.BoxGeometry(cornerSize * 0.98, 0.35, cornerSize * 0.98);
    const regGeo = new THREE.BoxGeometry(regWidth * 0.98, 0.35, cornerSize * 0.98);

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0xdfd3b8,
      roughness: 0.9
    });

    defs.forEach((def) => {
      const transform = this.tilePositions[def.id];
      if (!transform) return;

      const isCorner = transform.isCorner;
      const geo = isCorner ? cornerGeo : regGeo;
      const texture = this.createParchmentTileTexture(def, isCorner);

      const topMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0.02
      });

      const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
      const tileMesh = new THREE.Mesh(geo, materials);

      tileMesh.position.set(transform.x, 0.1, transform.z);
      tileMesh.rotation.y = transform.rotY;
      tileMesh.castShadow = false; // Tiles only receive shadows! Massive performance boost
      tileMesh.receiveShadow = true;
      tileMesh.userData = { tileId: def.id, def };

      this.scene.add(tileMesh);
      this.tiles[def.id] = tileMesh;
    });
  }

  // ================= HIGH-RESOLUTION SMOOTH REFINED BOARD TILES =================
  createParchmentTileTexture(def, isCorner) {
    const canvas = document.createElement("canvas");
    canvas.width = isCorner ? 1024 : 768;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;

    // Clean Aged Ivory Cardstock
    ctx.fillStyle = "#f6f0e4";
    ctx.fillRect(0, 0, w, h);

    // Subtle paper texture noise
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(180,165,140,0.08)" : "rgba(255,255,255,0.12)";
      ctx.fillRect(x, y, 2, 2);
    }

    // Outer Crisp Bold Ink Border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    const VINTAGE_COLORS = {
      brown: "#6b3f27",
      light_blue: "#5a9bc0",
      pink: "#b83d6a",
      orange: "#d4621c",
      red: "#b82420",
      yellow: "#d4a520",
      green: "#267845",
      dark_blue: "#1d4778"
    };

    if (def.type === "property") {
      const color = VINTAGE_COLORS[def.group] || def.color || "#888";
      ctx.fillStyle = color;
      ctx.fillRect(16, 16, w - 32, 230);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 14;
      ctx.strokeRect(16, 16, w - 32, 230);

      ctx.fillStyle = "#000000";
      ctx.font = "900 80px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = def.name.split(" ");
      if (words.length > 2) {
        ctx.fillText(words.slice(0, 2).join(" "), cx, 460);
        ctx.fillText(words.slice(2).join(" "), cx, 570);
      } else if (words.length === 2) {
        ctx.fillText(words[0], cx, 470);
        ctx.fillText(words[1], cx, 580);
      } else {
        ctx.fillText(def.name, cx, 520);
      }

      ctx.font = "900 96px 'Cinzel', serif";
      ctx.fillStyle = "#000000";
      ctx.fillText(`$${def.cost}`, cx, 860);

    } else if (def.type === "railroad") {
      const drawClassicTrain = (x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#0f172a";

        ctx.fillRect(-120, -35, 200, 85);
        ctx.fillRect(35, -100, 95, 150);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(55, -80, 55, 45);
        ctx.fillStyle = "#0f172a";

        ctx.fillRect(-95, -95, 30, 60);
        ctx.fillRect(-105, -108, 50, 15);

        ctx.beginPath();
        ctx.moveTo(-120, 50);
        ctx.lineTo(-170, 50);
        ctx.lineTo(-120, -5);
        ctx.closePath();
        ctx.fill();

        [-65, 0, 75].forEach(wx => {
          ctx.beginPath();
          ctx.arc(wx, 52, 32, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(wx, 52, 12, 0, Math.PI * 2);
          ctx.fillStyle = "#64748b";
          ctx.fill();
          ctx.fillStyle = "#0f172a";
        });

        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-65, 52);
        ctx.lineTo(75, 52);
        ctx.stroke();

        ctx.restore();
      };

      drawClassicTrain(cx, 370);

      ctx.fillStyle = "#000000";
      ctx.font = "900 74px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const rwords = def.name.split(" ");
      if (rwords.length > 2) {
        ctx.fillText(rwords.slice(0, 2).join(" "), cx, 600);
        ctx.fillText(rwords.slice(2).join(" "), cx, 680);
      } else {
        ctx.fillText(def.name, cx, 640);
      }
      ctx.font = "900 96px 'Cinzel', serif";
      ctx.fillText(`$${def.cost}`, cx, 860);

    } else if (def.type === "utility") {
      if (def.id === 12) {
        const drawBulb = (x, y) => {
          ctx.save();
          ctx.translate(x, y);

          ctx.beginPath();
          ctx.arc(0, -35, 70, Math.PI * 0.25, Math.PI * 0.75, true);
          ctx.lineTo(-28, 45);
          ctx.lineTo(28, 45);
          ctx.closePath();
          ctx.fillStyle = "#fef08a";
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 9;
          ctx.stroke();

          ctx.strokeStyle = "#ea580c";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-18, 25);
          ctx.lineTo(-12, -35);
          ctx.lineTo(0, -50);
          ctx.lineTo(12, -35);
          ctx.lineTo(18, 25);
          ctx.stroke();

          ctx.fillStyle = "#94a3b8";
          ctx.fillRect(-24, 48, 48, 32);
          ctx.fillStyle = "#334155";
          ctx.fillRect(-18, 80, 36, 14);

          ctx.restore();
        };
        drawBulb(cx, 370);
      } else {
        const drawFaucet = (x, y) => {
          ctx.save();
          ctx.translate(x, y);

          ctx.fillStyle = "#b45309";
          ctx.fillRect(-90, -15, 110, 35);

          ctx.beginPath();
          ctx.arc(20, 10, 40, -Math.PI / 2, 0);
          ctx.lineTo(60, 75);
          ctx.lineTo(32, 75);
          ctx.lineTo(32, 10);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 8;
          ctx.stroke();

          ctx.fillStyle = "#dc2626";
          ctx.fillRect(-8, -75, 16, 60);
          ctx.beginPath();
          ctx.ellipse(0, -80, 50, 15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#0284c7";
          ctx.beginPath();
          ctx.arc(46, 120, 14, 0, Math.PI);
          ctx.lineTo(46, 100);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        };
        drawFaucet(cx, 370);
      }

      ctx.fillStyle = "#000000";
      ctx.font = "900 74px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const uwords = def.name.split(" ");
      if (uwords.length > 2) {
        ctx.fillText(uwords.slice(0, 2).join(" "), cx, 600);
        ctx.fillText(uwords.slice(2).join(" "), cx, 680);
      } else {
        ctx.fillText(def.name, cx, 640);
      }
      ctx.font = "900 96px 'Cinzel', serif";
      ctx.fillText(`$${def.cost}`, cx, 860);

    } else if (def.type === "community_chest" || def.type === "chest") {
      const drawChest = (x, y) => {
        ctx.save();
        ctx.translate(x, y);

        ctx.fillStyle = "#5c2c16";
        ctx.fillRect(-120, -35, 240, 160);
        ctx.strokeStyle = "#1a0800";
        ctx.lineWidth = 9;
        ctx.strokeRect(-120, -35, 240, 160);

        ctx.beginPath();
        ctx.ellipse(0, -35, 120, 65, 0, Math.PI, 0);
        ctx.fillStyle = "#6e351b";
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#e5a93b";
        ctx.fillRect(-100, -96, 28, 220);
        ctx.fillRect(72, -96, 28, 220);
        ctx.fillRect(-120, -40, 240, 18);

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(0, 15, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-4, 15, 8, 20);

        [-45, -15, 15, 45].forEach((cp, idx) => {
          ctx.beginPath();
          ctx.ellipse(cp, -45 - (idx % 2) * 8, 16, 10, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#ffd700";
          ctx.fill();
          ctx.strokeStyle = "#b38600";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        });

        ctx.restore();
      };

      drawChest(cx, 370);

      ctx.fillStyle = "#000000";
      ctx.font = "900 76px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("COMMUNITY", cx, 660);
      ctx.fillText("CHEST", cx, 760);

    } else if (def.type === "chance") {
      ctx.save();
      ctx.font = "900 320px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ff7a00";
      ctx.fillText("?", cx, 370);
      ctx.restore();

      ctx.fillStyle = "#000000";
      ctx.font = "900 88px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CHANCE", cx, 720);

    } else if (def.type === "tax") {
      if (def.id === 4) {
        ctx.save();
        ctx.translate(cx, 370);
        ctx.fillStyle = "#d97706";
        ctx.beginPath();
        ctx.arc(0, 25, 75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-30, -60, 60, 50);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 9;
        ctx.stroke();

        ctx.fillStyle = "#000000";
        ctx.font = "900 100px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", 0, 25);
        ctx.restore();

        ctx.fillStyle = "#000000";
        ctx.font = "900 78px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText("INCOME TAX", cx, 620);
        ctx.font = "900 68px 'Cinzel', serif";
        ctx.fillText("PAY $200", cx, 720);
      } else {
        ctx.save();
        ctx.translate(cx, 370);
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.arc(0, 25, 70, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(0, -80);
        ctx.lineTo(50, -42);
        ctx.lineTo(32, -18);
        ctx.lineTo(-32, -18);
        ctx.lineTo(-50, -42);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "#000000";
        ctx.font = "900 78px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText("LUXURY TAX", cx, 620);
        ctx.font = "900 68px 'Cinzel', serif";
        ctx.fillText("PAY $100", cx, 720);
      }

    } else if (isCorner) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (def.id === 0) {
        // GO Corner: Arrow strictly points CLOCKWISE (LEFTWARDS towards Mediterranean Ave / Tile 1)
        ctx.fillStyle = "#1e6838";
        ctx.font = "900 64px 'Cinzel', serif";
        ctx.fillText("COLLECT $200 SALARY", cx, 210);
        ctx.fillText("AS YOU PASS", cx, 290);

        ctx.fillStyle = "#b91c1c";
        ctx.font = "900 240px 'Cinzel', serif";
        ctx.fillText("GO", cx, 550);

        // Red Directional Arrow Pointing LEFT
        ctx.fillStyle = "#b91c1c";
        ctx.beginPath();
        ctx.moveTo(cx + 240, 850);
        ctx.lineTo(cx - 60, 850);
        ctx.lineTo(cx - 60, 770);
        ctx.lineTo(cx - 240, 890); // Arrowhead tip points LEFT!
        ctx.lineTo(cx - 60, 1010);
        ctx.lineTo(cx - 60, 930);
        ctx.lineTo(cx + 240, 930);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 10;
        ctx.stroke();

      } else if (def.id === 10) {
        // Authentic Monopoly Jail: Orange Cell Box + Slender Bars + Just Visiting
        ctx.fillStyle = "#ff7700";
        ctx.fillRect(w * 0.32, 16, w * 0.68 - 16, h * 0.68 - 16);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 14;
        ctx.strokeRect(w * 0.32, 16, w * 0.68 - 16, h * 0.68 - 16);

        ctx.fillStyle = "#000000";
        ctx.font = "900 68px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText("IN JAIL", w * 0.65, 80);

        // Jake the Jailbird silhouette
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(w * 0.65, 230, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.fillRect(w * 0.54, 172, w * 0.22, 22);

        // Prisoner shirt stripes
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(w * 0.46, 480);
        ctx.lineTo(w * 0.53, 290);
        ctx.lineTo(w * 0.77, 290);
        ctx.lineTo(w * 0.84, 480);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#000000";
        for (let s = 310; s < 480; s += 34) {
          ctx.fillRect(w * 0.48, s, w * 0.34, 16);
        }

        // Clean Slender Iron Bars
        ctx.fillStyle = "#000000";
        for (let b = 0; b < 6; b++) {
          const bx = w * 0.38 + b * (w * 0.54 / 5);
          ctx.fillRect(bx - 5, 120, 10, 380);
        }
        ctx.fillRect(w * 0.34, 140, w * 0.62, 12);
        ctx.fillRect(w * 0.34, 480, w * 0.62, 12);

        // Outer "JUST VISITING" track
        ctx.fillStyle = "#000000";
        ctx.font = "900 78px 'Cinzel', serif";
        ctx.fillText("JUST", cx, 860);

        ctx.save();
        ctx.translate(140, 480);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("VISITING", 0, 0);
        ctx.restore();

      } else if (def.id === 20) {
        ctx.save();
        ctx.translate(cx, 440);
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(-110, -18, 220, 65);
        ctx.beginPath();
        ctx.ellipse(0, -18, 80, 50, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#93c5fd";
        ctx.fillRect(-50, -50, 100, 32);
        ctx.fillStyle = "#000000";
        [-70, 70].forEach(wx => {
          ctx.beginPath();
          ctx.arc(wx, 48, 28, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        ctx.fillStyle = "#1d4778";
        ctx.font = "900 96px 'Cinzel', serif";
        ctx.fillText("FREE", cx, 200);
        ctx.fillText("PARKING", cx, 780);

      } else if (def.id === 30) {
        ctx.save();
        ctx.translate(cx, 440);
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath();
        ctx.arc(0, -55, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-42, -88, 84, 20);
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath();
        ctx.moveTo(-15, -10);
        ctx.lineTo(-130, 45);
        ctx.lineTo(-115, 72);
        ctx.lineTo(0, 25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "#b91c1c";
        ctx.font = "900 95px 'Cinzel', serif";
        ctx.fillText("GO TO", cx, 180);
        ctx.fillText("JAIL", cx, 780);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    return texture;
  }

  // ================= 3D PIECES (LIGHTWEIGHT, FAST, NO LAG) =================
  create3DTokenMesh(tokenSymbol, colorHex) {
    const group = new THREE.Group();

    // 1. Heavy Stepped Antique Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(0.44, 0.50, 0.11, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x362c24,
      metalness: 0.85,
      roughness: 0.35
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.06;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Glowing Player Enamel Inlay Ring
    const ringGeo = new THREE.TorusGeometry(0.42, 0.045, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.3
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.11;
    group.add(ring);

    // 2. Token Geometry
    const key = this.getTokenModelKey(tokenSymbol);
    const template = this.loadedModels && this.loadedModels[key];

    if (template && (key === "hat" || key === "boot" || key === "thimble" || key === "plane")) {
      const model = template.clone(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      let targetDim = 1.0;
      if (key === "plane") targetDim = 1.05;
      if (key === "thimble") targetDim = 0.95;

      const scale = targetDim / (maxDim || 1);
      model.scale.set(scale, scale, scale);

      const updatedBox = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      updatedBox.getCenter(center);
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y = 0.14 - updatedBox.min.y;

      let tokenMat;
      if (key === "hat") {
        tokenMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          metalness: 0.85,
          roughness: 0.20,
          emissive: 0x475569,
          emissiveIntensity: 0.38
        });
      } else if (key === "boot") {
        tokenMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          metalness: 0.82,
          roughness: 0.22,
          emissive: 0x78350f,
          emissiveIntensity: 0.38
        });
      } else if (key === "thimble") {
        tokenMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.88,
          roughness: 0.16,
          emissive: 0x475569,
          emissiveIntensity: 0.40
        });
      } else if (key === "plane") {
        tokenMat = new THREE.MeshStandardMaterial({
          color: 0xfde047,
          metalness: 0.80,
          roughness: 0.20,
          emissive: 0x713f12,
          emissiveIntensity: 0.38
        });
      }

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (tokenMat) child.material = tokenMat;
        }
      });

      group.add(model);
    } else {
      const tokenMesh = this.createStylizedToken(key);
      group.add(tokenMesh);
    }

    group.scale.set(0.72, 0.72, 0.72);
    return group;
  }

  createStylizedToken(key) {
    const group = new THREE.Group();

    if (key === "car") {
      // Classic 1930s Monopoly Racecar Token
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        metalness: 0.52,
        roughness: 0.22,
        emissive: 0x881337,
        emissiveIntensity: 0.38
      });
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.95,
        roughness: 0.15
      });

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 1.25), bodyMat);
      chassis.position.y = 0.26;
      chassis.castShadow = true;
      group.add(chassis);

      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.45, 16), bodyMat);
      hood.rotation.x = Math.PI / 2;
      hood.position.set(0, 0.27, 0.65);
      hood.castShadow = true;
      group.add(hood);

      const grille = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.08), chromeMat);
      grille.position.set(0, 0.27, 0.88);
      group.add(grille);

      const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.40), bodyMat);
      cowl.position.set(0, 0.42, -0.15);
      group.add(cowl);

      const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.10, 16);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
      [[-0.32, 0.42], [0.32, 0.42], [-0.32, -0.42], [0.32, -0.42]].forEach(([wx, wz]) => {
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(wx, 0.18, wz);
        tire.castShadow = true;
        group.add(tire);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 8), chromeMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, 0.18, wz);
        group.add(hub);
      });

    } else if (key === "ship") {
      // Classic Authentic Monopoly Battleship Token
      const steelMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.85,
        roughness: 0.20,
        emissive: 0x334e68,
        emissiveIntensity: 0.38
      });

      const hullGeo = new THREE.BoxGeometry(0.46, 0.26, 1.4);
      const hull = new THREE.Mesh(hullGeo, steelMat);
      hull.position.y = 0.22;
      hull.castShadow = true;
      group.add(hull);

      const bowGeo = new THREE.ConeGeometry(0.24, 0.45, 4);
      bowGeo.rotateZ(Math.PI / 4);
      bowGeo.rotateX(-Math.PI / 2);
      const bow = new THREE.Mesh(bowGeo, steelMat);
      bow.position.set(0, 0.22, 0.88);
      bow.castShadow = true;
      group.add(bow);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.65), steelMat);
      bridge.position.set(0, 0.45, 0.05);
      bridge.castShadow = true;
      group.add(bridge);

      [0.45, -0.45].forEach(tz => {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.12, 12), steelMat);
        turret.position.set(0, 0.38, tz);
        turret.castShadow = true;
        group.add(turret);

        const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), steelMat);
        barrel1.rotation.x = Math.PI / 2;
        barrel1.position.set(-0.04, 0.38, tz + (tz > 0 ? 0.18 : -0.18));
        group.add(barrel1);

        const barrel2 = barrel1.clone();
        barrel2.position.x = 0.04;
        group.add(barrel2);
      });

      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.32, 10), steelMat);
      stack.rotation.x = -0.15;
      stack.position.set(0, 0.65, -0.15);
      group.add(stack);

    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.88,
        roughness: 0.2
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 16), mat);
      cone.position.y = 0.45;
      cone.castShadow = true;
      group.add(cone);
    }

    return group;
  }

  // ================= EXACT REAL MONOPOLY HOUSES & HOTELS =================
  syncProperties(properties, players) {
    if (!properties) return;
    this.ownerPlaques = this.ownerPlaques || new Map();

    for (const [idStr, prop] of Object.entries(properties)) {
      if (!prop) continue;
      const tileId = parseInt(idStr);
      let currentHouses = this.houses.get(tileId) || [];

      let desiredHouses = 0;
      let desiredHotel = false;

      if (prop.hotel || prop.houses === 5) {
        desiredHotel = true;
      } else {
        desiredHouses = prop.houses || 0;
      }

      currentHouses.forEach(h => this.scene.remove(h));
      currentHouses = [];

      if (desiredHotel) {
        const hotelMesh = this.buildRealMonopolyBuilding(true);
        this.placeHouseOnTile(hotelMesh, tileId, 0, 1);
        this.scene.add(hotelMesh);
        currentHouses.push(hotelMesh);
      } else if (desiredHouses > 0) {
        for (let i = 0; i < desiredHouses; i++) {
          const houseMesh = this.buildRealMonopolyBuilding(false);
          this.placeHouseOnTile(houseMesh, tileId, i, desiredHouses);
          this.scene.add(houseMesh);
          currentHouses.push(houseMesh);
        }
      }
      this.houses.set(tileId, currentHouses);

      // 3D Owner Ribbon / Plaque on Tile
      let plaqueMesh = this.ownerPlaques.get(tileId);
      if (plaqueMesh) {
        this.scene.remove(plaqueMesh);
        this.ownerPlaques.delete(tileId);
      }

      if (prop.owner) {
        const ownerPlayer = players ? players.find(p => p.id === prop.owner) : null;
        const ownerColor = ownerPlayer ? ownerPlayer.color : "#3b82f6";
        const t = this.tilePositions[tileId];

        if (t && !t.isCorner) {
          const plaqueGroup = new THREE.Group();
          const pMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(ownerColor),
            emissive: new THREE.Color(ownerColor),
            emissiveIntensity: 0.45,
            roughness: 0.25,
            metalness: 0.6
          });
          const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.08, 0.18), pMat);
          plaqueGroup.add(pMesh);

          // Position plaque on the inner curb of the tile
          const curbDist = 1.05;
          if (t.side === "bottom") plaqueGroup.position.set(t.x, 0.28, t.z - curbDist);
          else if (t.side === "top") plaqueGroup.position.set(t.x, 0.28, t.z + curbDist);
          else if (t.side === "left") plaqueGroup.position.set(t.x + curbDist, 0.28, t.z);
          else if (t.side === "right") plaqueGroup.position.set(t.x - curbDist, 0.28, t.z);

          plaqueGroup.rotation.y = t.rotY;
          this.scene.add(plaqueGroup);
          this.ownerPlaques.set(tileId, plaqueGroup);
        }
      }
    }
  }

  buildRealMonopolyBuilding(isHotel) {
    const group = new THREE.Group();

    if (isHotel) {
      // Classic Monopoly Red Grand Hotel
      const hotelMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.35,
        metalness: 0.05
      });

      const w = 0.48;
      const h = 0.28;
      const d = 0.26;

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hotelMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const roofGeo = new THREE.ConeGeometry(w * 0.72, h * 0.65, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, hotelMat);
      roof.position.y = h + h * 0.30;
      roof.scale.set(1.0, 1.0, d / w);
      roof.castShadow = true;
      group.add(roof);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), hotelMat);
      chimney.position.set(0, h + h * 0.52, 0);
      group.add(chimney);

    } else {
      // Classic Monopoly Green House
      const houseMat = new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.35,
        metalness: 0.05
      });

      const w = 0.28;
      const h = 0.20;
      const d = 0.22;

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const roofGeo = new THREE.ConeGeometry(w * 0.72, h * 0.75, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, houseMat);
      roof.position.y = h + h * 0.34;
      roof.scale.set(1.0, 1.0, d / w);
      roof.castShadow = true;
      group.add(roof);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), houseMat);
      chimney.position.set(0.07, h + h * 0.38, 0.04);
      group.add(chimney);
    }

    return group;
  }

  placeHouseOnTile(mesh, tileId, index, count) {
    const t = this.tilePositions[tileId];
    if (!t) return;

    const spacing = 0.32;
    const offset = (index - (count - 1) / 2) * spacing;

    if (t.side === "bottom") mesh.position.set(t.x + offset, 0.28, t.z - 0.78);
    else if (t.side === "top") mesh.position.set(t.x - offset, 0.28, t.z + 0.78);
    else if (t.side === "left") mesh.position.set(t.x + 0.78, 0.28, t.z - offset);
    else if (t.side === "right") mesh.position.set(t.x - 0.78, 0.28, t.z + offset);
  }

  // ================= ROUNDED WEIGHTED BONE DICE =================
  build3DDice() {
    this.diceMeshes = [];
    for (let i = 0; i < 2; i++) {
      let geo;
      if (THREE.RoundedBoxGeometry) {
        geo = new THREE.RoundedBoxGeometry(1.22, 1.22, 1.22, 6, 0.22);
      } else {
        geo = new THREE.BoxGeometry(1.22, 1.22, 1.22);
      }

      const materials = [
        this.createBoneDiceFace(1), // right (+X)
        this.createBoneDiceFace(6), // left (-X)
        this.createBoneDiceFace(2), // top (+Y)
        this.createBoneDiceFace(5), // bottom (-Y)
        this.createBoneDiceFace(3), // front (+Z)
        this.createBoneDiceFace(4)  // back (-Z)
      ];
      const die = new THREE.Mesh(geo, materials);
      die.castShadow = true;
      die.receiveShadow = true;
      die.position.set((i === 0 ? -1.35 : 1.35), 0.75, 0);
      const r = this.getFaceRotation(1);
      die.rotation.set(r.x, r.y, r.z);
      this.scene.add(die);
      this.diceMeshes.push(die);
    }
  }

  createBoneDiceFace(dots) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f6f1de";
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = (dots === 1) ? "#8c2018" : "#1a120c";
    const dot = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, 42, 0, Math.PI * 2);
      ctx.fill();
    };

    if (dots === 1) dot(256, 256);
    if (dots === 2) { dot(140, 140); dot(372, 372); }
    if (dots === 3) { dot(130, 130); dot(256, 256); dot(382, 382); }
    if (dots === 4) { dot(140, 140); dot(372, 140); dot(140, 372); dot(372, 372); }
    if (dots === 5) { dot(140, 140); dot(372, 140); dot(256, 256); dot(140, 372); dot(372, 372); }
    if (dots === 6) { dot(140, 120); dot(372, 120); dot(140, 256); dot(372, 256); dot(140, 392); dot(372, 392); }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0.05
    });
  }

  getFaceRotation(value) {
    switch (value) {
      case 1: return { x: 0, y: 0, z: Math.PI / 2 };
      case 6: return { x: 0, y: 0, z: -Math.PI / 2 };
      case 2: return { x: 0, y: 0, z: 0 };
      case 5: return { x: Math.PI, y: 0, z: 0 };
      case 3: return { x: -Math.PI / 2, y: 0, z: 0 };
      case 4: return { x: Math.PI / 2, y: 0, z: 0 };
      default: return { x: 0, y: 0, z: 0 };
    }
  }

  setDiceFaces(d1, d2) {
    if (!this.diceMeshes || this.diceMeshes.length < 2) return;
    const r1 = this.getFaceRotation(d1 || 1);
    const r2 = this.getFaceRotation(d2 || 1);
    this.diceMeshes[0].rotation.set(r1.x, r1.y, r1.z);
    this.diceMeshes[0].position.y = 0.75;
    this.diceMeshes[1].rotation.set(r2.x, r2.y, r2.z);
    this.diceMeshes[1].position.y = 0.75;
  }

  roll3DDice(d1, d2, onComplete) {
    this.isRolling = true;
    const duration = 1500; // 1.5 seconds of physical tumbling & bouncing
    const startTime = performance.now();

    // Target rotations for the resting face
    const tRot1 = this.getFaceRotation(d1 || 1);
    const tRot2 = this.getFaceRotation(d2 || 1);

    // Resting positions on the felt table
    const restY = 0.78;
    const endPos1 = new THREE.Vector3(-1.35, restY, 0.15);
    const endPos2 = new THREE.Vector3(1.35, restY, -0.15);

    // Initial throw toss positions (tossed from above and behind)
    const startPos1 = new THREE.Vector3(-2.8, 4.8, 3.2);
    const startPos2 = new THREE.Vector3(2.6, 5.2, 3.0);

    // Intermediate bounce impact positions on the felt table
    const bounce1Pos1 = new THREE.Vector3(-1.8, restY, 1.2);
    const bounce1Pos2 = new THREE.Vector3(1.8, restY, 1.1);

    const bounce2Pos1 = new THREE.Vector3(-1.45, restY, 0.45);
    const bounce2Pos2 = new THREE.Vector3(1.45, restY, 0.35);

    // Number of full 360-degree tumbling flips for each axis
    // Because each is an exact multiple of 2*PI, (tRot + flips * 2*PI) === tRot orientation!
    const flips1 = { x: 3, y: 2, z: 3 };
    const flips2 = { x: 4, y: 3, z: 2 };

    // Natural subtle resting yaw so dice don't look machine-aligned, while top face is 100% straight UP (+Y)
    const restingYaw1 = 0.14; // ~8 degrees
    const restingYaw2 = -0.18; // ~-10 degrees

    let bounce1Sound = false;
    let bounce2Sound = false;
    let bounce3Sound = false;

    const animateDice = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      // Smooth cubic ease-out deceleration curve for rotation (air and felt friction)
      // As progress -> 1, rotation progress -> 1 smoothly with zero angular velocity at rest!
      const rotProgress = 1.0 - Math.pow(1.0 - progress, 2.8);
      const remainingRotFactor = 1.0 - rotProgress;

      // Update both dice
      [0, 1].forEach((idx) => {
        const die = this.diceMeshes[idx];
        if (!die) return;

        const isDie1 = (idx === 0);
        const tRot = isDie1 ? tRot1 : tRot2;
        const flips = isDie1 ? flips1 : flips2;
        const yaw = isDie1 ? restingYaw1 : restingYaw2;

        let curX, curY, curZ;

        // ===== 1. KINEMATIC GRAVITY BOUNCE PHASES =====
        if (progress < 0.40) {
          // Phase 1: Initial Free Fall under Gravity to Felt Table (0.0 to 0.40)
          const p1 = progress / 0.40;
          const fallH = isDie1 ? 4.02 : 4.42;
          curY = restY + fallH * (1.0 - p1 * p1);

          const startP = isDie1 ? startPos1 : startPos2;
          const b1P = isDie1 ? bounce1Pos1 : bounce1Pos2;
          curX = THREE.MathUtils.lerp(startP.x, b1P.x, p1);
          curZ = THREE.MathUtils.lerp(startP.z, b1P.z, p1);

        } else if (progress < 0.72) {
          // Phase 2: First High Rebound & Forward Slide (0.40 to 0.72)
          const p2 = (progress - 0.40) / 0.32;
          const bounceH = isDie1 ? 1.55 : 1.70;
          // Parabolic arc of gravity: 4 * h * p * (1 - p)
          curY = restY + 4.0 * bounceH * p2 * (1.0 - p2);

          const b1P = isDie1 ? bounce1Pos1 : bounce1Pos2;
          const b2P = isDie1 ? bounce2Pos1 : bounce2Pos2;
          curX = THREE.MathUtils.lerp(b1P.x, b2P.x, p2);
          curZ = THREE.MathUtils.lerp(b1P.z, b2P.z, p2);

        } else if (progress < 0.90) {
          // Phase 3: Secondary Micro-Bounce & Settling (0.72 to 0.90)
          const p3 = (progress - 0.72) / 0.18;
          const bounceH = isDie1 ? 0.38 : 0.42;
          curY = restY + 4.0 * bounceH * p3 * (1.0 - p3);

          const b2P = isDie1 ? bounce2Pos1 : bounce2Pos2;
          const endP = isDie1 ? endPos1 : endPos2;
          curX = THREE.MathUtils.lerp(b2P.x, endP.x, p3);
          curZ = THREE.MathUtils.lerp(b2P.z, endP.z, p3);

        } else {
          // Phase 4: At Rest Flat on Felt Table (0.90 to 1.0)
          const endP = isDie1 ? endPos1 : endPos2;
          curX = endP.x;
          curY = restY;
          curZ = endP.z;
        }

        die.position.set(curX, curY, curZ);

        // ===== 2. CONTINUOUS ROTATION WITHOUT ANY SNAPPING =====
        // Continuous formula: targetAngle + (flips * 2*PI * remainingRotFactor)
        // At progress = 1: remainingRotFactor === 0 -> angle is EXACTLY targetAngle!
        // No snap, no pop, continuous deceleration to zero angular velocity!
        const rotX = tRot.x + flips.x * Math.PI * 2 * remainingRotFactor;
        const rotY = tRot.y + yaw + flips.y * Math.PI * 2 * remainingRotFactor;
        const rotZ = tRot.z + flips.z * Math.PI * 2 * remainingRotFactor;

        die.rotation.set(rotX, rotY, rotZ);
      });

      // Synchronized audio triggers on exact felt impacts
      if (progress >= 0.40 && !bounce1Sound) {
        bounce1Sound = true;
        if (window.sounds) {
          if (window.sounds.playDiceImpact) window.sounds.playDiceImpact(1);
          else window.sounds.playDice();
        }
        this.spawnHopParticles(-1.8, 1.2, 0xdfd3b8);
        this.spawnHopParticles(1.8, 1.1, 0xdfd3b8);
      }

      if (progress >= 0.72 && !bounce2Sound) {
        bounce2Sound = true;
        if (window.sounds) {
          if (window.sounds.playDiceImpact) window.sounds.playDiceImpact(2);
          else window.sounds.playDice();
        }
      }

      if (progress >= 0.90 && !bounce3Sound) {
        bounce3Sound = true;
        if (window.sounds) {
          if (window.sounds.playDiceImpact) window.sounds.playDiceImpact(3);
        }
      }

      if (progress < 1.0) {
        requestAnimationFrame(animateDice);
      } else {
        // Enforce final resting state (100% flat on felt table)
        this.diceMeshes.forEach((die, idx) => {
          const isDie1 = (idx === 0);
          const tRot = isDie1 ? tRot1 : tRot2;
          const endP = isDie1 ? endPos1 : endPos2;
          const yaw = isDie1 ? restingYaw1 : restingYaw2;
          die.position.set(endP.x, restY, endP.z);
          die.rotation.set(tRot.x, tRot.y + yaw, tRot.z);
        });

        this.isRolling = false;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animateDice);
  }

  // ================= ANIMATE CARD DRAW FROM 3D DECK =================
  animateDrawCard(type, onComplete) {
    const isChance = (type === "chance" || type === "Chance");
    const card = isChance ? this.chanceTopCard : this.chestTopCard;
    if (!card) {
      if (onComplete) onComplete();
      return;
    }

    const startY = card.position.y;
    const startRotY = card.rotation.y;
    const duration = 650;
    const startTime = performance.now();

    if (window.sounds) window.sounds.playCard();

    const anim = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const arc = Math.sin(progress * Math.PI);
      card.position.y = startY + arc * 2.4;
      card.rotation.y = startRotY + arc * 0.45;

      if (progress < 1) {
        requestAnimationFrame(anim);
      } else {
        card.position.y = startY;
        card.rotation.y = startRotY;
        if (onComplete) onComplete();
      }
    };
    requestAnimationFrame(anim);
  }

  // ================= SYNC PLAYERS & TOKENS =================
  syncPlayers(players, lastMove, onHopComplete) {
    if (!players) return;

    if (!this.modelsReady) {
      this.pendingPlayers = { players, lastMove, onHopComplete };
      return;
    }

    const tileOccupants = {};
    players.forEach(p => {
      if (!p.bankrupt) {
        if (!tileOccupants[p.position]) tileOccupants[p.position] = [];
        tileOccupants[p.position].push(p);
      }
    });

    let hopTriggered = false;

    players.forEach((p) => {
      let tokenObj = this.tokens.get(p.id);
      const occupants = tileOccupants[p.position] || [];
      const occIndex = occupants.findIndex(o => o.id === p.id);
      const occCount = occupants.length;

      if (!tokenObj) {
        tokenObj = this.create3DTokenMesh(p.token, p.color);
        this.scene.add(tokenObj);
        this.tokens.set(p.id, tokenObj);
        this.placeTokenOnTile(tokenObj, p.position, Math.max(0, occIndex), occCount);
      } else {
        if (lastMove && lastMove.playerId === p.id && tokenObj.userData.lastAnimatedMove !== lastMove.timestamp) {
          tokenObj.userData.lastAnimatedMove = lastMove.timestamp;
          hopTriggered = true;
          this.animateTokenHopSequence(tokenObj, lastMove.from, lastMove.to, Math.max(0, occIndex), occCount, players, onHopComplete);
        } else if (!tokenObj.userData.isAnimating) {
          this.placeTokenOnTile(tokenObj, p.position, Math.max(0, occIndex), occCount);
        }
      }

      tokenObj.visible = !p.bankrupt;
    });

    if (!hopTriggered && onHopComplete) {
      onHopComplete();
    }

    for (const [id, mesh] of this.tokens.entries()) {
      if (!players.some(p => p.id === id)) {
        this.scene.remove(mesh);
        this.tokens.delete(id);
      }
    }
  }

  computeTileOffset(tileId, occIndex, occCount) {
    if (occCount <= 1) return { x: 0, z: 0 };
    const t = this.tilePositions[tileId];
    const isCorner = t ? t.isCorner : false;
    const side = t ? t.side : "bottom";

    if (isCorner) {
      const radius = 0.55;
      const angle = (occIndex / occCount) * Math.PI * 2;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    }

    const maxSpread = 0.70;
    const delta = ((occIndex - (occCount - 1) / 2) / (occCount - 1 || 1)) * maxSpread;

    if (side === "bottom" || side === "top") {
      return { x: delta, z: 0 };
    } else {
      return { x: 0, z: delta };
    }
  }

  placeTokenOnTile(tokenObj, tileId, occIndex = 0, occCount = 1) {
    const t = this.tilePositions[tileId];
    if (!t) return;
    const offset = this.computeTileOffset(tileId, occIndex, occCount);
    tokenObj.position.set(t.x + offset.x, 0.28, t.z + offset.z);
    tokenObj.rotation.y = (t.tokenFacingY !== undefined ? t.tokenFacingY : t.rotY);
  }

  animateTokenHopSequence(tokenObj, fromTile, toTile, occIndex, occCount, allPlayers, onComplete) {
    tokenObj.userData.isAnimating = true;

    const path = [];
    let cur = fromTile;
    const totalSpaces = 40;
    const steps = (toTile >= fromTile) ? (toTile - fromTile) : (totalSpaces - fromTile + toTile);

    for (let s = 1; s <= steps; s++) {
      cur = (fromTile + s) % totalSpaces;
      path.push(cur);
    }

    if (path.length === 0) {
      tokenObj.userData.isAnimating = false;
      this.placeTokenOnTile(tokenObj, toTile, occIndex, occCount);
      if (onComplete) onComplete();
      return;
    }

    let stepIdx = 0;
    const hopDuration = 280; // Snappy 280ms per hop

    const hopNext = () => {
      if (stepIdx >= path.length) {
        tokenObj.userData.isAnimating = false;
        this.placeTokenOnTile(tokenObj, toTile, occIndex, occCount);
        this.spawnHopParticles(tokenObj.position.x, tokenObj.position.z, 0xdfd3b8);
        if (onComplete) onComplete();
        return;
      }

      const targetTile = path[stepIdx];
      const isFinal = (stepIdx === path.length - 1);
      const startPos = tokenObj.position.clone();
      const t = this.tilePositions[targetTile];
      const targetOffset = isFinal ? this.computeTileOffset(targetTile, occIndex, occCount) : { x: 0, z: 0 };
      const destPos = new THREE.Vector3(t.x + targetOffset.x, 0.28, t.z + targetOffset.z);

      // Rotate token towards direction of hop
      tokenObj.rotation.y = (t.tokenFacingY !== undefined ? t.tokenFacingY : t.rotY);

      const startTime = performance.now();

      const hopStep = (now) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / hopDuration);

        tokenObj.position.x = THREE.MathUtils.lerp(startPos.x, destPos.x, p);
        tokenObj.position.z = THREE.MathUtils.lerp(startPos.z, destPos.z, p);
        tokenObj.position.y = 0.28 + Math.sin(p * Math.PI) * 0.95;

        if (p < 1) {
          requestAnimationFrame(hopStep);
        } else {
          tokenObj.position.copy(destPos);
          if (window.sounds) window.sounds.playStep();
          this.spawnHopParticles(destPos.x, destPos.z, 0xdfd3b8);
          this.depressTile(targetTile);
          stepIdx++;
          setTimeout(hopNext, 30);
        }
      };

      requestAnimationFrame(hopStep);
    };

    hopNext();
  }

  spawnHopParticles(x, z, colorHex) {
    const count = 2; // Toned down to 2 very subtle dust motes
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0.3;
      positions[i * 3 + 2] = z;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.03;
      velocities.push({
        vx: Math.cos(angle) * speed,
        vy: 0.03 + Math.random() * 0.04,
        vz: Math.sin(angle) * speed
      });
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: colorHex || 0xdfd3b8,
      size: 0.038,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.particleSystems.push({
      mesh: pSystem,
      velocities,
      lifetime: 14,
      age: 0
    });
  }

  spawnGoldCoinFountain() {
    const count = 50;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.22;
      velocities.push({
        vx: Math.cos(angle) * speed,
        vy: 0.25 + Math.random() * 0.35,
        vz: Math.sin(angle) * speed
      });
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.28,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.particleSystems.push({
      mesh: pSystem,
      velocities,
      startTime: performance.now(),
      lifetime: 1400
    });
  }

  updateParticles() {
    const now = performance.now();

    for (let i = this.particleSystems.length - 1; i >= 0; i--) {
      const ps = this.particleSystems[i];
      const elapsed = now - ps.startTime;
      const progress = elapsed / ps.lifetime;

      if (progress >= 1) {
        this.scene.remove(ps.mesh);
        ps.mesh.geometry.dispose();
        ps.mesh.material.dispose();
        this.particleSystems.splice(i, 1);
        continue;
      }

      const positions = ps.mesh.geometry.attributes.position.array;
      const vels = ps.velocities;

      for (let j = 0; j < vels.length; j++) {
        positions[j * 3] += vels[j].vx;
        positions[j * 3 + 1] += vels[j].vy;
        positions[j * 3 + 2] += vels[j].vz;
        vels[j].vy -= 0.006;
      }

      ps.mesh.geometry.attributes.position.needsUpdate = true;
      ps.mesh.material.opacity = 1 - progress;
    }

    // Atmospheric Saloon Air Dust Motes Drift
    if (this.dustParticles && this.dustMoteData) {
      const pos = this.dustParticles.geometry.attributes.position.array;
      const count = this.dustMoteData.length;
      for (let i = 0; i < count; i++) {
        const d = this.dustMoteData[i];
        pos[i * 3 + 1] += d.speedY;
        if (pos[i * 3 + 1] > 16) pos[i * 3 + 1] = 0.8;

        pos[i * 3] = d.baseX + Math.sin(now * 0.0008 * d.swaySpeed + d.seed) * 1.2;
        pos[i * 3 + 2] = d.baseZ + Math.cos(now * 0.0008 * d.swaySpeed + d.seed) * 1.2;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ================= TACTILE TILE BUTTON / PRESSURE PLATE EFFECT =================
  depressTile(tileId, amount = 0.055) {
    if (!this.tiles || !this.tiles[tileId]) return;
    const tileMesh = this.tiles[tileId];
    if (!this.depressedTiles) this.depressedTiles = new Map();
    this.depressedTiles.set(tileId, { current: amount, base: 0.1 });
    tileMesh.position.y = 0.1 - amount;
  }

  updateTilePressurePlates() {
    if (!this.depressedTiles || this.depressedTiles.size === 0) return;
    for (const [tileId, entry] of this.depressedTiles.entries()) {
      const tileMesh = this.tiles[tileId];
      if (!tileMesh) {
        this.depressedTiles.delete(tileId);
        continue;
      }
      entry.current = THREE.MathUtils.lerp(entry.current, 0, 0.18);
      tileMesh.position.y = entry.base - entry.current;
      if (entry.current < 0.001) {
        tileMesh.position.y = entry.base;
        this.depressedTiles.delete(tileId);
      }
    }
  }

  // ================= RAYCASTING & 3D TITLE DEED INTERACTION =================
  setupInteraction() {
    this.renderer.domElement.addEventListener("click", (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.tiles);

      if (intersects.length > 0) {
        const hitTile = intersects[0].object;
        this.onTileClick(hitTile);
      }
    });
  }

  onTileClick(tileMesh) {
    if (!tileMesh || !tileMesh.userData) return;
    const tileId = tileMesh.userData.tileId;
    this.depressTile(tileId);
    if (window.sounds) window.sounds.playCard();
    this.openTitleDeedCard(tileId);
  }

  openTitleDeedCard(tileId) {
    if (window.showTitleDeedModal) {
      window.showTitleDeedModal(tileId);
    }
  }

  focusOnPlayerToken(playerId) {
    if (this.cameraMode !== "auto") return;
    const tokenObj = this.tokens.get(playerId);
    if (!tokenObj) return;

    const tx = tokenObj.position.x;
    const tz = tokenObj.position.z;

    const camX = tx * 0.65 - 2.2;
    const camY = 19;
    const camZ = tz * 0.65 + 17;

    this.smoothTransitionCamera(camX, camY, camZ, tx - 1.2, 0, tz);
  }

  // ================= CINEMATIC CAMERA MODES =================
  setCameraMode(mode) {
    this.cameraMode = mode;
    if (this.controls) {
      this.controls.enabled = (mode === "free");
    }

    if (mode === "auto") {
      this.resetCameraOverview();
    } else if (mode === "saloon") {
      this.smoothTransitionCamera(-2.4, 10, 24, -2.4, 1.2, 0);
    } else if (mode === "overview") {
      this.smoothTransitionCamera(-2.4, 30, 26, -2.4, 0, 0);
    }
  }

  smoothTransitionCamera(tx, ty, tz, lx, ly, lz, duration = 1200) {
    const startPos = this.camera.position.clone();
    const startTarget = (this.cameraTarget || new THREE.Vector3(-2.4, 0, 0)).clone();
    const destTarget = new THREE.Vector3(lx, ly, lz);
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = 0.5 - Math.cos(p * Math.PI) / 2;

      this.camera.position.x = THREE.MathUtils.lerp(startPos.x, tx, ease);
      this.camera.position.y = THREE.MathUtils.lerp(startPos.y, ty, ease);
      this.camera.position.z = THREE.MathUtils.lerp(startPos.z, tz, ease);

      const curX = THREE.MathUtils.lerp(startTarget.x, destTarget.x, ease);
      const curY = THREE.MathUtils.lerp(startTarget.y, destTarget.y, ease);
      const curZ = THREE.MathUtils.lerp(startTarget.z, destTarget.z, ease);
      this.cameraTarget = new THREE.Vector3(curX, curY, curZ);

      this.camera.lookAt(this.cameraTarget);

      if (p < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  resetCameraOverview() {
    this.smoothTransitionCamera(-2.2, 25, 27, -2.2, 0, 1.4);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = performance.now() * 0.001; // seconds

    // 1. Subtle overhead lantern flicker
    if (this.lanternLight) {
      const flicker = Math.sin(time * 7.0) * 0.05 + Math.sin(time * 19.0) * 0.03;
      const base = (this.lanternLight.userData && this.lanternLight.userData.baseIntensity) || 0.65;
      this.lanternLight.intensity = base + flicker * 0.4;
    }

    // 2. Realistic Ethereal Flame Shader Time Uniform Updates
    if (this.animatedFlames && this.animatedFlames.length > 0) {
      this.animatedFlames.forEach((mat) => {
        mat.uniforms.uTime.value = time;
      });
    }

    // 3. Flame Radial Glow Coronas Pulsing in sync with flames
    if (this.flameCoronas && this.flameCoronas.length > 0) {
      this.flameCoronas.forEach(({ sprite, baseScale, seed }) => {
        const pulse = 1.0 + Math.sin(time * 6.5 + seed) * 0.12 + Math.cos(time * 12.0 + seed) * 0.06;
        sprite.scale.set(baseScale * pulse, baseScale * pulse, 1);
        sprite.material.opacity = 0.65 + Math.sin(time * 8.0 + seed) * 0.18;
      });
    }

    // 4. Dynamic Candle & Lantern PointLight Organic Subtle Flicker
    if (this.candleLights && this.candleLights.length > 0) {
      this.candleLights.forEach((light) => {
        const seed = light.userData.seed || 0;
        const base = light.userData.baseIntensity || 1.2;
        const flicker = Math.sin(time * 15.0 + seed) * 0.08 + Math.sin(time * 32.0 + seed * 2.0) * 0.04;
        light.intensity = base * (1.0 + flicker);
      });
    }

    if (this.controls && this.controls.enabled) {
      this.controls.update();
    }

    this.updateTilePressurePlates();
    this.updateParticles();
    this.renderer.render(this.scene, this.camera);
  }
}

window.Monopoly3DScene = Monopoly3DScene;
