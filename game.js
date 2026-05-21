// SIGNAL ZERO — CORE GAME ENGINE

class GameEngine {
  constructor() {
    this.canvasSize = 640;
    this.center = { x: 320, y: 320 };
    
    // Game States
    this.phase = 'PREP'; // 'PREP' or 'COMBAT'
    this.prepTimer = 30; // 30 seconds preparation phase
    this.prepInterval = null;
    this.waveNumber = 0;
    this.waveType = 'NORMAL'; // 'NORMAL', 'SWARM', 'ARMORED', 'MINIBOSS', 'BOSS', 'BLACKOUT'
    this.score = 0;
    this.gameSpeed = 1; // 0 (paused), 1x, 2x
    this.gameOver = false;
    
    // Core (Objective)
    this.coreMaxHP = 1000;
    this.coreHP = 1000;
    this.timesCoreHit = 0;
    this.repairCountThisWave = 0; // limit repair to 10% (+100 HP) per wave gap
    
    // Resources
    this.fragments = { gray: 120, blue: 2, purple: 1, gold: 0 }; // Start with basic resources for first placements
    this.energyCells = 3;
    
    // Grid Configurations ( Concrentic Ring Slots )
    this.grid = [];
    this.innerRadius = 130;
    this.midRadius = 230;
    this.outerRadius = 320; // Enemy spawn threshold
    
    // Game Entities
    this.units = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.burningZones = []; // For Molecular Scatter mod
    
    // Selected states
    this.selectedCell = null;
    this.selectedShopClass = null; // 'sniper', 'aoe', 'barrier'
    this.selectedFragmentType = null; // 'gray', 'blue', 'purple', 'gold'
    
    // Special Ability States (Timers in frames/ticks)
    this.empDuration = 0; // 3s stun
    this.overchargeDuration = 0; // 10s 200% attack speed
    this.emergencyShieldDuration = 0; // 8s Core invincibility
    
    // Mini-boss / Boss tracking
    this.activeHeraldSector = null; // angular sector index currently flooded
    this.heraldFloodTimer = 0;
    this.sovereignBoss = null;
    this.hackedUnits = []; // Hacked units turn hostile
    
    // Floating combat numbers
    this.floatingTexts = [];

    // UI logs
    this.logs = [];

    this.initGrid();
  }

  // Generate 18 Inner slots, 36 Mid slots
  initGrid() {
    this.grid = [];
    
    // Inner Ring: 18 slots
    const innerCount = 18;
    for (let i = 0; i < innerCount; i++) {
      const angle = (i * 360) / innerCount;
      const rad = (angle * Math.PI) / 180;
      this.grid.push({
        id: `inner_${i}`,
        ring: 'inner',
        index: i,
        angle: angle,
        x: this.center.x + this.innerRadius * Math.cos(rad),
        y: this.center.y + this.innerRadius * Math.sin(rad),
        unit: null
      });
    }

    // Mid Ring: 36 slots
    const midCount = 36;
    for (let i = 0; i < midCount; i++) {
      const angle = (i * 360) / midCount;
      const rad = (angle * Math.PI) / 180;
      this.grid.push({
        id: `mid_${i}`,
        ring: 'mid',
        index: i,
        angle: angle,
        x: this.center.x + this.midRadius * Math.cos(rad),
        y: this.center.y + this.midRadius * Math.sin(rad),
        unit: null
      });
    }
  }

  // Adjacency checking for custom Ring geometry
  getNeighbors(cell) {
    const neighbors = [];
    if (!cell) return neighbors;

    const ring = cell.ring;
    const idx = cell.index;

    if (ring === 'inner') {
      // 1. Same ring neighbors (wrap-around)
      const prevIdx = (idx - 1 + 18) % 18;
      const nextIdx = (idx + 1) % 18;
      neighbors.push(this.grid.find(c => c.ring === 'inner' && c.index === prevIdx));
      neighbors.push(this.grid.find(c => c.ring === 'inner' && c.index === nextIdx));

      // 2. Outward (Mid ring) neighbors. 
      // Inner cell covering 20 degrees maps to 2 Mid cells covering 10 degrees each.
      const mid1 = (idx * 2) % 36;
      const mid2 = (idx * 2 + 1) % 36;
      const midPrev = (idx * 2 - 1 + 36) % 36;
      const midNext = (idx * 2 + 2) % 36;
      
      neighbors.push(this.grid.find(c => c.ring === 'mid' && c.index === mid1));
      neighbors.push(this.grid.find(c => c.ring === 'mid' && c.index === mid2));
      neighbors.push(this.grid.find(c => c.ring === 'mid' && c.index === midPrev));
      neighbors.push(this.grid.find(c => c.ring === 'mid' && c.index === midNext));

    } else if (ring === 'mid') {
      // 1. Same ring neighbors
      const prevIdx = (idx - 1 + 36) % 36;
      const nextIdx = (idx + 1) % 36;
      neighbors.push(this.grid.find(c => c.ring === 'mid' && c.index === prevIdx));
      neighbors.push(this.grid.find(c => c.ring === 'mid' && c.index === nextIdx));

      // 2. Inward (Inner ring) neighbors
      const inner1 = Math.floor(idx / 2) % 18;
      const inner2 = Math.floor((idx - 1 + 36) / 2) % 18;
      
      neighbors.push(this.grid.find(c => c.ring === 'inner' && c.index === inner1));
      if (inner1 !== inner2) {
        neighbors.push(this.grid.find(c => c.ring === 'inner' && c.index === inner2));
      }
    }

    return neighbors.filter(Boolean);
  }

