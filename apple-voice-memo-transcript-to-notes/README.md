# Apple Voice Memo transcript to notes

Save my Apple Voice Memos as text transcripts in my personal notes (in MEGA)

<callout role="note" style="display:block;background:light-blue">

ℹ️ This is a `uv` project.

</callout>

## TL;DR

1.	Turn on iCloud › Voice Memos (so recordings land on your Mac).
2.	Install the `launchd` agent that watches the Voice Memos folder for changes.
3.	When a memo is added or updated, `main.py` extracts the transcript and saves it to: `/Users/chrisshaw/MEGA/chris/notes/voice-notes`

…as `your-memo.md` with YAML front matter + transcript text.

⸻

## One-time setup

#### Enable sync

On iPhone & Mac: Settings/System Settings → Apple ID → iCloud → Voice Memos: On.

#### Clone the repo

```zsh
git clone https://github.com/chrisshaw/helpful-little-scripts.git
cd helpful-little-scripts/apple-voice-memo-transcript-to-notes
```

#### Make scripts executable

```zsh
chmod +x main.py watch-and-process.sh
```

#### Build the Full Disk Access launcher

Voice Memos recordings are TCC-protected, so the agent needs **Full Disk Access**
to read them. To avoid granting that to the shared system `/bin/bash`, launchd
runs a tiny dedicated launcher (`voicememo-runner`, see `voicememo-runner.c`) and
**only that binary** gets the grant. It spawns `bash` as a child, so the single
grant covers the whole pipeline (`bash`, `find`, `python`) without touching the
system shell.

```zsh
mkdir -p "$HOME/Library/Application Support/voicememos-to-notes"
cc -O2 -o "$HOME/Library/Application Support/voicememos-to-notes/voicememo-runner" voicememo-runner.c
```

#### Install the launchd agent

```zsh
cp com.chrisshaw.voicememos-to-notes.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.chrisshaw.voicememos-to-notes.plist
```

Verify it's loaded:

```zsh
launchctl list | grep voicememos
```

#### Grant Full Disk Access (required)

System Settings → Privacy & Security → Full Disk Access → click `+`, press ⌘⇧G, and paste:

```
~/Library/Application Support/voicememos-to-notes/voicememo-runner
```

Add it, toggle it **ON**, then reload the agent:

```zsh
launchctl kickstart -k gui/$(id -u)/com.chrisshaw.voicememos-to-notes
```

Only this launcher gets disk access — the system `/bin/bash` and your interactive
shell do not. (If you ever rebuild `voicememo-runner`, macOS treats it as a new
binary; re-confirm the Full Disk Access toggle.)

### How it works

The launchd agent uses `WatchPaths` to monitor `~/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/`. Unlike Automator Folder Actions (which only fire on new files), `WatchPaths` fires on **any** change — including when Apple updates an existing `.m4a` with a transcript after the initial sync. This means processing is **event-driven**: it starts within seconds of a file appearing or changing, not on a timer.

When triggered, `watch-and-process.sh`:

- Waits a few seconds for iCloud to finish writing, then processes any `.m4a` files modified in the last 30 minutes (a generous lookback window, not a polling interval)
- As a safety net, does a full sweep once per hour to catch transcripts that Apple embeds well after the initial audio sync
- Passes files to `main.py --skip-complete`, which skips files that already have a real transcript

### Output

Record a new memo on iPhone. Within a moment, you should see a `.md` appear in `/Users/chrisshaw/MEGA/chris/notes/voice-notes` like:

```md
---
title: "memo-name"
date: "2025-09-27T10:12:34-04:00"
source: "Apple Voice Memos"
duration_seconds: 123.456   # if available
language: "en-US"           # if available
tags: ["voice-memo"]
---
<full transcript here>
```

### Customize (quick tweaks)

- Change tags: edit `tags: ["voice-memo"]`.
- Different destination: change the `DEST="..."` path at the top of `main.py`.

## Logs

```zsh
tail -f ~/Library/Logs/voicememos-to-notes.log
```

## Disable / remove

```zsh
launchctl unload ~/Library/LaunchAgents/com.chrisshaw.voicememos-to-notes.plist
rm ~/Library/LaunchAgents/com.chrisshaw.voicememos-to-notes.plist
```

## Troubleshooting
- "(no embedded transcript)": the transcript should arrive automatically on the next file update. You can also open the memo in Voice Memos to prompt Apple to embed it.
- Nothing happens: run `launchctl list | grep voicememos` to check the agent is loaded. Check the log file — if it says `Cannot read the Recordings folder — "Operation not permitted"`, Full Disk Access isn't granted to `voicememo-runner` (see setup).
- Permissions: ensure Full Disk Access is granted to `voicememo-runner` (see setup). A stale `1` in the second column of `launchctl list` is the last exit code — it clears after the next successful run.
- Python not found: check that `/usr/bin/python3` exists, or update the shebang in `main.py`.

<details>
<summary>Legacy: Automator setup (replaced by launchd)</summary>

The original setup used an Automator Folder Action, but this only triggered on new files — not updates. Since Apple often syncs the audio before the transcript, many notes ended up with "(no embedded transcript)".

To remove the old Automator action: Finder → right-click the Recordings folder → Folder Actions Setup → uncheck or delete the action.

</details>
