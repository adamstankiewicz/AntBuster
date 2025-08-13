// Math utilities for the game
export const MathUtils = {
    // Calculate distance between two points
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    // Calculate angle between two points
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    // Clamp a value between min and max
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    // Linear interpolation
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },

    // Check if point is within circle
    pointInCircle(px, py, cx, cy, radius) {
        return this.distance(px, py, cx, cy) <= radius;
    },

    // Seeded random number generator for consistent patterns
    createSeededRandom(seed) {
        let seedValue = seed;
        return () => {
            seedValue = (seedValue * 16807) % 2147483647;
            return (seedValue - 1) / 2147483646;
        };
    },

    // Normalize angle to 0-2π range
    normalizeAngle(angle) {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    },

    // Get shortest angle difference
    angleDifference(angle1, angle2) {
        const diff = angle2 - angle1;
        return ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
    }
};