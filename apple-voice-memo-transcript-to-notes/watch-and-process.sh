#!/bin/bash
# watch-and-process.sh — Called by launchd when the Voice Memos folder changes.
#
# launchd WatchPaths fires on ANY change (add/modify/delete) but doesn't say
# which file changed. Strategy:
#   - Every trigger: process .m4a files modified in the last 30 minutes.
#   - Once per hour: full sweep of ALL .m4a files to catch late transcripts.
#   - main.py --skip-complete skips files that already have a real transcript.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RECORDINGS_DIR="$HOME/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings"
MAIN_PY="$SCRIPT_DIR/main.py"
LOCK_FILE="/tmp/voicememos-to-notes.lock"
SWEEP_MARKER="/tmp/voicememos-last-sweep"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [voicememos] $*"; }

# --- Locking: prevent overlapping runs ---
if [ -f "$LOCK_FILE" ]; then
    pid=$(cat "$LOCK_FILE" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        log "Already running (PID $pid), skipping."
        exit 0
    fi
    log "Removing stale lock file."
    rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# --- Brief delay to let iCloud sync settle ---
sleep 3

if [ ! -d "$RECORDINGS_DIR" ]; then
    log "Recordings directory not found: $RECORDINGS_DIR"
    exit 1
fi

# --- Collect files to process ---
declare -A file_set

# 1. Recently modified files (last 30 minutes)
while IFS= read -r -d '' f; do
    file_set["$f"]=1
done < <(find "$RECORDINGS_DIR" -name '*.m4a' -mmin -30 -print0 2>/dev/null)

log "Found ${#file_set[@]} recently modified .m4a file(s)."

# 2. Full sweep once per hour to catch late-arriving transcripts
if [ ! -f "$SWEEP_MARKER" ] || [ -n "$(find "$SWEEP_MARKER" -mmin +60 2>/dev/null)" ]; then
    log "Performing hourly full sweep..."
    while IFS= read -r -d '' f; do
        file_set["$f"]=1
    done < <(find "$RECORDINGS_DIR" -name '*.m4a' -print0 2>/dev/null)
    touch "$SWEEP_MARKER"
    log "Full sweep: ${#file_set[@]} total .m4a file(s)."
fi

if [ ${#file_set[@]} -eq 0 ]; then
    log "No files to process."
    exit 0
fi

# --- Run main.py with --skip-complete ---
files=()
for f in "${!file_set[@]}"; do
    files+=("$f")
done

log "Processing ${#files[@]} file(s)..."
"$MAIN_PY" --skip-complete "${files[@]}"
log "Done."
