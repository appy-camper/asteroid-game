const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Game objects
const spaceship = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    width: 50, // Visual width
    height: 50, // Visual height
    hitboxWidth: 0, // Add hitbox width
    hitboxHeight: 0, // Add hitbox height
    speed: 5,
    img: new Image(),
    // Flame properties
    flameSize: 0, 
    flameFlickerRate: 0.5,
    flameMaxSize: 15,
    // Powerup state
    hasShield: false,
    shieldColor: 'rgba(0, 150, 255, 0.4)', // Semi-transparent blue
    // Weapon state
    fireRate: 400, // Base fire rate (ms between shots)
    rapidFireRate: 50, // Faster fire rate (ms)
    rapidFireDuration: 5000, // Duration of rapid fire (ms)
    rapidFireEndTime: 0, // Timestamp when rapid fire ends
    lastShotTime: 0, // Timestamp of the last shot
    // Spread Shot state
    spreadShotDuration: 6000, // Duration of spread shot (ms)
    spreadShotEndTime: 0, // Timestamp when spread shot ends
    // Malfunction state
    weaponMalfunctionDuration: 5000, // Duration of malfunction (ms)
    weaponMalfunctionEndTime: 0, // Timestamp when malfunction ends
    // Wide Shot state
    wideShotDuration: 7000, // Duration of wide shot (ms)
    wideShotEndTime: 0 // Timestamp when wide shot ends
};

const asteroids = [];
const baseAsteroidSize = 30; // Rename original size
const baseAsteroidSpeed = 3; 
let score = 0;
let gameOver = false;

// Bullets array
const bullets = [];
const bulletSpeed = 7;
const bulletSize = 5; // Base width
const wideBulletSize = 35; // Increased width for wide shot (was 25)
const wideBulletHeight = 10; // Increased height for wide shot (base is bulletSize*2 = 10)
const wideShotFireRate = 180; // Specific fire rate for wide shot (ms) - faster than base (400) but slower than rapid (50)
const bulletSpreadSpeed = 2.5; 

// Powerups array
const powerups = [];
const powerupSize = 15;
const powerupSpeed = 2;
const powerupDropChance = 0.2; // Increased from 0.1 (10% -> 20%)

// Floating score text array
const floatingScores = [];
const floatSpeed = 0.8; 
const floatLife = 60; // Lifespan in frames (~1 second)

// Explosion particles array
const explosionParticles = [];

// Star background
const stars = [];
const numStars = 100;

// Mouse position
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2; // Initialize mouseY

// Load images
let shipImageLoaded = false;
let asteroidImageLoaded = false; // Add back asteroid loaded flag
const desiredShipWidth = 50; 

const asteroidImg = new Image(); // Add back asteroid image object
asteroidImg.onload = () => {
    console.log("Asteroid image loaded");
    asteroidImageLoaded = true;
    startGameIfReady(); // Call check
};
asteroidImg.onerror = (err) => { 
    console.error("Error loading asteroid image:", err);
    // Decide if game should start anyway with fallback later if needed
};
asteroidImg.src = 'asteroid.svg'; // Set asteroid image source

spaceship.img.onload = () => {
    console.log("Spaceship image loaded");
    const aspectRatio = spaceship.img.height / spaceship.img.width;
    spaceship.width = desiredShipWidth;
    spaceship.height = desiredShipWidth * aspectRatio;

    // Calculate hitbox size (e.g., 70% of visual size)
    const hitboxScale = 0.7;
    spaceship.hitboxWidth = spaceship.width * hitboxScale;
    spaceship.hitboxHeight = spaceship.height * hitboxScale;

    shipImageLoaded = true;
    startGameIfReady(); // Call check
};
spaceship.img.src = 'ship.png';

// Mouse state
let isMouseDown = false; 

// Event listeners
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top; // Store Y position
});

// ADD mousedown listener
canvas.addEventListener('mousedown', (e) => {
    if (gameOver) {
        resetGame();
    } else {
        isMouseDown = true;
    }
});

// ADD mouseup listener
canvas.addEventListener('mouseup', (e) => {
    isMouseDown = false;
});

