// Chance and Community Chest cards definitions and execution

const CHANCE_CARDS = [
  {
    id: "ch_go",
    text: "Advance to GO. Collect $200.",
    action: (engine, player) => {
      engine.movePlayerTo(player, 0, true);
    }
  },
  {
    id: "ch_illinois",
    text: "Advance to Illinois Ave. If you pass GO, collect $200.",
    action: (engine, player) => {
      engine.movePlayerTo(player, 24, true);
    }
  },
  {
    id: "ch_st_charles",
    text: "Advance to St. Charles Place. If you pass GO, collect $200.",
    action: (engine, player) => {
      engine.movePlayerTo(player, 11, true);
    }
  },
  {
    id: "ch_utility",
    text: "Advance token to nearest Utility. If unowned, you may buy it. If owned, throw dice and pay owner 10x the amount thrown.",
    action: (engine, player) => {
      const pos = player.position;
      const target = (pos > 12 && pos < 28) ? 28 : 12;
      engine.movePlayerTo(player, target, true, { utilityMultiplier: 10 });
    }
  },
  {
    id: "ch_railroad",
    text: "Advance token to the nearest Railroad and pay owner twice the rental to which he/she is otherwise entitled.",
    action: (engine, player) => {
      const pos = player.position;
      let target;
      if (pos < 5 || pos >= 35) target = 5;
      else if (pos < 15) target = 15;
      else if (pos < 25) target = 25;
      else target = 35;
      engine.movePlayerTo(player, target, true, { doubleRent: true });
    }
  },
  {
    id: "ch_bank_dividend",
    text: "Bank pays you dividend of $50.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 50); else player.money += 50;
      engine.log(`${player.name} received $50 dividend from the Bank.`);
    }
  },
  {
    id: "ch_get_out_jail",
    text: "Get Out of Jail Free. This card may be kept until needed or traded.",
    action: (engine, player) => {
      player.jailCards = (player.jailCards || 0) + 1;
      engine.log(`${player.name} received a Get Out of Jail Free card.`);
    }
  },
  {
    id: "ch_back_3",
    text: "Go Back 3 Spaces.",
    action: (engine, player) => {
      const target = (player.position - 3 + 40) % 40;
      engine.movePlayerTo(player, target, false);
    }
  },
  {
    id: "ch_jail",
    text: "Go to Jail. Go directly to Jail. Do not pass GO, do not collect $200.",
    action: (engine, player) => {
      engine.sendToJail(player);
    }
  },
  {
    id: "ch_repairs",
    text: "Make general repairs on all your property. For each house pay $25, for each hotel pay $100.",
    action: (engine, player) => {
      const cost = engine.calculateRepairs(player, 25, 100);
      engine.chargePlayer(player, cost, null, "Property Repairs");
    }
  },
  {
    id: "ch_speeding",
    text: "Speeding fine. Pay $15.",
    action: (engine, player) => {
      engine.chargePlayer(player, 15, null, "Speeding Fine");
    }
  },
  {
    id: "ch_reading",
    text: "Take a trip to Reading Railroad. If you pass GO, collect $200.",
    action: (engine, player) => {
      engine.movePlayerTo(player, 5, true);
    }
  },
  {
    id: "ch_boardwalk",
    text: "Advance to Boardwalk.",
    action: (engine, player) => {
      engine.movePlayerTo(player, 39, false);
    }
  },
  {
    id: "ch_chairman",
    text: "You have been elected Chairman of the Board. Pay each player $50.",
    action: (engine, player) => {
      const others = engine.players.filter(p => p.id !== player.id && !p.bankrupt);
      const total = others.length * 50;
      engine.chargePlayer(player, total, null, "Elected Chairman", () => {
        others.forEach(p => p.money += 50);
      });
    }
  },
  {
    id: "ch_loan",
    text: "Your building loan matures. Collect $150.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 150); else player.money += 150;
      engine.log(`${player.name} collected $150 building loan maturity.`);
    }
  }
];

