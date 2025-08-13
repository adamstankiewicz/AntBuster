class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.gameState = 'playing'; // 'playing', 'gameOver'
        this.money = 125;
        this.score = 0;
        
        this.selectedTowerType = 'cannon';
        this.placingTower = false;
        this.selectedTower = null;
        this.movingTower = false;
        
        // Tower types cycling
        this.towerTypes = [
            { type: 'cannon', name: 'Cannon', cost: 60 },
            { type: 'machineGun', name: 'Machine Gun', cost: 100 },
            { type: 'heavyCannon', name: 'Heavy Cannon', cost: 150 },
            { type: 'splash', name: 'Splash Gun', cost: 175 }
        ];
        this.currentTowerTypeIndex = 0;
        
        this.ants = [];
        this.towers = [];
        this.bullets = [];
        this.particles = [];
        
        this.antSpawnTimer = 0;
        this.antSpawnInterval = 120; // frames between ant spawns (back to original)
        this.difficultyTimer = 0;
        
        // Game objects positions (initialize first)
        this.anthill = { x: 50, y: 300 };
        this.cake = { 
            x: 720, 
            y: 300, 
            totalSlices: 8, 
            remainingSlices: 8,
            slicesDelivered: 0, // Track slices actually delivered to anthill
            sliceAngles: [] // Track which slices are taken
        };
        
        // Initialize cake slices
        for (let i = 0; i < this.cake.totalSlices; i++) {
            this.cake.sliceAngles.push(i * (Math.PI * 2) / this.cake.totalSlices);
        }
        
        // Natural wave system (after cake is initialized)
        this.currentWave = 1;
        this.antsInCurrentWave = 0;
        this.baseAntsPerWave = Math.min(4, this.cake.remainingSlices + 1); // Back to original
        this.waveStartTime = 0;
        this.nextWaveDelay = 1200; // 20 seconds between waves (slightly longer due to slower ants)
        
        // Adaptive difficulty system
        this.performanceHistory = [];
        this.antsKilled = 0;
        this.antsReachedCake = 0;
        this.totalAntsSpawned = 0;
        this.difficultyMultiplier = 1.0;
        this.lastPerformanceCheck = 0;
        
        this.setupEventListeners();
        this.gameLoop();
    }
    
    getPerformanceMetrics() {
        const totalAntsEncountered = this.antsKilled + this.antsReachedCake;
        const killRate = totalAntsEncountered > 0 ? this.antsKilled / totalAntsEncountered : 0;
        
        // Calculate average health loss of ants that were killed (how efficiently player kills)
        let totalHealthLoss = 0;
        let healthLossCount = 0;
        this.ants.forEach(ant => {
            if (ant.dead && ant.justDied) {
                const healthLossRatio = (ant.maxHealth - ant.health) / ant.maxHealth;
                totalHealthLoss += healthLossRatio;
                healthLossCount++;
            }
        });
        const averageHealthLoss = healthLossCount > 0 ? totalHealthLoss / healthLossCount : 0;
        
        return {
            killRate: killRate,
            cakeSlicesLost: this.cake.slicesDelivered,
            averageHealthLoss: averageHealthLoss,
            waveNumber: this.currentWave,
            towerCount: this.towers.length,
            moneyAmount: this.money
        };
    }
    
    setupEventListeners() {
        // Single tower button cycling - just changes type, doesn't auto-place
        const towerBtn = document.getElementById('towerTypeBtn');
        if (towerBtn) {
            towerBtn.addEventListener('click', (e) => {
                try {
                    // Cycle through tower types
                    this.currentTowerTypeIndex = (this.currentTowerTypeIndex + 1) % this.towerTypes.length;
                    const currentTower = this.towerTypes[this.currentTowerTypeIndex];
                    this.selectedTowerType = currentTower.type;
                    
                    // Update button text with dynamic pricing
                    const currentCost = this.getTowerCost(currentTower.type);
                    e.target.textContent = `${currentTower.name} - $${currentCost}`;
                    
                    // Don't auto-enable placement - let user click canvas when ready
                } catch (error) {
                    console.error('Error in tower button click:', error);
                }
            });
        }
        
        // Canvas click for tower placement
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // Canvas hover for tower placement preview
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        
        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        
        // ESC key to cancel tower placement
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelTowerPlacement();
            }
        });
        
        // Cancel button
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelTowerPlacement();
            });
        }
    }
    
    cancelTowerPlacement() {
        this.placingTower = false;
        this.selectedTower = null;
        this.movingTower = false;
        this.canvas.style.cursor = 'default';
        document.getElementById('cancelBtn').style.display = 'none';
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.gameState !== 'playing') return;
        
        // Check if clicking on upgrade button
        if (this.selectedTower && x >= 20 && x <= 100 && y >= 120 && y <= 140) {
            const upgradeCost = this.selectedTower.getUpgradeCost();
            if (this.money >= upgradeCost && this.selectedTower.level < 3) {
                this.money -= upgradeCost;
                this.selectedTower.upgrade();
                this.updateUI();
            }
            return;
        }
        
        // Check if clicking on move button
        if (this.selectedTower && x >= 120 && x <= 180 && y >= 120 && y <= 140) {
            this.movingTower = true;
            return;
        }
        
        // Check if clicking on existing tower for upgrades/movement
        const clickedTower = this.towers.find(tower => 
            Math.sqrt((x - tower.x) ** 2 + (y - tower.y) ** 2) < 25
        );
        
        if (clickedTower && !this.placingTower && !this.movingTower) {
            this.selectedTower = this.selectedTower === clickedTower ? null : clickedTower;
            return;
        }
        
        // Handle tower movement
        if (this.movingTower && this.selectedTower && this.canPlaceTower(x, y)) {
            this.selectedTower.x = x;
            this.selectedTower.y = y;
            this.movingTower = false;
            return;
        }
        
        // Place new tower or start placement mode
        if (this.placingTower && this.canPlaceTower(x, y)) {
            const towerCost = this.getTowerCost(this.selectedTowerType);
            if (this.money >= towerCost) {
                this.towers.push(new Tower(x, y, this.selectedTowerType));
                this.money -= towerCost;
                this.placingTower = false;
                this.selectedTower = null;
                this.updateUI();
            }
        } else if (!this.placingTower && !clickedTower && !this.movingTower) {
            // Start tower placement mode when clicking empty space
            this.placingTower = true;
            document.getElementById('cancelBtn').style.display = 'inline-block';
        }
    }
    
    handleCanvasHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }
    
    canPlaceTower(x, y) {
        // Check distance from anthill and cake
        if (Math.sqrt((x - this.anthill.x) ** 2 + (y - this.anthill.y) ** 2) < 40) return false;
        if (Math.sqrt((x - this.cake.x) ** 2 + (y - this.cake.y) ** 2) < 40) return false;
        
        // Check distance from other towers
        return !this.towers.some(tower => 
            Math.sqrt((x - tower.x) ** 2 + (y - tower.y) ** 2) < 50
        );
    }
    
    getTowerCost(type) {
        const baseCosts = {
            cannon: 60,
            machineGun: 100,
            heavyCannon: 150,
            splash: 175
        };
        
        const baseCost = baseCosts[type] || 60;
        
        // Stable pricing with predictable tiers for goal-setting
        const towerCount = this.towers.length;
        
        // Wave-based pricing tiers (predictable increases)
        let waveTier = 1.0;
        if (this.currentWave >= 20) waveTier = 1.8;
        else if (this.currentWave >= 15) waveTier = 1.5;
        else if (this.currentWave >= 10) waveTier = 1.3;
        else if (this.currentWave >= 5) waveTier = 1.1;
        
        // Tower count tiers (stable brackets)
        let densityTier = 1.0;
        if (towerCount >= 12) densityTier = 1.4;
        else if (towerCount >= 8) densityTier = 1.25;
        else if (towerCount >= 5) densityTier = 1.15;
        else if (towerCount >= 3) densityTier = 1.05;
        
        const priceMultiplier = waveTier * densityTier;
        
        return Math.floor(baseCost * priceMultiplier);
    }
    
    spawnAnt() {
        // Spawn different ant types based on current wave
        let antType = 'worker';
        
        if (this.currentWave >= 5) {
            const rand = Math.random();
            if (rand < 0.5) antType = 'worker';
            else if (rand < 0.8) antType = 'soldier';
            else antType = 'queen';
        } else if (this.currentWave >= 3) {
            const rand = Math.random();
            if (rand < 0.7) antType = 'worker';
            else antType = 'soldier';
        }
        
        this.ants.push(new Ant(this.anthill.x, this.anthill.y, this.cake, antType));
        this.totalAntsSpawned++;
    }
    
    startNextWave() {
        this.currentWave++;
        this.antsInCurrentWave = 0;
        this.waveStartTime = this.difficultyTimer;
        
        // Progressive difficulty scaling - gentle early, aggressive mid-game
        const waveMultiplier = 1 + (this.currentWave - 1) * 0.15; // 15% increase per wave
        
        // More aggressive difficulty scaling to prevent easy late game
        const towerCount = this.towers.length;
        const totalTowerPower = this.towers.reduce((sum, tower) => sum + tower.damage * tower.level, 0);
        const avgTowerPower = towerCount > 0 ? totalTowerPower / towerCount : 0;
        
        // Increased ant counts for better challenge with faster towers
        const baseAnts = Math.floor(4 + this.currentWave * 0.4 + Math.pow(Math.max(0, this.currentWave - 3) / 15, 1.3)); // More ants to match tower power
        
        // Moderate scaling based on player tower strength
        const powerScaling = Math.floor(Math.sqrt(avgTowerPower / 40)); // Higher threshold
        const countScaling = Math.floor(towerCount * 0.4); // Reduced tower count scaling
        
        // Very gentle exponential for late game challenge (not impossible)
        const progressionFactor = Math.pow(1.03, Math.max(0, this.currentWave - 10)); // Later start for exponential scaling
        const lateGameBonus = Math.floor(progressionFactor - 1);
        
        this.baseAntsPerWave = Math.min(35, baseAnts + powerScaling + countScaling + lateGameBonus);
        
        // Much faster spawn rates - ants should spawn rapidly
        const baseSpawnRate = 60 - this.currentWave * 2; // Very fast spawning
        const exponentialSpeedUp = Math.pow(0.95, this.currentWave); // Aggressive speedup
        this.antSpawnInterval = Math.max(10, Math.floor(baseSpawnRate * exponentialSpeedUp)); // Very low minimum spawn time
        
        // Faster wave delays to match rapid ant spawning
        if (this.cake.remainingSlices <= 3) {
            this.nextWaveDelay = 720; // 12 seconds when cake is low
        } else if (this.cake.remainingSlices <= 1) {
            this.nextWaveDelay = 900; // 15 seconds for final slice
        } else {
            this.nextWaveDelay = 540; // 9 second standard delay
        }
        
        // No automatic wave bonuses - money only from killing ants
        
        this.updateUI();
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Natural continuous spawning with overlapping waves
        this.antSpawnTimer++;
        
        // Start new wave if enough time has passed
        if (this.difficultyTimer - this.waveStartTime >= this.nextWaveDelay && this.cake.remainingSlices > 0) {
            this.startNextWave();
        }
        
        // Balanced ant limits - earning opportunities without overwhelming chaos
        let maxAntsForCake;
        if (this.cake.remainingSlices <= 1) {
            maxAntsForCake = 6; // Final defense with reasonable earning potential
        } else if (this.cake.remainingSlices <= 2) {
            maxAntsForCake = 9; // Moderate pressure with money opportunities
        } else if (this.cake.remainingSlices <= 3) {
            maxAntsForCake = 12; // Good challenge level
        } else if (this.cake.remainingSlices <= 4) {
            maxAntsForCake = 15; // Late game pressure
        } else {
            maxAntsForCake = Math.min(25, this.cake.remainingSlices * 2.5 + 4); // Capped scaling
        }
        
        const currentWaveAnts = Math.min(this.baseAntsPerWave, maxAntsForCake);
        
        // Only spawn if we haven't exceeded the cake-based limit
        const activeAnts = this.ants.filter(ant => !ant.dead).length;
        if (this.antSpawnTimer >= this.antSpawnInterval && this.antsInCurrentWave < currentWaveAnts && activeAnts < maxAntsForCake) {
            this.spawnAnt();
            this.antsInCurrentWave++;
            this.antSpawnTimer = 0;
        }
        
        // Remove excess ants if there are too many for remaining cake
        if (activeAnts > maxAntsForCake) {
            const excessAnts = this.ants.filter(ant => !ant.dead && !ant.carryingCake);
            const antsToRemove = Math.min(excessAnts.length, activeAnts - maxAntsForCake);
            
            for (let i = 0; i < antsToRemove; i++) {
                // Remove the furthest ant from cake (least threatening)
                excessAnts.sort((a, b) => {
                    const distA = Math.sqrt((a.x - this.cake.x) ** 2 + (a.y - this.cake.y) ** 2);
                    const distB = Math.sqrt((b.x - this.cake.x) ** 2 + (b.y - this.cake.y) ** 2);
                    return distB - distA;
                });
                if (excessAnts[i]) {
                    excessAnts[i].dead = true;
                }
            }
        }
        
        // Increase difficulty over time and check adaptive difficulty
        this.difficultyTimer++;
        this.checkAdaptiveDifficulty();
        
        // Update game objects
        this.ants.forEach(ant => ant.update());
        this.towers.forEach(tower => tower.update(this.ants, this.bullets));
        this.bullets.forEach(bullet => bullet.update());
        this.particles.forEach(particle => particle.update());
        
        // Award money for ants that died (better early game rewards)
        this.ants.forEach(ant => {
            if (ant.justDied && !ant.rewarded) {
                // If ant was carrying cake, return the slice
                if (ant.carryingCake && this.cake.remainingSlices < this.cake.totalSlices) {
                    this.cake.remainingSlices++;
                    // Add the slice back to the angles array
                    const sliceAngle = (this.cake.remainingSlices - 1) * (Math.PI * 2) / this.cake.totalSlices;
                    this.cake.sliceAngles.push(sliceAngle);
                }
                
                // Economic scaling - early game generous, late game more restrictive
                const difficultyPenalty = Math.max(0.7, this.difficultyMultiplier * 0.8);
                
                // Dynamic economic scaling based on actual player performance
                const performanceMetrics = this.getPerformanceMetrics();
                
                // If player is struggling, increase rewards (reduced bonuses)
                let struggleBonusMultiplier = 1.0;
                if (performanceMetrics.cakeSlicesLost > 3) struggleBonusMultiplier += 0.15; // Reduced from 0.3
                if (performanceMetrics.averageHealthLoss > 0.7) struggleBonusMultiplier += 0.1; // Reduced from 0.2
                if (this.money < 75 && this.towers.length < 2) struggleBonusMultiplier += 0.2; // More restrictive conditions
                
                // If player is doing too well, reduce rewards more aggressively
                let dominancePenalty = 1.0;
                if (performanceMetrics.killRate > 0.85 && this.currentWave > 3) dominancePenalty = 0.8; // Stricter
                if (this.money > 300 && performanceMetrics.cakeSlicesLost === 0) dominancePenalty *= 0.85; // Earlier penalty
                
                const economicMultiplier = struggleBonusMultiplier * dominancePenalty;
                
                const baseReward = ant.rewardValue / difficultyPenalty;
                const finalReward = Math.floor(baseReward * economicMultiplier);
                this.money += Math.max(1, finalReward); // Minimum 1 money per kill in late game
                this.score += ant.rewardValue * 5;
                ant.rewarded = true;
                this.antsKilled++;
            }
        });
        
        // Remove dead objects
        this.ants = this.ants.filter(ant => !ant.dead);
        this.bullets = this.bullets.filter(bullet => !bullet.dead);
        this.particles = this.particles.filter(particle => !particle.dead);
        
        // Check ants reaching cake
        this.ants.forEach(ant => {
            if (ant.reachedCake && !ant.returning) {
                if (this.cake.remainingSlices > 0) {
                    ant.returning = true;
                    ant.carryingCake = true;
                    ant.target = this.anthill;
                    ant.waypoints = ant.generateWaypoints(); // Use realistic return path
                    ant.currentWaypointIndex = 0;
                    ant.currentTarget = ant.waypoints[0];
                    
                    // Ants carrying cake get stronger protective health boost
                    const cakeProtection = ant.maxHealth * 0.8; // Increased from 0.5 to 0.8
                    ant.health = Math.min(ant.maxHealth * 1.8, ant.health + cakeProtection);
                    ant.maxHealth = ant.maxHealth * 1.8; // Increased max health too
                    
                    // Remove a slice from the cake visually (but game doesn't end yet)
                    this.cake.remainingSlices--;
                    this.cake.sliceAngles.pop(); // Remove the last slice angle
                } else {
                    // No cake remaining - ant continues wandering
                    ant.reachedCake = false; // Reset so ant generates new waypoints
                    ant.waypoints = ant.generateWaypoints();
                    ant.currentWaypointIndex = 0;
                    ant.currentTarget = ant.waypoints[0];
                }
            }
        });
        
        // Check ants returning to anthill with cake
        this.ants.forEach(ant => {
            if (ant.returning && ant.carryingCake) {
                const distanceToAnthill = Math.sqrt((ant.x - this.anthill.x) ** 2 + (ant.y - this.anthill.y) ** 2);
                if (distanceToAnthill < 20) {
                    // Ant successfully delivered cake slice
                    ant.carryingCake = false;
                    ant.dead = true; // Ant disappears into anthill
                    this.antsReachedCake++;
                    this.score -= 100; // Major penalty for losing a cake slice
                    this.cake.slicesDelivered++;
                    
                    // Check if all cake slices have been delivered to anthill
                    if (this.cake.slicesDelivered >= this.cake.totalSlices) {
                        this.gameState = 'gameOver';
                        document.getElementById('gameOverTitle').textContent = 'Cake Stolen!';
                        document.getElementById('gameOverMessage').textContent = 'The ants delivered all the cake slices to their anthill!';
                        document.getElementById('gameOver').style.display = 'block';
                    }
                }
            }
        });
        
        this.updateUI();
    }
    
    checkAdaptiveDifficulty() {
        // Much less frequent difficulty checks for stability
        if (this.difficultyTimer - this.lastPerformanceCheck >= 1800) { // Every 30 seconds
            this.lastPerformanceCheck = this.difficultyTimer;
            
            // Very slow, linear difficulty progression
            const timeBasedDifficulty = 1.0 + (this.difficultyTimer / 18000) * 0.5; // +0.5x difficulty every 5 minutes
            
            // Simple cake protection focus
            if (this.totalAntsSpawned > 5) { // Only after some ants have spawned
                const cakeProtectionRate = Math.max(0, this.cake.remainingSlices / this.cake.totalSlices);
                
                // Very gentle scaling based mainly on cake protection
                if (cakeProtectionRate > 0.75) { // If most cake is protected
                    this.difficultyMultiplier = Math.min(1.8, timeBasedDifficulty * 1.1);
                } else if (cakeProtectionRate < 0.5) { // If losing too much cake
                    this.difficultyMultiplier = Math.max(0.8, timeBasedDifficulty * 0.9);
                } else {
                    this.difficultyMultiplier = timeBasedDifficulty;
                }
            } else {
                this.difficultyMultiplier = 1.0; // No difficulty scaling until game starts
            }
        }
    }
    
    calculateTowerPower() {
        let totalPower = 0;
        this.towers.forEach(tower => {
            // Calculate tower effectiveness based on damage, range, and level
            const basePower = tower.damage * (tower.range / 100) * tower.level;
            totalPower += basePower;
        });
        return totalPower;
    }
    
    render() {
        // Clear canvas with grass texture
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#9ACD32');
        gradient.addColorStop(1, '#6B8E23');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw random grass blades (no diagonal patterns)
        this.ctx.fillStyle = 'rgba(107, 142, 35, 0.3)';
        
        // Use seeded random for consistent but natural pattern
        const grassSeed = 12345; // Fixed seed for consistent pattern
        let seedValue = grassSeed;
        
        const seededRandom = () => {
            seedValue = (seedValue * 16807) % 2147483647;
            return (seedValue - 1) / 2147483646;
        };
        
        for (let i = 0; i < 200; i++) {
            const x = seededRandom() * this.width;
            const y = seededRandom() * this.height;
            const height = 4 + seededRandom() * 6;
            const width = 1 + seededRandom();
            
            this.ctx.fillRect(x, y, width, height);
            
            // Add secondary grass blade nearby
            if (seededRandom() > 0.5) {
                this.ctx.fillRect(x + 2 + seededRandom() * 3, y + seededRandom() * 3, width * 0.8, height * 0.7);
            }
        }
        
        // Draw dirt path (more natural, winding)
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 25;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(this.anthill.x, this.anthill.y);
        
        // Create curved path segments
        const segments = 8;
        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            const x = this.anthill.x + (this.cake.x - this.anthill.x) * progress;
            const y = this.anthill.y + (this.cake.y - this.anthill.y) * progress + Math.sin(progress * Math.PI * 2) * 15;
            this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
        
        // Draw anthill with more detail
        // Base mound
        const anthillGradient = this.ctx.createRadialGradient(this.anthill.x, this.anthill.y - 10, 0, this.anthill.x, this.anthill.y, 35);
        anthillGradient.addColorStop(0, '#CD853F');
        anthillGradient.addColorStop(1, '#8B4513');
        this.ctx.fillStyle = anthillGradient;
        this.ctx.beginPath();
        this.ctx.arc(this.anthill.x, this.anthill.y, 35, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Anthill entrance
        this.ctx.fillStyle = '#654321';
        this.ctx.beginPath();
        this.ctx.arc(this.anthill.x, this.anthill.y, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Dirt particles around anthill
        this.ctx.fillStyle = '#A0522D';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = this.anthill.x + Math.cos(angle) * (40 + Math.random() * 10);
            const y = this.anthill.y + Math.sin(angle) * (40 + Math.random() * 10);
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw cake with actual removable slices
        const cakeRadius = 30;
        const sliceAngle = (Math.PI * 2) / this.cake.totalSlices;
        
        // Draw remaining cake slices
        this.cake.sliceAngles.forEach((startAngle, index) => {
            // Cake slice base
            const cakeGradient = this.ctx.createRadialGradient(this.cake.x, this.cake.y, 0, this.cake.x, this.cake.y, cakeRadius);
            cakeGradient.addColorStop(0, '#FFEFD5');
            cakeGradient.addColorStop(1, '#DEB887');
            this.ctx.fillStyle = cakeGradient;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.cake.x, this.cake.y);
            this.ctx.arc(this.cake.x, this.cake.y, cakeRadius, startAngle, startAngle + sliceAngle);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Frosting layer
            this.ctx.fillStyle = '#FFB6C1';
            this.ctx.beginPath();
            this.ctx.moveTo(this.cake.x, this.cake.y - 3);
            this.ctx.arc(this.cake.x, this.cake.y - 3, cakeRadius - 3, startAngle, startAngle + sliceAngle);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Slice separator lines
            this.ctx.strokeStyle = '#DEB887';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(this.cake.x, this.cake.y);
            this.ctx.lineTo(this.cake.x + Math.cos(startAngle) * cakeRadius, this.cake.y + Math.sin(startAngle) * cakeRadius);
            this.ctx.stroke();
        });
        
        // Draw game objects
        this.particles.forEach(particle => particle.render(this.ctx));
        this.bullets.forEach(bullet => bullet.render(this.ctx));
        this.ants.forEach(ant => ant.render(this.ctx));
        this.towers.forEach(tower => tower.render(this.ctx, tower === this.selectedTower));
        
        // Draw tower placement preview
        if (this.placingTower && this.mouseX && this.mouseY) {
            const canPlace = this.canPlaceTower(this.mouseX, this.mouseY);
            this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, 20, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw range preview
            const range = this.getTowerRange(this.selectedTowerType);
            this.ctx.strokeStyle = canPlace ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, range, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Draw tower movement preview
        if (this.movingTower && this.selectedTower && this.mouseX && this.mouseY) {
            const canPlace = this.canPlaceTower(this.mouseX, this.mouseY);
            this.ctx.fillStyle = canPlace ? 'rgba(0, 100, 255, 0.4)' : 'rgba(255, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, 20, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw range preview
            this.ctx.strokeStyle = canPlace ? 'rgba(0, 100, 255, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, this.selectedTower.range, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Draw connection line from original position
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.selectedTower.x, this.selectedTower.y);
            this.ctx.lineTo(this.mouseX, this.mouseY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Draw upgrade panel for selected tower
        if (this.selectedTower) {
            this.drawUpgradePanel();
        }
    }
    
    getTowerRange(type) {
        const ranges = {
            cannon: 100,
            machineGun: 80,
            heavyCannon: 120,
            splash: 90
        };
        return ranges[type] || 100;
    }
    
    drawUpgradePanel() {
        const tower = this.selectedTower;
        const panelX = 10;
        const panelY = 10;
        const panelWidth = 250;
        const panelHeight = 140;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${tower.type.toUpperCase()} - Level ${tower.level}`, panelX + 10, panelY + 20);
        this.ctx.fillText(`Damage: ${tower.damage}`, panelX + 10, panelY + 40);
        this.ctx.fillText(`Range: ${tower.range}`, panelX + 10, panelY + 60);
        this.ctx.fillText(`Fire Rate: ${Math.round(60/tower.fireRate * 10)/10}/sec`, panelX + 10, panelY + 80);
        
        // Upgrade button
        if (tower.level < 3) {
            const upgradeCost = tower.getUpgradeCost();
            this.ctx.fillText(`Upgrade: $${upgradeCost}`, panelX + 10, panelY + 100);
            
            if (this.money >= upgradeCost) {
                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                this.ctx.fillRect(panelX + 10, panelY + 110, 80, 20);
                this.ctx.fillStyle = 'white';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('UPGRADE', panelX + 50, panelY + 122);
            }
        } else {
            this.ctx.fillText('MAX LEVEL', panelX + 10, panelY + 100);
        }
        
        // Move button
        this.ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
        this.ctx.fillRect(panelX + 110, panelY + 110, 60, 20);
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MOVE', panelX + 140, panelY + 122);
    }
    
    updateUI() {
        document.getElementById('money').textContent = `$${this.money}`;
        document.getElementById('score').textContent = this.score;
        document.getElementById('cakeHealth').textContent = `${this.cake.remainingSlices}/${this.cake.totalSlices}`;
        document.getElementById('wave').textContent = this.currentWave;
        
        // Update tower button with current wave pricing
        const currentTower = this.towerTypes[this.currentTowerTypeIndex];
        const currentCost = this.getTowerCost(currentTower.type);
        document.getElementById('towerTypeBtn').textContent = `${currentTower.name} - $${currentCost}`;
    }
    
    restart() {
        this.gameState = 'playing';
        this.money = 125;
        this.score = 0;
        this.ants = [];
        this.towers = [];
        this.bullets = [];
        this.particles = [];
        this.selectedTower = null;
        this.antSpawnTimer = 0;
        this.antSpawnInterval = 120;
        this.difficultyTimer = 0;
        
        // Reset cake
        this.cake.remainingSlices = this.cake.totalSlices;
        this.cake.slicesDelivered = 0;
        this.cake.sliceAngles = [];
        for (let i = 0; i < this.cake.totalSlices; i++) {
            this.cake.sliceAngles.push(i * (Math.PI * 2) / this.cake.totalSlices);
        }
        
        // Reset wave system
        this.currentWave = 1;
        this.antsInCurrentWave = 0;
        this.baseAntsPerWave = Math.min(4, this.cake.remainingSlices + 1);
        this.waveStartTime = 0;
        this.nextWaveDelay = 1800;
        
        // Reset adaptive difficulty
        this.performanceHistory = [];
        this.antsKilled = 0;
        this.antsReachedCake = 0;
        this.totalAntsSpawned = 0;
        this.difficultyMultiplier = 1.0;
        this.lastPerformanceCheck = 0;
        
        // Reset tower selection
        this.currentTowerTypeIndex = 0;
        this.selectedTowerType = 'cannon';
        document.getElementById('towerTypeBtn').textContent = 'Cannon - $75';
        
        document.getElementById('gameOver').style.display = 'none';
        this.updateUI();
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Ant {
    constructor(x, y, target, type = 'worker') {
        this.x = x;
        this.y = y;
        this.originalTarget = target;
        this.target = target;
        this.type = type;
        
        // Set stats based on ant type
        this.setStatsForType();
        this.radius = this.baseRadius;
        this.dead = false;
        this.reachedCake = false;
        this.returning = false;
        this.justDied = false;
        this.rewarded = false;
        this.carryingCake = false;
        
        // Generate random waypoints for curved path
        this.waypoints = this.generateWaypoints();
        this.currentWaypointIndex = 0;
        this.currentTarget = this.waypoints[0];
        
        // Add realistic wandering behavior
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.wanderForce = 0.5; // More realistic wandering
        this.wanderSpeed = 0.03; // Slightly faster direction changes
        this.explorationRadius = 60; // More exploration from path
    }
    
    setStatsForType() {
        const stats = {
            worker: {
                health: 100,
                speed: 1.8 + Math.random() * 0.4, // Good balanced speed
                radius: 8,
                color: '#8B4513',
                reward: 6 // Back to original
            },
            soldier: {
                health: 180,
                speed: 1.6 + Math.random() * 0.3, // Good balanced speed
                radius: 10,
                color: '#654321',
                reward: 9 // Back to original
            },
            queen: {
                health: 300,
                speed: 1.4 + Math.random() * 0.3, // Good balanced speed
                radius: 12,
                color: '#A0522D',
                reward: 15 // Back to original
            }
        };
        
        const antStats = stats[this.type] || stats.worker;
        
        // Progressive ant strengthening over time - exponential scaling for mid-game
        const currentWave = game ? game.currentWave : 1;
        let timeMultiplier;
        // Dynamic ant strength based on player tower power rather than hardcoded wave thresholds
        const playerTowerPower = game ? game.towers.reduce((sum, tower) => sum + tower.damage * tower.level, 0) : 0;
        const avgPlayerPower = game && game.towers.length > 0 ? playerTowerPower / game.towers.length : 0;
        
        // More aggressive strength scaling for better challenge
        const baseStrengthMultiplier = 1 + (currentWave - 1) * 0.1;
        
        // Better power matching to keep up with upgraded towers
        const powerMatchingMultiplier = 1 + Math.sqrt(avgPlayerPower / 80) * 0.4;
        
        // Simple exponential growth with minimal dominance boost
        let baseExponent = 1.025;
        
        // Very safe dominance check - only add small boost for high tower counts
        if (game && game.towers && game.towers.length > 20) {
            baseExponent += 0.002; // Tiny boost for very dense defenses
        }
        
        const exponentialGrowth = Math.pow(baseExponent, Math.max(0, currentWave - 8));
        
        timeMultiplier = baseStrengthMultiplier * powerMatchingMultiplier * exponentialGrowth;
        const difficultyMultiplier = game ? game.difficultyMultiplier : 1.0;
        
        // Apply both time and difficulty scaling
        const totalMultiplier = timeMultiplier * Math.sqrt(difficultyMultiplier); // Less aggressive difficulty scaling
        
        this.health = Math.floor(antStats.health * totalMultiplier);
        this.maxHealth = this.health;
        this.baseSpeed = antStats.speed * Math.min(1.4, 1 + (currentWave - 1) * 0.03); // Back to original
        this.speed = this.baseSpeed;
        this.baseRadius = antStats.radius;
        this.antColor = antStats.color;
        this.rewardValue = Math.floor(antStats.reward * timeMultiplier); // Better rewards for stronger ants
    }
    
    generateWaypoints() {
        if (this.returning) {
            // Cake-carrying ants wander slightly but still head toward anthill
            const waypoints = [];
            
            if (this.carryingCake) {
                // Cake carriers take more waypoints but with smaller deviations
                const numReturnWaypoints = 2 + Math.floor(Math.random() * 2); // 2-3 waypoints for continuous wandering
                
                for (let i = 0; i < numReturnWaypoints; i++) {
                    // Create a path that curves toward anthill with realistic wandering
                    const progress = (i + 1) / (numReturnWaypoints + 1); // Progress from cake to anthill
                    const baseX = this.x + (game.anthill.x - this.x) * progress;
                    const baseY = this.y + (game.anthill.y - this.y) * progress;
                    
                    // Add realistic deviation around the base path
                    const deviationRange = 120 - (i * 25); // Larger deviation for more realistic wandering
                    const margin = 20;
                    const randomX = Math.max(margin, Math.min(game.width - margin, baseX + (Math.random() - 0.5) * deviationRange));
                    const randomY = Math.max(margin, Math.min(game.height - margin, baseY + (Math.random() - 0.5) * deviationRange));
                    waypoints.push({ x: randomX, y: randomY });
                }
            } else {
                // Non-cake returning ants explore more
                const numReturnWaypoints = 1 + Math.floor(Math.random() * 2); // 1-2 waypoints
                
                for (let i = 0; i < numReturnWaypoints; i++) {
                    const margin = 20;
                    const randomX = Math.max(margin, Math.min(game.width - margin, game.anthill.x + (Math.random() - 0.5) * 300));
                    const randomY = Math.max(margin, Math.min(game.height - margin, game.anthill.y + (Math.random() - 0.5) * 200));
                    waypoints.push({ x: randomX, y: randomY });
                }
            }
            
            waypoints.push({ x: game.anthill.x, y: game.anthill.y });
            return waypoints;
        }
        
        const waypoints = [];
        const startX = game.anthill.x;
        const startY = game.anthill.y;
        const endX = this.originalTarget.x;
        const endY = this.originalTarget.y;
        
        // Much more exploration - ants spread across entire map
        const numWaypoints = 3 + Math.floor(Math.random() * 3); // 3-5 waypoints for maximum map coverage
        
        for (let i = 0; i < numWaypoints; i++) {
            let waypointX, waypointY;
            
            if (i === 0) {
                // First waypoint can be anywhere on the map for maximum exploration
                waypointX = 100 + Math.random() * 600;
                waypointY = 100 + Math.random() * 400;
            } else if (i === numWaypoints - 1) {
                // Last waypoint should be closer to cake but still allow deviation
                const towardsCake = 0.7; // 70% toward cake
                const exploration = 0.3; // 30% random exploration
                
                waypointX = endX * towardsCake + (100 + Math.random() * 600) * exploration;
                waypointY = endY * towardsCake + (100 + Math.random() * 400) * exploration;
            } else {
                // Middle waypoints spread across the map with some bias toward cake
                const generalDirection = Math.atan2(endY - startY, endX - startX);
                const randomAngle = generalDirection + (Math.random() - 0.5) * Math.PI; // ±90° from general direction
                const randomDistance = 150 + Math.random() * 200; // 150-350 pixels from center
                
                const centerX = (startX + endX) / 2;
                const centerY = (startY + endY) / 2;
                
                waypointX = centerX + Math.cos(randomAngle) * randomDistance;
                waypointY = centerY + Math.sin(randomAngle) * randomDistance;
            }
            
            // Keep waypoints within bounds with margins
            const margin = 20;
            waypointX = Math.max(margin, Math.min(game.width - margin, waypointX));
            waypointY = Math.max(margin, Math.min(game.height - margin, waypointY));
            
            waypoints.push({ x: waypointX, y: waypointY });
        }
        
        // Add final target
        waypoints.push({ x: endX, y: endY });
        return waypoints;
    }
    
    
    update() {
        if (this.dead) return;
        
        // Adjust speed based on carrying cake
        const currentSpeed = this.carryingCake ? this.baseSpeed * 0.6 : this.baseSpeed; // 40% slower when carrying cake
        
        // Unified movement behavior for all ants
        const dx = this.currentTarget.x - this.x;
        const dy = this.currentTarget.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            // Update wandering behavior - more focused but still realistic
            this.wanderTimer++;
            if (this.wanderTimer > 20 + Math.random() * 40) { // Less frequent changes
                // More moderate direction changes
                if (Math.random() < 0.2) { // Reduced sharp turn chance
                    // Sometimes make moderate turns 
                    this.wanderAngle += (Math.random() - 0.5) * Math.PI/2; // Reduced from full PI
                } else {
                    // Most of the time make smaller adjustments
                    this.wanderAngle += (Math.random() - 0.5) * 0.5; // Reduced from 0.8
                }
                this.wanderTimer = 0;
            }
            
            // Gradually adjust wander angle toward target (like real ant behavior)
            const targetAngle = Math.atan2(dy, dx);
            const angleDiff = targetAngle - this.wanderAngle;
            let adjustedAngleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
            this.wanderAngle += adjustedAngleDiff * this.wanderSpeed;
            
            // Calculate movement with wandering and tower avoidance
            let targetForce = 0.7; // Back to original balance
            let wanderForce = this.wanderForce; // Back to original wandering strength
            
            const finalAngle = targetAngle * targetForce + this.wanderAngle * wanderForce;
            let moveX = Math.cos(finalAngle) * currentSpeed;
            let moveY = Math.sin(finalAngle) * currentSpeed;
            
            // Add some random exploration (increased for more dynamic movement)
            const exploration = (Math.random() - 0.5) * 0.6; // Increased for more lively movement
            moveX += Math.cos(this.wanderAngle + Math.PI/2) * exploration;
            moveY += Math.sin(this.wanderAngle + Math.PI/2) * exploration;
            
            // Smooth the movement angle to prevent jittery rotation
            const newMovementAngle = Math.atan2(moveY, moveX);
            if (this.actualMovementAngle === undefined) {
                this.actualMovementAngle = newMovementAngle;
            } else {
                // Smooth transition to new angle
                const angleDiff = newMovementAngle - this.actualMovementAngle;
                let adjustedAngleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
                this.actualMovementAngle += adjustedAngleDiff * 0.15; // Smooth rotation
            }
            
            // Smooth gradient-based tower avoidance
            const proposedX = this.x + moveX;
            const proposedY = this.y + moveY;
            
            let totalAvoidanceX = 0;
            let totalAvoidanceY = 0;
            let needsRepath = false;
            
            for (let tower of game.towers) {
                const towerDistance = Math.sqrt((this.x - tower.x) ** 2 + (this.y - tower.y) ** 2);
                const proposedDistance = Math.sqrt((proposedX - tower.x) ** 2 + (proposedY - tower.y) ** 2);
                
                // Smaller avoidance zones to allow passage through dense defenses
                const hardCollisionRadius = 21; // Reduced from 23 - tighter collision boundary
                const softAvoidanceRadius = 28; // Reduced from 35 - less early avoidance
                
                if (proposedDistance < hardCollisionRadius) {
                    // Hard collision - need to repath only if not recently done
                    if (!this.justTurnedAround) {
                        needsRepath = true;
                    }
                } else if (towerDistance < softAvoidanceRadius) {
                    // Soft avoidance - gradually steer away
                    const avoidanceStrength = (softAvoidanceRadius - towerDistance) / softAvoidanceRadius;
                    const avoidanceAngle = Math.atan2(this.y - tower.y, this.x - tower.x);
                    
                    totalAvoidanceX += Math.cos(avoidanceAngle) * avoidanceStrength * currentSpeed * 0.3; // Reduced from 0.6
                    totalAvoidanceY += Math.sin(avoidanceAngle) * avoidanceStrength * currentSpeed * 0.3; // Weaker avoidance
                }
            }
            
            // Apply soft avoidance to movement
            moveX += totalAvoidanceX;
            moveY += totalAvoidanceY;
            
            // Handle hard collision with repath (less frequently)
            if (needsRepath && !this.justTurnedAround) {
                this.wanderAngle += Math.PI + (Math.random() - 0.5) * Math.PI/3; // Smaller random component
                this.waypoints = this.generateWaypoints();
                this.currentWaypointIndex = 0;
                this.currentTarget = this.waypoints[0];
                
                this.justTurnedAround = true;
                this.turnAroundCooldown = 45; // Shorter cooldown for more adaptive pathfinding in dense defenses
            }
            
            // Cooldown management
            if (this.turnAroundCooldown > 0) {
                this.turnAroundCooldown--;
                if (this.turnAroundCooldown === 0) {
                    this.justTurnedAround = false;
                }
            }
            
            this.x += moveX;
            this.y += moveY;
            
            // Keep ant within canvas boundaries with buffer
            const margin = 20; // Increased margin to prevent corner sticking
            this.x = Math.max(margin, Math.min(game.width - margin, this.x));
            this.y = Math.max(margin, Math.min(game.height - margin, this.y));
            
            // If ant hits boundary, adjust movement to bounce away slightly
            if (this.x <= margin || this.x >= game.width - margin) {
                this.wanderAngle += Math.PI; // Turn around
            }
            if (this.y <= margin || this.y >= game.height - margin) {
                this.wanderAngle += Math.PI; // Turn around
            }
            
            // Remove pausing and backtracking for faster movement
        } else {
            // Move to next waypoint
            this.currentWaypointIndex++;
            if (this.currentWaypointIndex < this.waypoints.length) {
                this.currentTarget = this.waypoints[this.currentWaypointIndex];
            } else {
                if (!this.returning) {
                    this.reachedCake = true;
                }
            }
        }
        
        // Check if ant died
        if (this.health <= 0) {
            this.dead = true;
            this.justDied = true;
            // Create death particles
            for (let i = 0; i < 5; i++) {
                game.particles.push(new Particle(this.x, this.y, '#ff0000'));
            }
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
    }
    
    render(ctx) {
        if (this.dead) return;
        
        // Use actual movement angle for realistic orientation
        let angle = this.actualMovementAngle || 0;
        
        // Fallback to target direction if no movement angle is set yet
        if (angle === undefined || angle === null) {
            if (!this.returning) {
                const dx = this.currentTarget.x - this.x;
                const dy = this.currentTarget.y - this.y;
                angle = Math.atan2(dy, dx);
            } else {
                const dx = this.currentTarget.x - this.x;
                const dy = this.currentTarget.y - this.y;
                angle = Math.atan2(dy, dx);
            }
        }
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        
        // Draw ant shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(2, 2, this.radius + 2, this.radius - 1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Draw ant body (thorax)
        const bodyColor = this.returning ? this.darkenColor(this.antColor) : this.antColor;
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw ant head
        ctx.fillStyle = this.lightenColor(bodyColor);
        ctx.beginPath();
        const headX = this.x + Math.cos(angle) * (this.radius - 2);
        const headY = this.y + Math.sin(angle) * (this.radius - 2);
        ctx.arc(headX, headY, this.radius - 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw ant abdomen
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        const abdomenX = this.x - Math.cos(angle) * (this.radius - 2);
        const abdomenY = this.y - Math.sin(angle) * (this.radius - 2);
        ctx.arc(abdomenX, abdomenY, this.radius - 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw legs
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const legAngle1 = angle + Math.PI/2 + (i * 0.5);
            const legAngle2 = angle - Math.PI/2 - (i * 0.5);
            
            // Left legs
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(legAngle1) * 6, this.y + Math.sin(legAngle1) * 6);
            ctx.stroke();
            
            // Right legs
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(legAngle2) * 6, this.y + Math.sin(legAngle2) * 6);
            ctx.stroke();
        }
        
        // Draw antennae
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        const antennaAngle1 = angle + 0.3;
        const antennaAngle2 = angle - 0.3;
        
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX + Math.cos(antennaAngle1) * 8, headY + Math.sin(antennaAngle1) * 8);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX + Math.cos(antennaAngle2) * 8, headY + Math.sin(antennaAngle2) * 8);
        ctx.stroke();
        
        // Draw cake slice if carrying
        if (this.carryingCake) {
            const cakeX = this.x - Math.cos(angle) * 12;
            const cakeY = this.y - Math.sin(angle) * 12;
            
            // Cake slice base
            ctx.fillStyle = '#FFEFD5';
            ctx.beginPath();
            ctx.arc(cakeX, cakeY, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Frosting
            ctx.fillStyle = '#FFB6C1';
            ctx.beginPath();
            ctx.arc(cakeX, cakeY - 1, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Cherry
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(cakeX, cakeY - 3, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw health bar with better styling
        const barWidth = 16;
        const barHeight = 3;
        const healthPercent = this.health / this.maxHealth;
        
        // Health bar background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barWidth/2 - 1, this.y - this.radius - 10, barWidth + 2, barHeight + 2);
        
        // Health bar
        ctx.fillStyle = healthPercent > 0.6 ? '#32CD32' : healthPercent > 0.3 ? '#FFD700' : '#FF4500';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 9, barWidth * healthPercent, barHeight);
    }
    
    lightenColor(color) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = 40;
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                     (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                     (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    darkenColor(color) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = 30;
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
                     (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
                     (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }
}

class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.level = 1;
        this.fireTimer = 0;
        this.target = null;
        
        this.setStats();
    }
    
    setStats() {
        const stats = {
            cannon: { damage: 30, range: 100, fireRate: 15, color: '#8b4513' }, // 4.0/sec
            machineGun: { damage: 15, range: 80, fireRate: 6, color: '#696969' }, // 10.0/sec
            heavyCannon: { damage: 60, range: 120, fireRate: 30, color: '#2f4f4f' }, // 2.0/sec
            splash: { damage: 25, range: 90, fireRate: 20, color: '#b22222' } // 3.0/sec
        };
        
        const baseStat = stats[this.type];
        this.damage = baseStat.damage * this.level;
        this.range = baseStat.range + (this.level - 1) * 10;
        this.fireRate = Math.max(10, baseStat.fireRate - (this.level - 1) * 5);
        this.color = baseStat.color;
    }
    
    update(ants, bullets) {
        this.fireTimer++;
        
        // Find target with priority system
        this.target = null;
        let bestTarget = null;
        let bestPriority = -1;
        let closestDistance = this.range;
        
        ants.forEach(ant => {
            if (ant.dead) return;
            const distance = Math.sqrt((ant.x - this.x) ** 2 + (ant.y - this.y) ** 2);
            
            if (distance <= this.range) {
                // Calculate priority score
                let priority = 0;
                
                // Highest priority: ants carrying cake back to anthill
                if (ant.carryingCake && ant.returning) {
                    priority = 100;
                } 
                // Medium priority: ants going to get cake
                else if (!ant.returning) {
                    priority = 50;
                }
                // Lower priority: ants without cake
                else {
                    priority = 10;
                }
                
                // Among same priority, prefer closer targets
                priority -= distance / this.range * 10; // Closer = slightly higher priority
                
                // Select best target
                if (priority > bestPriority || (priority === bestPriority && distance < closestDistance)) {
                    bestTarget = ant;
                    bestPriority = priority;
                    closestDistance = distance;
                }
            }
        });
        
        this.target = bestTarget;
        
        // Fire at target
        if (this.target && this.fireTimer >= this.fireRate) {
            bullets.push(new Bullet(this.x, this.y, this.target, this.damage, this.type));
            this.fireTimer = 0;
        }
    }
    
    getUpgradeCost() {
        // Base costs for each tower type
        const baseCosts = {
            cannon: 60,
            machineGun: 100,
            heavyCannon: 150,
            splash: 175
        };
        
        const baseCost = baseCosts[this.type] || 60;
        const baseUpgradeCost = baseCost * 0.8 * this.level;
        
        // Stable upgrade cost tiers for predictable goals
        const currentWave = game ? game.currentWave : 1;
        const towerCount = game ? game.towers.length : 0;
        
        // Wave-based upgrade tiers (fixed brackets)
        let waveTier = 1.0;
        if (currentWave >= 25) waveTier = 1.6;
        else if (currentWave >= 20) waveTier = 1.4;
        else if (currentWave >= 15) waveTier = 1.25;
        else if (currentWave >= 10) waveTier = 1.1;
        
        // Tower count tiers for upgrades
        let densityTier = 1.0;
        if (towerCount >= 10) densityTier = 1.3;
        else if (towerCount >= 6) densityTier = 1.2;
        else if (towerCount >= 3) densityTier = 1.1;
        
        return Math.floor(baseUpgradeCost * waveTier * densityTier);
    }
    
    upgrade() {
        if (this.level < 3) {
            this.level++;
            this.setStats();
        }
    }
    
    render(ctx, selected = false) {
        // Draw range circle if selected
        if (selected) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw tower shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x + 3, this.y + 3, 22, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw tower base with enhanced gradient and type-specific styling
        const gradient = ctx.createRadialGradient(this.x, this.y - 5, 0, this.x, this.y, 20);
        const baseColor = this.color;
        gradient.addColorStop(0, this.lightenColor(baseColor, 50));
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, this.darkenColor(baseColor, 30));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Add type-specific details
        this.drawTowerDetails(ctx);
        
        // Draw tower rim
        ctx.strokeStyle = this.darkenColor(baseColor, 40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw barrel pointing at target
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const angle = Math.atan2(dy, dx);
            
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            
            this.drawBarrel(ctx);
            
            ctx.restore();
        }
        
        // Draw level indicator with better styling
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.level.toString(), this.x, this.y + 5);
        ctx.fillText(this.level.toString(), this.x, this.y + 5);
        
        // Draw upgrade stars for higher levels
        if (this.level > 1) {
            ctx.fillStyle = '#FFD700';
            for (let i = 0; i < this.level - 1; i++) {
                const starAngle = (i * Math.PI * 2 / (this.level - 1)) - Math.PI / 2;
                const starX = this.x + Math.cos(starAngle) * 25;
                const starY = this.y + Math.sin(starAngle) * 25;
                this.drawStar(ctx, starX, starY, 3);
            }
        }
    }
    
    drawTowerDetails(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        switch(this.type) {
            case 'cannon':
                // Draw reinforcement rings
                ctx.strokeStyle = this.darkenColor(this.color, 60);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, 16, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'machineGun':
                // Draw ventilation slots
                ctx.strokeStyle = this.darkenColor(this.color, 50);
                ctx.lineWidth = 2;
                for(let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI * 2) / 6;
                    const x1 = Math.cos(angle) * 10;
                    const y1 = Math.sin(angle) * 10;
                    const x2 = Math.cos(angle) * 15;
                    const y2 = Math.sin(angle) * 15;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
                break;
                
            case 'heavyCannon':
                // Draw armor plating
                ctx.fillStyle = this.lightenColor(this.color, 30);
                ctx.beginPath();
                ctx.arc(-8, -8, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(8, -8, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(-8, 8, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(8, 8, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'splash':
                // Draw explosive warning stripes
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                for(let i = 0; i < 4; i++) {
                    const angle = (i * Math.PI) / 2;
                    ctx.save();
                    ctx.rotate(angle);
                    ctx.beginPath();
                    ctx.moveTo(5, -2);
                    ctx.lineTo(15, -2);
                    ctx.moveTo(5, 2);
                    ctx.lineTo(15, 2);
                    ctx.stroke();
                    ctx.restore();
                }
                break;
        }
        
        ctx.restore();
    }
    
    drawBarrel(ctx) {
        switch(this.type) {
            case 'cannon':
                // Single thick barrel
                const barrelGradient = ctx.createLinearGradient(0, -5, 0, 5);
                barrelGradient.addColorStop(0, '#666');
                barrelGradient.addColorStop(0.5, '#333');
                barrelGradient.addColorStop(1, '#111');
                ctx.fillStyle = barrelGradient;
                ctx.fillRect(15, -5, 22, 10);
                ctx.fillStyle = '#000';
                ctx.fillRect(35, -3, 4, 6);
                break;
                
            case 'machineGun':
                // Multiple thin barrels
                ctx.fillStyle = '#444';
                for(let i = 0; i < 3; i++) {
                    const yOffset = (i - 1) * 4;
                    ctx.fillRect(15, yOffset - 1, 20, 2);
                    ctx.fillStyle = '#000';
                    ctx.fillRect(34, yOffset - 0.5, 2, 1);
                    ctx.fillStyle = '#444';
                }
                break;
                
            case 'heavyCannon':
                // Massive barrel with reinforcement
                const heavyGradient = ctx.createLinearGradient(0, -6, 0, 6);
                heavyGradient.addColorStop(0, '#555');
                heavyGradient.addColorStop(0.5, '#222');
                heavyGradient.addColorStop(1, '#000');
                ctx.fillStyle = heavyGradient;
                ctx.fillRect(15, -6, 25, 12);
                // Reinforcement rings
                ctx.strokeStyle = '#777';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(20, -6);
                ctx.lineTo(20, 6);
                ctx.moveTo(25, -6);
                ctx.lineTo(25, 6);
                ctx.moveTo(30, -6);
                ctx.lineTo(30, 6);
                ctx.stroke();
                ctx.fillStyle = '#000';
                ctx.fillRect(38, -4, 4, 8);
                break;
                
            case 'splash':
                // Wider barrel with explosive markings
                const splashGradient = ctx.createLinearGradient(0, -4, 0, 4);
                splashGradient.addColorStop(0, '#600');
                splashGradient.addColorStop(0.5, '#300');
                splashGradient.addColorStop(1, '#100');
                ctx.fillStyle = splashGradient;
                ctx.fillRect(15, -4, 20, 8);
                // Warning stripes
                ctx.fillStyle = '#FF0';
                ctx.fillRect(18, -3, 1, 6);
                ctx.fillRect(22, -3, 1, 6);
                ctx.fillRect(26, -3, 1, 6);
                ctx.fillRect(30, -3, 1, 6);
                ctx.fillStyle = '#000';
                ctx.fillRect(33, -2, 3, 4);
                break;
        }
    }
    
    drawStar(ctx, x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x1 = Math.cos(angle) * size;
            const y1 = Math.sin(angle) * size;
            const x2 = Math.cos(angle + Math.PI / 5) * size / 2;
            const y2 = Math.sin(angle + Math.PI / 5) * size / 2;
            if (i === 0) {
                ctx.moveTo(x1, y1);
            } else {
                ctx.lineTo(x1, y1);
            }
            ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                     (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                     (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
                     (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
                     (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }
}

class Bullet {
    constructor(x, y, target, damage, type) {
        this.x = x;
        this.y = y;
        this.targetX = target.x;
        this.targetY = target.y;
        this.target = target;
        this.damage = damage;
        this.type = type;
        this.speed = 8;
        this.dead = false;
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Check collision with target
        if (!this.target.dead) {
            const distance = Math.sqrt((this.x - this.target.x) ** 2 + (this.y - this.target.y) ** 2);
            if (distance < 10) {
                this.target.takeDamage(this.damage);
                
                // Splash damage
                if (this.type === 'splash') {
                    game.ants.forEach(ant => {
                        if (ant !== this.target && !ant.dead) {
                            const splashDistance = Math.sqrt((this.x - ant.x) ** 2 + (this.y - ant.y) ** 2);
                            if (splashDistance < 40) {
                                ant.takeDamage(this.damage * 0.5);
                            }
                        }
                    });
                }
                
                this.dead = true;
                return;
            }
        }
        
        // Remove if off screen
        if (this.x < 0 || this.x > 800 || this.y < 0 || this.y > 600) {
            this.dead = true;
        }
    }
    
    render(ctx) {
        const colors = {
            cannon: '#8B4513',
            machineGun: '#C0C0C0',
            heavyCannon: '#2F4F4F',
            splash: '#FF4500'
        };
        
        const color = colors[this.type] || '#333';
        
        // Draw bullet trail
        if (this.type === 'machineGun') {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - this.vx * 3, this.y - this.vy * 3);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
        }
        
        // Draw bullet glow for splash type
        if (this.type === 'splash') {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 8);
            gradient.addColorStop(0, 'rgba(255, 69, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw main bullet
        const gradient = ctx.createRadialGradient(this.x - 1, this.y - 1, 0, this.x, this.y, 4);
        gradient.addColorStop(0, this.lightenColor(color, 40));
        gradient.addColorStop(1, color);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Add shine effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x - 1, this.y - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                     (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                     (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.color = color;
        this.life = 30;
        this.maxLife = 30;
        this.dead = false;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life--;
        
        if (this.life <= 0) {
            this.dead = true;
        }
    }
    
    render(ctx) {
        const alpha = this.life / this.maxLife;
        
        // Create glow effect
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 4);
        gradient.addColorStop(0, `${this.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, `${this.color}00`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3 * alpha, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw bright center
        ctx.fillStyle = `${this.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.5 * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Start the game
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new Game();
});