const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Global Ready Flags
let windowFullyLoaded = false; // NEW: Flag for window.onload
let shipImageLoaded = false;
let asteroidImageLoaded = false;

// Function to resize canvas drawing buffer and position ship
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    if (canvas.width > 0 && canvas.height > 0) {
        spaceship.x = canvas.width / 2;
        const shipEffectiveHeight = (spaceship.height > 0) ? spaceship.height : 50;
        spaceship.y = canvas.height - shipEffectiveHeight / 2;
    } else {
        // Note: The console.warn that was here has been removed.
    }
}

// Initial and on-resize setup
window.addEventListener('resize', resizeCanvas);

// Game objects
const spaceship = {
  x: 0, // Will be set based on canvas width
  y: 0, // Will be set based on canvas height
  width: 50, // Visual width
  height: 50, // Visual height
  hitboxWidth: 0, // Add hitbox width
  hitboxHeight: 0, // Add hitbox height
  speed: 5,
  img: new Image(),
  // Flame properties
  flameSize: 0,
  flameFlickerRate: 0.2, // Reduced from 0.5 for slower flicker
  flameMaxSize: 12,
  flameMinSize: 7, // NEW: Minimum flicker size
  // Powerup state
  hasShield: false,
  shieldColor: "rgba(0, 150, 255, 0.4)", // Semi-transparent blue
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
  wideShotEndTime: 0, // Timestamp when wide shot ends
};

const asteroids = [];
const baseAsteroidSize = 30; // Rename original size
const baseAsteroidSpeed = 2; // Decreased from 3
let score = 0;
let displayedScore = 0; // NEW: For animating the score display
let gameOver = false;
let gameOverStartTime = 0; // Timestamp for game over start
const gameOverDisplayDuration = 5000; 
let asteroidsClearedOnGameOver = false; // NEW: Flag for game over asteroid clearing

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

// High Score
let highScore = 0;

// Explosion particles array
const explosionParticles = [];

// Star background
const stars = [];
const numStars = 100;

// Mouse position
let mouseX = 0; // Will be updated relative to canvas size
let mouseY = 0;
let mouseControlActive = false; 
let isShipAnimatingToStart = false; 
let shipAnimationTargetX = 0; 
let shipAnimationTargetY = 0; 
const shipAnimationSpeed = 0.15; 

// Load images
const desiredShipWidth = 30; // Decreased from 40

const asteroidImg = new Image(); // Add back asteroid image object
asteroidImg.onload = () => {
    asteroidImageLoaded = true;
    attemptGameStart();
};
asteroidImg.onerror = (err) => {
    console.error("Error loading asteroid image:", err); // Keep this one as it's an actual error
};
asteroidImg.src =
  "https://cdn.prod.website-files.com/6808a35d6048d7239947a278/681d0c7ddcdf5ac16aca18b0_asteroid.svg"; // Set asteroid image source

spaceship.img.onload = () => {
    const aspectRatio = (spaceship.img.naturalWidth > 0) ? (spaceship.img.naturalHeight / spaceship.img.naturalWidth) : 1;
    spaceship.width = desiredShipWidth;
    spaceship.height = desiredShipWidth * aspectRatio;
    shipImageLoaded = true;
    attemptGameStart();
};
spaceship.img.src =
  "https://cdn.prod.website-files.com/6808a35d6048d7239947a278/681d0c7d874439f86bc33e9f_ship.png";

// Mouse state
let isMouseDown = false;
let isMobileDevice = false;

// Check if device is mobile
function checkMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Event listeners
canvas.addEventListener("mousemove", (e) => {
  if (!isMobileDevice) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }
});

// Touch event handlers
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault(); // Prevent scrolling
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  mouseX = touch.clientX - rect.left;
  mouseY = touch.clientY - rect.top;
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  isMouseDown = true;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  mouseX = touch.clientX - rect.left;
  mouseY = touch.clientY - rect.top;
  
  if (gameOver) {
    resetGame();
    mouseControlActive = true;
    spaceship.x = mouseX;
    spaceship.y = mouseY;
    spaceship.x = Math.max(spaceship.width/2, Math.min(canvas.width - spaceship.width/2, spaceship.x));
    const topBound = spaceship.height / 2;
    const bottomBound = canvas.height - spaceship.height / 2;
    spaceship.y = Math.max(topBound, Math.min(bottomBound, spaceship.y));
  } else if (!mouseControlActive && !isShipAnimatingToStart) {
    mouseControlActive = true;
    isShipAnimatingToStart = true;
    shipAnimationTargetX = mouseX;
    shipAnimationTargetY = mouseY;
  }
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  isMouseDown = false;
});