// Create asteroids (Modified for dx)
function createAsteroid() {
    const x = Math.random() * (canvas.width - baseAsteroidSize * 2.5); // Adjust spawn range for largest size
    const y = -baseAsteroidSize * 2.5; // Start above canvas based on largest size

    const sizeRoll = Math.random();
    let sizeCategory;
    let health;
    let sizeMultiplier;
    let scoreValue;

    if (sizeRoll < 0.6) { // 60% chance Small
        sizeCategory = 'small';
        health = 1;
        sizeMultiplier = 1.0;
        scoreValue = 10;
    } else if (sizeRoll < 0.9) { // 30% chance Medium
        sizeCategory = 'medium';
        health = 3;
        sizeMultiplier = 1.75;
        scoreValue = 25;
    } else { // 10% chance Large
        sizeCategory = 'large';
        health = 5;
        sizeMultiplier = 2.5;
        scoreValue = 50;
    }

    const actualWidth = baseAsteroidSize * sizeMultiplier;
    const actualHeight = baseAsteroidSize * sizeMultiplier; // Assuming square/circular base

    const speed = baseAsteroidSpeed * (Math.random() * 0.6 + 0.7) / sizeMultiplier; 
    const rotationSpeed = (Math.random() - 0.5) * 0.05 / sizeMultiplier; 
    const dx = (Math.random() - 0.5) * 1.0; // Small horizontal velocity (-0.5 to +0.5 px/frame)

    asteroids.push({ 
        x, 
        y, 
        width: actualWidth, 
        height: actualHeight, 
        speed: speed,            
        angle: 0,                 
        rotationSpeed: rotationSpeed,
        dx: dx, // Add horizontal velocity
        health: health,           
        maxHealth: health,       
        scoreValue: scoreValue,   
        sizeCategory: sizeCategory
    });
}

// Shoot function (Modified for wide shot buffs)
function shoot() {
    const now = Date.now();
    
    // Check for malfunction FIRST
    if (now < spaceship.weaponMalfunctionEndTime) {
        console.log("Weapon malfunction active - Cannot shoot!");
        return; // Exit function, no shot possible
    }

    // Check active powerups
    const isRapidFireActive = now < spaceship.rapidFireEndTime;
    const isSpreadShotActive = now < spaceship.spreadShotEndTime;
    const isWideShotActive = now < spaceship.wideShotEndTime; 
    
    // Determine current fire rate - use the fastest active one
    let currentFireRate = spaceship.fireRate; // Start with base
    if (isWideShotActive) {
        currentFireRate = Math.min(currentFireRate, wideShotFireRate); // Apply wide shot rate if faster
    }
    if (isRapidFireActive) {
        currentFireRate = Math.min(currentFireRate, spaceship.rapidFireRate); // Apply rapid fire rate if even faster
    }
    
    const timeSinceLastShot = now - spaceship.lastShotTime;

    // console.log(`Trying to shoot... Wide: ${isWideShotActive}. Rate: ${currentFireRate}`); 

    if (timeSinceLastShot >= currentFireRate) {
        // console.log("Shot fired!"); 
        const startX = spaceship.x;
        const startY = spaceship.y - spaceship.height / 2; 
        
        // Determine bullet dimensions based on wide shot
        const currentBulletWidth = isWideShotActive ? wideBulletSize : bulletSize; 
        const currentBulletHeight = isWideShotActive ? wideBulletHeight : (bulletSize * 2);

        if (isSpreadShotActive) {
            // Create 3 bullets with spread (use current dimensions)
            bullets.push({ x: startX, y: startY, width: currentBulletWidth, height: currentBulletHeight, speed: bulletSpeed, dx: 0 }); 
            bullets.push({ x: startX, y: startY, width: currentBulletWidth, height: currentBulletHeight, speed: bulletSpeed, dx: -bulletSpreadSpeed }); 
            bullets.push({ x: startX, y: startY, width: currentBulletWidth, height: currentBulletHeight, speed: bulletSpeed, dx: bulletSpreadSpeed }); 
        } else {
            // Create 1 bullet (use current dimensions)
            bullets.push({ x: startX, y: startY, width: currentBulletWidth, height: currentBulletHeight, speed: bulletSpeed, dx: 0 }); 
        }
        
        spaceship.lastShotTime = now; 
    } else {
         // console.log("Fire rate cooldown active."); 
    }
}

