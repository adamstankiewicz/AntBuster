import { GameConfig } from '../config/GameConfig.js';

export class Bullet {
    constructor(x, y, target, damage, type, eventSystem) {
        this.x = x;
        this.y = y;
        this.targetX = target.x;
        this.targetY = target.y;
        this.target = target;
        this.damage = damage;
        this.type = type;
        this.speed = GameConfig.physics.bulletSpeed;
        this.dead = false;
        this.eventSystem = eventSystem;
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
    }
    
    update(ants) {
        this.x += this.vx;
        this.y += this.vy;
        
        // Check collision with target
        if (!this.target.dead) {
            const distance = Math.sqrt((this.x - this.target.x) ** 2 + (this.y - this.target.y) ** 2);
            if (distance < 10) {
                this.target.takeDamage(this.damage);
                
                // Splash damage
                if (this.type === 'splash') {
                    this.applySplashDamage(ants);
                }
                
                this.dead = true;
                return;
            }
        }
        
        // Remove if off screen
        if (this.x < 0 || this.x > GameConfig.canvas.width || 
            this.y < 0 || this.y > GameConfig.canvas.height) {
            this.dead = true;
        }
    }
    
    applySplashDamage(ants) {
        ants.forEach(ant => {
            if (ant !== this.target && !ant.dead) {
                const splashDistance = Math.sqrt((this.x - ant.x) ** 2 + (this.y - ant.y) ** 2);
                if (splashDistance < GameConfig.physics.splashRadius) {
                    ant.takeDamage(this.damage * 0.5);
                }
            }
        });
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