// ADD mousedown listener
canvas.addEventListener("mousedown", (e) => {
  if (!isMobileDevice) {
    if (gameOver) {
      resetGame();
      mouseControlActive = true;
      isMouseDown = true;
      spaceship.x = mouseX;
      spaceship.y = mouseY;
      spaceship.x = Math.max(spaceship.width/2, Math.min(canvas.width - spaceship.width/2, spaceship.x));
      const topBound = spaceship.height / 2;
      const bottomBound = canvas.height - spaceship.height / 2;
      spaceship.y = Math.max(topBound, Math.min(bottomBound, spaceship.y));
    } else {
      isMouseDown = true;
      if (!mouseControlActive && !isShipAnimatingToStart) {
        mouseControlActive = true;
        isShipAnimatingToStart = true;
        shipAnimationTargetX = mouseX;
        shipAnimationTargetY = mouseY;
      }
    }
  }
});

canvas.addEventListener("mouseup", () => {
  if (!isMobileDevice) {
    isMouseDown = false;
  }
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

  if (sizeRoll < 0.6) {
    // 60% chance Small
    sizeCategory = "small";
    health = 1;
    sizeMultiplier = 1.0;
    scoreValue = 10;
  } else if (sizeRoll < 0.9) {
    // 30% chance Medium
    sizeCategory = "medium";
    health = 3;
    sizeMultiplier = 1.5;
    scoreValue = 25;
  } else {
    // 10% chance Large
    sizeCategory = "large";
    health = 5;
    sizeMultiplier = 1.75;
    scoreValue = 50;
  }

  const actualWidth = baseAsteroidSize * sizeMultiplier;
  const actualHeight = baseAsteroidSize * sizeMultiplier; // Assuming square/circular base

  const speed =
    (baseAsteroidSpeed * (Math.random() * 0.6 + 0.7)) / sizeMultiplier;
  const rotationSpeed = ((Math.random() - 0.5) * 0.05) / sizeMultiplier;
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
    sizeCategory: sizeCategory,
  });
}

// Shoot function (Modified for wide shot buffs)
function shoot() {
  const now = Date.now();

  // Check for malfunction FIRST
  if (now < spaceship.weaponMalfunctionEndTime) {
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

  if (timeSinceLastShot >= currentFireRate) {
    const startX = spaceship.x;
    const startY = spaceship.y - spaceship.height / 2;

    // Determine bullet dimensions based on wide shot
    const currentBulletWidth = isWideShotActive ? wideBulletSize : bulletSize;
    const currentBulletHeight = isWideShotActive
      ? wideBulletHeight
      : bulletSize * 2;

    if (isSpreadShotActive) {
      // Create 3 bullets with spread (use current dimensions)
      bullets.push({
        x: startX,
        y: startY,
        width: currentBulletWidth,
        height: currentBulletHeight,
        speed: bulletSpeed,
        dx: 0,
      });
      bullets.push({
        x: startX,
        y: startY,
        width: currentBulletWidth,
        height: currentBulletHeight,
        speed: bulletSpeed,
        dx: -bulletSpreadSpeed,
      });
      bullets.push({
        x: startX,
        y: startY,
        width: currentBulletWidth,
        height: currentBulletHeight,
        speed: bulletSpeed,
        dx: bulletSpreadSpeed,
      });
    } else {
      // Create 1 bullet (use current dimensions)
      bullets.push({
        x: startX,
        y: startY,
        width: currentBulletWidth,
        height: currentBulletHeight,
        speed: bulletSpeed,
        dx: 0,
      });
    }

    spaceship.lastShotTime = now;
  } else {
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
      life: particleLife, // Particle lifespan (frames)
    });
  }
}

