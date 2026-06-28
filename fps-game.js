// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
minimapCanvas.width = 200;
minimapCanvas.height = 200;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Weapon Configuration
const WEAPONS = {
    rifle: {
        name: 'M4A1 ASSAULT RIFLE',
        damage: 25,
        fireRate: 100,
        magazineSize: 30,
        reserveAmmo: 90,
        reloadTime: 2000,
        accuracy: 0.95,
        icon: '🔫'
    },
    sniper: {
        name: 'AWP SNIPER RIFLE',
        damage: 100,
        fireRate: 1000,
        magazineSize: 5,
        reserveAmmo: 15,
        reloadTime: 3000,
        accuracy: 0.99,
        icon: '🎯'
    },
    shotgun: {
        name: 'PUMP SHOTGUN',
        damage: 80,
        fireRate: 800,
        magazineSize: 6,
        reserveAmmo: 24,
        reloadTime: 2500,
        accuracy: 0.7,
        pellets: 8,
        spread: 0.2,
        icon: '💣'
    }
};

// Game State
const gameState = {
    players: new Map(),
    bullets: [],
    obstacles: [],
    myId: 'player_' + Math.random().toString(36).substr(2, 9),
    started: false,
    redScore: 0,
    blueScore: 0,
    currentWeapon: 'rifle',
    ammo: { rifle: 30, sniper: 5, shotgun: 6 },
    reserve: { rifle: 90, sniper: 15, shotgun: 24 },
    isReloading: false,
    lastShot: 0,
    isDead: false,
    kills: 0,
    deaths: 0
};

// Player Class
class Player {
    constructor(id, name, team) {
        this.id = id;
        this.name = name;
        this.team = team;
        this.color = team === 'red' ? '#ff4444' : '#4444ff';
        this.x = team === 'red' ? 200 : canvas.width - 200;
        this.y = canvas.height / 2;
        this.angle = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 5;
        this.radius = 15;
        this.kills = 0;
        this.deaths = 0;
        this.isMoving = {up: false, down: false, left: false, right: false};
        this.currentWeapon = 'rifle';
        this.lastShot = 0;
        this.isDead = false;
        this.respawnTime = 0;
    }

    update(mouseX, mouseY) {
        if (this.isDead) return;

        // Movement
        let dx = 0, dy = 0;
        if (this.isMoving.up) dy -= 1;
        if (this.isMoving.down) dy += 1;
        if (this.isMoving.left) dx -= 1;
        if (this.isMoving.right) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        // Collision with walls
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Collision with obstacles
        gameState.obstacles.forEach(obs => {
            if (this.checkCollisionWithRect(obs)) {
                // Push player out of obstacle
                const overlapX = Math.min(
                    Math.abs(this.x - obs.x),
                    Math.abs(this.x - (obs.x + obs.width))
                );
                const overlapY = Math.min(
                    Math.abs(this.y - obs.y),
                    Math.abs(this.y - (obs.y + obs.height))
                );

                if (overlapX < overlapY) {
                    this.x += this.x < obs.x + obs.width / 2 ? -overlapX : overlapX;
                } else {
                    this.y += this.y < obs.y + obs.height / 2 ? -overlapY : overlapY;
                }
            }
        });

        // Calculate angle to mouse
        this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
    }