  // Find all cliques of size 3 (triangles) that contain Sniper + AoE + Barrier
  // Returns list of linked Trinity Lock groups
  calculateTrinityLocks() {
    // Clear all existing trinity locks
    this.units.forEach(u => {
      u.trinityGroup = null;
      u.statBuff = 1.0;
    });

    const activeGroups = [];
    const unitCount = this.units.length;

    // Check all combinations of 3 units
    for (let i = 0; i < unitCount; i++) {
      for (let j = i + 1; j < unitCount; j++) {
        for (let k = j + 1; k < unitCount; k++) {
          const uA = this.units[i];
          const uB = this.units[j];
          const uC = this.units[k];

          // 1. Must be distinct classes
          const classes = new Set([uA.class, uB.class, uC.class]);
          if (classes.size !== 3) continue;

          // 2. Must be mutually adjacent (clique of 3)
          const cellA = this.grid.find(c => c.unit === uA);
          const cellB = this.grid.find(c => c.unit === uB);
          const cellC = this.grid.find(c => c.unit === uC);

          if (!cellA || !cellB || !cellC) continue;

          const neighborsA = this.getNeighbors(cellA);
          const neighborsB = this.getNeighbors(cellB);

          const A_touches_B = neighborsA.includes(cellB);
          const B_touches_C = neighborsB.includes(cellC);
          const C_touches_A = neighborsA.includes(cellC);

          if (A_touches_B && B_touches_C && C_touches_A) {
            // Found a Trinity formation!
            const group = {
              id: `trinity_${Date.now()}_${Math.random()}`,
              units: [uA, uB, uC],
              sharedHP: uA.hp + uB.hp + uC.hp,
              sharedMaxHP: uA.maxHp + uB.maxHp + uC.maxHp
            };
            
            // Distribute reference
            uA.trinityGroup = group;
            uB.trinityGroup = group;
            uC.trinityGroup = group;

            uA.statBuff = 1.4;
            uB.statBuff = 1.4;
            uC.statBuff = 1.4;

            activeGroups.push(group);
          }
        }
      }
    }
    return activeGroups;
  }

  // Handle damage to a unit (with shared pool logic)
  damageUnit(unit, amount, type = "normal") {
    if (unit.trinityGroup) {
      const group = unit.trinityGroup;
      group.sharedHP = Math.max(0, group.sharedHP - amount);
      
      // Floating indicator centered above the damaged unit
      this.spawnFloatingText(`-${Math.round(amount)}`, unit.x, unit.y - 15, "normal");
      
      // Check group destruction
      if (group.sharedHP <= 0) {
        group.units.forEach(u => {
          this.destroyUnit(u);
        });
      }
    } else {
      if (unit.shieldHP > 0 && type !== "pierce") {
        const shieldDmg = Math.min(unit.shieldHP, amount);
        unit.shieldHP -= shieldDmg;
        amount -= shieldDmg;
        this.spawnFloatingText(`-${Math.round(shieldDmg)}`, unit.x, unit.y - 15, "shield");
        
        if (unit.shieldHP <= 0) {
          Sound.playShieldBreak();
          this.log(`Barrier shield collapsed at slot ${unit.cellId}!`, "warning");
        }
      }

      if (amount > 0) {
        unit.hp = Math.max(0, unit.hp - amount);
        this.spawnFloatingText(`-${Math.round(amount)}`, unit.x, unit.y - 15, "normal");
        
        if (unit.hp <= 0) {
          this.destroyUnit(unit);
        }
      }
    }
  }

  destroyUnit(unit) {
    const cell = this.grid.find(c => c.id === unit.cellId);
    if (cell) cell.unit = null;
    this.units = this.units.filter(u => u !== unit);
    this.log(`Unit [${unit.class.toUpperCase()}] destroyed at slot ${unit.cellId}!`, "warning");
    
    // Re-evaluate Trinity Locks
    this.calculateTrinityLocks();
  }

  // Resource cost checks
  getPlacementCost(unitClass) {
    if (unitClass === 'sniper') return 30;
    if (unitClass === 'aoe') return 40;
    if (unitClass === 'barrier') return 25;
    return 999;
  }

  // Place unit
  buyAndPlaceUnit(cellId, unitClass) {
    const cell = this.grid.find(c => c.id === cellId);
    if (!cell || cell.unit) return false;

    const cost = this.getPlacementCost(unitClass);
    if (this.fragments.gray < cost) {
      this.log("Insufficient gray fragments to place unit!", "warning");
      return false;
    }

    this.fragments.gray -= cost;
    
    // Create new Unit object
    const newUnit = {
      id: `unit_${Date.now()}_${Math.random()}`,
      class: unitClass,
      level: 1,
      cellId: cellId,
      ring: cell.ring,
      x: cell.x,
      y: cell.y,
      angle: cell.angle,
      mods: [], // max 2
      maxHp: unitClass === 'sniper' ? 200 : unitClass === 'aoe' ? 280 : 500,
      hp: unitClass === 'sniper' ? 200 : unitClass === 'aoe' ? 280 : 500,
      shieldHP: unitClass === 'barrier' ? 400 : 0,
      maxShieldHP: unitClass === 'barrier' ? 400 : 0,
      // base combat stats
      atk: unitClass === 'sniper' ? 120 : unitClass === 'aoe' ? 60 : 0,
      spd: unitClass === 'sniper' ? 0.8 : unitClass === 'aoe' ? 0.4 : 0,
      cooldown: 0,
      statBuff: 1.0,
      trinityGroup: null,
      hackTimer: 0 // hacked status ( Sovereign boss )
    };

    cell.unit = newUnit;
    this.units.push(newUnit);
    
    this.log(`Placed [${unitClass.toUpperCase()}] drone at ${cellId}.`, "info");
    Sound.playUpgrade();
    
    // Recompute synergies
    this.calculateTrinityLocks();
    return true;
  }

