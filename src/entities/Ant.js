import { GameConfig } from '../config/GameConfig.js';

export class Ant {
    constructor(x, y, target, type = 'worker', gameState, eventSystem) {
        this.x = x;
        this.y = y;
        this.originalTarget = target;
        this.target = target;
        this.type = type;
        this.gameState = gameState;
        this.eventSystem = eventSystem;
        
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
        this.wanderForce = 0.5;
        this.wanderSpeed = 0.03;
        this.explorationRadius = 60;
    }
    
    setStatsForType() {
        const antConfig = GameConfig.ants[this.type];
        if (!antConfig) {
            throw new Error(`Unknown ant type: ${this.type}`);
        }
        
        // Progressive ant strengthening over time
        const currentWave = this.gameState.currentWave;
        const baseStrengthMultiplier = 1 + (currentWave - 1) * 0.1;
        const exponentialGrowth = Math.pow(1.025, Math.max(0, currentWave - 8));
        const timeMultiplier = baseStrengthMultiplier * exponentialGrowth;
        
        this.health = Math.floor(antConfig.health * timeMultiplier);
        this.maxHealth = this.health;
        this.baseSpeed = antConfig.speed * Math.min(1.4, 1 + (currentWave - 1) * 0.03);
        this.speed = this.baseSpeed;
        this.baseRadius = antConfig.radius;
        this.antColor = antConfig.color;
        this.rewardValue = Math.floor(antConfig.reward * timeMultiplier);
    }
    
    generateWaypoints() {
        if (this.returning) {
            return this.generateReturnWaypoints();
        }
        return this.generateExploreWaypoints();
    }
    
    generateReturnWaypoints() {
        const waypoints = [];
        
        if (this.carryingCake) {
            // Cake carriers take more waypoints but with smaller deviations
            const numReturnWaypoints = 2 + Math.floor(Math.random() * 2);
            
            for (let i = 0; i < numReturnWaypoints; i++) {
                const progress = (i + 1) / (numReturnWaypoints + 1);
                const baseX = this.x + (GameConfig.positions.anthill.x - this.x) * progress;
                const baseY = this.y + (GameConfig.positions.anthill.y - this.y) * progress;
                
                const deviationRange = 120 - (i * 25);
                const margin = 20;
                const randomX = Math.max(margin, Math.min(GameConfig.canvas.width - margin, 
                    baseX + (Math.random() - 0.5) * deviationRange));
                const randomY = Math.max(margin, Math.min(GameConfig.canvas.height - margin, 
                    baseY + (Math.random() - 0.5) * deviationRange));
                waypoints.push({ x: randomX, y: randomY });
            }
        } else {
            // Non-cake returning ants explore more
            const numReturnWaypoints = 1 + Math.floor(Math.random() * 2);
            
            for (let i = 0; i < numReturnWaypoints; i++) {
                const margin = 20;
                const randomX = Math.max(margin, Math.min(GameConfig.canvas.width - margin, 
                    GameConfig.positions.anthill.x + (Math.random() - 0.5) * 300));
                const randomY = Math.max(margin, Math.min(GameConfig.canvas.height - margin, 
                    GameConfig.positions.anthill.y + (Math.random() - 0.5) * 200));
                waypoints.push({ x: randomX, y: randomY });
            }
        }
        
        waypoints.push({ x: GameConfig.positions.anthill.x, y: GameConfig.positions.anthill.y });
        return waypoints;
    }
    
    generateExploreWaypoints() {
        const waypoints = [];
        const startX = GameConfig.positions.anthill.x;
        const startY = GameConfig.positions.anthill.y;
        const endX = this.originalTarget.x;
        const endY = this.originalTarget.y;
        
        const numWaypoints = 3 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < numWaypoints; i++) {
            let waypointX, waypointY;
            
            if (i === 0) {
                waypointX = 100 + Math.random() * 600;
                waypointY = 100 + Math.random() * 400;
            } else if (i === numWaypoints - 1) {
                const towardsCake = 0.7;
                const exploration = 0.3;
                waypointX = endX * towardsCake + (100 + Math.random() * 600) * exploration;
                waypointY = endY * towardsCake + (100 + Math.random() * 400) * exploration;
            } else {
                const generalDirection = Math.atan2(endY - startY, endX - startX);
                const randomAngle = generalDirection + (Math.random() - 0.5) * Math.PI;
                const randomDistance = 150 + Math.random() * 200;
                
                const centerX = (startX + endX) / 2;
                const centerY = (startY + endY) / 2;
                
                waypointX = centerX + Math.cos(randomAngle) * randomDistance;
                waypointY = centerY + Math.sin(randomAngle) * randomDistance;
            }
            
            const margin = 20;
            waypointX = Math.max(margin, Math.min(GameConfig.canvas.width - margin, waypointX));
            waypointY = Math.max(margin, Math.min(GameConfig.canvas.height - margin, waypointY));
            
            waypoints.push({ x: waypointX, y: waypointY });
        }
        