    checkCollisionWithRect(rect) {
        const closestX = Math.max(rect.x, Math.min(this.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(this.y, rect.y + rect.height));
        const distance = Math.sqrt((this.x - closestX) ** 2 + (this.y - closestY) ** 2);
        return distance < this.radius;
    }

    draw() {
        if (this.isDead) return;

        // Draw player body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw weapon direction
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#333';
        ctx.fillRect(0, -3, this.radius + 15, 6);
        ctx.restore();

        // Draw name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(this.name, this.x, this.y - this.radius - 10);
        ctx.shadowBlur = 0;

        // Draw health bar
        const barWidth = 40;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.radius - 5;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthWidth = (this.health / this.maxHealth) * barWidth;
        ctx.fillStyle = this.health > 50 ? '#00ff00' : this.health > 25 ? '#ffaa00' : '#ff0000';
        ctx.fillRect(barX, barY, healthWidth, barHeight);
    }

    takeDamage(amount, attackerId) {
        if (this.isDead) return false;

        this.health -= amount;

        if (this.health <= 0) {
            this.health = 0;
            this.die(attackerId);
            return true;
        }
        return false;
    }

    die(killerId) {
        this.isDead = true;
        this.deaths++;
        this.respawnTime = Date.now() + 5000;

        // Update killer's stats
        if (killerId && killerId !== this.id) {
            const killer = gameState.players.get(killerId);
            if (killer) {
                killer.kills++;
                
                // Update team score
                if (killer.team === 'red') {
                    gameState.redScore++;
                } else {
                    gameState.blueScore++;
                }

                // Add to kill feed
                addKillFeed(killer.name, this.name, killer.team);
            }
        }

        // Show death screen for local player
        if (this.id === gameState.myId) {
            showDeathScreen();
        }
    }

    respawn() {
        this.isDead = false;
        this.health = this.maxHealth;
        this.x = this.team === 'red' ? 200 : canvas.width - 200;
        this.y = canvas.height / 2 + (Math.random() - 0.5) * 200;
        
        if (this.id === gameState.myId) {
            hideDeathScreen();
        }
    }

    shoot(targetX, targetY) {
        if (this.isDead) return null;

        const weapon = WEAPONS[this.currentWeapon];
        const now = Date.now();

        if (now - this.lastShot < weapon.fireRate) return null;

        this.lastShot = now;

        // Calculate bullet direction
        const angle = Math.atan2(targetY - this.y, targetX - this.x);

        if (this.currentWeapon === 'shotgun') {
            // Shotgun fires multiple pellets
            const bullets = [];
            for (let i = 0; i < weapon.pellets; i++) {
                const spread = (Math.random() - 0.5) * weapon.spread;
                bullets.push({
                    x: this.x + Math.cos(angle) * (this.radius + 10),
                    y: this.y + Math.sin(angle) * (this.radius + 10),
                    vx: Math.cos(angle + spread) * 20,
                    vy: Math.sin(angle + spread) * 20,
                    damage: weapon.damage / weapon.pellets,
                    owner: this.id,
                    team: this.team,
                    distance: 0,
                    maxDistance: 300
                });
            }
            return bullets;
        } else {
            // Regular bullet
            const accuracy = weapon.accuracy;
            const spread = (Math.random() - 0.5) * (1 - accuracy) * 0.1;
            
            return [{
                x: this.x + Math.cos(angle) * (this.radius + 10),
                y: this.y + Math.sin(angle) * (this.radius + 10),
                vx: Math.cos(angle + spread) * 25,
                vy: Math.sin(angle + spread) * 25,
                damage: weapon.damage,
                owner: this.id,
                team: this.team,
                distance: 0,
                maxDistance: this.currentWeapon === 'sniper' ? 1500 : 800
            }];
        }
    }
}

// Generate Obstacles (Cover)
function generateObstacles() {
    const obstacles = [];
    
    // Center cover
    obstacles.push({ x: canvas.width / 2 - 50, y: canvas.height / 2 - 50, width: 100, height: 100, color: '#555' });
    
    // Side covers
    for (let i = 0; i < 8; i++) {
        obstacles.push({
            x: 200 + Math.random() * (canvas.width - 400),
            y: 100 + Math.random() * (canvas.height - 200),
            width: 50 + Math.random() * 50,
            height: 50 + Math.random() * 50,
            color: '#444'
        });
    }
    
    return obstacles;
}

gameState.obstacles = generateObstacles();

// UI Events
const startButton = document.getElementById('startButton');
const playerNameInput = document.getElementById('playerName');
const teamOptions = document.querySelectorAll('.team-option');
let selectedTeam = 'red';

teamOptions.forEach(option => {
    option.addEventListener('click', () => {
        teamOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedTeam = option.dataset.team;
    });
});

startButton.addEventListener('click', startGame);
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

function startGame() {
    const playerName = playerNameInput.value.trim() || 'Soldier_' + Math.floor(Math.random() * 999);
    
    const player = new Player(gameState.myId, playerName, selectedTeam);
    gameState.players.set(gameState.myId, player);
    
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    gameState.started = true;
    
    // Lock pointer for FPS feel
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.onclick = function() {
        canvas.requestPointerLock();
    };
    
    gameLoop();
    storePlayerData();
    
    // Add bots
    setTimeout(() => addBot('red'), 1000);
    setTimeout(() => addBot('blue'), 1500);
    setTimeout(() => addBot('red'), 2000);
    setTimeout(() => addBot('blue'), 2500);
}

// Controls
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    const myPlayer = gameState.players.get(gameState.myId);
    if (!myPlayer || myPlayer.isDead) return;

