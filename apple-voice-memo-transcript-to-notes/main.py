# Automator: Run Shell Script
# Shell: /usr/bin/python3
# Pass input: as arguments
# Thank you to https://github.com/uasi/extract-apple-voice-memos-transcript/blob/master/extract-apple-voice-memos-transcript

import sys, os, json, struct, shutil, re
from datetime import datetime, timezone
from typing import Optional
from unicodedata import normalize

# === destination for outputs ===
DEST = "/Users/chrisshaw/MEGA/chris/notes/voice-notes"
os.makedirs(DEST, exist_ok=True)

# --- MP4 atom helpers ---
CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"udta", b"meta", b"ilst"}
TARGET_TSRP = b"tsrp"   # transcript payload atom (JSON)
TARGET_MVHD = b"mvhd"   # movie header, for duration calc
TARGET_NAME = b"\xa9nam"  # '©nam' — Voice Memos display title
TARGET_TKHD = b"tkhd"   # track header (has creation/modification times)
TARGET_MDHD = b"mdhd"   # media header (has creation/modification times)
TARGET_DAY = b"\xa9day"  # '©day' — Recording date
TARGET_DAT = b"\xa9dat"  # '©dat' — Date recorded

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
        # print(f"DEBUG: Walking atom {typ} at pos {pos}, size {aend-pos}")
        if typ in want:
            fp.seek(payload_start)
            found[typ] = fp.read(aend - payload_start)
        if typ in CONTAINERS:
            fp.seek(payload_start)
            # meta atom has a 4-byte version/flags header before child atoms
            if typ == b"meta":
                fp.read(4)  # skip version/flags
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

def parse_mvhd_timestamps(payload: Optional[bytes]):
    """Parse creation and modification timestamps from mvhd atom"""
    if not payload or len(payload) < 20:
        return None, None
    
    version = payload[0]
    # MP4 timestamps are seconds since Jan 1, 1904 UTC
    MP4_EPOCH_OFFSET = 2082844800  # Seconds between 1904 and 1970
    
    try:
        if version == 0 and len(payload) >= 20:
            creation_time = struct.unpack(">I", payload[4:8])[0]
            modification_time = struct.unpack(">I", payload[8:12])[0]
        elif version == 1 and len(payload) >= 32:
            creation_time = struct.unpack(">Q", payload[4:12])[0] 
            modification_time = struct.unpack(">Q", payload[12:20])[0]
        else:
            return None, None
            
        # Convert to Unix timestamps
        creation_unix = creation_time - MP4_EPOCH_OFFSET if creation_time > MP4_EPOCH_OFFSET else None
        modification_unix = modification_time - MP4_EPOCH_OFFSET if modification_time > MP4_EPOCH_OFFSET else None
        
        return creation_unix, modification_unix
    except:
        return None, None

def parse_track_header_timestamps(payload: Optional[bytes]):
    """Parse creation and modification timestamps from tkhd atom"""
    if not payload or len(payload) < 20:
        return None, None
        
    version = payload[0]
    MP4_EPOCH_OFFSET = 2082844800
    
    try:
        if version == 0 and len(payload) >= 20:
            creation_time = struct.unpack(">I", payload[4:8])[0]
            modification_time = struct.unpack(">I", payload[8:12])[0]
        elif version == 1 and len(payload) >= 32:
            creation_time = struct.unpack(">Q", payload[4:12])[0]
            modification_time = struct.unpack(">Q", payload[12:20])[0]
        else:
            return None, None
            
        creation_unix = creation_time - MP4_EPOCH_OFFSET if creation_time > MP4_EPOCH_OFFSET else None
        modification_unix = modification_time - MP4_EPOCH_OFFSET if modification_time > MP4_EPOCH_OFFSET else None
        
        return creation_unix, modification_unix
    except:
        return None, None

def parse_media_header_timestamps(payload: Optional[bytes]):
    """Parse creation and modification timestamps from mdhd atom"""
    if not payload or len(payload) < 20:
        return None, None
        
    version = payload[0]
    MP4_EPOCH_OFFSET = 2082844800
    
    try:
        if version == 0 and len(payload) >= 20:
            creation_time = struct.unpack(">I", payload[4:8])[0]
            modification_time = struct.unpack(">I", payload[8:12])[0]
        elif version == 1 and len(payload) >= 32:
            creation_time = struct.unpack(">Q", payload[4:12])[0]
            modification_time = struct.unpack(">Q", payload[12:20])[0]
        else:
            return None, None
            
        creation_unix = creation_time - MP4_EPOCH_OFFSET if creation_time > MP4_EPOCH_OFFSET else None
        modification_unix = modification_time - MP4_EPOCH_OFFSET if modification_time > MP4_EPOCH_OFFSET else None
        
        return creation_unix, modification_unix
    except:
        return None, None

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