        waypoints.push({ x: endX, y: endY });
        return waypoints;
    }
    
    update(towers) {
        if (this.dead) return;
        
        // Adjust speed based on carrying cake
        const currentSpeed = this.carryingCake ? this.baseSpeed * 0.6 : this.baseSpeed;
        
        // Movement logic
        const dx = this.currentTarget.x - this.x;
        const dy = this.currentTarget.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            this.updateMovement(currentSpeed, dx, dy, towers);
        } else {
            this.moveToNextWaypoint();
        }
        
        // Check if ant died
        if (this.health <= 0) {
            this.die();
        }
    }
    
    updateMovement(currentSpeed, dx, dy, towers) {
        // Update wandering behavior
        this.wanderTimer++;
        if (this.wanderTimer > 20 + Math.random() * 40) {
            if (Math.random() < 0.2) {
                this.wanderAngle += (Math.random() - 0.5) * Math.PI/2;
            } else {
                this.wanderAngle += (Math.random() - 0.5) * 0.5;
            }
            this.wanderTimer = 0;
        }
        
        // Calculate movement direction
        const targetAngle = Math.atan2(dy, dx);
        const angleDiff = targetAngle - this.wanderAngle;
        let adjustedAngleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
        this.wanderAngle += adjustedAngleDiff * this.wanderSpeed;
        
        const finalAngle = targetAngle * 0.7 + this.wanderAngle * this.wanderForce;
        let moveX = Math.cos(finalAngle) * currentSpeed;
        let moveY = Math.sin(finalAngle) * currentSpeed;
        
        // Add exploration
        const exploration = (Math.random() - 0.5) * 0.6;
        moveX += Math.cos(this.wanderAngle + Math.PI/2) * exploration;
        moveY += Math.sin(this.wanderAngle + Math.PI/2) * exploration;
        
        // Tower avoidance
        const avoidance = this.calculateTowerAvoidance(towers, currentSpeed);
        moveX += avoidance.x;
        moveY += avoidance.y;
        
        // Apply movement
        this.x += moveX;
        this.y += moveY;
        
        // Keep within bounds
        const margin = 20;
        this.x = Math.max(margin, Math.min(GameConfig.canvas.width - margin, this.x));
        this.y = Math.max(margin, Math.min(GameConfig.canvas.height - margin, this.y));
        
        // Store movement angle for rendering
        this.actualMovementAngle = Math.atan2(moveY, moveX);
    }
    
    calculateTowerAvoidance(towers, currentSpeed) {
        let totalAvoidanceX = 0;
        let totalAvoidanceY = 0;
        
        for (let tower of towers) {
            const towerDistance = Math.sqrt((this.x - tower.x) ** 2 + (this.y - tower.y) ** 2);
            const softAvoidanceRadius = GameConfig.physics.antAvoidanceRadius;
            
            if (towerDistance < softAvoidanceRadius) {
                const avoidanceStrength = (softAvoidanceRadius - towerDistance) / softAvoidanceRadius;
                const avoidanceAngle = Math.atan2(this.y - tower.y, this.x - tower.x);
                
                totalAvoidanceX += Math.cos(avoidanceAngle) * avoidanceStrength * currentSpeed * 0.3;
                totalAvoidanceY += Math.sin(avoidanceAngle) * avoidanceStrength * currentSpeed * 0.3;
            }
        }
        
        return { x: totalAvoidanceX, y: totalAvoidanceY };
    }
    
    moveToNextWaypoint() {
        this.currentWaypointIndex++;
        if (this.currentWaypointIndex < this.waypoints.length) {
            this.currentTarget = this.waypoints[this.currentWaypointIndex];
        } else {
            if (!this.returning) {
                this.reachedCake = true;
                this.eventSystem.emit('ant_reached_cake', this);
            }
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
    }
    
    die() {
        this.dead = true;
        this.justDied = true;
        this.eventSystem.emit('ant_died', this);
    }
    
    startReturning() {
        this.returning = true;
        this.carryingCake = true;
        this.target = { x: GameConfig.positions.anthill.x, y: GameConfig.positions.anthill.y };
        this.waypoints = this.generateWaypoints();
        this.currentWaypointIndex = 0;
        this.currentTarget = this.waypoints[0];
        
        // Health boost for carrying cake
        const cakeProtection = this.maxHealth * 0.8;
        this.health = Math.min(this.maxHealth * 1.8, this.health + cakeProtection);
        this.maxHealth = this.maxHealth * 1.8;
    }
    
    render(ctx) {
        if (this.dead) return;
        
        const angle = this.actualMovementAngle || 0;
        
        // Draw shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(this.x + 2, this.y + 2, this.radius + 2, this.radius - 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Draw ant body parts
        this.drawAntBody(ctx, angle);
        
        // Draw cake if carrying
        if (this.carryingCake) {
            this.drawCakeSlice(ctx, angle);
        }
        
        // Draw health bar
        this.drawHealthBar(ctx);
    }
    
    drawAntBody(ctx, angle) {
        const bodyColor = this.returning ? this.darkenColor(this.antColor) : this.antColor;
        
        // Main body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.fillStyle = this.lightenColor(bodyColor);
        ctx.beginPath();
        const headX = this.x + Math.cos(angle) * (this.radius - 2);
        const headY = this.y + Math.sin(angle) * (this.radius - 2);
        ctx.arc(headX, headY, this.radius - 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Abdomen
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        const abdomenX = this.x - Math.cos(angle) * (this.radius - 2);
        const abdomenY = this.y - Math.sin(angle) * (this.radius - 2);
        ctx.arc(abdomenX, abdomenY, this.radius - 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw legs and antennae
        this.drawLegs(ctx, angle);
        this.drawAntennae(ctx, angle, headX, headY);
    }
    
    drawLegs(ctx, angle) {
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
    }
    
    drawAntennae(ctx, angle, headX, headY) {
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
    }
    
    drawCakeSlice(ctx, angle) {
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
    
    drawHealthBar(ctx) {
        const barWidth = 16;
        const barHeight = 3;
        const healthPercent = this.health / this.maxHealth;
        
        // Background
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