    // Movement
    if (keys['w']) myPlayer.isMoving.up = true;
    if (keys['s']) myPlayer.isMoving.down = true;
    if (keys['a']) myPlayer.isMoving.left = true;
    if (keys['d']) myPlayer.isMoving.right = true;

    // Weapon switch
    if (e.key === '1') switchWeapon('rifle');
    if (e.key === '2') switchWeapon('sniper');
    if (e.key === '3') switchWeapon('shotgun');

    // Reload
    if (e.key.toLowerCase() === 'r') reload();
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    
    const myPlayer = gameState.players.get(gameState.myId);
    if (!myPlayer) return;

    if (e.key.toLowerCase() === 'w') myPlayer.isMoving.up = false;
    if (e.key.toLowerCase() === 's') myPlayer.isMoving.down = false;
    if (e.key.toLowerCase() === 'a') myPlayer.isMoving.left = false;
    if (e.key.toLowerCase() === 'd') myPlayer.isMoving.right = false;
});

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

canvas.addEventListener('mousedown', (e) => {
    if (!gameState.started || gameState.isReloading) return;
    
    const myPlayer = gameState.players.get(gameState.myId);
    if (!myPlayer || myPlayer.isDead) return;

    const currentAmmo = gameState.ammo[gameState.currentWeapon];
    
    if (currentAmmo > 0) {
        const bullets = myPlayer.shoot(mouseX, mouseY);
        if (bullets) {
            gameState.bullets.push(...bullets);
            gameState.ammo[gameState.currentWeapon]--;
            updateAmmoDisplay();
            createMuzzleFlash(myPlayer.x, myPlayer.y, myPlayer.angle);
        }
    }
});

function switchWeapon(weapon) {
    if (gameState.isReloading) return;
    gameState.currentWeapon = weapon;
    
    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer) myPlayer.currentWeapon = weapon;
    
    updateWeaponDisplay();
    updateAmmoDisplay();
}

function reload() {
    if (gameState.isReloading) return;
    
    const weapon = gameState.currentWeapon;
    const weaponData = WEAPONS[weapon];
    const currentAmmo = gameState.ammo[weapon];
    const reserveAmmo = gameState.reserve[weapon];
    
    if (currentAmmo === weaponData.magazineSize || reserveAmmo === 0) return;
    
    gameState.isReloading = true;
    document.getElementById('reloadIndicator').classList.add('show');
    
    setTimeout(() => {
        const ammoNeeded = weaponData.magazineSize - currentAmmo;
        const ammoToReload = Math.min(ammoNeeded, reserveAmmo);
        
        gameState.ammo[weapon] += ammoToReload;
        gameState.reserve[weapon] -= ammoToReload;
        
        gameState.isReloading = false;
        document.getElementById('reloadIndicator').classList.remove('show');
        updateAmmoDisplay();
    }, weaponData.reloadTime);
}

