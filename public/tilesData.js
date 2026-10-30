// 40 Classic Monopoly Tiles Specifications and Rich Deed Data
const TILES_DEF = [
  {
    "id": 0,
    "name": "GO",
    "type": "corner",
    "subtext": "COLLECT $200 AS YOU PASS",
    "color": null
  },
  {
    "id": 1,
    "name": "Mediterranean Ave",
    "type": "property",
    "group": "brown",
    "cost": 60,
    "rents": [
      2,
      10,
      30,
      90,
      160,
      250
    ],
    "houseCost": 50,
    "mortgage": 30,
    "color": "#8B4513"
  },
  {
    "id": 2,
    "name": "Community Chest",
    "type": "chest",
    "subtext": "FOLLOW INSTRUCTIONS ON TOP CARD",
    "color": null
  },
  {
    "id": 3,
    "name": "Baltic Ave",
    "type": "property",
    "group": "brown",
    "cost": 60,
    "rents": [
      4,
      20,
      60,
      180,
      320,
      450
    ],
    "houseCost": 50,
    "mortgage": 30,
    "color": "#8B4513"
  },
  {
    "id": 4,
    "name": "Income Tax",
    "type": "tax",
    "amount": 200,
    "subtext": "PAY $200",
    "color": null
  },
  {
    "id": 5,
    "name": "Reading Railroad",
    "type": "railroad",
    "group": "railroad",
    "cost": 200,
    "rents": [
      25,
      50,
      100,
      200
    ],
    "mortgage": 100,
    "color": "#000000"
  },
  {
    "id": 6,
    "name": "Oriental Ave",
    "type": "property",
    "group": "light_blue",
    "cost": 100,
    "rents": [
      6,
      30,
      90,
      270,
      400,
      550
    ],
    "houseCost": 50,
    "mortgage": 50,
    "color": "#87CEEB"
  },
  {
    "id": 7,
    "name": "Chance",
    "type": "chance",
    "subtext": "?",
    "color": null
  },
  {
    "id": 8,
    "name": "Vermont Ave",
    "type": "property",
    "group": "light_blue",
    "cost": 100,
    "rents": [
      6,
      30,
      90,
      270,
      400,
      550
    ],
    "houseCost": 50,
    "mortgage": 50,
    "color": "#87CEEB"
  },
  {
    "id": 9,
    "name": "Connecticut Ave",
    "type": "property",
    "group": "light_blue",
    "cost": 120,
    "rents": [
      8,
      40,
      100,
      300,
      450,
      600
    ],
    "houseCost": 50,
    "mortgage": 60,
    "color": "#87CEEB"
  },
  {
    "id": 10,
    "name": "Just Visiting / In Jail",
    "type": "corner",
    "subtext": "VISITING / IN JAIL",
    "color": null
  },
  {
    "id": 11,
    "name": "St. Charles Place",
    "type": "property",
    "group": "pink",
    "cost": 140,
    "rents": [
      10,
      50,
      150,
      450,
      625,
      750
    ],
    "houseCost": 100,
    "mortgage": 70,
    "color": "#D81B60"
  },
  {
    "id": 12,
    "name": "Electric Company",
    "type": "utility",
    "group": "utility",
    "cost": 150,
    "mortgage": 75,
    "color": "#B0BEC5"
  },
  {
    "id": 13,
    "name": "States Ave",
    "type": "property",
    "group": "pink",
    "cost": 140,
    "rents": [
      10,
      50,
      150,
      450,
      625,
      750
    ],
    "houseCost": 100,
    "mortgage": 70,
    "color": "#D81B60"
  },
  {
    "id": 14,
    "name": "Virginia Ave",
    "type": "property",
    "group": "pink",
    "cost": 160,
    "rents": [
      12,
      60,
      180,
      500,
      700,
      900
    ],
    "houseCost": 100,
    "mortgage": 80,
    "color": "#D81B60"
  },
  {
    "id": 15,
    "name": "Pennsylvania RR",
    "type": "railroad",
    "group": "railroad",
    "cost": 200,
    "rents": [
      25,
      50,
      100,
      200
    ],
    "mortgage": 100,
    "color": "#000000"
  },
  {
    "id": 16,
    "name": "St. James Place",
    "type": "property",
    "group": "orange",
    "cost": 180,
    "rents": [
      14,
      70,
      200,
      550,
      750,
      950
    ],
    "houseCost": 100,
    "mortgage": 90,
    "color": "#FB8C00"
  },
  {
    "id": 17,
    "name": "Community Chest",
    "type": "chest",
    "subtext": "FOLLOW INSTRUCTIONS ON TOP CARD",
    "color": null
  },
  {
    "id": 18,
    "name": "Tennessee Ave",
    "type": "property",
    "group": "orange",
    "cost": 180,
    "rents": [
      14,
      70,
      200,
      550,
      750,
      950
    ],
    "houseCost": 100,
    "mortgage": 90,
    "color": "#FB8C00"
  },
  {
    "id": 19,
    "name": "New York Ave",
    "type": "property",
    "group": "orange",
    "cost": 200,
    "rents": [
      16,
      80,
      220,
      600,
      800,
      1000
    ],
    "houseCost": 100,
    "mortgage": 100,
    "color": "#FB8C00"
  },
  {
    "id": 20,
    "name": "Free Parking",
    "type": "corner",
    "subtext": "FREE RESTING PLACE",
    "color": null
  },
  {
    "id": 21,
    "name": "Kentucky Ave",
    "type": "property",
    "group": "red",
    "cost": 220,
    "rents": [
      18,
      90,
      250,
      700,
      875,
      1050
    ],
    "houseCost": 150,
    "mortgage": 110,
    "color": "#E53935"
  },
  {
    "id": 22,
    "name": "Chance",
    "type": "chance",
    "subtext": "?",
    "color": null
  },
  {
    "id": 23,
    "name": "Indiana Ave",
    "type": "property",
    "group": "red",
    "cost": 220,
    "rents": [
      18,
      90,
      250,
      700,
      875,
      1050
    ],
    "houseCost": 150,
    "mortgage": 110,
    "color": "#E53935"
  },
  {
    "id": 24,
    "name": "Illinois Ave",
    "type": "property",
    "group": "red",
    "cost": 240,
    "rents": [
      20,
      100,
      300,
      750,
      925,
      1100
    ],
    "houseCost": 150,
    "mortgage": 120,
    "color": "#E53935"
  },
  {
    "id": 25,
    "name": "B. & O. Railroad",
    "type": "railroad",
    "group": "railroad",
    "cost": 200,
    "rents": [
      25,
      50,
      100,
      200
    ],
    "mortgage": 100,
    "color": "#000000"
  },
  {
    "id": 26,
    "name": "Atlantic Ave",
    "type": "property",
    "group": "yellow",
    "cost": 260,
    "rents": [
      22,
      110,
      330,
      800,
      975,
      1150
    ],
    "houseCost": 150,
    "mortgage": 130,
    "color": "#FDD835"
  },
  {
    "id": 27,
    "name": "Ventnor Ave",
    "type": "property",
    "group": "yellow",
    "cost": 260,
    "rents": [
      22,
      110,
      330,
      800,
      975,
      1150
    ],
    "houseCost": 150,
    "mortgage": 130,
    "color": "#FDD835"
  },
  {
    "id": 28,
    "name": "Water Works",
    "type": "utility",
    "group": "utility",
    "cost": 150,
    "mortgage": 75,
    "color": "#B0BEC5"
  },
  {
    "id": 29,
    "name": "Marvin Gardens",
    "type": "property",
    "group": "yellow",
    "cost": 280,
    "rents": [
      24,
      120,
      360,
      850,
      1025,
      1200
    ],
    "houseCost": 150,
    "mortgage": 140,
    "color": "#FDD835"
  },
  {
    "id": 30,
    "name": "Go To Jail",
    "type": "corner",
    "subtext": "GO DIRECTLY TO JAIL",
    "color": null
  },
  {
    "id": 31,
    "name": "Pacific Ave",
    "type": "property",
    "group": "green",
    "cost": 300,
    "rents": [
      26,
      130,
      390,
      900,
      1100,
      1275
    ],
    "houseCost": 200,
    "mortgage": 150,
    "color": "#43A047"
  },
  {
    "id": 32,
    "name": "North Carolina Ave",
    "type": "property",
    "group": "green",
    "cost": 300,
    "rents": [
      26,
      130,
      390,
      900,
      1100,
      1275
    ],
    "houseCost": 200,
    "mortgage": 150,
    "color": "#43A047"
  },
  {
    "id": 33,
    "name": "Community Chest",
    "type": "chest",
    "subtext": "FOLLOW INSTRUCTIONS ON TOP CARD",
    "color": null
  },
  {
    "id": 34,
    "name": "Pennsylvania Ave",
    "type": "property",
    "group": "green",
    "cost": 320,
    "rents": [
      28,
      150,
      450,
      1000,
      1200,
      1400
    ],
    "houseCost": 200,
    "mortgage": 160,
    "color": "#43A047"
  },
  {
    "id": 35,
    "name": "Short Line Railroad",
    "type": "railroad",
    "group": "railroad",
    "cost": 200,
    "rents": [
      25,
      50,
      100,
      200
    ],
    "mortgage": 100,
    "color": "#000000"
  },
  {
    "id": 36,
    "name": "Chance",
    "type": "chance",
    "subtext": "?",
    "color": null
  },
  {
    "id": 37,
    "name": "Park Place",
    "type": "property",
    "group": "dark_blue",
    "cost": 350,
    "rents": [
      35,
      175,
      500,
      1100,
      1300,
      1500
    ],
    "houseCost": 200,
    "mortgage": 175,
    "color": "#1E88E5"
  },
  {
    "id": 38,
    "name": "Luxury Tax",
    "type": "tax",
    "amount": 100,
    "subtext": "PAY $100",
    "color": null
  },
  {
    "id": 39,
    "name": "Boardwalk",
    "type": "property",
    "group": "dark_blue",
    "cost": 400,
    "rents": [
      50,
      200,
      600,
      1400,
      1700,
      2000
    ],
    "houseCost": 200,
    "mortgage": 200,
    "color": "#1E88E5"
  }
];
window.TILES_DEF = TILES_DEF;

// Build fast DEED_DATA lookup
window.DEED_DATA = {};
TILES_DEF.forEach(t => {
  if (t.rents) {
    window.DEED_DATA[t.id] = {
      rent: t.rents[0],
      h1: t.rents[1],
      h2: t.rents[2],
      h3: t.rents[3],
      h4: t.rents[4],
      hotel: t.rents[5],
      houseCost: t.houseCost || 100,
      mortgage: t.mortgage || Math.floor((t.cost || 100) / 2)
    };
  }
});

const GROUP_MEMBERS = {
  brown: [1, 3],
  light_blue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  dark_blue: [37, 39],
  railroad: [5, 15, 25, 35],
  utility: [12, 28]
};
window.GROUP_MEMBERS = GROUP_MEMBERS;
