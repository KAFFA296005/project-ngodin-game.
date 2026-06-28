// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Faction Configuration
const FACTIONS = {
    red: { name: 'RED RAVENS', color: '#ff0055', damageMultiplier: 1.2 },
    blue: { name: 'BLUE LEGION', color: '#00ccff', defenseMultiplier: 1.2 },
    green: { name: 'GREEN VIPERS', color: '#00ff41', speedMultiplier: 1.2 }
};

// Weapon Configuration
const WEAPONS = {
    laser: { damage: 10, speed: 15, cooldown: 200, color: '#00ffff', size: 5 },
    missile: { damage: 30, speed: 8, cooldown: 1000, color: '#ff0055', size: 8, explosive: true },
    emp: { damage: 50, speed: 0, cooldown: 3000, color: '#ffff00', size: 100, aoe: true }
};

// Game State
const gameState = {
    players: new Map(),
    projectiles: [],
    explosions: [],
    myId: 'player_' + Math.random().toString(36).substr(2, 9),
    started: false,
    currentWeapon: 'laser',
    lastShot: 0,
    kills: 0
};

// Player Class
class Player {
    constructor(id, name, faction) {
        this.id = id;
        this.name = name;
        this.faction = faction;
        this.factionData = FACTIONS[faction];
        this.color = this.factionData.color;
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = Math.random() * (canvas.height - 200) + 100;
        this.targetX = this.x;
        this.targetY = this.y;
        this.angle = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.shield = 50;
        this.speed = 4 * (this.factionData.speedMultiplier || 1);
        this.radius = 20;
        this.territories = [];
        this.score = 0;
        this.kills = 0;
        this.lastDamaged = 0;
        this.lastShot = 0;
    }

    update() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
            
            if (Math.random() > 0.7) {
                this.territories.push({ x: this.x, y: this.y, time: Date.now() });
            }
        }

        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        this.territories = this.territories.filter(t => Date.now() - t.time < 10000);
        this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);

        if (Date.now() - this.lastDamaged > 3000 && this.shield < 50) {
            this.shield += 0.5;
        }

        this.score = (this.territories.length * 10) + (this.kills * 100);
    }

    draw() {
        // Draw territories
        this.territories.forEach(territory => {
            const age = Date.now() - territory.time;
            const opacity = 1 - (age / 10000);
            ctx.fillStyle = this.color + Math.floor(opacity * 50).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(territory.x, territory.y, 15, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw player
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (this.shield > 0) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = this.shield / 50;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(0, -5, this.radius + 10, 10);
        ctx.restore();

        // Health bar
        const barWidth = 50;
        const barHeight = 5;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.radius - 15;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthWidth = (this.health / this.maxHealth) * barWidth;
        ctx.fillStyle = this.health > 50 ? '#00ff41' : this.health > 25 ? '#ffaa00' : '#ff0055';
        ctx.fillRect(barX, barY, healthWidth, barHeight);

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(this.name, this.x, this.y - this.radius - 25);
        ctx.shadowBlur = 0;
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    takeDamage(amount, attacker) {
        const defense = this.factionData.defenseMultiplier || 1;
        const actualDamage = amount / defense;

        if (this.shield > 0) {
            this.shield -= actualDamage;
            if (this.shield < 0) {
                this.health += this.shield;
                this.shield = 0;
            }
        } else {
            this.health -= actualDamage;
        }

        this.lastDamaged = Date.now();
        return this.health <= 0;
    }

    shoot(targetX, targetY, weapon) {
        const weaponData = WEAPONS[weapon];
        const now = Date.now();

        if (now - this.lastShot < weaponData.cooldown) return null;

        this.lastShot = now;

        if (weapon === 'emp') {
            return {
                type: 'emp',
                x: this.x,
                y: this.y,
                radius: weaponData.size,
                damage: weaponData.damage,
                owner: this.id,
                time: now
            };
        }

        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        return {
            type: weapon,
            x: this.x + Math.cos(angle) * (this.radius + 15),
            y: this.y + Math.sin(angle) * (this.radius + 15),
            vx: Math.cos(angle) * weaponData.speed,
            vy: Math.sin(angle) * weaponData.speed,
            damage: weaponData.damage * (this.factionData.damageMultiplier || 1),
            color: weaponData.color,
            size: weaponData.size,
            owner: this.id,
            explosive: weaponData.explosive
        };
    }
}

// UI Events
const startButton = document.getElementById('startButton');
const playerNameInput = document.getElementById('playerName');
const factionOptions = document.querySelectorAll('.faction-option');
let selectedFaction = 'red';

factionOptions.forEach(option => {
    option.addEventListener('click', () => {
        factionOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedFaction = option.dataset.faction;
    });
});

startButton.addEventListener('click', startGame);
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

function startGame() {
    const playerName = playerNameInput.value.trim() || 'Agent_' + Math.floor(Math.random() * 999);
    
    const player = new Player(gameState.myId, playerName, selectedFaction);
    gameState.players.set(gameState.myId, player);
    
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameInfo').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('stats').style.display = 'block';
    document.getElementById('weaponPanel').style.display = 'flex';
    
    gameState.started = true;
    player.lastShot = Date.now();
    
    gameLoop();
    storePlayerData();
    
    setTimeout(() => addBot(), 2000);
    setTimeout(() => addBot(), 4000);
}

// Controls
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let isMoving = false;

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if (gameState.started && isMoving) {
        const myPlayer = gameState.players.get(gameState.myId);
        if (myPlayer) myPlayer.setTarget(mouseX, mouseY);
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        isMoving = true;
        const myPlayer = gameState.players.get(gameState.myId);
        if (myPlayer && gameState.started) myPlayer.setTarget(mouseX, mouseY);
    }
});

canvas.addEventListener('mouseup', () => isMoving = false);
canvas.addEventListener('click', (e) => shoot(e.clientX, e.clientY));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Weapon Selection
document.querySelectorAll('.weapon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameState.currentWeapon = btn.dataset.weapon;
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === '1') selectWeapon('laser');
    if (e.key === '2') selectWeapon('missile');
    if (e.key === '3') selectWeapon('emp');
});

