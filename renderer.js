// SIGNAL ZERO — CANVAS RENDERING SYSTEM

class CanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
    this.hoveredCell = null;
    this.placementIndicatorAngle = 0;
    
    this.initEvents();
  }

  initEvents() {
    if (!this.canvas) return;

    // Track mouse hover and clicks on Concentric slots
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      
      this.findHoveredCell(mouseX, mouseY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredCell = null;
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      this.findHoveredCell(mouseX, mouseY);
      
      if (this.hoveredCell) {
        // Trigger select cell
        Game.selectedCell = this.hoveredCell;
        
        // Handle direct unit placements
        if (Game.selectedShopClass && !this.hoveredCell.unit) {
          Game.buyAndPlaceUnit(this.hoveredCell.id, Game.selectedShopClass);
          Game.selectedShopClass = null; // reset selection after buying
          
          // Clear active DOM selection in HTML
          const activeShop = document.querySelector('.shop-card.selected');
          if (activeShop) activeShop.classList.remove('selected');
        }
        
        // Handle immediate synthesis mods drops
        if (Game.selectedFragmentType && this.hoveredCell.unit) {
          Game.applySynthesisMod(this.hoveredCell.unit, Game.selectedFragmentType);
          Game.selectedFragmentType = null; // reset selection
          
          const activeFrag = document.querySelector('.frag-cell.selected');
          if (activeFrag) activeFrag.classList.remove('selected');
        }

        // Display unit info card in sidebar if selected
        this.updateDetailCardUI();
      } else {
        Game.selectedCell = null;
        this.updateDetailCardUI();
      }
    });
  }

  // Find nearest circular grid cell inside radius tolerance (30px)
  findHoveredCell(mx, my) {
    let nearest = null;
    let minDist = 30; // proximity tolerance

    Game.grid.forEach(cell => {
      const dx = cell.x - mx;
      const dy = cell.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = cell;
      }
    });

    this.hoveredCell = nearest;
  }

  updateDetailCardUI() {
    const card = document.getElementById('detail-card');
    if (!card) return;

    if (Game.selectedCell && Game.selectedCell.unit) {
      const u = Game.selectedCell.unit;
      card.style.display = 'flex';
      
      document.getElementById('detail-name').innerText = u.class.toUpperCase() + " DRONE";
      document.getElementById('detail-lvl').innerText = `RANK ${u.level}`;
      document.getElementById('detail-hp').innerText = `${Math.round(u.hp)} / ${u.maxHp}`;
      document.getElementById('detail-atk').innerText = u.class === 'barrier' ? 'Aura slow' : Math.round(u.atk * u.statBuff);
      document.getElementById('detail-spd').innerText = u.class === 'barrier' ? 'Regen' : (u.spd * u.statBuff).toFixed(1) + '/s';
      
      // Upgrade cost label
      const upgradeBtn = document.getElementById('upgrade-unit-btn');
      if (upgradeBtn) {
        if (u.level >= 5) {
          upgradeBtn.innerText = "MAX RANK";
          upgradeBtn.disabled = true;
        } else {
          upgradeBtn.innerText = `UPGRADE (${15 * u.level} GRAY)`;
          upgradeBtn.disabled = Game.fragments.gray < 15 * u.level;
        }
      }

      // Mods displays
      const modContainer = document.getElementById('detail-mods-container');
      if (modContainer) {
        modContainer.innerHTML = '';
        for (let i = 0; i < 2; i++) {
          const mod = u.mods[i];
          const div = document.createElement('div');
          div.className = `mod-pill-slot ${mod ? 'equipped' : ''}`;
          if (mod) {
            div.innerText = `${mod.name} (T${mod.tier})`;
            div.title = mod.desc;
          } else {
            div.innerText = "[EMPTY SYNTHESIS NODE]";
          }
          modContainer.appendChild(div);
        }
      }
    } else {
      card.style.display = 'none';
    }
  }

  // Draw frame cycle
  render() {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    
    // Clear screen
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.save();
    
    // Dynamic screenshake
    if (Game.screenShakeTime > 0) {
      const shakeX = (Math.random() - 0.5) * 8;
      const shakeY = (Math.random() - 0.5) * 8;
      ctx.translate(shakeX, shakeY);
      Game.screenShakeTime -= 1;
    }

    // 1. Draw environmental grid ripples
    this.drawRadarBackground(ctx);

    // 2. Draw Mini-Boss flooded sector hazard
    this.drawHeraldFloods(ctx);

    // 3. Draw grid placement rings
    this.drawGridStructure(ctx);

    // 4. Draw burning zones
    this.drawBurningZones(ctx);

    // 5. Draw active Trinity locks (Triangle connector beams)
    this.drawTrinityLockSynergies(ctx);

    // 6. Draw Navigation Core Engine
    this.drawNavigationCore(ctx);

    // 7. Draw Units
    this.drawUnits(ctx);

    // 8. Draw Enemies
    this.drawEnemies(ctx);

    // 9. Draw Projectiles
    this.drawProjectiles(ctx);

    // 10. Draw Particle system
    this.drawParticles(ctx);

    // 11. Draw floating HUD text metrics
    this.drawFloatingTexts(ctx);

    ctx.restore();
    
    // Animate loop cursor indicators
    this.placementIndicatorAngle += 0.03;
  }

  drawRadarBackground(ctx) {
    const center = Game.center;
    // Cyber aesthetic crosshairs
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.02)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center.x, 0);
    ctx.lineTo(center.x, this.canvas.height);
    ctx.moveTo(0, center.y);
    ctx.lineTo(this.canvas.width, center.y);
    ctx.stroke();

    // Pulses radiating from core
    const time = Date.now() / 1500;
    const pulseRad = (time % 1) * 320;
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 * (1 - (pulseRad / 320))})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, pulseRad, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawGridStructure(ctx) {
    const center = Game.center;

    // Outer spawn line
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, Game.outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // Concentric grid zones
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Game.innerRadius, 0, Math.PI * 2);
    ctx.arc(center.x, center.y, Game.midRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Render cells nodes
    Game.grid.forEach(cell => {
      const isSelected = Game.selectedCell === cell;
      const isHovered = this.hoveredCell === cell;
      
      // Node center glow
      ctx.fillStyle = cell.unit ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      if (isHovered) ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      if (isSelected) ctx.fillStyle = 'rgba(255, 0, 127, 0.3)';

      ctx.beginPath();
      ctx.arc(cell.x, cell.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Outer rings nodes
      ctx.strokeStyle = cell.ring === 'inner' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 240, 255, 0.15)';
      if (isHovered) ctx.strokeStyle = 'var(--neon-cyan)';
      if (isSelected) ctx.strokeStyle = 'var(--neon-magenta)';
      
      ctx.lineWidth = isHovered || isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Mini-label (Slot indices)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '7px var(--font-mono)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cell.ring === 'inner' ? `I-${cell.index}` : `M-${cell.index}`, cell.x, cell.y + 22);
    });
  }

  drawBurningZones(ctx) {
    Game.burningZones.forEach(zone => {
      const gradient = ctx.createRadialGradient(zone.x, zone.y, 5, zone.x, zone.y, 60);
      gradient.addColorStop(0, 'rgba(204, 0, 255, 0.35)');
      gradient.addColorStop(0.5, 'rgba(255, 0, 127, 0.15)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 60, 0, Math.PI * 2);
      ctx.fill();

      // Aesthetic burning crack lines
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const offset = Math.random() * 10;
        ctx.moveTo(zone.x, zone.y);
        ctx.lineTo(zone.x + (45 + offset) * Math.cos(angle), zone.y + (45 + offset) * Math.sin(angle));
      }
      ctx.stroke();
    });
  }

  // Draw Trinity connections
  drawTrinityLockSynergies(ctx) {
    const activeGroups = Game.calculateTrinityLocks();

    activeGroups.forEach(group => {
      const uA = group.units[0];
      const uB = group.units[1];
      const uC = group.units[2];

      ctx.save();
      // Glowing inner lock triangle
      ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(uA.x, uA.y);
      ctx.lineTo(uB.x, uB.y);
      ctx.lineTo(uC.x, uC.y);
      ctx.closePath();
      ctx.fill();

      // Lock border lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'var(--neon-cyan)';
      
      ctx.beginPath();
      ctx.moveTo(uA.x, uA.y);
      ctx.lineTo(uB.x, uB.y);
      ctx.lineTo(uC.x, uC.y);
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();

      // Shared HP display overlay right in middle of triangle center
      const centerX = (uA.x + uB.x + uC.x) / 3;
      const centerY = (uA.y + uB.y + uC.y) / 3;

      ctx.fillStyle = 'rgba(10, 14, 26, 0.8)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'var(--neon-cyan)';
      ctx.font = '8px var(--font-mono)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("TRINITY", centerX, centerY - 4);
      
      ctx.fillStyle = '#fff';
      ctx.fillText(Math.round(group.sharedHP), centerX, centerY + 5);
    });
  }

  // Draw Navigation Core
  drawNavigationCore(ctx) {
    const center = Game.center;

    ctx.save();
    
    // HP dynamic radial glow
    const hpRatio = Game.coreHP / Game.coreMaxHP;
    const radialGlow = ctx.createRadialGradient(center.x, center.y, 10, center.x, center.y, 45);
    radialGlow.addColorStop(0, hpRatio < 0.25 ? 'rgba(255, 0, 60, 0.45)' : 'rgba(255, 0, 127, 0.3)');
    radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGlow;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 45, 0, Math.PI * 2);
    ctx.fill();

    // Outer rotating engine segments
    const rotation = Date.now() / 2000;
    
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 36, rotation, rotation + Math.PI * 0.7);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 0, 127, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 36, rotation + Math.PI, rotation + Math.PI * 1.7);
    ctx.stroke();

    // Central singularity core
    ctx.fillStyle = hpRatio < 0.25 ? 'var(--alarm-red)' : 'var(--neon-magenta)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 22 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Emergency Invincible Dome active
    if (Game.emergencyShieldDuration > 0) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'var(--neon-cyan)';
      
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.beginPath();
      ctx.arc(center.x, center.y, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  // Render defensive drones
  drawUnits(ctx) {
    Game.units.forEach(unit => {
      ctx.save();
      
      // Hacked red indicator halo
      if (unit.hackTimer > 0) {
        ctx.strokeStyle = 'rgba(255, 0, 60, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw level banner rank text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(unit.x - 14, unit.y - 25, 28, 7);
      
      ctx.fillStyle = 'var(--neon-cyan)';
      ctx.font = '6px var(--font-mono)';
      ctx.textAlign = 'center';
      ctx.fillText(`LV.${unit.level}`, unit.x, unit.y - 20);

      // Class rendering vectors
      if (unit.class === 'sniper') {
        // Railgun Drone - rotating body pointing at high HP enemy
        let targetAngle = unit.angle * Math.PI / 180; // Default outward
        if (Game.enemies.length > 0) {
          // Point barrel to highest HP enemy
          let target = null;
          let maxHP = -1;
          Game.enemies.forEach(e => {
            if (e.hp > maxHP) { maxHP = e.hp; target = e; }
          });
          if (target) {
            targetAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
          }
        }

        // Base circle
        ctx.fillStyle = 'rgba(12, 16, 26, 0.9)';
        ctx.strokeStyle = 'var(--neon-cyan)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Moving weapon barrel
        ctx.translate(unit.x, unit.y);
        ctx.rotate(targetAngle);
        
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.fillRect(0, -3.5, 18, 7);
        // Barrel dual nozzle divider
        ctx.strokeStyle = '#060810';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(18, 0);
        ctx.stroke();

      } else if (unit.class === 'aoe') {
        // Plasma Spreader - Spinning center core triangle
        ctx.fillStyle = 'rgba(12, 16, 26, 0.9)';
        ctx.strokeStyle = 'var(--neon-yellow)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Spin triangle core
        ctx.translate(unit.x, unit.y);
        ctx.rotate(Date.now() / 400);
        
        ctx.fillStyle = 'var(--neon-yellow)';
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, 5);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();

      } else if (unit.class === 'barrier') {
        // Shield Node - Hexagonal pulsing boundary base
        ctx.fillStyle = 'rgba(12, 16, 26, 0.9)';
        ctx.strokeStyle = 'var(--neon-magenta)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        
        // Draw Hexagon
        for (let i = 0; i < 6; i++) {
          const angle = (i * 60 * Math.PI) / 180;
          const hX = unit.x + 13 * Math.cos(angle);
          const hY = unit.y + 13 * Math.sin(angle);
          if (i === 0) ctx.moveTo(hX, hY);
          else ctx.lineTo(hX, hY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner defensive dome graphic core
        ctx.fillStyle = 'rgba(255, 0, 127, 0.25)';
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 8 + Math.sin(Date.now() / 200) * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Shield health bar above HP banner
        const shieldRatio = unit.shieldHP / unit.maxShieldHP;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(unit.x - 14, unit.y - 32, 28, 4);
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.fillRect(unit.x - 14, unit.y - 32, 28 * shieldRatio, 4);
      }

      ctx.restore();

      // Standard unit health bar
      if (!unit.trinityGroup) {
        const hpRatio = unit.hp / unit.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(unit.x - 14, unit.y + 15, 28, 4);
        ctx.fillStyle = 'var(--neon-magenta)';
        ctx.fillRect(unit.x - 14, unit.y + 15, 28 * hpRatio, 4);
      }
    });
  }

  // Render alien swarm threats
  drawEnemies(ctx) {
    Game.enemies.forEach(enemy => {
      ctx.save();

      // Slowed state visual aura
      if (enemy.slowDuration > 0) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw custom shapes per alien class
      if (enemy.type === 'nanoswarm') {
        // Fast small triangle
        ctx.fillStyle = 'var(--neon-yellow)';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const angle = Math.atan2(Game.center.y - enemy.y, Game.center.x - enemy.x);
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(angle);
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -5);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (enemy.type === 'crawler') {
        // Armored hexagon
        ctx.fillStyle = 'rgba(0, 255, 128, 0.9)';
        ctx.strokeStyle = 'rgba(0, 255, 128, 0.4)';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

      } else if (enemy.type === 'breacher') {
        // Heavy ram drone
        ctx.fillStyle = '#ff3c00';
        ctx.strokeStyle = '#ffbb00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const angle = Math.atan2(Game.center.y - enemy.y, Game.center.x - enemy.x);
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(angle);
        ctx.rect(-10, -7, 20, 14);
        ctx.fill();
        ctx.stroke();

      } else if (enemy.type === 'commander') {
        // Golden Leader structure
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'var(--neon-yellow)';
        ctx.fillStyle = 'var(--neon-yellow)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y - 12);
        ctx.lineTo(enemy.x + 10, enemy.y + 8);
        ctx.lineTo(enemy.x - 10, enemy.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (enemy.type === 'drifter') {
        // Ghostly phase purple walker
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#cc00ff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#cc00ff';
        
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

      } else if (enemy.type === 'titan') {
        // Massive focus crawler
        ctx.fillStyle = '#5c1300';
        ctx.strokeStyle = '#ff3300';
        ctx.lineWidth = 3.5;
        
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner gears
        ctx.fillStyle = '#ff7700';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 8, 0, Math.PI * 2);
        ctx.fill();

      } else if (enemy.isBoss) { // Sovereign
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(Date.now() / 600);
        
        ctx.fillStyle = '#1c0c28';
        ctx.strokeStyle = 'var(--neon-magenta)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rotating spikes
        ctx.fillStyle = 'var(--alarm-red)';
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(-6, -34, 12, 20);
        }

      } else { // Standard default
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Enemy HP bar
      const hpRatio = enemy.hp / enemy.maxHp;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 8, 24, 3);
      ctx.fillStyle = 'var(--alarm-red)';
      ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 8, 24 * hpRatio, 3);
    });
  }

  // Draw active projectiles
  drawProjectiles(ctx) {
    Game.projectiles.forEach(p => {
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.hasBurningZone ? '#cc00ff' : 'var(--neon-yellow)';
      ctx.fillStyle = p.hasBurningZone ? '#cc00ff' : 'var(--neon-yellow)';
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }

  // Draw temporary particles (Sparks, laser sweeps)
  drawParticles(ctx) {
    Game.particles.forEach(p => {
      ctx.save();
      
      if (p.type === 'beam') {
        const opacity = p.life / p.maxLife;
        ctx.strokeStyle = p.color || 'rgba(0, 240, 255, 0.8)';
        ctx.lineWidth = 3.5 * opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.tx, p.ty);
        ctx.stroke();
      } else {
        // Point particle
        ctx.fillStyle = p.color || '#fff';
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // Draw Flooding toxic sector hazard (Mini-boss mechanic)
  drawHeraldFloods(ctx) {
    // Standard mini-boss activates sector flood
    if (Game.activeHeraldSector !== null) {
      const center = Game.center;
      const startAngle = (Game.activeHeraldSector * 30 * Math.PI) / 180;
      const endAngle = ((Game.activeHeraldSector + 1) * 30 * Math.PI) / 180;

      ctx.save();
      
      const pulseOpacity = 0.12 + Math.sin(Date.now() / 150) * 0.05;
      ctx.fillStyle = `rgba(255, 60, 0, ${pulseOpacity})`;
      
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, Game.outerRadius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      // Border bounds indicator
      ctx.strokeStyle = 'rgba(255, 60, 0, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(center.x + Game.outerRadius * Math.cos(startAngle), center.y + Game.outerRadius * Math.sin(startAngle));
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(center.x + Game.outerRadius * Math.cos(endAngle), center.y + Game.outerRadius * Math.sin(endAngle));
      ctx.stroke();

      ctx.restore();
    }
  }

  // Draw floating combat numbers
  drawFloatingTexts(ctx) {
    Game.floatingTexts.forEach(ft => {
      ctx.save();
      
      const ageRatio = ft.age / ft.maxAge;
      ctx.globalAlpha = 1 - ageRatio;
      
      // Floating translation
      const textY = ft.y - (30 * ageRatio);

      if (ft.style === 'crit') {
        ctx.fillStyle = 'var(--neon-yellow)';
        ctx.font = 'bold 13px var(--font-mono)';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'var(--neon-yellow)';
      } else if (ft.style === 'shield') {
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.font = 'bold 10px var(--font-mono)';
      } else if (ft.style === 'healing') {
        ctx.fillStyle = '#00ff80';
        ctx.font = 'bold 10px var(--font-mono)';
      } else {
        ctx.fillStyle = 'var(--alarm-red)';
        ctx.font = 'bold 10px var(--font-mono)';
      }

      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, textY);
      
      ctx.restore();
      ft.age += 1;
    });

    Game.floatingTexts = Game.floatingTexts.filter(ft => ft.age < ft.maxAge);
  }
}