// Create explosion particles (for ship)
function createExplosion(x, y) {
    const particleCount = 30; // Number of particles for ship explosion
    const particleSpeed = 8;
    const particleLife = 50 + Math.random() * 30;
    const particleSize = Math.random() * 4 + 2;
    
    for (let i = 0; i < particleCount; i++) {
        explosionParticles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * particleSpeed, // Random horizontal velocity
            dy: (Math.random() - 0.5) * particleSpeed, // Random vertical velocity
            size: particleSize, // Particle size
            life: particleLife // Particle lifespan (frames)
        });
    }
}

// Create debris particles (modified to scale based on asteroid size)
function createDebris(asteroid) { // Accepts the asteroid object
    // Base parameters
    let baseParticleCount = 8;
    let baseParticleSpeed = 3;  
    let baseParticleSize = 1.5;
    let baseParticleLife = 25;

    // Scale based on asteroid width (or use sizeMultiplier/sizeCategory)
    const scaleFactor = asteroid.width / baseAsteroidSize; // How much bigger than base size?

    const particleCount = Math.floor(baseParticleCount * scaleFactor); 
    const particleSpeed = baseParticleSpeed * (1 + (scaleFactor - 1) * 0.5); // Speed increases slightly with size
    const particleLife = baseParticleLife * scaleFactor; // Larger explosions last longer
    const particleSizeMin = baseParticleSize * scaleFactor * 0.8; // Min size scales
    const particleSizeMax = baseParticleSize * scaleFactor * 1.2; // Max size scales
    
    console.log(`Creating DESTRUCTION debris for ${asteroid.sizeCategory} asteroid. Count: ${particleCount}, Size: ${particleSizeMin.toFixed(1)}-${particleSizeMax.toFixed(1)}`);

    for (let i = 0; i < particleCount; i++) {
        explosionParticles.push({ // Still add to the main array
            x: asteroid.x + asteroid.width / 2, // Use asteroid center
            y: asteroid.y + asteroid.height / 2,
            dx: (Math.random() - 0.5) * particleSpeed, 
            dy: (Math.random() - 0.5) * particleSpeed, 
            size: Math.random() * (particleSizeMax - particleSizeMin) + particleSizeMin, // Scaled size range
            life: particleLife * (Math.random() * 0.4 + 0.8), // Vary life slightly
            maxLife: particleLife // Store max life for opacity calculation
            // No specific color override here, use default fiery colors for destruction
        });
    }
}

// Create small debris particles (for asteroid damage - unchanged)
function createSmallDebris(x, y) {
    const particleCount = 4 + Math.floor(Math.random() * 4); // 4-7 particles
    const particleSpeed = 4 + Math.random() * 2;  // Slightly slower than before, less sharp
    const particleLife = 20 + Math.random() * 15; // Adjusted lifespan
    
    for (let i = 0; i < particleCount; i++) {
        explosionParticles.push({ // Add to the main particle array
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * particleSpeed, 
            dy: (Math.random() - 0.5) * particleSpeed, 
            size: Math.random() * 3 + 2.5, // Increased debris size (2.5-5.5 pixels)
            life: particleLife,
            maxLife: particleLife, 
            color: 'grey' // Assign grey color identifier
        });
    }
}

// Create sparks (for weapon malfunction)
function createSparks(ship) {
    const particleCount = 1 + Math.floor(Math.random() * 2); // 1-2 sparks per call
    const particleSpeed = 2 + Math.random() * 2;  
    const particleLife = 8 + Math.random() * 8; // Very short lifespan

    // Emit from near the front/center of the ship
    const emitX = ship.x + (Math.random() - 0.5) * (ship.width * 0.4);
    const emitY = ship.y - ship.height * 0.3 + (Math.random() - 0.5) * (ship.height * 0.2);

    for (let i = 0; i < particleCount; i++) {
        explosionParticles.push({ // Add to the main particle array
            x: emitX,
            y: emitY,
            dx: (Math.random() - 0.5) * particleSpeed, 
            dy: (Math.random() - 0.5) * particleSpeed, 
            size: Math.random() * 3 + 2, // Increased spark size (2-5 pixels)
            life: particleLife,
            maxLife: particleLife, 
            color: 'spark' // Assign spark color identifier
        });
    }
}

