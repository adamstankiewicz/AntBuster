# AntBuster - Tower Defense Game

A tower defense game where you protect your cake from hungry ants! Built with vanilla JavaScript and HTML5 Canvas.

## How to Play

1. **Defend the Cake**: Prevent ants from stealing all 8 cake slices
2. **Build Towers**: Click empty spaces to place towers that automatically target ants
3. **Upgrade Towers**: Click on towers to upgrade their damage, range, and fire rate
4. **Manage Resources**: Earn money by defeating ants, spend wisely on towers
5. **Survive Waves**: Each wave brings more and stronger ants

## Controls

- **Left Click**: Place towers, select towers, upgrade towers
- **ESC**: Cancel tower placement
- **Tower Button**: Cycle through different tower types

## Tower Types

- **Cannon** ($60): Balanced damage and range, good all-around choice
- **Machine Gun** ($100): High fire rate, moderate damage, shorter range
- **Heavy Cannon** ($150): High damage, long range, slow fire rate
- **Splash Gun** ($175): Area damage, good against groups of ants

## Architecture

The game has been refactored into a clean, modular architecture that's easy to understand and extend:

```
src/
├── core/
│   ├── Game.js           # Main game coordinator
│   ├── GameState.js      # Centralized state management
│   └── EventSystem.js    # Event-driven communication
├── entities/
│   ├── Ant.js           # Ant behavior and rendering
│   ├── Tower.js         # Tower logic and rendering
│   ├── Bullet.js        # Projectile physics
│   └── Particle.js      # Visual effects
├── config/
│   └── GameConfig.js    # All game balance values
└── utils/
    └── MathUtils.js     # Shared mathematical functions
```

### Key Design Principles

1. **Separation of Concerns**: Each module has a single, clear responsibility
2. **Configuration-Driven**: Game balance values are centralized in `GameConfig.js`
3. **Event-Driven**: Loose coupling between systems using events
4. **Modular**: Easy to add new tower types, ant types, or game features
5. **Maintainable**: Clean, well-documented code that's approachable for contributors

### Features

- **Dynamic Difficulty**: Game adapts based on player performance
- **Progressive Waves**: Increasing challenge with new ant types
- **Economic System**: Strategic resource management
- **Visual Polish**: Smooth animations and particle effects
- **Tower Customization**: Upgrade and reposition towers

## Running the Game

1. Start a local web server in the project directory:
   ```bash
   python3 -m http.server 8080
   ```

2. Open your browser to: `http://localhost:8080`

## Contributing

The modular architecture makes it easy to contribute:

- **Add new tower types**: Extend `GameConfig.towers` and add rendering logic
- **Create new ant types**: Add to `GameConfig.ants` with unique behaviors  
- **Implement new systems**: Follow the existing pattern in the `systems/` directory
- **Balance gameplay**: Modify values in `GameConfig.js`

## Development

The codebase uses ES6 modules and modern JavaScript features. No build process required - runs directly in modern browsers.

### Adding New Features

1. **New Entity**: Create in `entities/` directory, import in `Game.js`
2. **New System**: Create in `systems/` directory with `update()` and `render()` methods
3. **New Config**: Add sections to `GameConfig.js`
4. **New Events**: Add to `GameEvents` object for loose coupling

The event system allows features to communicate without tight coupling, making the codebase flexible and extensible.

## AI-Assisted Development

This project includes optional AI agent definitions for faster, more creative
development.

- **Cursor users:** Agents auto-load from `.cursor/agents/`.
- **Other editors:** See `docs/ai-agents.md` for copy-paste prompts.

Recommended workflow:
1. Ask the **Game Designer Agent** for new gameplay ideas.
2. Consult the **UX & Accessibility Designer Agent** for interface and accessibility improvements.
3. Pass the chosen idea to the **Gameplay Engineer Agent** for implementation.
4. (Optional) Use the **Playtest & QA Agent** to test and refine before committing.