# Automator: Run Shell Script
# Shell: /usr/bin/python3
# Pass input: as arguments
# Thank you to https://github.com/uasi/extract-apple-voice-memos-transcript/blob/master/extract-apple-voice-memos-transcript

import sys, os, json, struct, shutil
from datetime import datetime, timezone
from typing import Optional

# === destination for outputs ===
DEST = "/Users/chrisshaw/MEGA/chris/notes/voice-notes"
os.makedirs(DEST, exist_ok=True)

# --- MP4 atom helpers ---
CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"udta", b"meta", b"ilst"}
TARGET_TSRP = b"tsrp"   # transcript payload atom (JSON)
TARGET_MVHD = b"mvhd"   # movie header, for duration calc

def read_atom_header(fp, end):
    pos = fp.tell()
    hdr = fp.read(8)
    if len(hdr) < 8: return None
    size = struct.unpack(">I", hdr[:4])[0]
    typ  = hdr[4:8]
    if size == 1:  # 64-bit size follows
        largesize = struct.unpack(">Q", fp.read(8))[0]
        header = 16
        atom_end = pos + largesize
    elif size == 0:  # to EOF of container
        header = 8
        atom_end = end
    else:
        header = 8
        atom_end = pos + size
    return pos, atom_end, header, typ

def walk_for_atoms(fp, end, want):
    found = {}
    while fp.tell() < end:
        h = read_atom_header(fp, end)
        if not h: break
        pos, aend, header, typ = h
        payload_start = pos + header
        if typ in want:
            fp.seek(payload_start)
            found[typ] = fp.read(aend - payload_start)
        if typ in CONTAINERS:
            fp.seek(payload_start)
            found.update(walk_for_atoms(fp, aend, want))
        fp.seek(aend)
    return found

def parse_mvhd_duration(payload: Optional[bytes]):
    if not payload or len(payload) < 20: return None
    version = payload[0]
    if version == 0 and len(payload) >= 24:
        timescale = struct.unpack(">I", payload[12:16])[0]
        duration  = struct.unpack(">I", payload[16:20])[0]
    elif version == 1 and len(payload) >= 36:
        timescale = struct.unpack(">I", payload[20:24])[0]
        duration  = struct.unpack(">Q", payload[24:32])[0]
    else:
        return None
    return None if not timescale else duration / float(timescale)

def extract_transcript_text(tsrp: Optional[bytes]):
    if not tsrp: return None, None
    s = tsrp.decode("utf-8", "ignore")
    i = s.find("{")
    if i > 0:
        s = s[i:]
    try:
        obj = json.loads(s)
    except json.JSONDecodeError:
        return None, None
    lang = obj.get("languageTag") or obj.get("language") or obj.get("locale")
    a = obj.get("attributedString")
    text = None
    if isinstance(a, dict) and isinstance(a.get("runs"), list):
        text = "".join(x for x in a["runs"] if isinstance(x, str))
    elif isinstance(a, list):
        text = "".join(x for x in a if isinstance(x, str))
    return text, lang

def yaml_escape(s: str) -> str:
    return s.replace('"', '\\"')

# --- main: each input path is a Voice Memos .m4a ---
for infile in sys.argv[1:]:
    if not infile.lower().endswith(".m4a"):
        continue

    base = os.path.splitext(os.path.basename(infile))[0]

    # timestamp (creation if available; fall back to mtime)
    try:
        st = os.stat(infile)
        created = getattr(st, "st_birthtime", st.st_mtime)
    except Exception:
        created = None
    # local ISO 8601 with offset
    dt = datetime.fromtimestamp(created, tz=timezone.utc).astimezone() if created else datetime.now().astimezone()
    iso = dt.isoformat()

    audio_dst = os.path.join(DEST, base + ".m4a")
    md_dst    = os.path.join(DEST, base + ".md")

    # read atoms
    with open(infile, "rb") as fp:
        size = os.fstat(fp.fileno()).st_size
        found = walk_for_atoms(fp, size, {TARGET_TSRP, TARGET_MVHD})

    duration = parse_mvhd_duration(found.get(TARGET_MVHD))
    text, language = extract_transcript_text(found.get(TARGET_TSRP))
    if not text:
        text = "(no embedded transcript)"

    # write Markdown with YAML front matter
    title = base
    yaml_lines = [
        "---",
        f'title: "{yaml_escape(title)}"',
        f'date: "{iso}"',
        'source: "Apple Voice Memos"',
    ]
    if duration is not None:
        yaml_lines.append(f"duration_seconds: {duration:.3f}")
    if language:
        yaml_lines.append(f'language: "{yaml_escape(language)}"')
    yaml_lines.append('tags: ["voice-memo"]')
    # copy audio
    # shutil.copy2(infile, audio_dst)
    # yaml_lines.append(f'audio: "./{yaml_escape(os.path.basename(audio_dst))}"')
    yaml_lines.append("---\n")

    with open(md_dst, "w", encoding="utf-8") as w:
        w.write("\n".join(yaml_lines))
        w.write(text.strip() + "\n")