// Spawn Powerup (Updated probabilities)
function spawnPowerup(x, y) { 
    const dropRoll = Math.random();
    let type;
    // Adjust probabilities - Example: ~20% each
    if (dropRoll < 0.2) { 
        type = 'shield';
    } else if (dropRoll < 0.4) { 
        type = 'rapidFire';
    } else if (dropRoll < 0.6) { 
        type = 'spreadShot';
    } else if (dropRoll < 0.8) { 
        type = 'wideShot'; // Add wide shot chance
    } else { 
        type = 'weaponMalfunction';
    }
    
    console.log(`Spawning ${type} powerup/down!`); 
    powerups.push({
        x: x, y: y, width: powerupSize, height: powerupSize, type: type, speed: powerupSpeed
    });
}

// Create stars
function createStars() {
    for (let i = 0; i < numStars; i++) {
        const size = Math.random() * 2 + 1; // Star size between 1 and 3
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: size,
            // Assign speed based on size (smaller = slower)
            // Max speed = 1.5, Min speed = 0.5
            speed: (1 - (size - 1) / 2) * 1.0 + 0.5 
        });
    }
}

// Check collision between spaceship hitbox and asteroid
function checkCollision(ship, asteroid) {
    // Calculate ship hitbox boundaries (centered)
    const shipHitboxX = ship.x - ship.hitboxWidth / 2;
    const shipHitboxY = ship.y - ship.hitboxHeight / 2;

    return shipHitboxX < asteroid.x + asteroid.width &&
           shipHitboxX + ship.hitboxWidth > asteroid.x &&
           shipHitboxY < asteroid.y + asteroid.height &&
           shipHitboxY + ship.hitboxHeight > asteroid.y;
}

// Draw spaceship
function drawSpaceship() {
    if (shipImageLoaded) {
        // Draw shield if active
        if (spaceship.hasShield) {
            ctx.fillStyle = spaceship.shieldColor;
            ctx.beginPath();
            // Draw circle slightly larger than the ship
            ctx.arc(spaceship.x, spaceship.y, Math.max(spaceship.width, spaceship.height) * 0.75, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw ship image on top
        ctx.drawImage(
            spaceship.img,
            spaceship.x - spaceship.width / 2,
            spaceship.y - spaceship.height / 2, 
            spaceship.width,
            spaceship.height
        );
    } else {
        // Fallback drawing if image not loaded (optional)
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(spaceship.x - 15, spaceship.y, 30, 30);
    }
}

// Draw flame
function drawFlame(ship) {
    const flameBaseY = ship.y + ship.height / 2; // Position below the ship center
    const flameTipY = flameBaseY + ship.flameSize;
    const flameWidth = ship.width * 0.4; // Adjust width relative to ship

    ctx.fillStyle = `rgba(255, ${Math.random() * 155 + 100}, 0, 0.8)`; // Orange/yellow, slightly transparent
    ctx.beginPath();
    ctx.moveTo(ship.x - flameWidth / 2, flameBaseY);
    ctx.lineTo(ship.x + flameWidth / 2, flameBaseY);
    ctx.lineTo(ship.x, flameTipY); // Pointy flame tip
    ctx.closePath();
    ctx.fill();
}

// Draw explosion particles (modified for color and sparks)
function drawExplosion() {
    explosionParticles.forEach((p, index) => {
        const opacity = Math.max(0, p.life / (p.maxLife || 60)); 

        // Check for specific color override
        if (p.color === 'grey') {
             ctx.fillStyle = `rgba(180, 180, 180, ${opacity * 0.8})`; 
        } else if (p.color === 'spark') {
             // Brighter yellow/white for sparks
             ctx.fillStyle = `rgba(255, 255, ${100 + Math.random()*155}, ${opacity * 0.95})`; 
        } else {
            // Default fiery colors 
            ctx.fillStyle = `rgba(200, ${Math.random() * 100 + 50}, 0, ${opacity * 0.9})`; 
        }
        
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
}

// Draw bullets
function drawBullets() {
    ctx.fillStyle = '#00ffff'; // Cyan color for bullets
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    });
}

// Draw asteroids (Modified for highlight gradient)
function drawAsteroids() {
    if (asteroidImageLoaded) {
        // --- Drop Shadow Setup ---
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; 
        ctx.shadowBlur = 8; 
        ctx.shadowOffsetX = 4; 
        ctx.shadowOffsetY = 4; 

        asteroids.forEach(asteroid => {
            ctx.save(); 
            ctx.translate(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2);
            ctx.rotate(asteroid.angle); 
            
            // 1. Draw the image (with drop shadow)
            ctx.drawImage(
                asteroidImg, 
                -asteroid.width / 2, 
                -asteroid.height / 2,
                asteroid.width, 
                asteroid.height
            );

            // --- Surface Shading Gradient ---
            ctx.shadowColor = 'transparent'; // Disable shadow for gradients
            const radius = asteroid.width / 2; 
            
            // SHADOW GRADIENT (Bottom-Right)
            const shadowGradX1 = radius * 0.4; // Offset start away from light
            const shadowGradY1 = radius * 0.4;
            // Adjusted end point slightly to avoid center concentration
            const shadowGrad = ctx.createRadialGradient(shadowGradX1, shadowGradY1, radius * 0.1, radius * 0.1, radius * 0.1, radius * 1.2); 
            shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)'); 
            shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)'); 
            shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');   
            ctx.fillStyle = shadowGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2); // Slightly larger circle for full coverage
            ctx.fill();

            // HIGHLIGHT GRADIENT (Top-Left)
            const hlGradX1 = radius * -0.4; // Offset start towards light
            const hlGradY1 = radius * -0.4;
             // Adjusted end point slightly to avoid center concentration
            const hlGrad = ctx.createRadialGradient(hlGradX1, hlGradY1, radius * 0.05, radius * -0.1, radius * -0.1, radius * 0.9); // Smaller extent
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)'); // Semi-transparent white
            hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');   
            ctx.fillStyle = hlGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2); 
            ctx.fill();

            ctx.restore(); 
        });

        // --- Reset Drop Shadow Properties ---
        ctx.shadowColor = 'transparent'; 
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

    } else {
        // Fallback drawing (Could also scale based on asteroid.width)
        ctx.fillStyle = '#ff0000';
        asteroids.forEach(asteroid => {
            ctx.fillRect(asteroid.x, asteroid.y, asteroid.width, asteroid.height);
        });
    }
}