function selectWeapon(weapon) {
    gameState.currentWeapon = weapon;
    document.querySelectorAll('.weapon-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.weapon === weapon);
    });
}

function shoot(targetX, targetY) {
    if (!gameState.started) return;
    
    const myPlayer = gameState.players.get(gameState.myId);
    if (!myPlayer) return;

    const projectile = myPlayer.shoot(targetX, targetY, gameState.currentWeapon);
    if (projectile) {
        gameState.projectiles.push(projectile);
        
        if (projectile.type === 'emp') {
            createExplosion(projectile.x, projectile.y, projectile.radius, projectile.color);
            checkEMPHits(projectile);
        }
    }
}

// Combat System
function updateProjectiles() {
    gameState.projectiles = gameState.projectiles.filter(proj => {
        if (proj.type === 'emp') return false;

        proj.x += proj.vx;
        proj.y += proj.vy;

        if (proj.x < 0 || proj.x > canvas.width || proj.y < 0 || proj.y > canvas.height) {
            return false;
        }

        for (let [id, player] of gameState.players) {
            if (id === proj.owner || player.health <= 0) continue;

            const dx = player.x - proj.x;
            const dy = player.y - proj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < player.radius) {
                const dead = player.takeDamage(proj.damage, proj.owner);
                
                if (proj.explosive) {
                    createExplosion(proj.x, proj.y, 50, proj.color);
                }

                if (dead) {
                    handlePlayerDeath(player, proj.owner);
                }

                return false;
            }
        }

        return true;
    });
}

function checkEMPHits(emp) {
    for (let [id, player] of gameState.players) {
        if (id === emp.owner) continue;

        const dx = player.x - emp.x;
        const dy = player.y - emp.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < emp.radius) {
            const dead = player.takeDamage(emp.damage, emp.owner);
            if (dead) handlePlayerDeath(player, emp.owner);
        }
    }
}

function handlePlayerDeath(player, killerId) {
    createExplosion(player.x, player.y, 100, player.color);
    
    if (killerId === gameState.myId) {
        gameState.kills++;
        const myPlayer = gameState.players.get(gameState.myId);
        if (myPlayer) myPlayer.kills++;
    }

    setTimeout(() => {
        player.health = player.maxHealth;
        player.shield = 50;
        player.x = Math.random() * (canvas.width - 200) + 100;
        player.y = Math.random() * (canvas.height - 200) + 100;
        player.territories = [];
    }, 3000);
}

function createExplosion(x, y, radius, color) {
    gameState.explosions.push({ x, y, radius, color, time: Date.now(), duration: 500 });
}

