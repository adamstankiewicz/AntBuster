import { GameConfig } from '../config/GameConfig.js';
import { GameState } from './GameState.js';
import { EventSystem, GameEvents } from './EventSystem.js';
import { Ant } from '../entities/Ant.js';
import { Tower } from '../entities/Tower.js';
import { Bullet } from '../entities/Bullet.js';
import { Particle } from '../entities/Particle.js';
import { MathUtils } from '../utils/MathUtils.js';
import { SoundSystem } from '../utils/SoundSystem.js';

// Main game coordinator - orchestrates all systems
export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Core systems
        this.state = new GameState();
        this.events = new EventSystem();
        this.sounds = new SoundSystem();
        
        // Game object collections
        this.ants = [];
        this.towers = [];
        this.bullets = [];
        this.particles = [];
        
        // Setup event listeners
        this.setupEventListeners();
        this.setupGameEventListeners();
        
        // Start game loop
        this.gameLoop();
    }
    
    setupGameEventListeners() {
        // Listen to game events and update accordingly
        this.events.on(GameEvents.ANT_DIED, (ant) => {
            this.handleAntDeath(ant);
        });
        
        this.events.on(GameEvents.ANT_REACHED_CAKE, (ant) => {
            this.handleAntReachedCake(ant);
        });
        
        this.events.on(GameEvents.TOWER_PLACED, () => {
            this.updateUI();
        });
        
        this.events.on(GameEvents.UI_UPDATE_NEEDED, () => {
            this.updateUI();
        });
        
    }
    
    handleAntDeath(ant) {
        if (ant.justDied && !ant.rewarded) {
            // Return cake slice if ant was carrying one
            if (ant.carryingCake) {
                this.state.returnCakeSlice();
            }
            
            // Award money and score
            const reward = this.calculateAntReward(ant);
            this.state.earnMoney(reward);
            this.state.addScore(ant.rewardValue * 5);
            ant.rewarded = true;
            this.state.antsKilled++;
            
            // Play sound effects
            if (reward > 0) {
                setTimeout(() => this.sounds.playMoneyEarn(), 100);
            }
            
            // Create death particles
            for (let i = 0; i < 5; i++) {
                this.particles.push(new Particle(ant.x, ant.y, '#ff0000'));
            }
            
            this.events.emit(GameEvents.UI_UPDATE_NEEDED);
        }
    }
    
    calculateAntReward(ant) {
        // Economic scaling based on game state
        const difficultyPenalty = Math.max(0.7, this.state.difficultyMultiplier * 0.8);
        const performanceMetrics = this.getPerformanceMetrics();
        
        // Struggle bonus
        let struggleBonusMultiplier = 1.0;
        if (performanceMetrics.cakeSlicesLost > 3) struggleBonusMultiplier += 0.15;
        if (performanceMetrics.averageHealthLoss > 0.7) struggleBonusMultiplier += 0.1;
        if (this.state.money < 75 && this.towers.length < 2) struggleBonusMultiplier += 0.2;
        
        // Dominance penalty
        let dominancePenalty = 1.0;
        if (performanceMetrics.killRate > 0.85 && this.state.currentWave > 3) dominancePenalty = 0.8;
        if (this.state.money > 300 && performanceMetrics.cakeSlicesLost === 0) dominancePenalty *= 0.85;
        
        const economicMultiplier = struggleBonusMultiplier * dominancePenalty;
        const baseReward = ant.rewardValue / difficultyPenalty;
        
        return Math.max(1, Math.floor(baseReward * economicMultiplier));
    }
    
    handleAntReachedCake(ant) {
        if (this.state.cake.remainingSlices > 0) {
            ant.startReturning();
            this.state.takeCakeSlice();
            this.sounds.playAntReachCake();
            this.events.emit(GameEvents.UI_UPDATE_NEEDED);
        } else {
            // No cake remaining - ant continues wandering
            ant.reachedCake = false;
            ant.waypoints = ant.generateWaypoints();
            ant.currentWaypointIndex = 0;
            ant.currentTarget = ant.waypoints[0];
        }
    }
    
    setupEventListeners() {
        // Tower button cycling
        const towerBtn = document.getElementById('towerTypeBtn');
        if (towerBtn) {
            towerBtn.addEventListener('click', (e) => {
                this.cycleTowerType(e);
            });
        }
        
        // Canvas interactions
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        
        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelTowerPlacement();
            });
        }
    }
    
    cycleTowerType(e) {
        try {
            this.sounds.playButtonClick();
            const towerTypes = Object.keys(GameConfig.towers);
            this.state.currentTowerTypeIndex = (this.state.currentTowerTypeIndex + 1) % towerTypes.length;
            const currentTowerKey = towerTypes[this.state.currentTowerTypeIndex];
            this.state.selectedTowerType = currentTowerKey;
            
            const currentTower = GameConfig.towers[currentTowerKey];
            const currentCost = this.getTowerCost(currentTowerKey);
            e.target.textContent = `${currentTower.name} - $${currentCost}`;
        } catch (error) {
            console.error('Error in tower button click:', error);
        }
    }
    
    handleKeyDown(e) {
        // Prevent default behavior for game keys
        if (['1', '2', '3', '4', ' ', 'Escape'].includes(e.key)) {
            e.preventDefault();
        }
        
        switch (e.key) {
            case 'Escape':
                this.cancelTowerPlacement();
                break;
                
            case ' ': // Spacebar for pause/unpause
                this.togglePause();
                break;
                
            case '1':
                this.selectTowerType(0);
                break;
                
            case '2':
                this.selectTowerType(1);
                break;
                
            case '3':
                this.selectTowerType(2);
                break;
                
            case '4':
                this.selectTowerType(3);
                break;
                
            case 'r':
            case 'R':
                if (this.state.gameState === 'gameOver') {
                    this.restart();
                }
                break;
        }
    }
    
    selectTowerType(index) {
        const towerTypes = Object.keys(GameConfig.towers);
        if (index < towerTypes.length) {
            this.state.currentTowerTypeIndex = index;
            const currentTowerKey = towerTypes[index];
            this.state.selectedTowerType = currentTowerKey;
            
            const currentTower = GameConfig.towers[currentTowerKey];
            const currentCost = this.getTowerCost(currentTowerKey);
            const towerBtn = document.getElementById('towerTypeBtn');
            if (towerBtn) {
                towerBtn.textContent = `${currentTower.name} - $${currentCost}`;
            }
        }
    }
    
    togglePause() {
        if (this.state.gameState === 'playing') {
            this.state.gameState = 'paused';
            this.sounds.playPause();
        } else if (this.state.gameState === 'paused') {
            this.state.gameState = 'playing';
            this.sounds.playUnpause();
        }
        this.events.emit('game_paused', this.state.gameState === 'paused');
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (!this.state.isPlaying()) return;
        
        // Check for tower panel button clicks
        if (this.state.selectedTower) {
            const panelX = 15;
            const panelY = 15;
            const panelHeight = 160;
            const buttonY = panelY + panelHeight - 35;
            
            // Upgrade button (15, buttonY, 90, 25)
            if (x >= panelX + 15 && x <= panelX + 105 && y >= buttonY && y <= buttonY + 25) {
                this.tryUpgradeTower();
                return;
            }
            
            // Move button (115, buttonY, 70, 25)
            if (x >= panelX + 115 && x <= panelX + 185 && y >= buttonY && y <= buttonY + 25) {
                this.state.movingTower = true;
                return;
            }
            
            // Sell button (195, buttonY, 70, 25)
            if (x >= panelX + 195 && x <= panelX + 265 && y >= buttonY && y <= buttonY + 25) {
                this.sellTower();
                return;
            }
        }
        
        // Check for tower selection
        const clickedTower = this.towers.find(tower => 
            MathUtils.distance(x, y, tower.x, tower.y) < 25
        );
        
        if (clickedTower && !this.state.placingTower && !this.state.movingTower) {
            this.state.selectedTower = this.state.selectedTower === clickedTower ? null : clickedTower;
            return;
        }
        
        // Handle tower movement
        if (this.state.movingTower && this.state.selectedTower && this.canPlaceTower(x, y)) {
            this.state.selectedTower.x = x;
            this.state.selectedTower.y = y;
            this.state.movingTower = false;
            return;
        }
        
        // Handle tower placement
        if (this.state.placingTower && this.canPlaceTower(x, y)) {
            this.placeTower(x, y);
        } else if (!this.state.placingTower && !clickedTower && !this.state.movingTower) {
            this.startTowerPlacement();
        }
    }
    
    tryUpgradeTower() {
        const upgradeCost = this.state.selectedTower.getUpgradeCost();
        if (this.state.canAfford(upgradeCost) && this.state.selectedTower.canUpgrade()) {
            this.state.spendMoney(upgradeCost);
            this.state.selectedTower.upgrade();
            this.sounds.playTowerUpgrade();
            this.updateUI();
        }
    }
    
    sellTower() {
        if (this.state.selectedTower) {
            const sellValue = Math.floor(this.state.selectedTower.baseCost * 0.7);
            this.state.earnMoney(sellValue);
            this.sounds.playTowerSell();
            
            // Remove tower from array
            const towerIndex = this.towers.indexOf(this.state.selectedTower);
            if (towerIndex > -1) {
                this.towers.splice(towerIndex, 1);
            }
            
            this.state.selectedTower = null;
            this.events.emit('tower_sold', sellValue);
            this.updateUI();
        }
    }
    
    placeTower(x, y) {
        const towerCost = this.getTowerCost(this.state.selectedTowerType);
        if (this.state.spendMoney(towerCost)) {
            const newTower = new Tower(x, y, this.state.selectedTowerType, this.state, this.events);
            this.towers.push(newTower);
            this.state.placingTower = false;
            this.state.selectedTower = null;
            this.sounds.playTowerPlace();
            this.events.emit(GameEvents.TOWER_PLACED, newTower);
            this.updateUI();
        }
    }
    
    startTowerPlacement() {
        this.state.placingTower = true;
        document.getElementById('cancelBtn').style.display = 'inline-block';
    }
    
    handleCanvasHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.state.mouseX = e.clientX - rect.left;
        this.state.mouseY = e.clientY - rect.top;
    }
    
    cancelTowerPlacement() {
        this.state.placingTower = false;
        this.state.selectedTower = null;
        this.state.movingTower = false;
        this.canvas.style.cursor = 'default';
        document.getElementById('cancelBtn').style.display = 'none';
    }
    
    canPlaceTower(x, y) {
        // Check distance from anthill and cake
        if (MathUtils.distance(x, y, GameConfig.positions.anthill.x, GameConfig.positions.anthill.y) < 40) return false;
        if (MathUtils.distance(x, y, GameConfig.positions.cake.x, GameConfig.positions.cake.y) < 40) return false;
        
        // Check distance from other towers
        return !this.towers.some(tower => 
            MathUtils.distance(x, y, tower.x, tower.y) < GameConfig.physics.towerPlacementMinDistance
        );
    }
    
    getTowerCost(type) {
        const towerConfig = GameConfig.towers[type];
        if (!towerConfig) return 60;
        
        const baseCost = towerConfig.baseCost;
        const towerCount = this.towers.length;
        
        // Wave-based pricing tiers
        let waveTier = 1.0;
        if (this.state.currentWave >= 20) waveTier = 1.8;
        else if (this.state.currentWave >= 15) waveTier = 1.5;
        else if (this.state.currentWave >= 10) waveTier = 1.3;
        else if (this.state.currentWave >= 5) waveTier = 1.1;
        
        // Tower count tiers
        let densityTier = 1.0;
        if (towerCount >= 12) densityTier = 1.4;
        else if (towerCount >= 8) densityTier = 1.25;
        else if (towerCount >= 5) densityTier = 1.15;
        else if (towerCount >= 3) densityTier = 1.05;
        
        return Math.floor(baseCost * waveTier * densityTier);
    }
    
    update() {
        if (!this.state.isPlaying()) return;
        
        // Wave management
        this.updateWaveSystem();
        
        // Update game objects
        this.ants.forEach(ant => ant.update(this.towers));
        this.towers.forEach(tower => tower.update(this.ants, this.bullets));
        this.bullets.forEach(bullet => bullet.update(this.ants));
        this.particles.forEach(particle => particle.update());
        
        // Check ants returning to anthill with cake
        this.checkAntsReturning();
        
        // Remove dead objects
        this.ants = this.ants.filter(ant => !ant.dead);
        this.bullets = this.bullets.filter(bullet => !bullet.dead);
        this.particles = this.particles.filter(particle => !particle.dead);
        
        // Update difficulty
        this.state.difficultyTimer++;
        this.checkAdaptiveDifficulty();
        
        this.updateUI();
    }
    
    updateWaveSystem() {
        this.state.antSpawnTimer++;
        
        // Start new wave if enough time has passed
        if (this.state.difficultyTimer - this.state.waveStartTime >= this.state.nextWaveDelay && 
            this.state.cake.remainingSlices > 0) {
            this.startNextWave();
        }
        
        // Spawn ants based on current wave
        const maxAntsForCake = this.calculateMaxAntsForCake();
        const currentWaveAnts = Math.min(this.state.baseAntsPerWave, maxAntsForCake);
        const activeAnts = this.ants.filter(ant => !ant.dead).length;
        
        if (this.state.antSpawnTimer >= this.state.antSpawnInterval && 
            this.state.antsInCurrentWave < currentWaveAnts && 
            activeAnts < maxAntsForCake) {
            this.spawnAnt();
            this.state.antsInCurrentWave++;
            this.state.antSpawnTimer = 0;
        }
    }
    
    calculateMaxAntsForCake() {
        if (this.state.cake.remainingSlices <= 1) return 6;
        if (this.state.cake.remainingSlices <= 2) return 9;
        if (this.state.cake.remainingSlices <= 3) return 12;
        if (this.state.cake.remainingSlices <= 4) return 15;
        return Math.min(25, this.state.cake.remainingSlices * 2.5 + 4);
    }
    
    startNextWave() {
        this.state.currentWave++;
        this.state.antsInCurrentWave = 0;
        this.state.waveStartTime = this.state.difficultyTimer;
        
        // Calculate wave difficulty
        const waveMultiplier = 1 + (this.state.currentWave - 1) * GameConfig.waves.difficultyIncrease;
        const baseAnts = Math.floor(4 + this.state.currentWave * 0.4 + 
            Math.pow(Math.max(0, this.state.currentWave - 3) / 15, 1.3));
        
        this.state.baseAntsPerWave = Math.min(35, baseAnts);
        
        // Update spawn rate
        const baseSpawnRate = 60 - this.state.currentWave * 2;
        const exponentialSpeedUp = Math.pow(0.95, this.state.currentWave);
        this.state.antSpawnInterval = Math.max(10, Math.floor(baseSpawnRate * exponentialSpeedUp));
        
        // Update wave delay
        if (this.state.cake.remainingSlices <= 3) {
            this.state.nextWaveDelay = 720;
        } else if (this.state.cake.remainingSlices <= 1) {
            this.state.nextWaveDelay = 900;
        } else {
            this.state.nextWaveDelay = 540;
        }
        
        this.sounds.playWaveStart();
        this.events.emit(GameEvents.WAVE_STARTED, this.state.currentWave);
    }
    
    spawnAnt() {
        let antType = 'worker';
        
        if (this.state.currentWave >= 5) {
            const rand = Math.random();
            if (rand < 0.5) antType = 'worker';
            else if (rand < 0.8) antType = 'soldier';
            else antType = 'queen';
        } else if (this.state.currentWave >= 3) {
            const rand = Math.random();
            if (rand < 0.7) antType = 'worker';
            else antType = 'soldier';
        }
        
        const ant = new Ant(
            GameConfig.positions.anthill.x, 
            GameConfig.positions.anthill.y, 
            this.state.cake, 
            antType, 
            this.state, 
            this.events
        );
        this.ants.push(ant);
        this.state.totalAntsSpawned++;
        this.events.emit(GameEvents.ANT_SPAWNED, ant);
    }
    
    checkAntsReturning() {
        this.ants.forEach(ant => {
            if (ant.returning && ant.carryingCake) {
                const distanceToAnthill = MathUtils.distance(
                    ant.x, ant.y, 
                    GameConfig.positions.anthill.x, 
                    GameConfig.positions.anthill.y
                );
                
                if (distanceToAnthill < 20) {
                    ant.carryingCake = false;
                    ant.dead = true;
                    
                    const gameOverResult = this.state.deliverCakeSlice();
                    if (gameOverResult) {
                        this.endGame(gameOverResult.reason, gameOverResult.message);
                    }
                    
                    this.events.emit(GameEvents.ANT_DELIVERED_CAKE, ant);
                }
            }
        });
    }
    
    checkAdaptiveDifficulty() {
        if (this.state.difficultyTimer - this.state.lastPerformanceCheck >= 1800) {
            this.state.lastPerformanceCheck = this.state.difficultyTimer;
            
            const timeBasedDifficulty = 1.0 + (this.state.difficultyTimer / 18000) * 0.5;
            
            if (this.state.totalAntsSpawned > 5) {
                const cakeProtectionRate = Math.max(0, this.state.cake.remainingSlices / this.state.cake.totalSlices);
                
                if (cakeProtectionRate > 0.75) {
                    this.state.difficultyMultiplier = Math.min(1.8, timeBasedDifficulty * 1.1);
                } else if (cakeProtectionRate < 0.5) {
                    this.state.difficultyMultiplier = Math.max(0.8, timeBasedDifficulty * 0.9);
                } else {
                    this.state.difficultyMultiplier = timeBasedDifficulty;
                }
            } else {
                this.state.difficultyMultiplier = 1.0;
            }
        }
    }
    
    getPerformanceMetrics() {
        const totalAntsEncountered = this.state.antsKilled + this.state.antsReachedCake;
        const killRate = totalAntsEncountered > 0 ? this.state.antsKilled / totalAntsEncountered : 0;
        
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
            cakeSlicesLost: this.state.cake.slicesDelivered,
            averageHealthLoss: averageHealthLoss,
            waveNumber: this.state.currentWave,
            towerCount: this.towers.length,
            moneyAmount: this.state.money
        };
    }
    
    endGame(reason, message) {
        this.state.endGame(reason, message);
        this.sounds.playGameOver();
        document.getElementById('gameOverTitle').textContent = reason;
        document.getElementById('gameOverMessage').textContent = message;
        document.getElementById('gameOver').style.display = 'block';
        this.events.emit(GameEvents.GAME_OVER, { reason, message });
    }
    
    render() {
        // Clear canvas with grass texture
        this.renderBackground();
        
        // Draw game objects
        this.particles.forEach(particle => particle.render(this.ctx));
        this.bullets.forEach(bullet => bullet.render(this.ctx));
        this.ants.forEach(ant => ant.render(this.ctx));
        this.towers.forEach(tower => tower.render(this.ctx, tower === this.state.selectedTower));
        
        // Draw UI overlays
        this.renderTowerPlacementPreview();
        this.renderTowerMovementPreview();
        this.renderUpgradePanel();
        
        // Draw pause overlay
        if (this.state.isPaused()) {
            this.renderPauseOverlay();
        }
    }
    
    renderBackground() {
        // Grass gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#9ACD32');
        gradient.addColorStop(1, '#6B8E23');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Grass texture
        this.renderGrassTexture();
        
        // Path
        this.renderPath();
        
        // Anthill and cake
        this.renderAnthill();
        this.renderCake();
    }
    
    renderGrassTexture() {
        this.ctx.fillStyle = 'rgba(107, 142, 35, 0.3)';
        const seededRandom = MathUtils.createSeededRandom(12345);
        
        for (let i = 0; i < 200; i++) {
            const x = seededRandom() * this.width;
            const y = seededRandom() * this.height;
            const height = 4 + seededRandom() * 6;
            const width = 1 + seededRandom();
            
            this.ctx.fillRect(x, y, width, height);
            
            if (seededRandom() > 0.5) {
                this.ctx.fillRect(x + 2 + seededRandom() * 3, y + seededRandom() * 3, width * 0.8, height * 0.7);
            }
        }
    }
    
    renderPath() {
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 25;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(GameConfig.positions.anthill.x, GameConfig.positions.anthill.y);
        
        const segments = 8;
        for (let i = 1; i <= segments; i++) {
            const progress = i / segments;
            const x = GameConfig.positions.anthill.x + (GameConfig.positions.cake.x - GameConfig.positions.anthill.x) * progress;
            const y = GameConfig.positions.anthill.y + (GameConfig.positions.cake.y - GameConfig.positions.anthill.y) * progress + 
                Math.sin(progress * Math.PI * 2) * 15;
            this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }
    
    renderAnthill() {
        const anthill = GameConfig.positions.anthill;
        
        // Base mound
        const anthillGradient = this.ctx.createRadialGradient(anthill.x, anthill.y - 10, 0, anthill.x, anthill.y, 35);
        anthillGradient.addColorStop(0, '#CD853F');
        anthillGradient.addColorStop(1, '#8B4513');
        this.ctx.fillStyle = anthillGradient;
        this.ctx.beginPath();
        this.ctx.arc(anthill.x, anthill.y, 35, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Entrance
        this.ctx.fillStyle = '#654321';
        this.ctx.beginPath();
        this.ctx.arc(anthill.x, anthill.y, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Dirt particles
        this.ctx.fillStyle = '#A0522D';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = anthill.x + Math.cos(angle) * (40 + Math.random() * 10);
            const y = anthill.y + Math.sin(angle) * (40 + Math.random() * 10);
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    renderCake() {
        const cake = this.state.cake;
        const cakeRadius = 30;
        const sliceAngle = (Math.PI * 2) / cake.totalSlices;
        
        // Draw remaining cake slices
        cake.sliceAngles.forEach((startAngle, index) => {
            // Cake slice base
            const cakeGradient = this.ctx.createRadialGradient(cake.x, cake.y, 0, cake.x, cake.y, cakeRadius);
            cakeGradient.addColorStop(0, '#FFEFD5');
            cakeGradient.addColorStop(1, '#DEB887');
            this.ctx.fillStyle = cakeGradient;
            
            this.ctx.beginPath();
            this.ctx.moveTo(cake.x, cake.y);
            this.ctx.arc(cake.x, cake.y, cakeRadius, startAngle, startAngle + sliceAngle);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Frosting layer
            this.ctx.fillStyle = '#FFB6C1';
            this.ctx.beginPath();
            this.ctx.moveTo(cake.x, cake.y - 3);
            this.ctx.arc(cake.x, cake.y - 3, cakeRadius - 3, startAngle, startAngle + sliceAngle);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Slice separator lines
            this.ctx.strokeStyle = '#DEB887';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(cake.x, cake.y);
            this.ctx.lineTo(cake.x + Math.cos(startAngle) * cakeRadius, cake.y + Math.sin(startAngle) * cakeRadius);
            this.ctx.stroke();
        });
    }
    
    renderTowerPlacementPreview() {
        if (this.state.placingTower && this.state.mouseX && this.state.mouseY) {
            const canPlace = this.canPlaceTower(this.state.mouseX, this.state.mouseY);
            this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(this.state.mouseX, this.state.mouseY, 20, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Range preview
            const towerConfig = GameConfig.towers[this.state.selectedTowerType];
            if (towerConfig) {
                this.ctx.strokeStyle = canPlace ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(this.state.mouseX, this.state.mouseY, towerConfig.range, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
    }
    
    renderTowerMovementPreview() {
        if (this.state.movingTower && this.state.selectedTower && this.state.mouseX && this.state.mouseY) {
            const canPlace = this.canPlaceTower(this.state.mouseX, this.state.mouseY);
            this.ctx.fillStyle = canPlace ? 'rgba(0, 100, 255, 0.4)' : 'rgba(255, 0, 0, 0.4)';
            this.ctx.beginPath();
            this.ctx.arc(this.state.mouseX, this.state.mouseY, 20, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Range preview
            this.ctx.strokeStyle = canPlace ? 'rgba(0, 100, 255, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.state.mouseX, this.state.mouseY, this.state.selectedTower.range, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Connection line
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.state.selectedTower.x, this.state.selectedTower.y);
            this.ctx.lineTo(this.state.mouseX, this.state.mouseY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }
    
    renderUpgradePanel() {
        if (!this.state.selectedTower) return;
        
        const tower = this.state.selectedTower;
        const panelX = 15;
        const panelY = 15;
        const panelWidth = 280;
        const panelHeight = 160;
        const borderRadius = 12;
        
        // Draw modern panel background with gradient and shadow
        this.ctx.save();
        
        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(panelX + 3, panelY + 3, panelWidth, panelHeight);
        
        // Main panel with rounded corners
        this.ctx.fillStyle = 'rgba(26, 46, 35, 0.95)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Header with tower type and level
        const towerConfig = GameConfig.towers[tower.type];
        this.ctx.fillStyle = towerConfig.color;
        this.ctx.fillRect(panelX, panelY, panelWidth, 35);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px Inter, Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${towerConfig.name} (Level ${tower.level})`, panelX + 15, panelY + 22);
        
        // Stats section
        this.ctx.fillStyle = '#e0e0e0';
        this.ctx.font = '13px Inter, Arial, sans-serif';
        
        const statsY = panelY + 55;
        const lineHeight = 18;
        let currentY = statsY;
        
        // Damage
        this.ctx.fillText(`💥 Damage: ${tower.damage}`, panelX + 15, currentY);
        currentY += lineHeight;
        
        // Range  
        this.ctx.fillText(`🎯 Range: ${tower.range}`, panelX + 15, currentY);
        currentY += lineHeight;
        
        // Fire Rate
        const fireRate = Math.round(60/tower.fireRate * 10)/10;
        this.ctx.fillText(`⚡ Fire Rate: ${fireRate}/sec`, panelX + 15, currentY);
        currentY += lineHeight;
        
        // Upgrade section
        const buttonY = panelY + panelHeight - 35;
        
        if (tower.canUpgrade()) {
            const upgradeCost = tower.getUpgradeCost();
            const canAfford = this.state.canAfford(upgradeCost);
            
            // Upgrade button
            this.ctx.fillStyle = canAfford ? 'rgba(76, 175, 80, 0.8)' : 'rgba(100, 100, 100, 0.5)';
            this.ctx.fillRect(panelX + 15, buttonY, 90, 25);
            
            this.ctx.strokeStyle = canAfford ? '#4CAF50' : '#666';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(panelX + 15, buttonY, 90, 25);
            
            this.ctx.fillStyle = canAfford ? 'white' : '#999';
            this.ctx.font = 'bold 12px Inter, Arial, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`UPGRADE $${upgradeCost}`, panelX + 60, buttonY + 16);
        } else {
            // Max level indicator
            this.ctx.fillStyle = 'rgba(255, 193, 7, 0.8)';
            this.ctx.fillRect(panelX + 15, buttonY, 90, 25);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Inter, Arial, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('MAX LEVEL', panelX + 60, buttonY + 16);
        }
        
        // Move button
        this.ctx.fillStyle = 'rgba(33, 150, 243, 0.8)';
        this.ctx.fillRect(panelX + 115, buttonY, 70, 25);
        
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(panelX + 115, buttonY, 70, 25);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Inter, Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MOVE', panelX + 150, buttonY + 16);
        
        // Sell button
        this.ctx.fillStyle = 'rgba(244, 67, 54, 0.8)';
        this.ctx.fillRect(panelX + 195, buttonY, 70, 25);
        
        this.ctx.strokeStyle = '#F44336';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(panelX + 195, buttonY, 70, 25);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Inter, Arial, sans-serif';
        this.ctx.textAlign = 'center';
        const sellValue = Math.floor(tower.baseCost * 0.7);
        this.ctx.fillText(`SELL $${sellValue}`, panelX + 230, buttonY + 16);
        
        this.ctx.restore();
    }
    
    renderPauseOverlay() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Pause text
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 48px Inter, Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', this.width / 2, this.height / 2 - 20);
        
        // Instructions
        this.ctx.font = '18px Inter, Arial, sans-serif';
        this.ctx.fillStyle = '#cccccc';
        this.ctx.fillText('Press SPACE to resume', this.width / 2, this.height / 2 + 30);
    }
    
    updateUI() {
        document.getElementById('money').textContent = `$${this.state.money}`;
        document.getElementById('score').textContent = this.state.score;
        document.getElementById('cakeHealth').textContent = `${this.state.cake.remainingSlices}/${this.state.cake.totalSlices}`;
        document.getElementById('wave').textContent = this.state.currentWave;
        
        // Update tower button
        const towerKeys = Object.keys(GameConfig.towers);
        const currentTowerKey = towerKeys[this.state.currentTowerTypeIndex];
        const currentTower = GameConfig.towers[currentTowerKey];
        const currentCost = this.getTowerCost(currentTowerKey);
        document.getElementById('towerTypeBtn').textContent = `${currentTower.name} - $${currentCost}`;
    }
    
    restart() {
        // Reset state
        this.state.reset();
        
        // Clear object arrays
        this.ants = [];
        this.towers = [];
        this.bullets = [];
        this.particles = [];
        
        // Hide game over screen
        document.getElementById('gameOver').style.display = 'none';
        
        // Update UI
        this.updateUI();
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Export for global access (maintaining compatibility)
window.Game = Game;