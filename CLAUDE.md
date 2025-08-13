# AntBuster Game - Claude Context

## Project Overview
AntBuster is a tower defense game where players defend a cake from hungry ants. Built with vanilla JavaScript, HTML5 Canvas, and modern web technologies. The goal is to create an awesome open-source friendly game with solid UX.

## Architecture
The codebase has been refactored into a clean, modular architecture:

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
    ├── MathUtils.js     # Shared mathematical functions
    └── SoundSystem.js   # Web Audio API sound effects
```

## Key Design Principles
1. **Separation of Concerns** - Each module has a single, clear responsibility
2. **Configuration-Driven** - Game balance values centralized in `GameConfig.js`
3. **Event-Driven** - Loose coupling between systems using events
4. **Modular** - Easy to add new tower types, ant types, or game features
5. **Open-Source Friendly** - Clean, approachable code for contributors

## Coding Standards
- **ES6 modules** with clean imports/exports
- **No build process** - runs directly in modern browsers
- **Minimal comments** - only when they explain complex logic or purpose
- **Modern JavaScript** - async/await, destructuring, arrow functions
- **Consistent naming** - camelCase for variables/functions, PascalCase for classes
- **Event-driven architecture** - use EventSystem for component communication

## Game Features
- **4 Tower Types**: Cannon, Machine Gun, Heavy Cannon, Splash Gun
- **3 Ant Types**: Worker, Soldier, Queen (different health/speed)
- **Upgrade System**: 3 levels per tower with increasing stats
- **Adaptive Difficulty**: Game automatically adjusts challenge based on player performance
- **Dynamic Pricing**: Tower costs increase with wave/count for strategic resource management
- **Wave System**: Progressive difficulty with more/stronger ants
- **Economic System**: Money from killing ants, strategic spending decisions
- **Engaging Mechanics**: 
  - Tower placement strategy matters
  - Risk/reward in tower positioning
  - Multiple paths to victory
  - Satisfying feedback loops
- **Keyboard Shortcuts**: Space (pause), 1-4 (tower types), ESC (cancel)
- **Sound Effects**: Generated using Web Audio API
- **Modern UI**: CSS gradients, animations, responsive design

## Current State
- ✅ Core gameplay fully functional
- ✅ Modern UI with professional styling
- ✅ Keyboard shortcuts and accessibility
- ✅ Sound system (non-intrusive)
- ✅ Tower upgrade/move/sell system
- ✅ Responsive design
- ✅ Event-driven architecture

## Development Workflow
- **Test locally**: `python3 -m http.server 8080` then open `http://localhost:8080`
- **Edit config**: Modify `GameConfig.js` for balance changes
- **Add features**: Follow existing patterns in respective directories
- **Events**: Use EventSystem for component communication
- **Sounds**: Add to SoundSystem.js, keep volume reasonable
- **Git workflow**: Commit and push periodically when features are complete or milestones are reached

## Game Design Philosophy
- **Engaging Mechanics**: Focus on creating satisfying, skill-based gameplay loops
- **Adaptive Difficulty**: Game adjusts based on player performance to maintain challenge
- **Strategic Depth**: Multiple viable strategies, meaningful choices in tower placement/upgrades
- **Player Agency**: Clear feedback, responsive controls, player actions have clear consequences
- **Balance Philosophy**:
  - **Early game**: Accessible, players learn mechanics
  - **Mid game**: Strategic tower placement and upgrades matter
  - **Late game**: Challenging but not impossible, skill-based
  - **Economy**: Reward skillful play, but don't punish new players too harshly

## Known Issues/TODOs
- Consider adding more tower types or special abilities
- Tutorial system for new players
- Achievement system
- Multiple maps/themes
- Better mobile touch support

## Testing Commands
```bash
# Start development server
python3 -m http.server 8080

# Check for linting issues (if using linter)
npm run lint

# Run tests (if test framework added)
npm test
```

## File Modification Guidelines
- **GameConfig.js**: Safe to modify for balance tweaks
- **Game.js**: Main coordinator, be careful with game loop changes
- **Entity files**: Follow existing patterns for new features
- **index.html**: Only modify for UI/styling changes
- **Sound effects**: Keep volume low, avoid repetitive sounds

## Contributing Notes
This project aims to be beginner-friendly and educational. Code should be:
- Self-documenting where possible
- Well-structured and modular
- Easy to understand and extend
- Free of unnecessary complexity