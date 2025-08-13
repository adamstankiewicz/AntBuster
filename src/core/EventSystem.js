// Simple event system for decoupled communication
export class EventSystem {
    constructor() {
        this.listeners = new Map();
    }

    // Subscribe to an event
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    // Unsubscribe from an event
    off(eventType, callback) {
        if (this.listeners.has(eventType)) {
            const callbacks = this.listeners.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // Emit an event
    emit(eventType, data = null) {
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${eventType}:`, error);
                }
            });
        }
    }

    // Clear all listeners
    clear() {
        this.listeners.clear();
    }
}

// Common game events
export const GameEvents = {
    // Entity events
    ANT_SPAWNED: 'ant_spawned',
    ANT_DIED: 'ant_died',
    ANT_REACHED_CAKE: 'ant_reached_cake',
    ANT_DELIVERED_CAKE: 'ant_delivered_cake',
    
    // Tower events
    TOWER_PLACED: 'tower_placed',
    TOWER_UPGRADED: 'tower_upgraded',
    TOWER_FIRED: 'tower_fired',
    
    // Game state events
    WAVE_STARTED: 'wave_started',
    GAME_OVER: 'game_over',
    MONEY_CHANGED: 'money_changed',
    SCORE_CHANGED: 'score_changed',
    
    // UI events
    TOWER_SELECTED: 'tower_selected',
    UI_UPDATE_NEEDED: 'ui_update_needed'
};