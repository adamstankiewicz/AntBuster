// Game configuration - all balance values in one place
export const GameConfig = {
    // Canvas settings
    canvas: {
        width: 800,
        height: 600
    },

    // Starting values
    starting: {
        money: 125,
        score: 0,
        cakeSlices: 8
    },

    // Tower types and their base stats
    towers: {
        cannon: {
            name: 'Cannon',
            baseCost: 60,
            damage: 30,
            range: 100,
            fireRate: 15,
            color: '#8b4513'
        },
        machineGun: {
            name: 'Machine Gun',
            baseCost: 100,
            damage: 15,
            range: 80,
            fireRate: 6,
            color: '#696969'
        },
        heavyCannon: {
            name: 'Heavy Cannon',
            baseCost: 150,
            damage: 60,
            range: 120,
            fireRate: 30,
            color: '#2f4f4f'
        },
        splash: {
            name: 'Splash Gun',
            baseCost: 175,
            damage: 25,
            range: 90,
            fireRate: 20,
            color: '#b22222'
        }
    },

    // Ant types and their base stats
    ants: {
        worker: {
            health: 100,
            speed: 1.8,
            radius: 8,
            color: '#8B4513',
            reward: 6
        },
        soldier: {
            health: 180,
            speed: 1.6,
            radius: 10,
            color: '#654321',
            reward: 9
        },
        queen: {
            health: 300,
            speed: 1.4,
            radius: 12,
            color: '#A0522D',
            reward: 15
        }
    },

    // Wave system settings
    waves: {
        baseAntsPerWave: 4,
        baseSpawnInterval: 120,
        waveDelay: 1200,
        difficultyIncrease: 0.15
    },

    // Game positions
    positions: {
        anthill: { x: 50, y: 300 },
        cake: { x: 720, y: 300 }
    },

    // Physics settings
    physics: {
        bulletSpeed: 8,
        splashRadius: 40,
        towerPlacementMinDistance: 50,
        antAvoidanceRadius: 28
    }
};