def extract_title_from_ilst(name_atom_bytes):
    """
    Parse the '©nam' (0xA9 0x6E 0x61 0x6D) atom for its 'data' child and decode text.
    """
    if not name_atom_bytes:
        return None
    
    i, n = 0, len(name_atom_bytes)
    while i + 8 <= n:
        size = struct.unpack(">I", name_atom_bytes[i:i+4])[0]
        typ  = name_atom_bytes[i+4:i+8]
        if size < 8 or i + size > n:
            break
        if typ == b"data" and size >= 16:
            payload = name_atom_bytes[i+16:i+size]
            for enc in ("utf-8", "utf-16-be"):
                try:
                    txt = payload.decode(enc, "ignore").strip("\x00").strip()
                    if txt:
                        return txt
                except Exception:
                    pass
        i += size
    return None

def slugify(s, max_len=64):
    s = normalize("NFKD", s)
    s = "".join(ch for ch in s if ch.isalnum() or ch in " -_")
    s = re.sub(r"\s+", "-", s).strip("-_")
    return s[:max_len] or "voice-memo"

def yaml_escape(s: str) -> str:
    return s.replace('"', '\\"')

# --- main: each input path is a Voice Memos .m4a ---
for infile in sys.argv[1:]:
    if not infile.lower().endswith(".m4a"):
        continue

    base = os.path.splitext(os.path.basename(infile))[0]

    # read atoms first to get recording timestamp from metadata
    with open(infile, "rb") as fp:
        size = os.fstat(fp.fileno()).st_size
        found = walk_for_atoms(fp, size, {TARGET_TSRP, TARGET_MVHD, TARGET_NAME, 
                                         TARGET_TKHD, TARGET_MDHD, TARGET_DAY, TARGET_DAT})

    # Get recording timestamp - priority order: mvhd creation > filename parse > file system
    recording_timestamp = None
    
    # 1. Try mvhd creation time (actual recording time)
    if found.get(TARGET_MVHD):
        mvhd_creation, _ = parse_mvhd_timestamps(found.get(TARGET_MVHD))
        if mvhd_creation:
            recording_timestamp = mvhd_creation
    
    # 2. Fall back to filename parsing if mvhd failed
    if not recording_timestamp:
        filename_match = re.match(r'(\d{8})\s(\d{6})', os.path.basename(infile))
        if filename_match:
            date_str, time_str = filename_match.groups()
            try:
                dt_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} {time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
                recording_timestamp = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S").timestamp()
            except:
                pass
    
    # 3. Last resort: file system timestamp
    if not recording_timestamp:
        try:
            st = os.stat(infile)
            recording_timestamp = getattr(st, "st_birthtime", st.st_mtime)
        except Exception:
            recording_timestamp = None
    
    # Convert to datetime for output formatting
    if recording_timestamp:
        dt = datetime.fromtimestamp(recording_timestamp, tz=timezone.utc).astimezone()
    else:
        dt = datetime.now().astimezone()
    
    iso = dt.isoformat()
    ts = dt.strftime("%Y-%m-%d_%H-%M-%S")
        
    # Prefer the Voice Memos display title, fallback to file stem
    meta_title = extract_title_from_ilst(found.get(TARGET_NAME))
    if not meta_title:
        meta_title = os.path.splitext(os.path.basename(infile))[0]

    # Timestamped, slugified filename to avoid collisions
    base = f"{ts}_{slugify(meta_title)}"

    audio_dst = os.path.join(DEST, base + ".m4a")
    md_dst    = os.path.join(DEST, base + ".md")

    duration = parse_mvhd_duration(found.get(TARGET_MVHD))
    text, language = extract_transcript_text(found.get(TARGET_TSRP))
    
    if not text:
        text = "(no embedded transcript)"

    # write Markdown with YAML front matter
    yaml_lines = [
        "---",
        f'title: "{yaml_escape(meta_title)}"',
        f'date: "{iso}"',
        'source: "Apple Voice Memos"',
    ]
    if duration is not None:
        yaml_lines.append(f"duration_seconds: {duration:.3f}")
    if language:
        # Handle both string and dictionary language formats
        if isinstance(language, str):
            yaml_lines.append(f'language: "{yaml_escape(language)}"')
        elif isinstance(language, dict) and 'identifier' in language:
            lang_code = language['identifier']
            yaml_lines.append(f'language: "{yaml_escape(lang_code)}"')
    yaml_lines.append('tags: ["voice-memo"]')
    # copy audio
    # shutil.copy2(infile, audio_dst)
    # yaml_lines.append(f'audio: "./{yaml_escape(os.path.basename(audio_dst))}"')
    yaml_lines.append("---\n")

    with open(md_dst, "w", encoding="utf-8") as w:
        w.write("\n".join(yaml_lines))
        w.write(text.strip() + "\n")
