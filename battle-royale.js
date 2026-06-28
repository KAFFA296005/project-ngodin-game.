// Animated Background
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
bgCanvas.width = window.innerWidth;
bgCanvas.height = window.innerHeight;

class Star {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.y += this.speed;
        if (this.y > bgCanvas.height) this.reset();
    }
    draw() {
        bgCtx.fillStyle = '#fff';
        bgCtx.globalAlpha = Math.random() * 0.5 + 0.5;
        bgCtx.beginPath();
        bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        bgCtx.fill();
    }
}

const stars = Array.from({length: 150}, () => new Star());

function animateBackground() {
    bgCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.globalAlpha = 1;
    stars.forEach(star => {
        star.update();
        star.draw();
    });
    requestAnimationFrame(animateBackground);
}
animateBackground();

// Game Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
});

// Game State
const gameState = {
    players: new Map(),
    started: false,
    myId: 'player_' + Math.random().toString(36).substr(2, 9),
    character: 'assault',
    keys: {}
};

// Character Configuration
const CHARACTERS = {
    assault: { name: 'ASSAULT', color: '#ff4444', icon: '⚔️' },
    tank: { name: 'TANK', color: '#4444ff', icon: '🛡️' },
    sniper: { name: 'SNIPER', color: '#44ff44', icon: '🎯' },
    medic: { name: 'MEDIC', color: '#ffff44', icon: '💊' }
};

// Player Class
class Player {
    constructor(id, name, character) {
        this.id = id;
        this.name = name;
        this.character = character;
        this.charData = CHARACTERS[character];
        this.color = this.charData.color;
        this.x = canvas.width / 2 + (Math.random() - 0.5) * 200;
        this.y = canvas.height / 2 + (Math.random() - 0.5) * 200;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 5;
        this.radius = 15;
        this.kills = 0;
        this.isDead = false;
    }

    update(keys, mouseX, mouseY) {
        if (this.isDead) return;

        this.vx = 0;
        this.vy = 0;
        if (keys['w']) this.vy -= 1;
        if (keys['s']) this.vy += 1;
        if (keys['a']) this.vx -= 1;
        if (keys['d']) this.vx += 1;

        if (this.vx !== 0 && this.vy !== 0) {
            this.vx *= 0.707;
            this.vy *= 0.707;
        }

        this.x += this.vx * this.speed;
        this.y += this.vy * this.speed;

        this.x = Math.max(50, Math.min(canvas.width - 50, this.x));
        this.y = Math.max(50, Math.min(canvas.height - 50, this.y));

        this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
    }

    draw() {
        if (this.isDead) return;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + 3, this.y + 3, this.radius, this.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.color + '80');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.rotate(this.angle);
        ctx.fillStyle = '#333';
        ctx.fillRect(0, -4, this.radius + 12, 8);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.radius + 8, -2, 8, 4);
        
        ctx.restore();

        // Icon
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.charData.icon, this.x, this.y + 5);

        // Name
        ctx.font = 'bold 12px Orbitron, Arial';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 5;
        ctx.fillText(this.name, this.x, this.y - this.radius - 10);
        ctx.shadowBlur = 0;

        // Health bar
        const barWidth = 50;
        const barHeight = 5;
        const x = this.x - barWidth / 2;
        const y = this.y - this.radius - 5;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x, y, barWidth, barHeight);

        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    }
}

// UI Setup
const startButton = document.getElementById('startButton');
const playerNameInput = document.getElementById('playerName');
const characterCards = document.querySelectorAll('.character-card');

characterCards.forEach(card => {
    card.addEventListener('click', () => {
        characterCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        gameState.character = card.dataset.char;
    });
});

startButton.addEventListener('click', startGame);
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

function startGame() {
    const playerName = playerNameInput.value.trim() || 'Player_' + Math.floor(Math.random() * 999);
    
    const player = new Player(gameState.myId, playerName, gameState.character);
    gameState.players.set(gameState.myId, player);
    
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    gameState.started = true;
    gameLoop();
    
    // Add some bots
    setTimeout(() => addBot(), 1000);
    setTimeout(() => addBot(), 2000);
    setTimeout(() => addBot(), 3000);
}

// Controls
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

document.addEventListener('keydown', (e) => {
    gameState.keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    gameState.keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Bot AI
function addBot() {
    const botNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Ghost', 'Hunter'];
    const characters = ['assault', 'tank', 'sniper', 'medic'];
    
    const botId = 'bot_' + Math.random().toString(36).substr(2, 9);
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    const botChar = characters[Math.floor(Math.random() * characters.length)];
    
    const bot = new Player(botId, botName, botChar);
    gameState.players.set(botId, bot);

    // Bot AI
    setInterval(() => {
        if (!gameState.started || bot.isDead) return;

        // Random movement
        if (Math.random() > 0.95) {
            const targetX = Math.random() * canvas.width;
            const targetY = Math.random() * canvas.height;
            bot.angle = Math.atan2(targetY - bot.y, targetX - bot.x);
        }

        // Simple movement
        if (Math.random() > 0.9) {
            const keys = {
                w: Math.random() > 0.5,
                s: Math.random() > 0.5,
                a: Math.random() > 0.5,
                d: Math.random() > 0.5
            };
            const targetX = bot.x + Math.cos(bot.angle) * 100;
            const targetY = bot.y + Math.sin(bot.angle) * 100;
            bot.update(keys, targetX, targetY);
        }
    }, 100);
}

// Update UI
function updateUI() {
    const myPlayer = gameState.players.get(gameState.myId);
    if (!myPlayer) return;

    // Update health
    const healthPercent = (myPlayer.health / myPlayer.maxHealth) * 100;
    document.getElementById('healthFill').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent = Math.floor(myPlayer.health) + ' HP';

    // Update kills
    document.getElementById('killCount').textContent = myPlayer.kills;

    // Update alive count
    const aliveCount = Array.from(gameState.players.values()).filter(p => !p.isDead).length;
    document.getElementById('aliveCount').textContent = aliveCount;

    // Update leaderboard
    const sortedPlayers = Array.from(gameState.players.values())
        .filter(p => !p.isDead)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 5);

    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';
    sortedPlayers.forEach((player, index) => {
        const entry = document.createElement('div');
        entry.className = 'leaderboard-entry' + (player.id === gameState.myId ? ' you' : '');
        entry.innerHTML = `
            <span><span class="rank">#${index + 1}</span> ${player.name}</span>
            <span style="color: ${player.color}; font-weight: bold;">${player.kills} kills</span>
        `;
        leaderboardList.appendChild(entry);
    });

    // Draw minimap
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, 220, 220);

    const scale = 220 / Math.max(canvas.width, canvas.height);
    gameState.players.forEach(player => {
        if (player.isDead) return;
        minimapCtx.fillStyle = player.color;
        minimapCtx.beginPath();
        minimapCtx.arc(player.x * scale, player.y * scale, 4, 0, Math.PI * 2);
        minimapCtx.fill();
    });
}

// Game Loop
function gameLoop() {
    if (!gameState.started) return;

    // Clear canvas
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
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

    // Update and draw players
    const myPlayer = gameState.players.get(gameState.myId);
    if (myPlayer) {
        myPlayer.update(gameState.keys, mouseX, mouseY);
    }

    gameState.players.forEach(player => {
        player.draw();
    });

    // Update UI
    updateUI();

    requestAnimationFrame(gameLoop);
}

console.log('Battle Royale game loaded! Press START to play.');