// Create debris particles (modified to scale based on asteroid size)
function createDebris(asteroid) {
  // Accepts the asteroid object
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

  for (let i = 0; i < particleCount; i++) {
    explosionParticles.push({
      // Still add to the main array
      x: asteroid.x + asteroid.width / 2, // Use asteroid center
      y: asteroid.y + asteroid.height / 2,
      dx: (Math.random() - 0.5) * particleSpeed,
      dy: (Math.random() - 0.5) * particleSpeed,
      size:
        Math.random() * (particleSizeMax - particleSizeMin) + particleSizeMin, // Scaled size range
      life: particleLife * (Math.random() * 0.4 + 0.8), // Vary life slightly
      maxLife: particleLife, // Store max life for opacity calculation
      // No specific color override here, use default fiery colors for destruction
    });
  }
}

// Create small debris particles (for asteroid damage - unchanged)
function createSmallDebris(x, y) {
  const particleCount = 4 + Math.floor(Math.random() * 4); // 4-7 particles
  const particleSpeed = 4 + Math.random() * 2; // Slightly slower than before, less sharp
  const particleLife = 20 + Math.random() * 15; // Adjusted lifespan

  for (let i = 0; i < particleCount; i++) {
    explosionParticles.push({
      // Add to the main particle array
      x: x,
      y: y,
      dx: (Math.random() - 0.5) * particleSpeed,
      dy: (Math.random() - 0.5) * particleSpeed,
      size: Math.random() * 3 + 2.5, // Increased debris size (2.5-5.5 pixels)
      life: particleLife,
      maxLife: particleLife,
      color: "grey", // Assign grey color identifier
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
  const emitY =
    ship.y - ship.height * 0.3 + (Math.random() - 0.5) * (ship.height * 0.2);

  for (let i = 0; i < particleCount; i++) {
    explosionParticles.push({
      // Add to the main particle array
      x: emitX,
      y: emitY,
      dx: (Math.random() - 0.5) * particleSpeed,
      dy: (Math.random() - 0.5) * particleSpeed,
      size: Math.random() * 3 + 2, // Increased spark size (2-5 pixels)
      life: particleLife,
      maxLife: particleLife,
      color: "spark", // Assign spark color identifier
    });
  }
}

// Spawn Powerup (Updated probabilities)
function spawnPowerup(x, y) {
  const dropRoll = Math.random();
  let type;
  // Adjust probabilities - Example: ~20% each
  if (dropRoll < 0.2) {
    type = "shield";
  } else if (dropRoll < 0.4) {
    type = "rapidFire";
  } else if (dropRoll < 0.6) {
    type = "spreadShot";
  } else if (dropRoll < 0.8) {
    type = "wideShot"; // Add wide shot chance
  } else {
    type = "weaponMalfunction";
  }

  powerups.push({
    x: x,
    y: y,
    width: powerupSize,
    height: powerupSize,
    type: type,
    speed: powerupSpeed,
  });
}

// Create stars
function createStars() {
  for (let i = 0; i < numStars; i++) {
    const size = Math.random() * 2 + 1; // Star size between 1 and 3
    let color = "#ffffff"; // Default white
    const colorRoll = Math.random();
    if (colorRoll < 0.15) { // 15% chance red-ish
        color = "rgba(255, 220, 220, 1)"; 
    } else if (colorRoll < 0.30) { // 15% chance blue-ish (total 30% for non-white)
        color = "rgba(220, 220, 255, 1)";
    }
    // Else, it remains white (70% chance)

    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: size,
      speed: (1 - (size - 1) / 2) * 1.0 + 0.5,
      color: color // Store the determined color
    });
  }
}

// Check collision between spaceship hitbox and asteroid
function checkCollision(ship, asteroid) {
  // Calculate ship hitbox boundaries (centered)
  const shipHitboxX = ship.x - ship.hitboxWidth / 2;
  const shipHitboxY = ship.y - ship.hitboxHeight / 2;

  return (
    shipHitboxX < asteroid.x + asteroid.width &&
    shipHitboxX + ship.hitboxWidth > asteroid.x &&
    shipHitboxY < asteroid.y + asteroid.height &&
    shipHitboxY + ship.hitboxHeight > asteroid.y
  );
}

// Draw spaceship
function drawSpaceship() {
  if (shipImageLoaded) {
    // Draw shield if active
    if (spaceship.hasShield) {
      ctx.fillStyle = spaceship.shieldColor;
      ctx.beginPath();
      // Draw circle slightly larger than the ship
      ctx.arc(
        spaceship.x,
        spaceship.y,
        Math.max(spaceship.width, spaceship.height) * 0.75,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Draw ship image on top
    ctx.drawImage(
      spaceship.img,
      spaceship.x - spaceship.width / 2,
      spaceship.y - spaceship.height / 2,
      spaceship.width,
      spaceship.height,
    );
  } else {
    // Fallback drawing if image not loaded (optional)
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(spaceship.x - 15, spaceship.y, 30, 30);
  }
}

// Draw flame
function drawFlame(ship) {
  const flameBaseY = ship.y + ship.height / 2; // Position below the ship center
  const flameTipY = flameBaseY + ship.flameSize;
  const flameWidth = ship.width * 0.4; // Adjust width relative to ship

  if (ship.flameSize <= 0) { // Don't draw if flame is not visible
    return;
  }

  const leftBaseX = ship.x - flameWidth / 2;
  const rightBaseX = ship.x + flameWidth / 2;
  const tipX = ship.x;

  const bulgeFactor = flameWidth * 0.25; 
  const cpLeftX = leftBaseX - bulgeFactor;
  const cpRightX = rightBaseX + bulgeFactor;
  const cpY = flameBaseY + ship.flameSize * 0.5;

  ctx.fillStyle = `rgba(255, ${Math.random() * 155 + 100}, 0, 0.8)`; 
  ctx.beginPath();
  ctx.moveTo(leftBaseX, flameBaseY); 
  ctx.quadraticCurveTo(cpLeftX, cpY, tipX, flameTipY);
  ctx.quadraticCurveTo(cpRightX, cpY, rightBaseX, flameBaseY);
  ctx.closePath(); 
  ctx.fill();
}

// Draw explosion particles (modified for color and sparks)
function drawExplosion() {
  explosionParticles.forEach((p, index) => {
    const opacity = Math.max(0, p.life / (p.maxLife || 60));

    // Check for specific color override
    if (p.color === "grey") {
      ctx.fillStyle = `rgba(180, 180, 180, ${opacity * 0.8})`;
    } else if (p.color === "spark") {
      // Brighter yellow/white for sparks
      ctx.fillStyle = `rgba(255, 255, ${100 + Math.random() * 155}, ${opacity * 0.95})`;
    } else {
      // Default fiery colors
      ctx.fillStyle = `rgba(200, ${Math.random() * 100 + 50}, 0, ${opacity * 0.9})`;
    }

    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
}

// Draw bullets
function drawBullets() {
  ctx.fillStyle = "#F85013"; // Cyan color for bullets
  bullets.forEach((bullet) => {
    ctx.fillRect(
      bullet.x - bullet.width / 2,
      bullet.y - bullet.height / 2,
      bullet.width,
      bullet.height,
    );
  });
}

// Draw asteroids (Modified for highlight gradient)
function drawAsteroids() {
  if (asteroidImageLoaded) {
    // --- Drop Shadow Setup ---
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    asteroids.forEach((asteroid) => {
      ctx.save();
      ctx.translate(
        asteroid.x + asteroid.width / 2,
        asteroid.y + asteroid.height / 2,
      );
      ctx.rotate(asteroid.angle);

      // 1. Draw the image (with drop shadow)
      ctx.drawImage(
        asteroidImg,
        -asteroid.width / 2,
        -asteroid.height / 2,
        asteroid.width,
        asteroid.height,
      );

      // --- Surface Shading Gradient ---
      ctx.shadowColor = "transparent"; // Disable shadow for gradients
      const radius = asteroid.width / 2;

      // SHADOW GRADIENT (Bottom-Right)
      const shadowGradX1 = radius * 0.4; // Offset start away from light
      const shadowGradY1 = radius * 0.4;
      // Adjusted end point slightly to avoid center concentration
      const shadowGrad = ctx.createRadialGradient(
        shadowGradX1,
        shadowGradY1,
        radius * 0.1,
        radius * 0.1,
        radius * 0.1,
        radius * 1.2,
      );
      shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.4)");
      shadowGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.1)");
      shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2); // Slightly larger circle for full coverage
      ctx.fill();

      // HIGHLIGHT GRADIENT (Top-Left)
      const hlGradX1 = radius * -0.4; // Offset start towards light
      const hlGradY1 = radius * -0.4;
      // Adjusted end point slightly to avoid center concentration
      const hlGrad = ctx.createRadialGradient(
        hlGradX1,
        hlGradY1,
        radius * 0.05,
        radius * -0.1,
        radius * -0.1,
        radius * 0.9,
      ); // Smaller extent
      hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.25)"); // Semi-transparent white
      hlGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
      hlGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // --- Reset Drop Shadow Properties ---
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    // Fallback drawing (Could also scale based on asteroid.width)
    ctx.fillStyle = "#ff0000";
    asteroids.forEach((asteroid) => {
      ctx.fillRect(asteroid.x, asteroid.y, asteroid.width, asteroid.height);
    });
  }
}

// Draw stars
function drawStars() {
   stars.forEach((star) => {
        ctx.fillStyle = star.color; // Use the star's specific color
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), 1, 1); // Draw 1x1 pixel star
    });
}

// Draw score
function drawScore() {
  const fontSize = Math.max(12, Math.floor(canvas.width / 40)); 
  ctx.fillStyle = "#ffffff";
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = "left"; 
  ctx.fillText(`Score: ${Math.floor(displayedScore)}`, 10, fontSize + 10); // Use displayedScore
}

// Draw game over (modified to display high score)
function drawGameOver() {
    const mainFontSize = Math.max(24, Math.floor(canvas.width / 15)); 
    const subFontSize = Math.max(16, Math.floor(canvas.width / 30));  

    ctx.textAlign = "center";
    
    ctx.fillStyle = "#F85013"; 
    ctx.font = `${mainFontSize}px Arial`;
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - mainFontSize * 0.5); 

    ctx.fillStyle = "#ffffff"; 
    ctx.font = `${subFontSize}px Arial`;
    ctx.fillText(
        `Final Score: ${Math.floor(displayedScore)}`, // Use displayedScore
        canvas.width / 2,
        canvas.height / 2 + subFontSize * 1.5 
    );
    ctx.fillText( 
        `High Score: ${highScore}`,
        canvas.width / 2,
        canvas.height / 2 + subFontSize * 3 
    );
}

