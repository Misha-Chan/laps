# Panya local runtime (Telegram Drive)

Panya runs as a small Express bridge on the laptop and stores media in Telegram
Drive. The public site is served by Vercel, and `panya-api.hostaka.fun` points at
the laptop through a Cloudflare named tunnel.

## Services

| Unit | Purpose |
| --- | --- |
| `panya-bridge.service` | Express bridge on `127.0.0.1:3100` |
| `panya-tunnel.service` | Cloudflare named tunnel `panya` |
| `panya-watchdog.timer` | Runs the watchdog every 5 minutes |

## Install the watchdog

```bash
mkdir -p ~/.local/bin ~/.config/panya
install -m 755 deploy/panya/panya-telegram-watchdog.sh ~/.local/bin/panya-telegram-watchdog.sh
install -m 644 deploy/panya/panya-watchdog.service ~/.config/systemd/user/panya-watchdog.service
install -m 644 deploy/panya/panya-watchdog.timer ~/.config/systemd/user/panya-watchdog.timer
printf '%s' '<telegram-drive-api-key>' > ~/.config/panya/telegram-api-key
chmod 600 ~/.config/panya/telegram-api-key
systemctl --user daemon-reload
systemctl --user enable --now panya-watchdog.timer
```

The watchdog checks `GET /files?folder_id=4415884906&limit=1` on the Telegram
Drive REST API. If that check fails it restarts the desktop app, then retries for
up to 60 seconds. It also restarts `panya-bridge.service` if the bridge stops
answering, and restarts `panya-tunnel.service` if the tunnel is inactive.

Logs are written to `~/.local/state/panya/watchdog.log` only when something needs
attention.