function drawProjectiles() {
    gameState.projectiles.forEach(proj => {
        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function drawExplosions() {
    gameState.explosions = gameState.explosions.filter(exp => {
        const age = Date.now() - exp.time;
        if (age > exp.duration) return false;

        const progress = age / exp.duration;
        const currentRadius = exp.radius * (1 + progress);
        const opacity = 1 - progress;

        ctx.strokeStyle = exp.color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        return true;
    });
}

// Multiplayer via LocalStorage
function storePlayerData() {
    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer && myPlayer.health > 0) {
        const playerData = {
            id: myPlayer.id,
            name: myPlayer.name,
            faction: myPlayer.faction,
            x: myPlayer.x,
            y: myPlayer.y,
            targetX: myPlayer.targetX,
            targetY: myPlayer.targetY,
            health: myPlayer.health,
            shield: myPlayer.shield,
            territories: myPlayer.territories,
            kills: myPlayer.kills,
            score: myPlayer.score,
            lastUpdate: Date.now()
        };
        localStorage.setItem(myPlayer.id, JSON.stringify(playerData));
    }
}

function loadOtherPlayers() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('player_') && key !== gameState.myId) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                
                if (Date.now() - data.lastUpdate < 3000) {
                    if (!gameState.players.has(data.id)) {
                        const player = new Player(data.id, data.name, data.faction);
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
function addBot() {
    const botNames = ['DELTA-9', 'OMEGA-7', 'SIGMA-4', 'ALPHA-2', 'BETA-5'];
    const factions = ['red', 'blue', 'green'];
    
    const botId = 'bot_' + Math.random().toString(36).substr(2, 9);
    const bot = new Player(botId, botNames[Math.floor(Math.random() * botNames.length)], factions[Math.floor(Math.random() * factions.length)]);
    gameState.players.set(botId, bot);

    setInterval(() => {
        if (!gameState.started || bot.health <= 0) return;

        if (Math.random() > 0.8) {
            bot.setTarget(Math.random() * canvas.width, Math.random() * canvas.height);
        }

        if (Math.random() > 0.7) {
            let nearestEnemy = null;
            let minDist = Infinity;

            for (let [id, player] of gameState.players) {
                if (id === botId || player.health <= 0) continue;
                const dist = Math.hypot(player.x - bot.x, player.y - bot.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestEnemy = player;
                }
            }

            if (nearestEnemy && minDist < 400) {
                const proj = bot.shoot(nearestEnemy.x, nearestEnemy.y, 'laser');
                if (proj) gameState.projectiles.push(proj);
            }
        }
    }, 1500);
}

// Game Loop
function gameLoop() {
    if (!gameState.started) return;

    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawExplosions();

    gameState.players.forEach(player => {
        if (player.health > 0) {
            player.update();
            player.draw();
        }
    });

    updateProjectiles();
    drawProjectiles();
    storePlayerData();
    loadOtherPlayers();
    updateUI();
    updateWeaponCooldowns();

    requestAnimationFrame(gameLoop);
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.05)';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function updateUI() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';

    gameState.players.forEach(player => {
        if (player.health > 0) {
            const div = document.createElement('div');
            div.className = 'player-info';
            div.innerHTML = `
                <span>${player.name} ${player.id === gameState.myId ? '(YOU)' : ''}</span>
                <span style="color: ${player.health > 50 ? '#00ff41' : '#ff0055'}">${Math.floor(player.health)}%</span>
            `;
            playersList.appendChild(div);
        }
    });

    const leaderboardList = document.getElementById('leaderboardList');
    const sortedPlayers = Array.from(gameState.players.values())
        .filter(p => p.health > 0)
        .sort((a, b) => b.score - a.score);

    leaderboardList.innerHTML = '';
    sortedPlayers.slice(0, 5).forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-entry' + (player.id === gameState.myId ? ' you' : '');
        div.innerHTML = `
            <span>${index + 1}. ${player.name}</span>
            <span style="color: ${player.color}">${player.score}</span>
        `;
        leaderboardList.appendChild(div);
    });

    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer) {
        document.getElementById('killCount').textContent = myPlayer.kills;
        document.getElementById('territoryCount').textContent = myPlayer.territories.length;
        document.getElementById('powerLevel').textContent = Math.floor(myPlayer.health + myPlayer.shield);
    }
}

function updateWeaponCooldowns() {
    const myPlayer = gameState.players.get(gameState.myId);
    if (!myPlayer) return;

    document.querySelectorAll('.weapon-btn').forEach(btn => {
        const weapon = btn.dataset.weapon;
        const weaponData = WEAPONS[weapon];
        const timeSinceLastShot = Date.now() - myPlayer.lastShot;
        
        if (weapon === gameState.currentWeapon && timeSinceLastShot < weaponData.cooldown) {
            btn.classList.add('cooldown');
        } else {
            btn.classList.remove('cooldown');
        }
    });
}

window.addEventListener('beforeunload', () => {
    if (gameState.started) {
        localStorage.removeItem(gameState.myId);
    }
});     