// Draw powerups
function drawPowerups() {
  if (powerups.length > 0) {
  }
  powerups.forEach((p) => {
    if (p.type === "shield") {
      ctx.fillStyle = "rgba(0, 150, 255, 0.8)"; // Solid blue for item
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
      // Optional: add a border or letter 'S'
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (p.type === "rapidFire") {
      ctx.fillStyle = "rgba(255, 100, 0, 0.9)"; // Orange color
      ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); // Draw as square
      // Optional: add a border or letter 'R'
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    } else if (p.type === "spreadShot") {
      ctx.fillStyle = "rgba(0, 200, 100, 0.9)"; // Green color
      // Draw 3 small squares to represent spread
      const s = p.width / 3;
      ctx.fillRect(p.x - s * 1.5, p.y - s / 2, s, s);
      ctx.fillRect(p.x - s / 2, p.y - s * 1.5, s, s);
      ctx.fillRect(p.x + s * 0.5, p.y - s / 2, s, s);
      // Optional: add a border
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); // Outer border
    } else if (p.type === "wideShot") {
      ctx.fillStyle = "rgba(200, 200, 200, 0.9)"; // Light grey/silver color
      ctx.fillRect(
        p.x - p.width / 2,
        p.y - p.height / 4,
        p.width,
        p.height / 2,
      ); // Draw as horizontal bar
      // Optional: add border
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    } else if (p.type === "weaponMalfunction") {
      ctx.fillStyle = "rgba(255, 0, 0, 0.9)"; // Red color
      ctx.strokeStyle = "white";
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
    maxLife: floatLife, // Store for opacity calculation
  });
}

