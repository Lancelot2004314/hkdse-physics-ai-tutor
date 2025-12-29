/**
 * Physics Avatar - Matter.js powered knight in a circular world
 * Features: Real physics, cinematic combat, natural animations
 */

class PhysicsAvatar {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            size: 80,
            combatOnly: false,
            gravityY: 1.0,
            enemyCount: 1,
            enemyMaxAliveMs: 6000,
            ...options
        };

        // Physics
        this.engine = null;
        this.world = null;
        this.runner = null;

        // Bodies
        this.knight = null;
        this.sword = null;
        this.enemies = [];
        this.walls = [];
        this.ground = null;

        // Rendering
        this.canvas = null;
        this.ctx = null;

        // State machine
        this.currentState = 'idle';
        this.stateTimer = null;
        this.states = ['idle', 'sleep', 'practice', 'combat', 'rest'];
        this.stateWeights = { idle: 1, sleep: 1, practice: 1.5, combat: 3, rest: 1 };

        // Combat
        this.combatPhase = 0;
        this.comboCount = 0;
        this.hitStopFrames = 0;

        // Camera/FX
        this.cameraShake = { x: 0, y: 0, intensity: 0 };
        this.timeScale = 1;
        this.effects = [];
        this.swordTrail = [];

        // Animation
        this.frameCount = 0;
        this.lastTime = 0;
        this.nowMs = 0;
        this.accumulatorMs = 0;
        this.fixedStepMs = 1000 / 60;

        // AI / combat timing (for animation-like behavior)
        this.targetEnemy = null;
        this.lastAttackAt = 0;
        this.attackCooldownMs = 280;
        this.manualHitCooldownMs = 90;
        this.lastManualHitAt = 0;
        this.walkPhase = 0;

        // Combo (animation-like timeline)
        this.combo = { active: false, step: 0, nextAt: 0, dir: 1 };
        this.comboStepIntervalMs = 120; // fast combo
        this.comboSteps = 3;

        // Enemy spawn alternation (right/left)
        // 1 => spawn right, -1 => spawn left
        this.spawnSide = 1;

        // Debug overlay
        this.debug = { alive: 0, dead: 0, total: 0 };
        this.spawnStats = { totalSpawned: 0, lastSpawnAt: 0, lastSpawnSide: 1 };

        this.init();
    }

    async init() {
        // Load Matter.js if not already loaded
        if (typeof Matter === 'undefined') {
            await this.loadMatterJS();
        }

        this.createCanvas();
        this.createPhysicsWorld();
        this.createCircularBoundary();
        this.createGround();
        this.createKnight();
        this.startRenderLoop();
        // If combatOnly, stay in combat forever (no sleep/practice)
        if (this.options.combatOnly) {
            this.setState('combat');
        } else {
            this.startStateCycle();
        }

        console.log('PhysicsAvatar initialized!');
    }

    loadMatterJS() {
        return new Promise((resolve, reject) => {
            if (typeof Matter !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size;
        this.canvas.className = 'physics-avatar-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);
    }

    createPhysicsWorld() {
        const { Engine, World, Runner } = Matter;

        this.engine = Engine.create();
        this.world = this.engine.world;
        // Default: normal-ish gravity so it doesn't look like floating
        this.world.gravity.y = this.options.gravityY;
        this.world.gravity.x = 0;

        // Make simulation more stable (less jitter)
        this.engine.positionIterations = 8;
        this.engine.velocityIterations = 6;
        this.engine.constraintIterations = 4;

        // Collision events
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            this.handleCollision(event);
        });
    }

    createCircularBoundary() {
        const { Bodies, Composite } = Matter;
        const cx = this.options.size / 2;
        const cy = this.options.size / 2;
        const radius = this.options.size / 2 - 2;
        const segments = 32;

        // Create circular boundary using chain of static bodies
        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;

            const x1 = cx + Math.cos(angle1) * radius;
            const y1 = cy + Math.sin(angle1) * radius;
            const x2 = cx + Math.cos(angle2) * radius;
            const y2 = cy + Math.sin(angle2) * radius;

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const ang = Math.atan2(y2 - y1, x2 - x1);

            const wall = Bodies.rectangle(mx, my, len + 2, 4, {
                isStatic: true,
                angle: ang,
                render: { visible: false },
                label: 'wall',
                restitution: 0.3,
                friction: 0.1
            });
            this.walls.push(wall);
        }

        Composite.add(this.world, this.walls);
    }

    /**
     * Create a simple ground platform inside the circle so the knight isn't floating
     */
    createGround() {
        const { Bodies, Composite } = Matter;
        const size = this.options.size;
        const cx = size / 2;
        const y = size - 14;
        // Slightly curved/flat ground approximation
        this.ground = Bodies.rectangle(cx, y, size * 0.7, 6, {
            isStatic: true,
            label: 'ground',
            restitution: 0.0,
            friction: 0.95,
            render: { visible: false }
        });
        Composite.add(this.world, this.ground);
    }

    createKnight() {
        const { Bodies, Body, Composite, Constraint } = Matter;
        const cx = this.options.size / 2;
        const cy = this.options.size / 2 + 5;

        // Knight body (main body) - high air friction to stay stable
        this.knight = Bodies.circle(cx, cy, 8, {
            label: 'knight',
            density: 0.003,
            frictionAir: 0.15, // High air friction - won't fly away
            restitution: 0.1,
            render: { fillStyle: '#FFD700' }
        });

        // Sword (attached to knight) - also high air friction
        this.sword = Bodies.rectangle(cx + 12, cy - 5, 14, 2, {
            label: 'sword',
            density: 0.001,
            frictionAir: 0.05, // allow faster slashes
            restitution: 0.1,
            render: { fillStyle: '#C0C0C0' }
        });

        // Connect sword to knight
        this.swordConstraint = Constraint.create({
            bodyA: this.knight,
            pointA: { x: 6, y: -3 },
            bodyB: this.sword,
            pointB: { x: -5, y: 0 },
            stiffness: 0.9,
            damping: 0.15,
            length: 0
        });

        Composite.add(this.world, [this.knight, this.sword, this.swordConstraint]);
    }

    createEnemy(x, y) {
        const { Bodies, Composite } = Matter;

        const enemy = Bodies.circle(x, y, 6, {
            label: 'enemy',
            density: 0.001,
            frictionAir: 0.03,
            restitution: 0.4,
            render: { fillStyle: '#FFFFFF' }
        });

        // Enemy lifecycle (hp + death fade)
        enemy.plugin = enemy.plugin || {};
        enemy.plugin.hp = 2;
        enemy.plugin.dead = false;
        enemy.plugin.deadAt = null; // ms
        enemy.plugin.spawnedAt = this.nowMs || performance.now();

        this.enemies.push(enemy);
        Composite.add(this.world, enemy);
        return enemy;
    }

    removeEnemy(enemy) {
        const { Composite } = Matter;
        const idx = this.enemies.indexOf(enemy);
        if (idx > -1) {
            this.enemies.splice(idx, 1);
            Composite.remove(this.world, enemy);
        }
    }

    clearEnemies() {
        const { Composite } = Matter;
        this.enemies.forEach(e => Composite.remove(this.world, e));
        this.enemies = [];
    }

    handleCollision(event) {
        const pairs = event.pairs;

        pairs.forEach(pair => {
            const labels = [pair.bodyA.label, pair.bodyB.label];

            // Sword hits enemy
            if (labels.includes('sword') && labels.includes('enemy')) {
                const enemy = pair.bodyA.label === 'enemy' ? pair.bodyA : pair.bodyB;
                this.onSwordHitEnemy(enemy);
            }
        });
    }

    onSwordHitEnemy(enemy) {
        const { Body } = Matter;

        // Ignore if already dead
        if (enemy.plugin && enemy.plugin.dead) return;

        // Decrease HP
        if (enemy.plugin && typeof enemy.plugin.hp === 'number') {
            enemy.plugin.hp -= 1;
        }

        // Apply knockback (stronger + direction-aware)
        const dir = enemy.position.x >= this.knight.position.x ? 1 : -1;
        const force = { x: 0.010 * dir, y: -0.004 };
        Body.applyForce(enemy, enemy.position, force);

        // Hit effects
        this.triggerHitStop(3);
        this.triggerCameraShake(7);
        this.spawnEffect('impact', enemy.position.x, enemy.position.y);
        this.spawnEffect('shockwave', enemy.position.x, enemy.position.y);
        this.spawnEffect('flash', 0, 0);

        this.comboCount++;
        if (this.comboCount >= 2) {
            this.spawnEffect('comicText', enemy.position.x - 10, enemy.position.y - 10, this.comboCount >= 4 ? 'KAPOW!' : 'BAM!');
        }

        // Death: fade out then remove after 1.5s
        if (enemy.plugin && enemy.plugin.hp <= 0) {
            enemy.plugin.dead = true;
            enemy.plugin.deadAt = this.nowMs || performance.now();

            // Stop interacting with anything
            enemy.collisionFilter.mask = 0;
            enemy.collisionFilter.category = 0;

            // Dramatic fall
            Body.setAngularVelocity(enemy, (Math.random() - 0.5) * 0.6);
            Body.applyForce(enemy, enemy.position, { x: 0.002, y: 0.001 });

            this.spawnEffect('comicText', enemy.position.x - 14, enemy.position.y - 14, 'K.O!');

            // Immediately ensure new enemies if we're in combat (or combatOnly)
            if (this.options.combatOnly || this.currentState === 'combat') {
                this.ensureEnemyCount(this.options.enemyCount || 1);
            }
        }
    }

    /**
     * Ensure there are N alive enemies during combat
     */
    ensureEnemyCount(targetAlive = 1) {
        const alive = this.enemies.filter(e => !(e.plugin && e.plugin.dead));
        if (alive.length >= targetAlive) return;

        const size = this.options.size;
        const cy = size / 2;
        const spawnYBase = cy + (Math.random() * 18 - 9);

        // Spawn enough to reach target
        const missing = Math.max(0, targetAlive - alive.length);
        for (let i = 0; i < missing; i++) {
            // Alternate spawn side each enemy
            const spawnX = this.spawnSide === 1 ? (size - 16) : 16;
            const usedSide = this.spawnSide;
            this.spawnSide *= -1;

            const spawnY = spawnYBase + (Math.random() * 10 - 5);

            // Avoid spawning too close to knight
            const dx = spawnX - this.knight.position.x;
            const dy = spawnY - this.knight.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const safeY = dist < 18 ? (cy - 14) : spawnY;

            this.createEnemy(spawnX, safeY);

            // Track spawn stats for on-screen debugging
            this.spawnStats.totalSpawned += 1;
            this.spawnStats.lastSpawnAt = this.nowMs || performance.now();
            this.spawnStats.lastSpawnSide = usedSide;
        }
    }

    /**
     * Remove dead enemies after fade duration (1.5s)
     */
    cleanupDeadEnemies() {
        const fadeMs = 1500;
        const now = this.nowMs || performance.now();
        const toRemove = this.enemies.filter(e =>
            e.plugin && e.plugin.dead && e.plugin.deadAt && (now - e.plugin.deadAt) >= fadeMs
        );
        toRemove.forEach(e => this.removeEnemy(e));

        // After removals, if we're fighting, keep spawning to target count
        if (toRemove.length > 0 && (this.options.combatOnly || this.currentState === 'combat')) {
            this.ensureEnemyCount(this.options.enemyCount || 1);
        }
    }

    triggerHitStop(frames) {
        this.hitStopFrames = frames;
    }

    triggerCameraShake(intensity) {
        this.cameraShake.intensity = intensity;
    }

    spawnEffect(type, x, y, text = '') {
        this.effects.push({
            type,
            x,
            y,
            text,
            life: 1,
            maxLife: type === 'shockwave' ? 20 : (type === 'slash' ? 10 : (type === 'flash' ? 6 : 15)),
            frame: 0
        });
    }

    // ========== STATE MACHINE ==========

    startStateCycle() {
        this.setState('idle');
        this.scheduleNextState();
    }

    scheduleNextState() {
        const durations = {
            idle: 3000,
            sleep: 5000,
            practice: 4000,
            combat: 8000,
            rest: 3000
        };

        const duration = durations[this.currentState] || 3000;

        this.stateTimer = setTimeout(() => {
            const next = this.pickNextState();
            this.setState(next);
            this.scheduleNextState();
        }, duration);
    }

    pickNextState() {
        const available = this.states.filter(s => s !== this.currentState);
        let total = 0;
        available.forEach(s => total += this.stateWeights[s] || 1);

        let rand = Math.random() * total;
        for (const s of available) {
            rand -= this.stateWeights[s] || 1;
            if (rand <= 0) return s;
        }
        return 'idle';
    }

    setState(state) {
        this.currentState = state;
        this.combatPhase = 0;
        this.comboCount = 0;

        // State entry actions
        switch (state) {
            case 'combat':
                this.startCombat();
                break;
            case 'sleep':
                this.startSleep();
                break;
            case 'practice':
                this.startPractice();
                break;
            case 'rest':
                this.startRest();
                break;
            default:
                this.startIdle();
        }
    }

    startIdle() {
        this.clearEnemies();
        this.world.gravity.y = this.options.gravityY;
    }

    startSleep() {
        this.clearEnemies();
        this.world.gravity.y = this.options.gravityY;
        // Knight sinks and tilts
        Matter.Body.setAngle(this.knight, 0.3);
    }

    startPractice() {
        this.clearEnemies();
        this.world.gravity.y = this.options.gravityY;
    }

    startRest() {
        this.clearEnemies();
        this.world.gravity.y = this.options.gravityY;
    }

    startCombat() {
        this.world.gravity.y = this.options.gravityY;
        // Ensure at least 1 enemy exists
        this.ensureEnemyCount(1);
        this.combatPhase = 0;
        this.targetEnemy = null;
        this.lastAttackAt = this.nowMs || performance.now();
    }

    // ========== UPDATE LOOP ==========

    update(dt) {
        if (this.hitStopFrames > 0) {
            this.hitStopFrames--;
            return; // Freeze physics during hit stop
        }

        // Step physics with fixed timestep (prevents \"weird\" motion on variable FPS)
        this.accumulatorMs += Math.min(dt, 50);
        let steps = 0;
        while (this.accumulatorMs >= this.fixedStepMs && steps < 3) {
            Matter.Engine.update(this.engine, this.fixedStepMs * this.timeScale);
            this.accumulatorMs -= this.fixedStepMs;
            steps++;
        }

        // IMPORTANT: Keep knight inside bounds
        this.constrainKnightPosition();

        // Clean up dead enemies (fade out then remove)
        this.cleanupDeadEnemies();

        // HARD GUARANTEE: always maintain enemies while in combat / combatOnly
        if (this.options.combatOnly || this.currentState === 'combat') {
            this.ensureEnemyCount(this.options.enemyCount || 1);
        }

        // If an enemy refuses to die (no hits) for too long, auto-expire it so the fight keeps going
        this.expireOldEnemies();

        // Update camera shake
        if (this.cameraShake.intensity > 0) {
            this.cameraShake.x = (Math.random() - 0.5) * this.cameraShake.intensity;
            this.cameraShake.y = (Math.random() - 0.5) * this.cameraShake.intensity;
            this.cameraShake.intensity *= 0.9; // longer/stronger
            if (this.cameraShake.intensity < 0.1) {
                this.cameraShake.intensity = 0;
                this.cameraShake.x = 0;
                this.cameraShake.y = 0;
            }
        }

        // Update effects
        this.effects = this.effects.filter(e => {
            e.frame++;
            e.life = 1 - e.frame / e.maxLife;
            return e.life > 0;
        });

        // Track sword tip for trail
        const swordTip = this.getSwordTip();
        this.swordTrail.push({ ...swordTip, alpha: 1 });
        if (this.swordTrail.length > 8) this.swordTrail.shift();
        this.swordTrail.forEach((p, i) => p.alpha = (i + 1) / this.swordTrail.length);

        // State-specific updates
        this.updateState(dt);

        this.frameCount++;
    }

    expireOldEnemies() {
        const now = this.nowMs || performance.now();
        const maxAlive = this.options.enemyMaxAliveMs || 6000;
        const { Body } = Matter;

        for (const e of this.enemies) {
            if (!e.plugin) continue;
            if (e.plugin.dead) continue;
            if (!e.plugin.spawnedAt) continue;

            if (now - e.plugin.spawnedAt >= maxAlive) {
                // Mark as dead and fade out
                e.plugin.dead = true;
                e.plugin.deadAt = now;
                e.collisionFilter.mask = 0;
                e.collisionFilter.category = 0;
                Body.setAngularVelocity(e, (Math.random() - 0.5) * 0.4);
            }
        }
    }

    /**
     * Keep knight inside the circular boundary
     */
    constrainKnightPosition() {
        const { Body } = Matter;
        const cx = this.options.size / 2;
        const cy = this.options.size / 2;
        const maxRadius = this.options.size / 2 - 12; // Stay 12px from edge

        // Check knight position
        const dx = this.knight.position.x - cx;
        const dy = this.knight.position.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxRadius) {
            // Push back to inside bounds
            const angle = Math.atan2(dy, dx);
            const newX = cx + Math.cos(angle) * maxRadius;
            const newY = cy + Math.sin(angle) * maxRadius;
            Body.setPosition(this.knight, { x: newX, y: newY });

            // Also reduce velocity to prevent flying out again
            Body.setVelocity(this.knight, {
                x: this.knight.velocity.x * 0.5,
                y: this.knight.velocity.y * 0.5
            });
        }

        // Also constrain sword
        const sdx = this.sword.position.x - cx;
        const sdy = this.sword.position.y - cy;
        const sdist = Math.sqrt(sdx * sdx + sdy * sdy);

        if (sdist > maxRadius + 5) {
            const angle = Math.atan2(sdy, sdx);
            Body.setPosition(this.sword, {
                x: cx + Math.cos(angle) * maxRadius,
                y: cy + Math.sin(angle) * maxRadius
            });
            Body.setVelocity(this.sword, { x: 0, y: 0 });
        }
    }

    updateState(dt) {
        const { Body } = Matter;
        const time = this.frameCount * 0.05;

        switch (this.currentState) {
            case 'idle':
                // Gentle floating/breathing
                // With gravity on, just do a subtle "idle sway" instead of floating
                const sway = Math.sin(time) * 0.00015;
                Body.applyForce(this.knight, this.knight.position, { x: sway, y: 0 });
                break;

            case 'sleep':
                // Slow rocking
                const rock = Math.sin(time * 0.5) * 0.0001;
                Body.applyForce(this.knight, this.knight.position, { x: rock, y: 0 });
                break;

            case 'practice':
                // Periodic sword swings
                // Smaller swing force so it reads like an animation, not physics explosion
                const swing = Math.sin(time * 2) * 0.0012;
                Body.applyForce(this.sword, this.sword.position, { x: swing, y: -Math.abs(swing) * 0.2 });
                break;

            case 'combat':
                this.ensureEnemyCount(1);
                this.updateCombat(dt);
                break;

            case 'rest':
                // Settle down
                break;
        }
    }

    updateCombat(dt) {
        const { Body } = Matter;
        const now = this.nowMs || performance.now();

        // 1) Pick a target (nearest alive)
        const alive = this.enemies.filter(e => !(e.plugin && e.plugin.dead));
        if (!this.targetEnemy || (this.targetEnemy.plugin && this.targetEnemy.plugin.dead)) {
            this.targetEnemy = alive[0] || null;
        }
        if (!this.targetEnemy) return;

        // 2) Enemy AI: drift toward knight (so it looks like a fight, not random)
        this.enemyApproach(this.targetEnemy);

        // 3) Knight AI: move to a \"fighting distance\" and attack on a timed cadence
        const dx = this.targetEnemy.position.x - this.knight.position.x;
        const absDx = Math.abs(dx);
        const dir = dx >= 0 ? 1 : -1;

        // Walk/run toward target
        const desiredSpeed = absDx > 18 ? 1.2 : (absDx > 10 ? 0.7 : 0.2);
        const vx = Math.max(-desiredSpeed, Math.min(desiredSpeed, dx * 0.05));
        Body.setVelocity(this.knight, { x: vx, y: this.knight.velocity.y });

        // Keep knight mostly upright (animation-like)
        Body.setAngularVelocity(this.knight, this.knight.angularVelocity * 0.5);
        Body.setAngle(this.knight, this.knight.angle * 0.9);

        // Start a fast combo when close enough and cooldown passed
        if (!this.combo.active && absDx < 16 && (now - this.lastAttackAt) >= this.attackCooldownMs) {
            this.startCombo(dir, now);
        }

        // Progress combo steps
        if (this.combo.active && now >= this.combo.nextAt) {
            this.performSlash(this.combo.dir, this.combo.step);
            this.combo.step += 1;
            this.combo.nextAt = now + this.comboStepIntervalMs;

            if (this.combo.step >= this.comboSteps) {
                this.combo.active = false;
                this.lastAttackAt = now;
            }
        }

        // Manual hit check (so hits feel consistent even if collision misses)
        this.manualSwordHitCheck(now);
    }

    enemyApproach(enemy) {
        const { Body } = Matter;
        const dx = this.knight.position.x - enemy.position.x;
        const vx = Math.max(-0.6, Math.min(0.6, dx * 0.02));
        Body.setVelocity(enemy, { x: vx, y: enemy.velocity.y });
        Body.setAngularVelocity(enemy, enemy.angularVelocity * 0.6);
    }

    startCombo(dir, now) {
        this.combo.active = true;
        this.combo.step = 0;
        this.combo.dir = dir;
        this.combo.nextAt = now; // immediate
    }

    performSlash(dir, step = 0) {
        const { Body } = Matter;
        // Visible slash: bigger sword whip + small lunge, plus a slash arc effect
        const lunge = 0.0012 + step * 0.0002;
        const swordForce = 0.0035 + step * 0.0006;
        const swordSpin = 1.2 + step * 0.25;

        Body.applyForce(this.knight, this.knight.position, { x: lunge * dir, y: -0.00035 });
        Body.setAngularVelocity(this.sword, swordSpin * dir);
        Body.applyForce(this.sword, this.sword.position, { x: swordForce * dir, y: -0.0012 });

        const tip = this.getSwordTip();
        this.spawnEffect('slash', tip.x, tip.y, dir > 0 ? 'R' : 'L');

        // Force a damage check right at slash timing (more \"he is cutting\" feeling)
        const now = this.nowMs || performance.now();
        this.manualSwordHitCheck(now, true);
    }

    manualSwordHitCheck(now, force = false) {
        if (!force && (now - this.lastManualHitAt) < this.manualHitCooldownMs) return;
        const tip = this.getSwordTip();
        const alive = this.enemies.filter(e => !(e.plugin && e.plugin.dead));
        for (const enemy of alive) {
            const dx = enemy.position.x - tip.x;
            const dy = enemy.position.y - tip.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 14 * 14) {
                this.lastManualHitAt = now;
                this.onSwordHitEnemy(enemy);
                break;
            }
        }
    }

    /**
     * Gently pull knight toward center
     */
    pullToCenter(strength) {
        const { Body } = Matter;
        const cx = this.options.size / 2;
        const cy = this.options.size / 2 + 5;

        const dx = cx - this.knight.position.x;
        const dy = cy - this.knight.position.y;

        Body.applyForce(this.knight, this.knight.position, {
            x: dx * strength,
            y: dy * strength
        });
    }

    getSwordTip() {
        const angle = this.sword.angle;
        const len = 7;
        return {
            x: this.sword.position.x + Math.cos(angle) * len,
            y: this.sword.position.y + Math.sin(angle) * len
        };
    }

    // ========== RENDER ==========

    render() {
        const ctx = this.ctx;
        const size = this.options.size;
        const cx = size / 2;
        const cy = size / 2;

        ctx.save();

        // Clear
        ctx.clearRect(0, 0, size, size);

        // Clip to circle
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2);
        ctx.clip();

        // Camera shake offset
        ctx.translate(this.cameraShake.x, this.cameraShake.y);

        // Background gradient
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
        bgGrad.addColorStop(0, '#2d4a6f');
        bgGrad.addColorStop(1, '#1a2f4a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, size, size);

        // Ground line
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.ellipse(cx, size - 12, 30, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sword trail
        if (this.swordTrail.length > 1 && this.currentState === 'combat') {
            ctx.beginPath();
            ctx.moveTo(this.swordTrail[0].x, this.swordTrail[0].y);
            for (let i = 1; i < this.swordTrail.length; i++) {
                const p = this.swordTrail[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.strokeStyle = `rgba(255, 215, 0, 0.6)`;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Render enemies
        this.enemies.forEach(enemy => {
            let alpha = 0.8;
            if (enemy.plugin && enemy.plugin.dead && enemy.plugin.deadAt) {
                const t = Math.min(1, Math.max(0, (this.nowMs - enemy.plugin.deadAt) / 1500));
                alpha = 0.8 * (1 - t);
            }
            this.renderStickFigure(ctx, enemy.position.x, enemy.position.y, enemy.angle, '#FFFFFF', '#CCCCCC', 0.8, alpha);

            // HP label (so you can see if it is actually dying)
            if (enemy.plugin && !enemy.plugin.dead) {
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.font = 'bold 9px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 2;
                const hp = typeof enemy.plugin.hp === 'number' ? enemy.plugin.hp : '?';
                ctx.strokeText(String(hp), enemy.position.x - 3, enemy.position.y - 12);
                ctx.fillText(String(hp), enemy.position.x - 3, enemy.position.y - 12);
                ctx.restore();
            }
        });

        // Debug overlay (top-left)
        const alive = this.enemies.filter(e => !(e.plugin && e.plugin.dead)).length;
        const dead = this.enemies.filter(e => (e.plugin && e.plugin.dead)).length;
        this.debug = { alive, dead, total: this.enemies.length };
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const sinceSpawn = this.spawnStats.lastSpawnAt ? Math.max(0, (this.nowMs - this.spawnStats.lastSpawnAt)) : 0;
        const sideChar = this.spawnStats.lastSpawnSide === 1 ? 'R' : 'L';
        ctx.fillText(`A:${alive} D:${dead} T:${this.enemies.length}`, 6, 10);
        ctx.fillText(`spawned:${this.spawnStats.totalSpawned} last:${sideChar} ${Math.round(sinceSpawn)}ms`, 6, 22);
        ctx.fillText(`target:${this.options.enemyCount || 1} combatOnly:${!!this.options.combatOnly}`, 6, 34);

        // Render knight
        this.renderKnight(ctx);

        // Render effects
        this.renderEffects(ctx);

        // Sleep ZZZ
        if (this.currentState === 'sleep') {
            this.renderZzz(ctx);
        }

        // Combo counter
        if (this.comboCount > 0 && this.currentState === 'combat') {
            ctx.font = 'bold 7px Arial';
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.strokeText(`COMBO x${this.comboCount}`, 8, 16);
            ctx.fillText(`COMBO x${this.comboCount}`, 8, 16);
        }

        ctx.restore();
    }

    renderKnight(ctx) {
        const k = this.knight;
        const s = this.sword;
        const x = k.position.x;
        const y = k.position.y;
        const angle = k.angle;
        const speedX = Math.abs(k.velocity.x || 0);
        this.walkPhase += speedX * 0.25;
        const legSwing = Math.sin(this.walkPhase) * Math.min(1, speedX / 1.2) * 3;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Glow effect
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 4;

        // Cape
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.moveTo(-2, 2);
        ctx.quadraticCurveTo(-6, 10, -4, 18);
        ctx.quadraticCurveTo(0, 20, 4, 18);
        ctx.quadraticCurveTo(6, 10, 2, 2);
        ctx.fill();

        // Body
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 12);
        ctx.stroke();

        // Legs
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(-4, 22 + legSwing);
        ctx.moveTo(0, 12);
        ctx.lineTo(4, 22 - legSwing);
        ctx.stroke();

        // Left arm + shield
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(-6, 9);
        ctx.stroke();
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(-8, 10, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right arm (sword attached via physics)
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(6, 1);
        ctx.stroke();

        // Head
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, -4, 5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Helmet plume
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(5, -11, 4, -5);
        ctx.fill();

        // Visor
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(-3.5, -5, 7, 2);

        // Eyes
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(-1.5, -4, 0.8, 0, Math.PI * 2);
        ctx.arc(1.5, -4, 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Render sword separately (physics body)
        ctx.save();
        ctx.translate(s.position.x, s.position.y);
        ctx.rotate(s.angle);

        ctx.shadowColor = '#C0C0C0';
        ctx.shadowBlur = 2;

        // Hilt
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-5, -1.5, 4, 3);
        ctx.beginPath();
        ctx.arc(-5, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // Blade
        const bladeGrad = ctx.createLinearGradient(-1, 0, 9, 0);
        bladeGrad.addColorStop(0, '#FFFFFF');
        bladeGrad.addColorStop(1, '#A0A0A0');
        ctx.fillStyle = bladeGrad;
        ctx.fillRect(-1, -0.8, 10, 1.6);

        ctx.restore();
    }

    renderStickFigure(ctx, x, y, angle, color, strokeColor, scale = 1, alpha = 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

        // Head
        ctx.fillStyle = color;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(0, 14);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(-6, 11);
        ctx.moveTo(0, 6);
        ctx.lineTo(5, 10);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(-4, 24);
        ctx.moveTo(0, 14);
        ctx.lineTo(4, 24);
        ctx.stroke();

        // Weapon
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-6, 11);
        ctx.lineTo(-10, 5);
        ctx.stroke();

        ctx.restore();
    }

    renderEffects(ctx) {
        this.effects.forEach(e => {
            switch (e.type) {
                case 'impact':
                    this.renderImpact(ctx, e);
                    break;
                case 'shockwave':
                    this.renderShockwave(ctx, e);
                    break;
                case 'comicText':
                    this.renderComicText(ctx, e);
                    break;
                case 'slash':
                    this.renderSlash(ctx, e);
                    break;
                case 'flash':
                    this.renderFlash(ctx, e);
                    break;
            }
        });
    }

    renderImpact(ctx, e) {
        const scale = 1 + (1 - e.life) * 2;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = e.life;

        // Sparkles
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            const r = 3 + (1 - e.life) * 8;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 1.5 * e.life, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    renderShockwave(ctx, e) {
        const radius = (1 - e.life) * 20;
        ctx.save();
        ctx.globalAlpha = e.life * 0.7;
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2 * e.life;
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    renderComicText(ctx, e) {
        const scale = 0.5 + (1 - e.life) * 0.5;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = e.life;
        ctx.font = 'bold 12px Impact, Arial Black, sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.strokeText(e.text, 0, 0);
        ctx.fillText(e.text, 0, 0);
        ctx.restore();
    }

    renderSlash(ctx, e) {
        // A fast glowing arc near the hit position
        const t = 1 - e.life;
        const r = 10 + t * 18;
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.life * 1.2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.9 * e.life})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const start = e.text === 'R' ? -0.6 : Math.PI + 0.6;
        const end = e.text === 'R' ? 0.6 : Math.PI - 0.6;
        ctx.arc(e.x, e.y, r, start, end);
        ctx.stroke();
        ctx.restore();
    }

    renderFlash(ctx, e) {
        // Quick white overlay flash for impact
        ctx.save();
        ctx.globalAlpha = 0.18 * e.life;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.options.size, this.options.size);
        ctx.restore();
    }

    renderZzz(ctx) {
        const time = this.frameCount * 0.03;
        ctx.font = 'bold 8px Arial';
        ctx.fillStyle = '#60a5fa';

        for (let i = 0; i < 3; i++) {
            const offset = (time + i * 0.5) % 2;
            const alpha = 1 - offset / 2;
            const size = 8 - i * 2;
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${size}px Arial`;
            ctx.fillText('Z', 55 + i * 6, 35 - offset * 8 - i * 5);
        }
        ctx.globalAlpha = 1;
    }

    // ========== RENDER LOOP ==========

    startRenderLoop() {
        const loop = (time) => {
            const dt = Math.min(time - this.lastTime, 50); // Cap delta time
            this.lastTime = time;
            this.nowMs = time;

            this.update(dt);
            this.render();

            this.animationFrame = requestAnimationFrame(loop);
        };

        this.animationFrame = requestAnimationFrame(loop);
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.stateTimer) {
            clearTimeout(this.stateTimer);
        }
        if (this.runner) {
            Matter.Runner.stop(this.runner);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.PhysicsAvatar = PhysicsAvatar;
}