  // Upgrade unit level (max 5)
  upgradeUnit(unit) {
    if (unit.level >= 5) {
      this.log("Unit is already at maximum level 5!", "warning");
      return;
    }

    const cost = 15 * unit.level;
    if (this.fragments.gray < cost) {
      this.log(`Insufficient gray fragments (Need ${cost}) to upgrade unit!`, "warning");
      return;
    }

    this.fragments.gray -= cost;
    unit.level += 1;
    
    // Stat adjustments
    if (unit.class === 'sniper') {
      unit.atk += 40;
      unit.spd += 0.08;
      unit.maxHp += 40;
      unit.hp += 40;
    } else if (unit.class === 'aoe') {
      unit.atk += 20;
      unit.spd += 0.04;
      unit.maxHp += 50;
      unit.hp += 50;
    } else if (unit.class === 'barrier') {
      unit.maxHp += 100;
      unit.hp += 100;
      unit.maxShieldHP += 100;
      unit.shieldHP = unit.maxShieldHP; // full recharge on upgrade
    }

    this.log(`Upgraded unit at ${unit.cellId} to Rank ${unit.level}.`, "success");
    Sound.playUpgrade();
    
    // Refresh trinity lock stats if changed
    this.calculateTrinityLocks();
  }

  // Synthesis Mod System
  applySynthesisMod(unit, fragmentType) {
    if (unit.mods.length >= 2) {
      this.log("Synthesis limit reached! Unit can hold maximum 2 mods.", "warning");
      return;
    }

    // Check availability
    if (this.fragments[fragmentType] < 1 && fragmentType !== 'gray') {
      this.log(`Insufficient [${fragmentType.toUpperCase()}] fragments to fuse!`, "warning");
      return;
    }
    if (fragmentType === 'gray' && this.fragments.gray < 20) {
      this.log("Need at least 20 gray fragments to apply Tier 1 synthesis mod!", "warning");
      return;
    }

    // Deduct cost
    if (fragmentType === 'gray') this.fragments.gray -= 20;
    else this.fragments[fragmentType] -= 1;

    // Build the Synthesis Mod
    let mod = null;
    if (fragmentType === 'gray') {
      mod = { name: "Swarm Lens", tier: 1, desc: "Sniper hits 2 targets / AoE +10% splash" };
    } else if (fragmentType === 'blue') {
      mod = { name: "Vorn Carapace", tier: 2, desc: "Barrier unit +200 extra shield HP" };
    } else if (fragmentType === 'purple') {
      mod = { name: "Molecular Scatter", tier: 3, desc: "AoE leaves burning zone / Sniper pierces +25% dmg" };
    } else if (fragmentType === 'gold') {
      mod = { name: "Echo Core", tier: 4, desc: "Ghost duplication with 50% performance" };
    }

    // Rules logic
    // 1. Legendary Gold cannot coexist with any other mod
    if (fragmentType === 'gold' && unit.mods.length > 0) {
      this.log("Legendary Echo Core cannot coexist with other synthesis mods!", "warning");
      // refund
      this.fragments.gold += 1;
      return;
    }
    if (unit.mods.some(m => m.tier === 4)) {
      this.log("Legendary Echo Core blocks other incoming synthesis mods!", "warning");
      if (fragmentType === 'gray') this.fragments.gray += 20;
      else this.fragments[fragmentType] += 1;
      return;
    }

    // 2. Conflict logic (Applying second mod causes incompatible conflict)
    let causedConflict = false;
    if (unit.mods.length === 1) {
      // Incompatible if tier matches or just random chance (50%)
      if (Math.random() < 0.5) {
        causedConflict = true;
        const targetIdx = 0; // downgrade the first mod
        const prevMod = unit.mods[targetIdx];
        if (prevMod.tier > 1) {
          prevMod.tier -= 1;
          if (prevMod.tier === 3) prevMod.name = "Molecular Scatter";
          if (prevMod.tier === 2) prevMod.name = "Vorn Carapace";
          if (prevMod.tier === 1) prevMod.name = "Swarm Lens";
          prevMod.desc = `Downgraded: ${prevMod.name}`;
          this.log("CONFLCT DETECTED! Alien matrix collapsed. Existing mod downgraded by 1 tier.", "warning");
        } else {
          this.log("Incompatibility bypassed due to low core tier.", "info");
        }
      }
    }

    unit.mods.push(mod);

    // Apply immediate effects
    if (mod.name === "Vorn Carapace") {
      unit.maxShieldHP += 200;
      unit.shieldHP += 200;
    }

    this.log(`Fused [${mod.name}] onto unit at ${unit.cellId}!`, "success");
    Sound.playSynthesis();
  }

