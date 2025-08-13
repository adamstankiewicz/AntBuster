import { GameConfig } from '../config/GameConfig.js';
import { Bullet } from './Bullet.js';

export class Tower {
    constructor(x, y, type, gameState, eventSystem) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.level = 1;
        this.fireTimer = 0;
        this.target = null;
        this.gameState = gameState;
        this.eventSystem = eventSystem;
        
        this.setStats();
    }
    
    setStats() {
        const towerConfig = GameConfig.towers[this.type];
        if (!towerConfig) {
            throw new Error(`Unknown tower type: ${this.type}`);
        }
        
        this.damage = towerConfig.damage * this.level;
        this.range = towerConfig.range + (this.level - 1) * 10;
        this.fireRate = Math.max(10, towerConfig.fireRate - (this.level - 1) * 5);
        this.color = towerConfig.color;
        this.baseCost = towerConfig.baseCost;
    }
    
    update(ants, bullets) {
        this.fireTimer++;
        
        // Find best target
        this.target = this.findBestTarget(ants);
        
        // Fire at target
        if (this.target && this.fireTimer >= this.fireRate) {
            this.fire(bullets);
            this.fireTimer = 0;
        }
    }
    
    findBestTarget(ants) {
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
                priority -= distance / this.range * 10;
                
                // Select best target
                if (priority > bestPriority || (priority === bestPriority && distance < closestDistance)) {
                    bestTarget = ant;
                    bestPriority = priority;
                    closestDistance = distance;
                }
            }
        });
        
        return bestTarget;
    }
    
    fire(bullets) {
        bullets.push(new Bullet(this.x, this.y, this.target, this.damage, this.type, this.eventSystem));
        this.eventSystem.emit('tower_fired', { tower: this, target: this.target });
    }
    
    getUpgradeCost() {
        const baseUpgradeCost = this.baseCost * 0.8 * this.level;
        
        // Wave-based upgrade tiers
        let waveTier = 1.0;
        const currentWave = this.gameState.currentWave;
        if (currentWave >= 25) waveTier = 1.6;
        else if (currentWave >= 20) waveTier = 1.4;
        else if (currentWave >= 15) waveTier = 1.25;
        else if (currentWave >= 10) waveTier = 1.1;
        
        // Tower count tiers for upgrades
        let densityTier = 1.0;
        const towerCount = this.gameState.towers ? this.gameState.towers.length : 0;
        if (towerCount >= 10) densityTier = 1.3;
        else if (towerCount >= 6) densityTier = 1.2;
        else if (towerCount >= 3) densityTier = 1.1;
        
        return Math.floor(baseUpgradeCost * waveTier * densityTier);
    }
    
    canUpgrade() {
        return this.level < 3;
    }
    
    upgrade() {
        if (this.canUpgrade()) {
            this.level++;
            this.setStats();
            this.eventSystem.emit('tower_upgraded', this);
            return true;
        }
        return false;
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
        
        // Draw tower base
        this.drawTowerBase(ctx);
        
        // Draw type-specific details
        this.drawTowerDetails(ctx);
        
        // Draw barrel pointing at target
        if (this.target) {
            this.drawBarrel(ctx);
        }
        
        // Draw level indicator
        this.drawLevelIndicator(ctx);
        
        // Draw upgrade stars for higher levels
        if (this.level > 1) {
            this.drawUpgradeStars(ctx);
        }
    }
    
    drawTowerBase(ctx) {
        const gradient = ctx.createRadialGradient(this.x, this.y - 5, 0, this.x, this.y, 20);
        gradient.addColorStop(0, this.lightenColor(this.color, 50));
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 30));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw tower rim
        ctx.strokeStyle = this.darkenColor(this.color, 40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    drawTowerDetails(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        switch(this.type) {
            case 'cannon':
                this.drawCannonDetails(ctx);
                break;
            case 'machineGun':
                this.drawMachineGunDetails(ctx);
                break;
            case 'heavyCannon':
                this.drawHeavyCannonDetails(ctx);
                break;
            case 'splash':
                this.drawSplashDetails(ctx);
                break;
        }
        
        ctx.restore();
    }
    
    drawCannonDetails(ctx) {
        ctx.strokeStyle = this.darkenColor(this.color, 60);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    drawMachineGunDetails(ctx) {
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
    }
    
    drawHeavyCannonDetails(ctx) {
        ctx.fillStyle = this.lightenColor(this.color, 30);
        const positions = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
        positions.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    drawSplashDetails(ctx) {
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
    }
    
    drawBarrel(ctx) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        
        switch(this.type) {
            case 'cannon':
                this.drawCannonBarrel(ctx);
                break;
            case 'machineGun':
                this.drawMachineGunBarrel(ctx);
                break;
            case 'heavyCannon':
                this.drawHeavyCannonBarrel(ctx);
                break;
            case 'splash':
                this.drawSplashBarrel(ctx);
                break;
        }
        
        ctx.restore();
    }
    
    drawCannonBarrel(ctx) {
        const barrelGradient = ctx.createLinearGradient(0, -5, 0, 5);
        barrelGradient.addColorStop(0, '#666');
        barrelGradient.addColorStop(0.5, '#333');
        barrelGradient.addColorStop(1, '#111');
        ctx.fillStyle = barrelGradient;
        ctx.fillRect(15, -5, 22, 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(35, -3, 4, 6);
    }
    
    drawMachineGunBarrel(ctx) {
        ctx.fillStyle = '#444';
        for(let i = 0; i < 3; i++) {
            const yOffset = (i - 1) * 4;
            ctx.fillRect(15, yOffset - 1, 20, 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(34, yOffset - 0.5, 2, 1);
            ctx.fillStyle = '#444';
        }
    }
    
    drawHeavyCannonBarrel(ctx) {
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
        [20, 25, 30].forEach(x => {
            ctx.moveTo(x, -6);
            ctx.lineTo(x, 6);
        });
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.fillRect(38, -4, 4, 8);
    }
    
    drawSplashBarrel(ctx) {
        const splashGradient = ctx.createLinearGradient(0, -4, 0, 4);
        splashGradient.addColorStop(0, '#600');
        splashGradient.addColorStop(0.5, '#300');
        splashGradient.addColorStop(1, '#100');
        ctx.fillStyle = splashGradient;
        ctx.fillRect(15, -4, 20, 8);
        
        // Warning stripes
        ctx.fillStyle = '#FF0';
        [18, 22, 26, 30].forEach(x => {
            ctx.fillRect(x, -3, 1, 6);
        });
        ctx.fillStyle = '#000';
        ctx.fillRect(33, -2, 3, 4);
    }
    
    drawLevelIndicator(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.level.toString(), this.x, this.y + 5);
        ctx.fillText(this.level.toString(), this.x, this.y + 5);
    }
    
    drawUpgradeStars(ctx) {
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < this.level - 1; i++) {
            const starAngle = (i * Math.PI * 2 / (this.level - 1)) - Math.PI / 2;
            const starX = this.x + Math.cos(starAngle) * 25;
            const starY = this.y + Math.sin(starAngle) * 25;
            this.drawStar(ctx, starX, starY, 3);
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
        return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                     (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                     (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)}`;
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return `#${(0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
                     (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
                     (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1)}`;
    }
}