const COMMUNITY_CHEST_CARDS = [
  {
    id: "cc_go",
    text: "Advance to GO. Collect $200.",
    action: (engine, player) => {
      engine.movePlayerTo(player, 0, true);
    }
  },
  {
    id: "cc_bank_error",
    text: "Bank error in your favor. Collect $200.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 200); else player.money += 200;
      engine.log(`${player.name} collected $200 from bank error.`);
    }
  },
  {
    id: "cc_doctor",
    text: "Doctor's fee. Pay $50.",
    action: (engine, player) => {
      engine.chargePlayer(player, 50, null, "Doctor's fee");
    }
  },
  {
    id: "cc_stock",
    text: "From sale of stock you get $50.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 50); else player.money += 50;
      engine.log(`${player.name} received $50 from stock sale.`);
    }
  },
  {
    id: "cc_jail_free",
    text: "Get Out of Jail Free. This card may be kept until needed or traded.",
    action: (engine, player) => {
      player.jailCards = (player.jailCards || 0) + 1;
      engine.log(`${player.name} received a Get Out of Jail Free card.`);
    }
  },
  {
    id: "cc_jail",
    text: "Go to Jail. Go directly to Jail. Do not pass GO, do not collect $200.",
    action: (engine, player) => {
      engine.sendToJail(player);
    }
  },
  {
    id: "cc_holiday",
    text: "Holiday fund matures. Receive $100.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 100); else player.money += 100;
      engine.log(`${player.name} collected $100 from holiday fund.`);
    }
  },
  {
    id: "cc_tax_refund",
    text: "Income tax refund. Collect $20.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 20); else player.money += 20;
      engine.log(`${player.name} received $20 tax refund.`);
    }
  },
  {
    id: "cc_birthday",
    text: "It is your birthday. Collect $10 from every player.",
    action: (engine, player) => {
      const others = engine.players.filter(p => p.id !== player.id && !p.bankrupt);
      others.forEach(p => {
        const pay = Math.min(p.money, 10);
        if (engine.deductCash) engine.deductCash(p, pay); else p.money -= pay;
        if (engine.addCash) engine.addCash(player, pay); else player.money += pay;
      });
      engine.log(`${player.name} collected birthday gifts from everyone!`);
    }
  },
  {
    id: "cc_life",
    text: "Life insurance matures. Collect $100.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 100); else player.money += 100;
      engine.log(`${player.name} collected $100 life insurance.`);
    }
  },
  {
    id: "cc_hospital",
    text: "Pay hospital fees of $100.",
    action: (engine, player) => {
      engine.chargePlayer(player, 100, null, "Hospital fees");
    }
  },
  {
    id: "cc_school",
    text: "Pay school fees of $50.",
    action: (engine, player) => {
      engine.chargePlayer(player, 50, null, "School fees");
    }
  },
  {
    id: "cc_consultancy",
    text: "Receive $25 consultancy fee.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 25); else player.money += 25;
      engine.log(`${player.name} received $25 consultancy fee.`);
    }
  },
  {
    id: "cc_street_repairs",
    text: "You are assessed for street repairs. $40 per house, $115 per hotel.",
    action: (engine, player) => {
      const cost = engine.calculateRepairs(player, 40, 115);
      engine.chargePlayer(player, cost, null, "Street repairs");
    }
  },
  {
    id: "cc_beauty",
    text: "You have won second prize in a beauty contest. Collect $10.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 10); else player.money += 10;
      engine.log(`${player.name} won second prize in beauty contest ($10).`);
    }
  },
  {
    id: "cc_inherit",
    text: "You inherit $100.",
    action: (engine, player) => {
      if (engine.addCash) engine.addCash(player, 100); else player.money += 100;
      engine.log(`${player.name} inherited $100.`);
    }
  }
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  shuffle
};