  // Repair Core
  repairCore() {
    if (this.coreHP >= this.coreMaxHP) {
      this.log("Navigation Core is already at maximum integrity!", "info");
      return;
    }
    if (this.repairCountThisWave >= 100) {
      this.log("Emergency repair threshold reached! (Max +10% per wave interval)", "warning");
      return;
    }
    if (this.fragments.gray < 50) {
      this.log("Need 50 gray fragments to repair Navigation Core!", "warning");
      return;
    }

    this.fragments.gray -= 50;
    this.coreHP = Math.min(this.coreMaxHP, this.coreHP + 10);
    this.repairCountThisWave += 10;
    this.log(`Core repaired +10 HP. (${this.coreHP}/${this.coreMaxHP})`, "success");
    Sound.playUpgrade();
  }

  // Special Manual Abilities
  triggerEMP() {
    if (this.energyCells < 1) {
      this.log("Insufficient Energy Cells (Need 1) for EMP Burst!", "warning");
      return;
    }
    this.energyCells -= 1;
    this.empDuration = 180; // 3 seconds at 60fps
    this.log("EMP BURST INITIALIZED! Scanning field suspended.", "success");
    Sound.playEMP();

    // Trigger visual effect particles
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: this.center.x,
        y: this.center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 45,
        maxLife: 45,
        color: "rgba(0, 240, 255, 0.8)",
        size: 2 + Math.random() * 3
      });
    }
  }

  triggerOvercharge() {
    if (this.energyCells < 2) {
      this.log("Insufficient Energy Cells (Need 2) for Overcharge!", "warning");
      return;
    }
    this.energyCells -= 2;
    this.overchargeDuration = 600; // 10 seconds at 60fps
    this.log("ENGINE OVERCHARGE! Defense weapons firing rate doubled.", "success");
    Sound.playOvercharge();
  }

  triggerHarvest() {
    if (this.energyCells < 1) {
      this.log("Insufficient Energy Cells (Need 1) for Fragment Harvest!", "warning");
      return;
    }
    this.energyCells -= 1;
    this.enemies.forEach(enemy => {
      // Force fragment drop
      this.fragments.gray += 1;
      this.spawnFloatingText("+1 GRAY", enemy.x, enemy.y, "healing");
    });
    this.log("HARVEST FREQUENCY EMITTED! Reclaiming stray fragments.", "success");
    Sound.playHarvest();
  }

  triggerEmergencyShield() {
    if (this.energyCells < 3) {
      this.log("Insufficient Energy Cells (Need 3) for Emergency Shield!", "warning");
      return;
    }
    this.energyCells -= 3;
    this.emergencyShieldDuration = 480; // 8 seconds at 60fps
    this.log("EMERGENCY CORE MATRIX DEPLOYED! Dynamic invincibility active.", "success");
    Sound.playRecall(); // reuse recall synth warp
  }

  triggerRecall(cellId) {
    if (this.energyCells < 2) {
      this.log("Insufficient Energy Cells (Need 2) to Recall drone!", "warning");
      return;
    }
    const cell = this.grid.find(c => c.id === cellId);
    if (!cell || !cell.unit) {
      this.log("Select a slot containing an active drone to Recall.", "warning");
      return;
    }

    this.energyCells -= 2;
    const recalledUnit = cell.unit;
    cell.unit = null;
    this.units = this.units.filter(u => u !== recalledUnit);
    
    // Refund gray fragments
    const refund = Math.round(this.getPlacementCost(recalledUnit.class) * 0.7);
    this.fragments.gray += refund;
    this.log(`Recalled drone at ${cellId}. Refunded ${refund} gray fragments.`, "info");
    Sound.playRecall();

    this.calculateTrinityLocks();
  }

  // Wave Generation Formulas
  startNextWave() {
    if (this.phase !== 'PREP') return;
    this.phase = 'COMBAT';
    this.waveNumber += 1;
    this.repairCountThisWave = 0; // reset core repair count cap

    // Wave type decision
    if (this.waveNumber % 15 === 0) {
      this.waveType = 'BOSS';
    } else if (this.waveNumber % 5 === 0) {
      this.waveType = 'MINIBOSS';
    } else if (this.waveNumber % 3 === 0) {
      this.waveType = 'SWARM';
    } else if (this.waveNumber % 4 === 0) {
      this.waveType = 'ARMORED';
    } else if (this.waveNumber >= 20 && Math.random() < 0.2) {
      this.waveType = 'BLACKOUT';
      this.log("BLACKOUT: Station auxiliary power disabled! Stats -30%!", "warning");
      // Screen blackout active
      const flash = document.querySelector('.screen-flash');
      if (flash) {
        flash.className = 'screen-flash blackout blackout-active';
      }
    } else {
      this.waveType = 'NORMAL';
    }

    this.log(`WAVE ${this.waveNumber} DEPLOYED! Type: ${this.waveType}`, "success");
    
    // Clear old debris
    this.burningZones = [];

    // Calculate wave size
    let enemyCount = 10 + (this.waveNumber * 3);
    if (this.waveType === 'SWARM') enemyCount *= 2.5;

    // Spawn planning
    const scaleHP = 1 + (this.waveNumber * 0.08);
    const scaleSpeed = Math.min(2.5, 1 + (this.waveNumber * 0.02));

    this.spawnQueue = [];
    
    // Add boss to queue
    if (this.waveType === 'BOSS') {
      this.spawnQueue.push({ type: 'sovereign', hp: 20000 * scaleHP, speed: 0.3 * scaleSpeed, damage: 200, isBoss: true });
    } else if (this.waveType === 'MINIBOSS') {
      this.spawnQueue.push({ type: 'herald', hp: 5000 * scaleHP, speed: 0.4 * scaleSpeed, damage: 100, isMiniBoss: true });
    }

    // Add elite & standard mix
    const eliteCount = this.waveNumber >= 5 ? Math.floor(this.waveNumber / 5) : 0;
    
    for (let i = 0; i < eliteCount; i++) {
      const eliteTypes = ['commander', 'drifter', 'titan'];
      const chosenType = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
      
      let eliteBaseHP = 1200;
      let eliteSpeed = 0.5;
      let eliteDmg = 100;
      
      if (chosenType === 'drifter') { eliteBaseHP = 600; eliteSpeed = 1.2; eliteDmg = 40; }
      if (chosenType === 'titan') { eliteBaseHP = 2500; eliteSpeed = 0.3; eliteDmg = 200; }

      this.spawnQueue.push({
        type: chosenType,
        hp: eliteBaseHP * scaleHP,
        speed: eliteSpeed * scaleSpeed,
        damage: eliteDmg,
        isElite: true
      });
    }

    // Standard enemies mix
    const stdCount = enemyCount - eliteCount;
    for (let i = 0; i < stdCount; i++) {
      let roll = Math.random();
      let type = 'crawler';
      let hp = 200;
      let speed = 0.8;
      let damage = 25;

      if (this.waveType === 'SWARM') {
        type = 'nanoswarm'; hp = 80; speed = 1.6; damage = 10;
      } else {
        if (roll < 0.35) { type = 'nanoswarm'; hp = 80; speed = 1.6; damage = 10; }
        else if (roll < 0.6) { type = 'crawler'; hp = 200; speed = 0.8; damage = 25; }
        else if (roll < 0.85) { type = 'breacher'; hp = 350; speed = 0.5; damage = 60; }
        else { type = 'splitter'; hp = 150; speed = 0.9; damage = 20; }
      }

      this.spawnQueue.push({
        type: type,
        hp: hp * scaleHP,
        speed: speed * scaleSpeed,
        damage: damage,
        isElite: false
      });
    }

    // Shuffling standard queue
    this.spawnQueue.sort(() => Math.random() - 0.5);

    // Spawning ticks setup
    this.ticksSinceLastSpawn = 0;
  }

  // Execute actual enemy object generation onto the field
  spawnEnemy(config) {
    // 12 outer spawning positions (R = 380px)
    const spawnerIndex = Math.floor(Math.random() * 12);
    const angle = (spawnerIndex * 360) / 12;
    const rad = (angle * Math.PI) / 180;
    
    const spawnX = this.center.x + this.outerRadius * Math.cos(rad);
    const spawnY = this.center.y + this.outerRadius * Math.sin(rad);

    const enemy = {
      id: `enemy_${Date.now()}_${Math.random()}`,
      type: config.type,
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speed,
      damage: config.damage,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      radius: config.isBoss ? 28 : config.isMiniBoss ? 20 : config.isElite ? 14 : 8,
      isBoss: !!config.isBoss,
      isMiniBoss: !!config.isMiniBoss,
      isElite: !!config.isElite,
      slowDuration: 0,
      slowFactor: 1.0,
      shieldBreakBlock: false,
      hackTriggered: false
    };

    this.enemies.push(enemy);
  }

  // Floating text emitter helper
  spawnFloatingText(text, x, y, style = "normal") {
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      style: style,
      age: 0,
      maxAge: 45
    });
  }

  // Local state update step
  update() {
    if (this.gameOver) return;

    // Apply EMP effects
    if (this.empDuration > 0) this.empDuration -= 1;
    if (this.overchargeDuration > 0) this.overchargeDuration -= 1;
    if (this.emergencyShieldDuration > 0) this.emergencyShieldDuration -= 1;

    // Active waves logic
    if (this.phase === 'COMBAT') {
      // Spawn items
      this.ticksSinceLastSpawn += 1;
      const interval = 30 / this.gameSpeed; // tick intervals (0.5s at 60fps)
      if (this.spawnQueue.length > 0 && this.ticksSinceLastSpawn >= interval) {
        const next = this.spawnQueue.shift();
        this.spawnEnemy(next);
        this.ticksSinceLastSpawn = 0;
      }

      // Check wave clear
      if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
        this.completeWave();
      }
    }

    // Dynamic environmental zones (Molecular Scatter burn zones)
    this.burningZones.forEach(zone => {
      zone.life -= 1;
      // Deal damage to enemies inside burning zone
      this.enemies.forEach(enemy => {
        const dx = enemy.x - zone.x;
        const dy = enemy.y - zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 60) {
          enemy.hp -= (0.5 * this.gameSpeed); // 30 DPS at 60fps
        }
      });
    });
    this.burningZones = this.burningZones.filter(z => z.life > 0);

    // Update Projectiles
    this.updateProjectiles();

    // Update Particles
    this.particles.forEach(p => {
      p.x += p.vx * this.gameSpeed;
      p.y += p.vy * this.gameSpeed;
      p.life -= 1;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    // Update Enemies
    this.updateEnemies();

    // Update Units Auto-Fire AI
    this.updateUnitsAI();

    // Alert systems
    if (this.coreHP <= 100 && Math.random() < 0.02) {
      Sound.playAlarm();
    }
  }

  // Handle movements, collisions & Core impact
  updateEnemies() {
    this.enemies.forEach(enemy => {
      // If EMP active, bypass actions
      if (this.empDuration > 0) return;

      // Slow effects tracking
      if (enemy.slowDuration > 0) {
        enemy.slowDuration -= 1;
        if (enemy.slowDuration === 0) enemy.slowFactor = 1.0;
      }

      // Vorn Commander nearby speed buff
      let commanderBuff = 1.0;
      if (enemy.type !== 'commander') {
        const hasCommander = this.enemies.some(e => e.type === 'commander' && this.getDistance(enemy, e) < 120);
        if (hasCommander) commanderBuff = 1.2;
      }

      const activeSpeed = enemy.speed * enemy.slowFactor * commanderBuff * (this.coreHP <= 500 ? 1.1 : 1.0);

      // Path straight towards Core center (0,0 relative coordinate)
      const dx = this.center.x - enemy.x;
      const dy = this.center.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Sovereign hack mechanic
      if (enemy.isBoss && enemy.hp / enemy.maxHp <= 0.5 && !enemy.hackTriggered) {
        enemy.hackTriggered = true;
        this.log("VORN SOVEREIGN PHASE 2: Hacking system AI!", "warning");
        
        // Hack random active defense unit
        if (this.units.length > 0) {
          const targetUnit = this.units[Math.floor(Math.random() * this.units.length)];
          targetUnit.hackTimer = 480; // 8 seconds hacked
          this.log(`WARNING: Drone at slot ${targetUnit.cellId} hacked by Sovereign!`, "warning");
        }
      }

      // Check collision with center core
      if (dist < 40) {
        this.impactCore(enemy);
        return;
      }

      // Phase Drifters bypass all blockings
      if (enemy.type === 'drifter') {
        enemy.x += (dx / dist) * activeSpeed * this.gameSpeed;
        enemy.y += (dy / dist) * activeSpeed * this.gameSpeed;
        return;
      }

      // Standard movement blocked by Barrier shields in mid/inner rings
      let isBlocked = false;
      let blockingUnit = null;

      // Search for barrier units in adjacent path
      for (const u of this.units) {
        if (u.class === 'barrier' && u.hp > 0) {
          const uDist = this.getDistance(enemy, u);
          if (uDist < 30) {
            isBlocked = true;
            blockingUnit = u;
            break;
          }
        }
      }

      if (isBlocked && blockingUnit) {
        // Attack the blocking barrier
        const u_dmg = enemy.damage / 60; // scale DPS
        this.damageUnit(blockingUnit, u_dmg * this.gameSpeed);
        
        // Small sparks
        if (Math.random() < 0.15) {
          this.particles.push({
            x: blockingUnit.x + (Math.random() - 0.5) * 16,
            y: blockingUnit.y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            life: 20,
            maxLife: 20,
            color: "rgba(255, 0, 127, 0.7)",
            size: 1 + Math.random() * 2
          });
        }
      } else {
        // Move towards core
        enemy.x += (dx / dist) * activeSpeed * this.gameSpeed;
        enemy.y += (dy / dist) * activeSpeed * this.gameSpeed;
      }
    });

    // Remove dead enemies
    this.enemies = this.enemies.filter(e => {
      if (e.hp <= 0) {
        this.score += e.isBoss ? 2000 : e.isMiniBoss ? 1000 : e.isElite ? 250 : 50;
        this.score += 5; // kill bonus
        this.handleEnemyDrop(e);
        
        // Splitting splitter
        if (e.type === 'splitter') {
          for (let i = 0; i < 2; i++) {
            const angleOffset = (i === 0 ? 45 : -45) * Math.PI / 180;
            const dirX = this.center.x - e.x;
            const dirY = this.center.y - e.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY);
            
            this.enemies.push({
              id: `splitter_spawn_${Date.now()}_${Math.random()}`,
              type: 'nanoswarm',
              hp: 60,
              maxHp: 60,
              speed: 1.5,
              damage: 10,
              x: e.x + (Math.random() - 0.5) * 10,
              y: e.y + (Math.random() - 0.5) * 10,
              vx: 0, vy: 0,
              radius: 6,
              slowDuration: 0,
              slowFactor: 1.0
            });
          }
        }
        return false;
      }
      return true;
    });
  }

  // Handle Core impact
  impactCore(enemy) {
    this.enemies = this.enemies.filter(e => e !== enemy);
    this.timesCoreHit += 1;
    this.score = Math.max(0, this.score - 20); // hit penalty

    if (this.emergencyShieldDuration > 0) {
      this.log("Emergency shielding absorbs Core damage!", "info");
      this.spawnFloatingText("BLOCKED", this.center.x, this.center.y - 20, "shield");
      return;
    }

    this.coreHP = Math.max(0, this.coreHP - Math.round(enemy.damage));
    this.spawnFloatingText(`-${Math.round(enemy.damage)}`, this.center.x + (Math.random() - 0.5) * 20, this.center.y - 10, "normal");

    // Camera screenshake
    this.screenShakeTime = 20;

    // Visual red hit flash
    const flash = document.querySelector('.screen-flash');
    if (flash) {
      flash.className = 'screen-flash damage flash-active';
    }

    if (this.coreHP <= 0) {
      this.triggerGameOver();
    }
  }

  // Vorn Fragment chance drops
  handleEnemyDrop(enemy) {
    let dropRoll = Math.random();
    let harvestRate = 1.0;
    
    // Core critical desperation bonus 2x drops
    if (this.coreHP <= 100) harvestRate = 2.0;

    // Boss guarantee Gold drops
    if (enemy.isBoss) {
      this.fragments.gold += 1;
      this.log("VORN SOVEREIGN SLAIN! Gold Fragment harvested.", "success");
      this.spawnFloatingText("+1 GOLD", enemy.x, enemy.y, "crit");
      return;
    }

    // Mini-boss guarantee Purple drops
    if (enemy.isMiniBoss) {
      this.fragments.purple += 1;
      this.log("VORN HERALD DEFEATED! Purple Fragment harvested.", "success");
      this.spawnFloatingText("+1 PURPLE", enemy.x, enemy.y, "crit");
      return;
    }

    // Standard drop rate tier check
    const dropChance = 0.35 * harvestRate;
    if (dropRoll < dropChance) {
      const rarityRoll = Math.random();
      
      if (rarityRoll < 0.03) { // 3% Gold
        this.fragments.gold += 1;
        this.spawnFloatingText("+1 GOLD", enemy.x, enemy.y, "crit");
        this.log("LEGENDARY Fragment harvested!", "success");
      } else if (rarityRoll < 0.15) { // 12% Purple
        this.fragments.purple += 1;
        this.spawnFloatingText("+1 PURPLE", enemy.x, enemy.y, "crit");
      } else if (rarityRoll < 0.40) { // 25% Blue
        this.fragments.blue += 1;
        this.spawnFloatingText("+1 BLUE", enemy.x, enemy.y, "shield");
      } else { // 40% Gray
        this.fragments.gray += 10; // Earn in batches of 10
        this.spawnFloatingText("+10 GRAY", enemy.x, enemy.y, "healing");
      }
    }
  }

  // Update Projectiles
  updateProjectiles() {
    this.projectiles.forEach(p => {
      // Moves straight towards target coords
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const speed = p.speed * this.gameSpeed;
      if (dist <= speed) {
        this.detonateProjectile(p);
      } else {
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
      }
    });

    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  // Projectile impact logic (AoE explosions, damage execution)
  detonateProjectile(p) {
    p.dead = true;
    Sound.playExplosion();

    // 1. AoE Plasma spreader damage
    if (p.type === 'aoe') {
      const splashRadius = p.radius || 80;
      
      // Burning scatter zone purple mod
      if (p.hasBurningZone) {
        this.burningZones.push({
          x: p.tx,
          y: p.ty,
          life: 300 // 5 seconds at 60fps
        });
      }

      this.enemies.forEach(enemy => {
        const dx = enemy.x - p.tx;
        const dy = enemy.y - p.ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= splashRadius) {
          // Crawlers resist 50% splash damage
          let finalDmg = p.damage;
          if (enemy.type === 'crawler') finalDmg *= 0.5;

          enemy.hp -= finalDmg;
          
          // Slow standard adjacent enemies
          enemy.slowDuration = 120; // 2 seconds slow
          enemy.slowFactor = 0.65;
        }
      });

      // Spawn explosion particle visual
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        this.particles.push({
          x: p.tx,
          y: p.ty,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 30,
          maxLife: 30,
          color: p.hasBurningZone ? "rgba(204, 0, 255, 0.6)" : "rgba(255, 234, 0, 0.6)",
          size: 2 + Math.random() * 3
        });
      }
    }
  }

  // Update auto-attack behaviors for defensive drones
  updateUnitsAI() {
    this.units.forEach(unit => {
      // Handle hacked status (attack Core instead of Vorn)
      if (unit.hackTimer > 0) {
        unit.hackTimer -= 1 * this.gameSpeed;
        if (Math.random() < 0.05) {
          // Fire railgun/plasma directly towards the Core
          this.coreHP = Math.max(0, this.coreHP - Math.round(unit.atk * 0.1));
          this.spawnFloatingText(`-${Math.round(unit.atk * 0.1)}`, this.center.x, this.center.y, "normal");
        }
        return;
      }

      // Barrier nodes slow surrounding enemies automatically
      if (unit.class === 'barrier') {
        this.enemies.forEach(enemy => {
          const dist = this.getDistance(unit, enemy);
          if (dist <= 60) {
            enemy.slowDuration = 60; // 1s refresh slow
            enemy.slowFactor = 0.65; // -35% speed
          }
        });
        
        // Passive shield HP regeneration if adjacent to AoE drone
        const neighbors = this.getNeighbors(this.grid.find(c => c.id === unit.cellId));
        const adjacentAoE = neighbors.some(n => n && n.unit && n.unit.class === 'aoe');
        if (adjacentAoE && unit.shieldHP < unit.maxShieldHP) {
          unit.shieldHP = Math.min(unit.maxShieldHP, unit.shieldHP + 0.15 * this.gameSpeed);
        }
        return;
      }

      // Offensives drone targeting logic
      if (unit.cooldown > 0) {
        unit.cooldown -= 1 * this.gameSpeed;
        return;
      }

      const buffedRate = this.overchargeDuration > 0 ? 2.0 : 1.0;
      const rateScale = unit.spd * buffedRate * unit.statBuff;

      // Targeting
      if (unit.class === 'sniper') {
        // Target highest HP in full map range
        let target = null;
        let maxHP = -1;
        this.enemies.forEach(enemy => {
          if (enemy.hp > maxHP) {
            maxHP = enemy.hp;
            target = enemy;
          }
        });

        if (target) {
          this.fireSniper(unit, target);
          unit.cooldown = 60 / rateScale;
        }

      } else if (unit.class === 'aoe') {
        // Target cell with highest enemy density inside mid/outer ring range (R < 280)
        let bestTarget = null;
        let highestDensity = 0;

        // Simplify: check all active enemies and count neighboring clusters
        this.enemies.forEach(candidate => {
          const dx = candidate.x - this.center.x;
          const dy = candidate.y - this.center.y;
          const radDist = Math.sqrt(dx * dx + dy * dy);
          
          if (radDist <= 280) {
            let density = 0;
            this.enemies.forEach(other => {
              if (this.getDistance(candidate, other) <= 60) {
                density += 1;
              }
            });
            if (density > highestDensity) {
              highestDensity = density;
              bestTarget = candidate;
            }
          }
        });

        if (bestTarget) {
          this.fireAoE(unit, bestTarget);
          unit.cooldown = 60 / rateScale;
        }
      }
    });
  }

  // Sniper railgun projectile logic (piercing high damage vector line)
  fireSniper(unit, target) {
    Sound.playLaser();

    // Swarm Lens Gray mod allows hitting 2 targets
    const hasSwarmLens = unit.mods.some(m => m.name === "Swarm Lens");
    const numTargets = hasSwarmLens ? 2 : 1;
    const finalAtk = unit.atk * unit.statBuff;

    // Apply linear piercing vector path
    let targetsHit = 0;
    
    // Select first N enemies in line towards the target direction
    const beamAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
    
    const hitEnemies = this.enemies.filter(enemy => {
      if (targetsHit >= numTargets) return false;
      
      // Calculate distance from point to laser line segment
      const dx = enemy.x - unit.x;
      const dy = enemy.y - unit.y;
      
      // Projection along beam direction
      const proj = dx * Math.cos(beamAngle) + dy * Math.sin(beamAngle);
      if (proj < 0) return false; // Opposite direction
      
      const perpDist = Math.abs(dx * Math.sin(beamAngle) - dy * Math.cos(beamAngle));
      if (perpDist <= enemy.radius + 10) {
        targetsHit += 1;
        return true;
      }
      return false;
    });

    hitEnemies.forEach(enemy => {
      // Nanoswarms evade 40% sniper pierce attacks
      if (enemy.type === 'nanoswarm' && Math.random() < 0.40) {
        this.spawnFloatingText("EVADE", enemy.x, enemy.y, "shield");
        return;
      }

      // Purple pierce +25% bonus
      const isPurpleBonus = unit.mods.some(m => m.name === "Molecular Scatter");
      const multiplier = isPurpleBonus ? 1.25 : 1.0;

      enemy.hp -= finalAtk * multiplier;
      
      // Draw piercing line particle
      this.particles.push({
        type: 'beam',
        x: unit.x,
        y: unit.y,
        tx: enemy.x,
        ty: enemy.y,
        life: 15,
        maxLife: 15,
        color: "rgba(0, 240, 255, 0.9)"
      });
    });

    // Drawing final aesthetic beam trail to full map length if no hits
    if (hitEnemies.length === 0) {
      this.particles.push({
        type: 'beam',
        x: unit.x,
        y: unit.y,
        tx: unit.x + 600 * Math.cos(beamAngle),
        ty: unit.y + 600 * Math.sin(beamAngle),
        life: 15,
        maxLife: 15,
        color: "rgba(0, 240, 255, 0.4)"
      });
    }
  }

  // AoE Plasma Spreader firing logic
  fireAoE(unit, target) {
    const splashBonus = unit.mods.some(m => m.name === "Swarm Lens") ? 1.25 : 1.0;
    const finalRadius = 80 * splashBonus;
    
    const hasBurning = unit.mods.some(m => m.name === "Molecular Scatter");

    // Launch visible glowing projectile orb
    this.projectiles.push({
      type: 'aoe',
      x: unit.x,
      y: unit.y,
      tx: target.x,
      ty: target.y,
      speed: 6,
      damage: unit.atk * unit.statBuff,
      radius: finalRadius,
      hasBurningZone: hasBurning,
      dead: false
    });
  }

  // End wave sequence and distribute rewards
  completeWave() {
    this.phase = 'PREP';
    this.prepTimer = 30;
    this.logs = []; // clear screen log spam
    
    // Core energy reward
    if (this.waveNumber % 3 === 0) {
      this.energyCells += 1;
      this.log("WAVE CLEAR! Energy Cells replenished +1.", "success");
    } else {
      this.log("WAVE CLEAR! Accessing preparation system.", "info");
    }

    // Award standard clears
    this.fragments.gray += 30;
    this.fragments.blue += 1;

    // Reset countdown
    this.startPrepCountdown();
  }

  startPrepCountdown() {
    if (this.prepInterval) clearInterval(this.prepInterval);
    
    this.prepInterval = setInterval(() => {
      if (this.gameSpeed === 0) return; // paused
      
      this.prepTimer -= 1;
      if (this.prepTimer <= 0) {
        clearInterval(this.prepInterval);
        this.startNextWave();
      }
    }, 1000 / this.gameSpeed);
  }

  triggerGameOver() {
    this.gameOver = true;
    this.phase = 'PREP';
    if (this.prepInterval) clearInterval(this.prepInterval);
    
    // Save record score
    this.log(`CRITICAL FAIL: Station SIGNAL-0 Core offline. Final Score: ${this.score}`, "warning");
  }

  // Util functions
  getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  log(msg, type = "info") {
    this.logs.unshift({
      time: new Date().toLocaleTimeString(),
      text: msg,
      type: type
    });
    // limit logs size
    if (this.logs.length > 25) this.logs.pop();
  }
}

// Global Game Engine Instance
const Game = new GameEngine();
window.Game = Game; // export to window
