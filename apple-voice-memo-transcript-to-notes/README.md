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

#### Install the launchd agent

```zsh
cp com.chrisshaw.voicememos-to-notes.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.chrisshaw.voicememos-to-notes.plist
```

Verify it's loaded:

```zsh
launchctl list | grep voicememos
```

#### Permissions (if needed)

System Settings → Privacy & Security → Full Disk Access → enable for `/bin/bash` (or Terminal.app).

### How it works

The launchd agent uses `WatchPaths` to monitor `~/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/`. Unlike Automator Folder Actions (which only fire on new files), `WatchPaths` fires on **any** change — including when Apple updates an existing `.m4a` with a transcript after the initial sync.

When triggered, `watch-and-process.sh`:
- Processes `.m4a` files modified in the last 30 minutes
- Once per hour, does a full sweep to catch late-arriving transcripts
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
- Nothing happens: run `launchctl list | grep voicememos` to check the agent is loaded. Check the log file for errors.
- Permissions: ensure Full Disk Access is granted (see setup).
- Python not found: check that `/usr/bin/python3` exists, or update the shebang in `main.py`.

<details>
<summary>Legacy: Automator setup (replaced by launchd)</summary>

The original setup used an Automator Folder Action, but this only triggered on new files — not updates. Since Apple often syncs the audio before the transcript, many notes ended up with "(no embedded transcript)".

To remove the old Automator action: Finder → right-click the Recordings folder → Folder Actions Setup → uncheck or delete the action.

</details>
