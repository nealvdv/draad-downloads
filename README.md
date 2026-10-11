# Draad for Windows, macOS and Linux

[Draad](https://draad.app) is a free Bible study app: one story, one red thread, in your own language.
No ads, no account needed.

## Download

| | |
|---|---|
| Windows | [Draad-Setup.exe](https://github.com/nealvdv/draad-downloads/releases/latest/download/Draad-Setup.exe) |
| macOS | [Draad.dmg](https://github.com/nealvdv/draad-downloads/releases/latest/download/Draad.dmg) |
| Linux | [Draad.AppImage](https://github.com/nealvdv/draad-downloads/releases/latest/download/Draad.AppImage) |

The desktop app is draad.app in a window of its own, so it is always the same as the website: every
change there is in the app at once. It updates itself, and what you saved for offline reading stays
readable without internet. The installers are not signed yet: Windows and macOS may ask once whether
you trust the app.

On a phone, open draad.app and add it to your home screen. The store apps follow.

## For the maker

This repository holds the window around the site (`main.cjs`) and builds the installers on GitHub's
machines. A release: raise `version` in package.json, then

    git tag desktop-v0.2.0 && git push origin main desktop-v0.2.0

Try it locally: `npm ci`, then `npm start` (or `npm run dev` against the website's dev server on
port 3000). In VS Code's terminal Electron needs `ELECTRON_RUN_AS_NODE` unset.

Made by Neal Van de Velde (nealvdv).