// Bullet System
function updateBullets() {
    gameState.bullets = gameState.bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.distance += Math.sqrt(bullet.vx ** 2 + bullet.vy ** 2);

        // Check bounds and max distance
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height ||
            bullet.distance > bullet.maxDistance) {
            return false;
        }

        // Check collision with obstacles
        for (let obs of gameState.obstacles) {
            if (bullet.x > obs.x && bullet.x < obs.x + obs.width &&
                bullet.y > obs.y && bullet.y < obs.y + obs.height) {
                return false;
            }
        }

        // Check collision with players
        for (let [id, player] of gameState.players) {
            if (id === bullet.owner || player.isDead || player.team === bullet.team) continue;

            const dx = player.x - bullet.x;
            const dy = player.y - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < player.radius) {
                player.takeDamage(bullet.damage, bullet.owner);
                return false;
            }
        }

        return true;
    });
}

function drawBullets() {
    gameState.bullets.forEach(bullet => {
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

// Multiplayer via LocalStorage
function storePlayerData() {
    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer) {
        const playerData = {
            id: myPlayer.id,
            name: myPlayer.name,
            team: myPlayer.team,
            x: myPlayer.x,
            y: myPlayer.y,
            angle: myPlayer.angle,
            health: myPlayer.health,
            kills: myPlayer.kills,
            deaths: myPlayer.deaths,
            isDead: myPlayer.isDead,
            currentWeapon: myPlayer.currentWeapon,
            lastUpdate: Date.now()
        };
        localStorage.setItem(myPlayer.id, JSON.stringify(playerData));
        localStorage.setItem('gameScore', JSON.stringify({
            red: gameState.redScore,
            blue: gameState.blueScore
        }));
    }
}

function loadOtherPlayers() {
    // Load scores
    const scoreData = localStorage.getItem('gameScore');
    if (scoreData) {
        const scores = JSON.parse(scoreData);
        gameState.redScore = scores.red;
        gameState.blueScore = scores.blue;
    }

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('player_') && key !== gameState.myId) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                
                if (Date.now() - data.lastUpdate < 3000) {
                    if (!gameState.players.has(data.id)) {
                        const player = new Player(data.id, data.name, data.team);
                        gameState.players.set(data.id, player);
                    }
                    
                    const player = gameState.players.get(data.id);
                    Object.assign(player, data);
                } else {
                    localStorage.removeItem(key);
                    gameState.players.delete(data.id);
                }
            } catch (e) {}
        }
    }
}

// Bot AI
function addBot(team) {
    const botNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
    const botId = 'bot_' + Math.random().toString(36).substr(2, 9);
    const bot = new Player(botId, botNames[Math.floor(Math.random() * botNames.length)], team);
    gameState.players.set(botId, bot);

    // Bot AI
    setInterval(() => {
        if (!gameState.started || bot.isDead) {
            if (bot.isDead && Date.now() > bot.respawnTime) {
                bot.respawn();
            }
            return;
        }

        // Random movement
        if (Math.random() > 0.95) {
            bot.isMoving = {
                up: Math.random() > 0.5,
                down: Math.random() > 0.5,
                left: Math.random() > 0.5,
                right: Math.random() > 0.5
            };
        }

        // Find and shoot nearest enemy
        let nearestEnemy = null;
        let minDist = Infinity;

        for (let [id, player] of gameState.players) {
            if (id === botId || player.isDead || player.team === bot.team) continue;
            const dist = Math.hypot(player.x - bot.x, player.y - bot.y);
            if (dist < minDist) {
                minDist = dist;
                nearestEnemy = player;
            }
        }

        if (nearestEnemy && minDist < 500) {
            bot.angle = Math.atan2(nearestEnemy.y - bot.y, nearestEnemy.x - bot.x);
            
            if (Math.random() > 0.7) {
                const bullets = bot.shoot(nearestEnemy.x, nearestEnemy.y);
                if (bullets) gameState.bullets.push(...bullets);
            }
        }

        bot.update(bot.x + Math.cos(bot.angle) * 100, bot.y + Math.sin(bot.angle) * 100);
    }, 100);
}

