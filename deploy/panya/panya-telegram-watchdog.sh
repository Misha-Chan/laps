#!/usr/bin/env bash
# Panya watchdog: every 5 minutes, verify Telegram Drive and the Panya bridge.
# If Telegram Drive is hung (health endpoint can still be OK), restart the app.
set -u

API_KEY_FILE="${PANYA_API_KEY_FILE:-$HOME/.config/panya/telegram-api-key}"
API_URL="${PANYA_TELEGRAM_API_URL:-http://127.0.0.1:8550/api/v1}"
FOLDER_ID="${PANYA_TELEGRAM_FOLDER_ID:-4415884906}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/panya"
LOG="$STATE_DIR/watchdog.log"
mkdir -p "$STATE_DIR"

log() {
  printf '%s %s\n' "$(date -Is)" "$*" >>"$LOG"
}

telegram_ok() {
  [ -r "$API_KEY_FILE" ] || return 1
  local key
  key="$(cat "$API_KEY_FILE")"
  curl -fsS --max-time 20 -H "X-API-Key: $key" \
    "$API_URL/files?folder_id=$FOLDER_ID&limit=1" >/dev/null 2>&1
}

bridge_ok() {
  curl -fsS --max-time 10 http://127.0.0.1:3100/panya/api/items >/dev/null 2>&1
}

restart_telegram() {
  log "Telegram Drive check failed; restarting app"
  pkill -TERM -x app 2>/dev/null || true
  for _ in $(seq 1 30); do
    pgrep -x app >/dev/null || break
    sleep 0.5
  done
  pkill -KILL -x app 2>/dev/null || true
  sleep 1

  cd "$HOME" || return 1
  setsid env \
    DISPLAY="${DISPLAY:-:0}" \
    WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" \
    XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}" \
    GDK_BACKEND="${GDK_BACKEND:-wayland}" \
    WEBKIT_FORCE_ACCESSIBILITY=1 \
    NO_AT_BRIDGE=0 \
    GTK_MODULES=gail:atk-bridge \
    /usr/bin/app >>"$STATE_DIR/telegramdrive.log" 2>&1 < /dev/null &

  sleep 6
  gdbus call --session \
    --dest com.cameronamer.telegramdrive.SingleInstance \
    --object-path /com/cameronamer/telegramdrive/SingleInstance \
    --method org.SingleInstance.DBus.ExecuteCallback '[]' "$HOME" \
    >/dev/null 2>&1 || true

  for _ in $(seq 1 12); do
    sleep 5
    if telegram_ok; then
      log "Telegram Drive recovered"
      return 0
    fi
  done
  log "Telegram Drive still failing after restart"
  return 1
}

if ! telegram_ok; then
  restart_telegram || true
fi

if ! bridge_ok; then
  log "Panya bridge check failed; restarting panya-bridge.service"
  systemctl --user restart panya-bridge.service 2>/dev/null || true
fi

if ! systemctl --user is-active --quiet panya-tunnel.service; then
  log "Panya tunnel inactive; restarting panya-tunnel.service"
  systemctl --user restart panya-tunnel.service 2>/dev/null || true
fi
