// Simple sound system using Web Audio API for generated sound effects
export class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.enabled = false;
        }
    }
    
    // Resume audio context if needed (due to browser autoplay policies)
    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    // Generate and play a sound with given parameters
    playSound(frequency, duration, type = 'sine', volume = null) {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        const vol = volume !== null ? volume : this.volume;
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(vol, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    // Predefined sound effects
    playTowerPlace() {
        this.playSound(440, 0.1, 'square');
        setTimeout(() => this.playSound(550, 0.1, 'square'), 50);
    }
    
    playTowerUpgrade() {
        this.playSound(330, 0.15, 'sine');
        setTimeout(() => this.playSound(440, 0.15, 'sine'), 75);
        setTimeout(() => this.playSound(550, 0.15, 'sine'), 150);
    }
    
    playTowerSell() {
        this.playSound(220, 0.2, 'sawtooth', 0.2);
        setTimeout(() => this.playSound(165, 0.2, 'sawtooth', 0.15), 100);
    }
    
    playTowerFire() {
        this.playSound(800, 0.03, 'square', 0.05);
    }
    
    playAntDie() {
        this.playSound(150, 0.1, 'sawtooth', 0.15);
    }
    
    playMoneyEarn() {
        this.playSound(660, 0.1, 'sine', 0.2);
        setTimeout(() => this.playSound(880, 0.1, 'sine', 0.2), 50);
    }
    
    playWaveStart() {
        this.playSound(220, 0.2, 'triangle');
        setTimeout(() => this.playSound(330, 0.2, 'triangle'), 100);
        setTimeout(() => this.playSound(440, 0.3, 'triangle'), 200);
    }
    
    playGameOver() {
        this.playSound(330, 0.3, 'sine');
        setTimeout(() => this.playSound(290, 0.3, 'sine'), 150);
        setTimeout(() => this.playSound(220, 0.5, 'sine'), 300);
    }
    
    playPause() {
        this.playSound(440, 0.1, 'square', 0.2);
    }
    
    playUnpause() {
        this.playSound(550, 0.1, 'square', 0.2);
    }
    
    playButtonClick() {
        this.playSound(800, 0.03, 'square', 0.1);
    }
    
    playAntReachCake() {
        this.playSound(200, 0.2, 'triangle', 0.2);
        setTimeout(() => this.playSound(180, 0.2, 'triangle', 0.15), 100);
    }
    
    // Volume control
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }
    
    // Enable/disable sounds
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    // Toggle mute
    toggleMute() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}