// UI Functions
function updateAmmoDisplay() {
    const weapon = gameState.currentWeapon;
    document.getElementById('currentAmmo').textContent = gameState.ammo[weapon];
    document.getElementById('reserveAmmo').textContent = gameState.reserve[weapon];
}

function updateWeaponDisplay() {
    const weapon = WEAPONS[gameState.currentWeapon];
    document.getElementById('weaponName').textContent = weapon.name;
    
    document.querySelectorAll('.weapon-slot').forEach(slot => {
        slot.classList.remove('active');
    });
    
    const weaponIndex = {rifle: 1, sniper: 2, shotgun: 3};
    const activeSlot = document.querySelector(`.weapon-slot[data-weapon="${weaponIndex[gameState.currentWeapon]}"]`);
    if (activeSlot) activeSlot.classList.add('active');
}

function updateHealthBar() {
    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer) {
        const healthPercent = (myPlayer.health / myPlayer.maxHealth) * 100;
        document.querySelector('#healthBar .fill').style.width = healthPercent + '%';
    }
}

function updateScoreBoard() {
    document.getElementById('redScore').textContent = gameState.redScore;
    document.getElementById('blueScore').textContent = gameState.blueScore;
}

function addKillFeed(killerName, victimName, team) {
    const killFeed = document.getElementById('killFeed');
    const msg = document.createElement('div');
    msg.className = 'kill-message';
    msg.innerHTML = `<span style="color: ${team === 'red' ? '#ff4444' : '#4444ff'}">${killerName}</span> eliminated <span style="color: #aaa">${victimName}</span>`;
    killFeed.appendChild(msg);
    
    setTimeout(() => msg.remove(), 5000);
    
    // Keep only last 5 messages
    while (killFeed.children.length > 5) {
        killFeed.firstChild.remove();
    }
}

function createMuzzleFlash(x, y, angle) {
    const flash = document.createElement('div');
    flash.className = 'muzzle-flash';
    flash.style.left = x + Math.cos(angle) * 30 + 'px';
    flash.style.top = y + Math.sin(angle) * 30 + 'px';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 100);
}

function showDeathScreen() {
    document.getElementById('deathScreen').classList.add('show');
    let countdown = 5;
    
    const interval = setInterval(() => {
        countdown--;
        document.getElementById('respawnTimer').textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(interval);
            const myPlayer = gameState.players.get(gameState.myId);
            if (myPlayer) myPlayer.respawn();
        }
    }, 1000);
}

function hideDeathScreen() {
    document.getElementById('deathScreen').classList.remove('show');
}

// Draw Minimap
function drawMinimap() {
    const scale = 0.15;
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, 200, 200);

    // Draw obstacles
    gameState.obstacles.forEach(obs => {
        minimapCtx.fillStyle = '#555';
        minimapCtx.fillRect(obs.x * scale, obs.y * scale, obs.width * scale, obs.height * scale);
    });

    // Draw players
    gameState.players.forEach(player => {
        if (player.isDead) return;
        minimapCtx.fillStyle = player.color;
        minimapCtx.beginPath();
        minimapCtx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    });
}

// Game Loop
function gameLoop() {
    if (!gameState.started) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw obstacles
    gameState.obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Update and draw players
    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer) {
        myPlayer.update(mouseX, mouseY);
    }

    gameState.players.forEach(player => {
        if (player.isDead && Date.now() > player.respawnTime) {
            player.respawn();
        }
        player.draw();
    });

    // Update and draw bullets
    updateBullets();
    drawBullets();

    // Update UI
    updateHealthBar();
    updateScoreBoard();
    drawMinimap();

    // Multiplayer sync
    storePlayerData();
    loadOtherPlayers();

    requestAnimationFrame(gameLoop);
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (gameState.started) {
        localStorage.removeItem(gameState.myId);
    }
});
