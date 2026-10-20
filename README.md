# Tasks

A simple nested todo list with drag and drop. It works offline, saves everything in the browser, and installs as an app on Omarchy (Arch Linux).

Built with Vite, React, TypeScript, dnd-kit, Dexie (IndexedDB), Zustand, and vite-plugin-pwa.

## Using it

| Action | How |
| --- | --- |
| Add a task | `Enter` in a task, or the **+ Add task** button |
| Indent / outdent | `Tab` / `Shift+Tab` |
| Reorder or nest | Drag the `⋮⋮` handle. Drag sideways to change the nesting level |
| Collapse children | Click the arrow to the left of the checkbox |
| Delete an empty task | `Backspace` |
| Delete a task and its children | Click `×` on the right |

## Requirements

- [mise](https://mise.jdx.dev/) (comes with Omarchy), or any Node 22+ and pnpm install
- Chromium (Omarchy's default browser)

```bash
mise use -g node@22
mise use -g pnpm@latest
```

## Run it for development

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. Offline support is off in dev mode because the service worker only runs in a production build.

## Install it on Omarchy

### 1. Build

```bash
git clone git@github.com:rkbart/tasks-app.git ~/Projects/tasks-app
cd ~/Projects/tasks-app
pnpm install
pnpm build
```

### 2. Serve the build at login

Run this from inside the project folder. It creates a small systemd user service that serves `dist/` on port 4173.

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/tasks.service <<EOF
[Unit]
Description=Tasks app

[Service]
ExecStart=/usr/bin/python -m http.server 4173 --bind 127.0.0.1 --directory $PWD/dist
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now tasks.service
```

Check that it's running:

```bash
systemctl --user status tasks.service
curl -I http://localhost:4173
```

If it fails, run `journalctl --user -u tasks.service -e`. If `/usr/bin/python` doesn't exist, run `which python3` and use that path in the service file.

### 3. Install it as an app

1. Open http://localhost:4173 in Chromium.
2. Click the install icon at the right end of the address bar. If it isn't there, open the three-dot menu and choose **Cast, save, and share → Install page as app**.
3. Confirm. The app opens in its own window and appears in the launcher.

Do one install method only. The Omarchy menu's **Install → Web App** option also works, but using both creates two launcher entries.

To remove it, open the app, use the three-dot menu in its window, and choose **Uninstall**.

## Update to a new version

```bash
cd ~/Projects/tasks-app
git pull
pnpm install
pnpm build
```

The service keeps running and serves the new files. Close and reopen the app window once if it still shows the old version.

## Your data

- Tasks are stored in IndexedDB, per browser profile and per address. `http://localhost:5173` (dev) and `http://localhost:4173` (installed) have separate data.
- Clearing browser data deletes your tasks.
- Tasks are not shared between machines. A fresh install on another machine starts empty.

## Project layout

```
src/store.ts    flat task list (id, depth, text, done, collapsed), all actions, IndexedDB saving
src/App.tsx     UI, drag and drop, keyboard shortcuts
src/index.css   styles
vite.config.ts  PWA manifest and service worker
public/         app icons
```

Nesting is stored as a flat list in display order with a `depth` number per item. A task's children are the items right after it with a greater depth.

## Possible next steps

- Export / import for backups and moving tasks between machines
- Wrap it in [Tauri](https://tauri.app/) for a tray icon, a global hotkey, and file-based storage. For that build, remove `vite-plugin-pwa` and replace the CSS `field-sizing: content` with a small JavaScript auto-resize, since WebKitGTK may not support it.