// Draw Floating Scores
function drawFloatingScores() {
  const fontSize = Math.max(10, Math.floor(canvas.width / 60)); // Relative to canvas width, min 10px
  floatingScores.forEach((fs) => {
    const opacity = Math.max(0, fs.life / fs.maxLife);
    ctx.fillStyle = `rgba(255, 220, 62, ${opacity * 0.9})`; // Changed to #FFDC3E (R:255, G:220, B:62) with opacity
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center"; // Center the text horizontally
    ctx.fillText(fs.text, fs.x, fs.y);
  });
}

// Function to load high score from localStorage
function loadHighScore() {
    const storedHighScore = localStorage.getItem('spaceDodgeHighScore');
    if (storedHighScore) {
        highScore = parseInt(storedHighScore, 10);
    } else {
    }
}

// Function to save high score to localStorage
function saveHighScore() {
    localStorage.setItem('spaceDodgeHighScore', highScore.toString());
}

// Game loop
function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Auto-fire for mobile devices
  if (isMobileDevice && mouseControlActive && !gameOver) {
    shoot();
  }

  // Animate displayedScore towards actual score (NEW)
  if (displayedScore < score) {
    let diff = score - displayedScore;
    let increment = Math.max(1, diff * 0.05); // Increment by at least 1 or 5% of difference (adjust 0.05 for speed)
    displayedScore += increment;
    if (displayedScore > score) {
        displayedScore = score; // Clamp
    }
  } else if (displayedScore > score) { // For potential score decreases
    let diff = displayedScore - score;
    let decrement = Math.max(1, diff * 0.05);
    displayedScore -= decrement;
    if (displayedScore < score) {
        displayedScore = score; // Clamp
    }
  }

  // Update star positions based on individual speed
  stars.forEach((star) => {
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
    if (
      bullets[i].y < -bullets[i].height ||
      bullets[i].x < -bullets[i].width ||
      bullets[i].x > canvas.width + bullets[i].width
    ) {
      bullets.splice(i, 1);
    }
  }

  // Check powerup/malfunction timers (can run regardless of mouseControlActive)
  const now = Date.now();
  if (spaceship.rapidFireEndTime > 0 && now >= spaceship.rapidFireEndTime) {
    spaceship.rapidFireEndTime = 0; // Reset timer
  }
  if (spaceship.spreadShotEndTime > 0 && now >= spaceship.spreadShotEndTime) {
    spaceship.spreadShotEndTime = 0;
  }
  if (spaceship.wideShotEndTime > 0 && now >= spaceship.wideShotEndTime) {
    spaceship.wideShotEndTime = 0;
  }
  if (spaceship.weaponMalfunctionEndTime > 0) {
    if (now >= spaceship.weaponMalfunctionEndTime) {
      spaceship.weaponMalfunctionEndTime = 0;
    } else {
      if (Math.random() < 0.2) {
        createSparks(spaceship);
      }
    }
  }

  if (!gameOver) {
    if (isShipAnimatingToStart) {
        // Animate ship to initial click position
        const dx = shipAnimationTargetX - spaceship.x;
        const dy = shipAnimationTargetY - spaceship.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1) { 
            spaceship.x += dx * shipAnimationSpeed;
            spaceship.y += dy * shipAnimationSpeed;
        } else {
            spaceship.x = shipAnimationTargetX;
            spaceship.y = shipAnimationTargetY;
            isShipAnimatingToStart = false;
        }
        // Animate flame during initial movement
        spaceship.flameSize += spaceship.flameFlickerRate;
        if (spaceship.flameSize > spaceship.flameMaxSize || (spaceship.flameSize < spaceship.flameMinSize && spaceship.flameFlickerRate < 0)) {
            spaceship.flameFlickerRate *= -1;
            let lowerBound = (spaceship.flameFlickerRate < 0) ? spaceship.flameMinSize : 0;
            spaceship.flameSize = Math.max(lowerBound, Math.min(spaceship.flameSize, spaceship.flameMaxSize));
        }

    } else if (mouseControlActive) {
        // Normal mouse following after animation 
        spaceship.x = mouseX;
        spaceship.y = mouseY; 

        // Constrain X position
        spaceship.x = Math.max(spaceship.width/2, Math.min(canvas.width - spaceship.width/2, spaceship.x));
        // Constrain Y position
        const topBound = spaceship.height / 2;
        const bottomBound = canvas.height - spaceship.height / 2; 
        spaceship.y = Math.max(topBound, Math.min(bottomBound, spaceship.y));

        // Animate flame (respecting minSize for flicker)
        spaceship.flameSize += spaceship.flameFlickerRate;
        if (spaceship.flameSize > spaceship.flameMaxSize || (spaceship.flameSize < spaceship.flameMinSize && spaceship.flameFlickerRate < 0)) {
            spaceship.flameFlickerRate *= -1;
            let lowerBound = (spaceship.flameFlickerRate < 0) ? spaceship.flameMinSize : 0;
            spaceship.flameSize = Math.max(lowerBound, Math.min(spaceship.flameSize, spaceship.flameMaxSize));
        }
    } else {
        // Keep ship centered until mouse control is active
        if (canvas.width > 0 && canvas.height > 0) { // Ensure canvas is sized
            spaceship.x = canvas.width / 2;
            spaceship.y = canvas.height / 2;
        }
    }

    if (mouseControlActive) { // ##### MAIN GATE FOR ACTIVE GAME ELEMENTS #####
        // Create new asteroids - Decrease frequency
        if (Math.random() < 0.03) {
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
              spaceship.hasShield = false;
              createDebris(asteroid);
              asteroids.splice(i, 1);
              continue;
            } else {
              gameOver = true;
              createExplosion(spaceship.x, spaceship.y);
              break; // Exit asteroid loop as game is over
            }
          }
          if(gameOver) break; // Break outer loop if game ended from ship collision

          // Check Bullet-Asteroid collision
          let asteroidHitByBullet = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j]; // Use a reference
            const asteroidLeft = asteroid.x;
            const asteroidRight = asteroid.x + asteroid.width;
            const asteroidTop = asteroid.y;
            const asteroidBottom = asteroid.y + asteroid.height;
            const bulletLeft = bullet.x - bullet.width / 2;
            const bulletRight = bullet.x + bullet.width / 2;
            const bulletTop = bullet.y - bullet.height / 2;
            const bulletBottom = bullet.y + bullet.height / 2;

            if (
              bulletRight > asteroidLeft &&
              bulletLeft < asteroidRight &&
              bulletBottom > asteroidTop &&
              bulletTop < asteroidBottom
            ) {
              asteroid.health -= 1;
              bullets.splice(j, 1);
              asteroidHitByBullet = true;

              if (asteroid.health <= 0) {
                score += asteroid.scoreValue;
                spawnFloatingScore(
                  asteroid.x + asteroid.width / 2,
                  asteroid.y + asteroid.height / 2,
                  asteroid.scoreValue,
                );
                createDebris(asteroid);
                if (Math.random() < powerupDropChance) {
                  spawnPowerup(
                    asteroid.x + asteroid.width / 2,
                    asteroid.y + asteroid.height / 2,
                  );
                }
                asteroids.splice(i, 1);
              } else {
                createSmallDebris(bullet.x, bullet.y);
                asteroid.speed *= 0.9;
              }
              break; 
            }
          }

          if (asteroidHitByBullet && asteroid.health <= 0 && i < asteroids.length) { // Check i < asteroids.length after splice
            continue; 
          }

          if (i < asteroids.length && asteroids[i].y > canvas.height) {
            asteroids.splice(i, 1);
          }
        } // End Asteroid Loop

        // Update powerups positions and check collection
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            p.y += p.speed;
            if (p.y > canvas.height + p.height) {
                powerups.splice(i, 1);
                continue; 
            }
            
            const dx = spaceship.x - p.x;
            const dy = spaceship.y - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const collisionDistance = spaceship.width / 2 + p.width / 2; 

            if (distance < collisionDistance) {
                if (p.type === "shield") {
                    spaceship.hasShield = true;
                } else if (p.type === "rapidFire") {
                    spaceship.rapidFireEndTime = Date.now() + spaceship.rapidFireDuration;
                    spaceship.spreadShotEndTime = 0;
                    spaceship.wideShotEndTime = 0; 
                    spaceship.weaponMalfunctionEndTime = 0;
                } else if (p.type === "spreadShot") {
                    spaceship.spreadShotEndTime = Date.now() + spaceship.spreadShotDuration;
                    spaceship.rapidFireEndTime = 0;
                    spaceship.wideShotEndTime = 0; 
                    spaceship.weaponMalfunctionEndTime = 0;
                } else if (p.type === "wideShot") {
                    spaceship.wideShotEndTime = Date.now() + spaceship.wideShotDuration;
                    spaceship.rapidFireEndTime = 0; 
                    spaceship.spreadShotEndTime = 0;
                    spaceship.weaponMalfunctionEndTime = 0;
                } else if (p.type === "weaponMalfunction") {
                    spaceship.weaponMalfunctionEndTime = Date.now() + spaceship.weaponMalfunctionDuration;
                    spaceship.rapidFireEndTime = 0; 
                    spaceship.spreadShotEndTime = 0;
                    spaceship.wideShotEndTime = 0;
                }
                powerups.splice(i, 1); 
            }
        } // End Powerup Loop

        // Update Floating Scores
        for (let i = floatingScores.length - 1; i >= 0; i--) {
            const fs = floatingScores[i];
            fs.y -= floatSpeed; // Move up
            fs.life -= 1;
            if (fs.life <= 0) {
            floatingScores.splice(i, 1); // Remove dead text
            }
        } // End Floating Score Loop
    } // ##### END MAIN GATE FOR ACTIVE GAME ELEMENTS #####

    // Attempt to shoot if mouse is down
    if (isMouseDown) {
      shoot(); // Call shoot every frame, cooldown logic inside shoot() handles rate
    }
  } // End of if(!gameOver)

  // Draw everything
  drawStars();
  drawBullets(); // Drawn if they exist (will be empty before first shot)

  if (mouseControlActive) { // Gate drawing of active game elements
    drawAsteroids();
    drawPowerups();
    drawFloatingScores(); // Draw floating score text
    if (!gameOver) { // Only draw main score if game is NOT over
        drawScore(); 
    }
  }

  // Draw ship and flame ONLY if game is not over
  if (!gameOver) {
    drawSpaceship(); // Ship drawing now includes shield
    drawFlame(spaceship); // Draw flame after ship/shield
  }

  // Draw explosion/debris particles if any exist (regardless of game state)
  if (explosionParticles.length > 0) {
    drawExplosion();
  }

  // Game over text handles its own score display if game is over
  // The main score display is now gated by mouseControlActive

  // Draw game over text only if game is over
  if (gameOver) {
    drawGameOver();
  }

  requestAnimationFrame(gameLoop);
}