// Draw stars
function drawStars() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Draw score
function drawScore() {
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left'; // Explicitly set alignment
    ctx.fillText(`Score: ${score}`, 10, 30);
}

// Draw game over
function drawGameOver() {
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2);
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${score}`, canvas.width/2, canvas.height/2 + 40);
}

// Draw powerups
function drawPowerups() {
    if (powerups.length > 0) {
        console.log(`Drawing ${powerups.length} powerups.`); // Log drawing attempt
    }
    powerups.forEach(p => {
        if (p.type === 'shield') {
            ctx.fillStyle = 'rgba(0, 150, 255, 0.8)'; // Solid blue for item
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
            ctx.fill();
            // Optional: add a border or letter 'S'
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (p.type === 'rapidFire') {
            ctx.fillStyle = 'rgba(255, 100, 0, 0.9)'; // Orange color
            ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); // Draw as square
             // Optional: add a border or letter 'R'
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        } else if (p.type === 'spreadShot') {
            ctx.fillStyle = 'rgba(0, 200, 100, 0.9)'; // Green color
            // Draw 3 small squares to represent spread
            const s = p.width / 3;
            ctx.fillRect(p.x - s * 1.5, p.y - s / 2, s, s);
            ctx.fillRect(p.x - s / 2, p.y - s * 1.5, s, s);
            ctx.fillRect(p.x + s * 0.5, p.y - s / 2, s, s);
             // Optional: add a border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); // Outer border
        } else if (p.type === 'wideShot') {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.9)'; // Light grey/silver color
            ctx.fillRect(p.x - p.width / 2, p.y - p.height / 4, p.width, p.height / 2); // Draw as horizontal bar
            // Optional: add border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); 
        } else if (p.type === 'weaponMalfunction') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; // Red color
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Draw an 'X'
            ctx.moveTo(p.x - p.width / 2, p.y - p.height / 2);
            ctx.lineTo(p.x + p.width / 2, p.y + p.height / 2);
            ctx.moveTo(p.x + p.width / 2, p.y - p.height / 2);
            ctx.lineTo(p.x - p.width / 2, p.y + p.height / 2);
            ctx.stroke();
             // Optional: add background or border
            // ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
            // ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        }
    });
}

// Spawn Floating Score Text
function spawnFloatingScore(x, y, value) {
    floatingScores.push({
        x: x,
        y: y,
        text: `+${value}`,
        life: floatLife,
        maxLife: floatLife // Store for opacity calculation
    });
}

// Draw Floating Scores
function drawFloatingScores() {
    floatingScores.forEach(fs => {
        const opacity = Math.max(0, fs.life / fs.maxLife);
        ctx.fillStyle = `rgba(255, 255, 100, ${opacity * 0.9})`; // Yellowish color
        ctx.font = '16px Arial'; 
        ctx.textAlign = 'center'; // Center the text horizontally
        ctx.fillText(fs.text, fs.x, fs.y);
    });
}

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update star positions based on individual speed
    stars.forEach(star => {
        star.y += star.speed; // Use star's own speed
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });

    // Update explosion particles
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const p = explosionParticles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life -= 1;
        p.dx *= 0.98; // Optional friction
        p.dy *= 0.98; // Optional friction
        // We stored maxLife, no need to recalculate opacity here, done in drawExplosion

        // Remove dead particles
        if (p.life <= 0) {
            explosionParticles.splice(i, 1);
        }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        bullets[i].x += bullets[i].dx; // Add horizontal movement
        
        // Remove bullets off screen (top, left, or right)
        if (bullets[i].y < -bullets[i].height || bullets[i].x < -bullets[i].width || bullets[i].x > canvas.width + bullets[i].width) {
            bullets.splice(i, 1);
        }
    }

    // Update powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].y += powerups[i].speed;
        // Remove powerups off screen
        if (powerups[i].y > canvas.height + powerups[i].height) {
            powerups.splice(i, 1);
        }
    }

    // Check rapid fire duration
    const now = Date.now();
    if (spaceship.rapidFireEndTime > 0 && now >= spaceship.rapidFireEndTime) {
        spaceship.rapidFireEndTime = 0; // Reset timer
        console.log("Rapid fire ended.");
    }

    // Check spread shot duration
    if (spaceship.spreadShotEndTime > 0 && now >= spaceship.spreadShotEndTime) {
        spaceship.spreadShotEndTime = 0; 
        console.log("Spread shot ended.");
    }

    // Check wide shot duration
    if (spaceship.wideShotEndTime > 0 && now >= spaceship.wideShotEndTime) {
        spaceship.wideShotEndTime = 0; 
        console.log("Wide shot ended.");
    }

    // Check malfunction duration & Create Sparks
    if (spaceship.weaponMalfunctionEndTime > 0) {
        if (now >= spaceship.weaponMalfunctionEndTime) {
             spaceship.weaponMalfunctionEndTime = 0; 
             console.log("Weapon malfunction ended.");
        } else {
            // Malfunction active, chance to create sparks
            if (Math.random() < 0.2) { // 20% chance per frame to add sparks
                createSparks(spaceship);
            }
        }
    }

    // Update Floating Scores
    for (let i = floatingScores.length - 1; i >= 0; i--) {
        const fs = floatingScores[i];
        fs.y -= floatSpeed; // Move up
        fs.life -= 1;
        if (fs.life <= 0) {
            floatingScores.splice(i, 1); // Remove dead text
        }
    }

    if (!gameOver) {
        // Update spaceship position (X and Y)
        spaceship.x = mouseX;
        spaceship.y = mouseY; // Update Y position based on mouse

        // Constrain X position
        spaceship.x = Math.max(spaceship.width/2, Math.min(canvas.width - spaceship.width/2, spaceship.x));
        // Constrain Y position (consider ship height and flame)
        const topBound = spaceship.height / 2; 
        const bottomBound = canvas.height - spaceship.height / 2 - spaceship.flameMaxSize; // Account for flame
        spaceship.y = Math.max(topBound, Math.min(bottomBound, spaceship.y));

        // Create new asteroids - Increase frequency
        if (Math.random() < 0.08) { 
            createAsteroid();
        }

        // Update asteroids & Check Collisions
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const asteroid = asteroids[i]; // Use a reference

            // Update position (Y and X)
            asteroid.y += asteroid.speed; 
            asteroid.x += asteroid.dx; // Update horizontal position
            asteroid.angle += asteroid.rotationSpeed; 

            // Horizontal Screen Wrapping
            if (asteroid.x + asteroid.width < 0) { // Off left edge
                asteroid.x = canvas.width;
            } else if (asteroid.x > canvas.width) { // Off right edge
                asteroid.x = -asteroid.width;
            }

            // Check Ship-Asteroid collision (uses asteroid.width/height)
            if (checkCollision(spaceship, asteroid)) {
                if (spaceship.hasShield) {
                   // ... shield logic (destroy asteroid instantly regardless of health) ...
                   spaceship.hasShield = false;
                   createDebris(asteroid); 
                   asteroids.splice(i, 1); 
                   console.log("Shield used!");
                   continue; 
                } else {
                   // ... game over logic ...
                   gameOver = true;
                   createExplosion(spaceship.x, spaceship.y); 
                   break; 
                }
            }

            // Check Bullet-Asteroid collision
            let asteroidHitByBullet = false;
            for (let j = bullets.length - 1; j >= 0; j--) {
                 const bullet = bullets[j]; // Use a reference
                 // Define boundaries
                 const asteroidLeft = asteroid.x;
                 const asteroidRight = asteroid.x + asteroid.width;
                 const asteroidTop = asteroid.y;
                 const asteroidBottom = asteroid.y + asteroid.height;
                 const bulletLeft = bullet.x - bullet.width / 2;
                 const bulletRight = bullet.x + bullet.width / 2;
                 const bulletTop = bullet.y - bullet.height / 2;
                 const bulletBottom = bullet.y + bullet.height / 2;
                 
                 if (bulletRight > asteroidLeft && bulletLeft < asteroidRight &&
                     bulletBottom > asteroidTop && bulletTop < asteroidBottom) {

                    // Collision detected!
                    console.log(`Bullet hit ${asteroid.sizeCategory} asteroid.`); 
                    
                    asteroid.health -= 1; // Decrease health
                    bullets.splice(j, 1); // Remove bullet
                    asteroidHitByBullet = true; // Mark as hit for this frame

                    if (asteroid.health <= 0) {
                        // Destroyed
                        console.log(`${asteroid.sizeCategory} asteroid destroyed! Score: +${asteroid.scoreValue}`);
                        score += asteroid.scoreValue; 
                        spawnFloatingScore(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2, asteroid.scoreValue); // Spawn score text
                        createDebris(asteroid); // Pass the whole asteroid object for scaling
                        
                        // Chance to spawn powerup
                        if (Math.random() < powerupDropChance) {
                            spawnPowerup(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2); 
                        }
                        
                        asteroids.splice(i, 1); // Remove asteroid
                    } else {
                        // Damaged but not destroyed
                        console.log(`Asteroid health: ${asteroid.health}, Speed: ${asteroid.speed.toFixed(2)}`);
                        createSmallDebris(bullet.x, bullet.y); // Create grey debris at bullet impact point
                        
                        // Slow down the asteroid slightly
                        asteroid.speed *= 0.9; // Reduce speed by 10%
                        // Optional: Add a minimum speed check if desired
                        // asteroid.speed = Math.max(asteroid.speed, minAsteroidSpeed); 
                        console.log(`Asteroid slowed to: ${asteroid.speed.toFixed(2)}`);
                    }
                    break; // Bullet is gone, exit inner loop (j)
                 }
            }
            
            // If asteroid was destroyed by a bullet in this frame, skip off-screen check and continue outer loop
             if (asteroidHitByBullet && asteroid.health <= 0) { 
                 continue; 
             }

            // Remove asteroids that are off bottom screen WITHOUT scoring
            // Important: Check this condition *after* potential splice from collisions
            if (i < asteroids.length && asteroids[i].y > canvas.height) { // Check index validity before accessing
                asteroids.splice(i, 1);
            }
        }

        // Attempt to shoot if mouse is down
        if (isMouseDown) {
            shoot(); // Call shoot every frame, cooldown logic inside shoot() handles rate
        }

        // Check Ship-Powerup collisions (updated for wide shot and exclusivity)
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            // Simple distance check from ship center to powerup center
            const dx = spaceship.x - p.x;
            const dy = spaceship.y - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const collisionDistance = (spaceship.width / 2) + (p.width / 2); // Approximate

            if (distance < collisionDistance) {
                if (p.type === 'shield') {
                    spaceship.hasShield = true;
                    console.log("Shield Activated!");
                } else if (p.type === 'rapidFire') {
                    spaceship.rapidFireEndTime = Date.now() + spaceship.rapidFireDuration;
                    spaceship.spreadShotEndTime = 0; 
                    spaceship.wideShotEndTime = 0; // Disable wide shot
                    spaceship.weaponMalfunctionEndTime = 0; 
                    console.log("Rapid Fire Activated!");
                } else if (p.type === 'spreadShot') {
                    spaceship.spreadShotEndTime = Date.now() + spaceship.spreadShotDuration;
                    spaceship.rapidFireEndTime = 0; 
                    spaceship.wideShotEndTime = 0; // Disable wide shot
                    spaceship.weaponMalfunctionEndTime = 0; 
                    console.log("Spread Shot Activated!");
                } else if (p.type === 'wideShot') {
                    spaceship.wideShotEndTime = Date.now() + spaceship.wideShotDuration;
                    spaceship.rapidFireEndTime = 0; // Disable other weapon types
                    spaceship.spreadShotEndTime = 0;
                    spaceship.weaponMalfunctionEndTime = 0; 
                    console.log("Wide Shot Activated!");
                } else if (p.type === 'weaponMalfunction') {
                    spaceship.weaponMalfunctionEndTime = Date.now() + spaceship.weaponMalfunctionDuration;
                    spaceship.rapidFireEndTime = 0; // Disable active powerups
                    spaceship.spreadShotEndTime = 0; 
                    spaceship.wideShotEndTime = 0; 
                    console.log("Weapon Malfunction Activated!");
                }
                powerups.splice(i, 1); // Remove collected item
            }
        }
    }

    // Draw everything
    drawStars(); 
    drawBullets(); 
    drawPowerups(); 
    drawFloatingScores(); // Draw floating score text
    
    // Draw ship and flame ONLY if game is not over
    if (!gameOver) {
        drawSpaceship();    // Ship drawing now includes shield
        drawFlame(spaceship); // Draw flame after ship/shield
    } 
    
    // Draw explosion/debris particles if any exist (regardless of game state)
    if (explosionParticles.length > 0) {
        drawExplosion(); 
    }

    // Always draw asteroids and score
    drawAsteroids(); 
    drawScore();
    
    // Draw game over text only if game is over
    if (gameOver) {
        drawGameOver(); 
    }

    requestAnimationFrame(gameLoop);
}

// Function to start the game only when both images are loaded
function startGameIfReady() {
    console.log(`Checking if game can start: shipLoaded=${shipImageLoaded}, asteroidLoaded=${asteroidImageLoaded}`);
    if (shipImageLoaded && asteroidImageLoaded) { // Check both flags
        console.log("Both images loaded, starting game...");
        createStars();
        gameLoop();
    } else {
        console.log("Waiting for images to load...");
    }
}

// Reset Game Function
function resetGame() {
    console.log("Resetting game...");
    gameOver = false;
    score = 0;
    
    // Clear arrays
    asteroids.length = 0;
    bullets.length = 0;
    powerups.length = 0;
    explosionParticles.length = 0;
    floatingScores.length = 0;

    // Reset spaceship position and state
    spaceship.x = canvas.width / 2;
    spaceship.y = canvas.height - 50; // Or original starting y
    spaceship.hasShield = false;
    spaceship.rapidFireEndTime = 0;
    spaceship.spreadShotEndTime = 0;
    spaceship.weaponMalfunctionEndTime = 0;
    spaceship.lastShotTime = 0; 

    // Optional: Reset stars for a completely new background, though not strictly required
    // stars.length = 0;
    // createStars();

    // The gameLoop continues running via requestAnimationFrame, 
    // setting gameOver = false will resume normal updates.
} 