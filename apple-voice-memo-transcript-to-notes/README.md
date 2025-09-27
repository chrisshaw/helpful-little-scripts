# Apple Voice Memo transcript to notes

Save my Apple Voice Memos as text transcripts in my personal notes (in MEGA)

I use this in Automator

<callout role="note" style="display:block;background:light-blue">

ℹ️ This is a `uv` project.

</callout>

## TL;DR

1.	Turn on iCloud › Voice Memos (so recordings land on your Mac).
2.	Make an Automator → Folder Action that watches the Voice Memos folder.
3.	Paste the script below. It copies audio to: `/Users/chrisshaw/MEGA/chris/notes/voice-notes`

…and creates `your-memo`.md with YAML + transcript.

⸻

## One-time setup

#### Enable sync

On iPhone & Mac: Settings/System Settings → Apple ID → iCloud → Voice Memos: On.

#### Clone the repo

```zsh
git clone https://github.com/chrisshaw/helpful-little-scripts.git
cd helpful-little-scripts/apple-voice-memo-transcript-to-notes
```

Copy the path as you'll use it in the Folder Action next.

#### Change file permissions to executable (755)

```zsh
sudo chmod +x main.py
```


#### Create the Folder Action

- Open Automator → New → Folder Action.
- “Folder:” choose: `~/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings/`
- Add Run Shell Script. Shell: type `/bin/zsh`. Set “Pass input:” → “as arguments.”
- Paste: `"$HOME/projects/helpful-little-scripts/apple-voice-memo-transcript-to-notes/main.py" "$@"`
- Save (name it e.g. Voice Memos → MEGA).

#### Permissions (if needed)

System Settings → Privacy & Security → Full Disk Access → enable for Automator.

### Output

Record a new memo on iPhone. Within a moment, you should see a `.m4a` and a `.md` appear in `/Users/chrisshaw/MEGA/chris/notes/voice-notes` like:

```md
---
title: "memo-name"
date: "2025-09-27T10:12:34-04:00"
source: "Apple Voice Memos"
audio: "./memo-name.m4a"
duration_seconds: 123.456   # if available
language: "en-US"           # if available
tags: ["voice-memo"]
---
<full transcript here>
```

### Customize (quick tweaks)

- Change tags: edit tags: ["voice-memo"].
- Prefix filenames with date: replace base = … with:
  ```python
  base = dt.strftime("%Y-%m-%d_") + os.path.splitext(os.path.basename(infile))[0]
  ```
- Copying audio: remove the shutil.copy2(...) line and the audio: field.
- Different destination: change the DEST="..." path at the top.

## Disable / remove

Open Automator → Folder Actions → uncheck or delete the “Voice Memos → MEGA” action. You can also remove it from Folder Actions Setup in Finder (right-click the folder).

## Troubleshooting
- “(no embedded transcript)”: open the memo once in Voice Memos; Apple may not have embedded the transcript yet.
- Nothing happens: confirm the Automator action is enabled and that Automator has Full Disk Access.
- Path wrong: double-check the watched folder path (see setup).
- Python not found: change /usr/bin/python3 to your Python 3 path.