// --- Window Load Event ---
window.onload = () => {
    windowFullyLoaded = true;
    isMobileDevice = checkMobileDevice();
    attemptGameStart();
};

// --- Main Game Setup Orchestration ---
function attemptGameStart() {

    if (windowFullyLoaded && shipImageLoaded && asteroidImageLoaded) {
        loadHighScore();
        resizeCanvas();
        resetGame();
        createStars();
        gameLoop();
    } else {
    }
}

// Reset Game Function
function resetGame() {
    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }
    gameOver = false;
    score = 0;
    displayedScore = 0; // NEW: Reset displayed score
    mouseControlActive = false; 
    isShipAnimatingToStart = false; 

    asteroids.length = 0;
    bullets.length = 0;
    powerups.length = 0;
    explosionParticles.length = 0;
    floatingScores.length = 0;

    // Reset flame (original parameters)
    spaceship.flameSize = 0;
    spaceship.flameFlickerRate = 0.3; // Use the new slower positive rate

    // Ensure ship is positioned correctly in the center (handled by gameLoop condition and resizeCanvas)
    if (canvas.width > 0 && canvas.height > 0) {
        spaceship.x = canvas.width / 2;
        spaceship.y = canvas.height / 2; 
    } else {
         // Note: The console.warn that was here has been removed.
    }
    spaceship.hasShield = false;
    spaceship.rapidFireEndTime = 0;
    spaceship.spreadShotEndTime = 0;
    spaceship.wideShotEndTime = 0;
    spaceship.weaponMalfunctionEndTime = 0;
    spaceship.lastShotTime = 0;
}

