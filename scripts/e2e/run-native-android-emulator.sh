#!/usr/bin/env bash
set -Eeuo pipefail

# This file is executed as one Bash process by android-emulator-runner.
# Keep temporary logs under /tmp: RUNNER_TEMP is not forwarded by that action.
AGENT_LOG="/tmp/naxa-native-support-agent.log"
AGENT_PID=""

cleanup_agent() {
  if [[ -n "$AGENT_PID" ]] && kill -0 "$AGENT_PID" 2>/dev/null; then
    kill "$AGENT_PID" 2>/dev/null || true
    wait "$AGENT_PID" 2>/dev/null || true
  fi
}
trap cleanup_agent EXIT

adb shell settings put system system_locales en-US || true
: > "$AGENT_LOG"

node scripts/e2e/naxa-support-native-android-e2e.cjs --agent > "$AGENT_LOG" 2>&1 &
AGENT_PID=$!

agent_ready=0
for _ in $(seq 1 120); do
  if grep -q "AGENT READY" "$AGENT_LOG" 2>/dev/null; then
    agent_ready=1
    break
  fi
  if ! kill -0 "$AGENT_PID" 2>/dev/null; then
    cat "$AGENT_LOG" || true
    echo "::error::L’Agent Support n’a pas pu démarrer."
    exit 1
  fi
  sleep 1
done

if [[ "$agent_ready" -ne 1 ]]; then
  cat "$AGENT_LOG" || true
  echo "::error::L’Agent Support n’est pas prêt après 120 secondes."
  exit 1
fi

set +e
(cd android && gradle --no-daemon --stacktrace :app:connectedDebugAndroidTest)
TEST_STATUS=$?
set -e

if [[ "$TEST_STATUS" -ne 0 ]]; then
  kill "$AGENT_PID" 2>/dev/null || true
fi

set +e
wait "$AGENT_PID"
AGENT_STATUS=$?
set -e
AGENT_PID=""

cat "$AGENT_LOG"

if [[ "$TEST_STATUS" -ne 0 || "$AGENT_STATUS" -ne 0 ]]; then
  echo "::error::Échec E2E — Android instrumentation=$TEST_STATUS ; Agent Chromium=$AGENT_STATUS."
  exit 1
fi

echo "PASS GLOBAL — application Android, agent Support, audio/vidéo et cycle de vie."
