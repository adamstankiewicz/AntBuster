import { GameConfig } from '../config/GameConfig.js';

// Simple game state management
export class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        // Game status
        this.gameState = 'playing'; // 'playing', 'paused', 'gameOver'
        
        // Resources
        this.money = GameConfig.starting.money;
        this.score = GameConfig.starting.score;
        
        // Cake status
        this.cake = {
            x: GameConfig.positions.cake.x,
            y: GameConfig.positions.cake.y,
            totalSlices: GameConfig.starting.cakeSlices,
            remainingSlices: GameConfig.starting.cakeSlices,
            slicesDelivered: 0,
            sliceAngles: []
        };
        
        // Initialize cake slice angles
        for (let i = 0; i < this.cake.totalSlices; i++) {
            this.cake.sliceAngles.push(i * (Math.PI * 2) / this.cake.totalSlices);
        }
        
        // Wave system
        this.currentWave = 1;
        this.antsInCurrentWave = 0;
        this.baseAntsPerWave = GameConfig.waves.baseAntsPerWave;
        this.waveStartTime = 0;
        this.nextWaveDelay = GameConfig.waves.waveDelay;
        this.antSpawnTimer = 0;
        this.antSpawnInterval = GameConfig.waves.baseSpawnInterval;
        
        // Difficulty and performance tracking
        this.difficultyTimer = 0;
        this.difficultyMultiplier = 1.0;
        this.lastPerformanceCheck = 0;
        this.antsKilled = 0;
        this.antsReachedCake = 0;
        this.totalAntsSpawned = 0;
        
        // Tower placement
        this.selectedTowerType = 'cannon';
        this.currentTowerTypeIndex = 0;
        this.placingTower = false;
        this.selectedTower = null;
        this.movingTower = false;
        
        // Input tracking
        this.mouseX = 0;
        this.mouseY = 0;
    }

    // Helper methods for common state checks
    isGameOver() {
        return this.gameState === 'gameOver';
    }

    isPlaying() {
        return this.gameState === 'playing';
    }

    isPaused() {
        return this.gameState === 'paused';
    }

    endGame(reason = 'Cake Stolen!', message = 'The ants delivered all the cake slices to their anthill!') {
        this.gameState = 'gameOver';
        return { reason, message };
    }

    // Money management
    canAfford(cost) {
        return this.money >= cost;
    }

    spendMoney(amount) {
        if (this.canAfford(amount)) {
            this.money -= amount;
            return true;
        }
        return false;
    }

    earnMoney(amount) {
        this.money += amount;
    }

    // Score management
    addScore(points) {
        this.score += points;
    }

    // Cake management
    takeCakeSlice() {
        if (this.cake.remainingSlices > 0) {
            this.cake.remainingSlices--;
            this.cake.sliceAngles.pop();
            return true;
        }
        return false;
    }

    returnCakeSlice() {
        if (this.cake.remainingSlices < this.cake.totalSlices) {
            this.cake.remainingSlices++;
            const sliceAngle = (this.cake.remainingSlices - 1) * (Math.PI * 2) / this.cake.totalSlices;
            this.cake.sliceAngles.push(sliceAngle);
            return true;
        }
        return false;
    }

    deliverCakeSlice() {
        this.cake.slicesDelivered++;
        this.antsReachedCake++;
        this.addScore(-100); // Penalty for losing cake
        
        // Check if game over
        if (this.cake.slicesDelivered >= this.cake.totalSlices) {
            return this.endGame();
        }
        return null;
    }
}