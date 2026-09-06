# CONTRIBUTING.md — Paint Mixer

## Development Mode: 🟡 EXPLORE

Current mode: **EXPLORE** — features are evolving rapidly. Changes should be tested before deploy, but formal test suites are not yet required. A regression on a working feature must be fixed before any new features are added.

### Mode Levels
- 🔴 WILD WEST: No rules. Ship it.
- 🟡 EXPLORE: Test before deploy. Regressions block new work. No formal tests required.
- 🟢 STABLE: Formal tests required. Lint must pass. Semver enforced.

## Rules

### R1: Test Before Deploy
Run JS syntax validation before every deploy:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('paint-mixer.html','utf8');const m=h.match(/<script>([\s\S]*)<\/script>/);if(m){try{new Function(m[1]);console.log('OK')}catch(e){console.error(e.message)}}"
```
If it doesn't print "OK", don't deploy.

### R2: Regressions Block New Features
If a change breaks existing functionality, fix the regression before adding any new features. No exceptions.

### R3: Single-File Architecture
All code lives in `paint-mixer.html`. No external JS/CSS files. The only exception is `scripts/deploy.sh`.

### R4: Deploy via gh-pages
Push to `main` for source, then run `bash scripts/deploy.sh` to deploy to `gh-pages`. Never push to `gh-pages` directly.

### R5: Version & Deploy Time Stamping
`APP_VERSION` and `DEPLOY_TIME` constants must exist in the file. `DEPLOY_TIME` is auto-stamped by `scripts/deploy.sh`. `APP_VERSION` is manually bumped on meaningful changes.

### R6: Collection Data is User-Owned
No hardcoded collection/wishlist data. Collection state lives in `localStorage`. The `SEED_COLLECTION` is a starter set only — new users start with it, existing users keep their own data.

### R7: No External Dependencies
The app must work fully offline as a single HTML file. No CDN imports, no external fonts, no API calls.

## File Structure
```
paint-mixer/
├── paint-mixer.html    # The entire app
├── scripts/
│   └── deploy.sh       # Deploy to gh-pages
├── CONTRIBUTING.md     # This file
└── README.md           # Project description
```
