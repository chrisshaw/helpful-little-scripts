#!/usr/bin/env python3
# Where letters go. Drafts by default; --send goes out over SMTP, behind the guards
# that keep this a letter to one person instead of a mailing to many.

import json, os, re, smtplib, ssl, sys
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

LEDGER = Path(os.environ.get("THANKS_LEDGER", Path(__file__).parent / "ledger.jsonl"))
DAILY_SEND_CAP = 5   # a person sends a few letters; a spammer sends thousands


class Ledger:
    """Append-only record of everyone already written to, so nobody gets two."""

    def __init__(self, path=LEDGER):
        self.path = Path(path)
        self.rows = []
        if self.path.exists():
            for line in self.path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        self.rows.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

    def seen(self, key):
        return any(r.get("key") == key for r in self.rows)

    def emailed(self, address):
        if not address:
            return False
        return any((r.get("email") or "").lower() == address.lower() and r.get("sent")
                   for r in self.rows)

    def sent_since(self, hours=24):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        n = 0
        for r in self.rows:
            if not r.get("sent"):
                continue
            try:
                if datetime.fromisoformat(r["at"]) > cutoff:
                    n += 1
            except (KeyError, ValueError):
                continue
        return n

    def record(self, target, subject, sent, draft_path=None):
        row = {
            "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "key": target.key, "source": target.source, "name": target.name,
            "url": target.url, "email": target.email, "subject": subject,
            "sent": bool(sent), "draft": str(draft_path) if draft_path else None,
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")
        self.rows.append(row)


def slug(text, n=48):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:n].rstrip("-") or "letter")


def write_draft(target, subject, body, outdir, model):
    """Markdown with YAML front matter, same shape as the other scripts here."""
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d")
    path = outdir / f"{stamp}-{target.source}-{slug(target.name)}.md"
    front = {
        "to": target.name, "source": target.source, "url": target.url,
        "email": target.email or "", "channel": target.channel or "",
        "subject": subject, "sendable": target.sendable,
        "written_by": model, "written_at": datetime.now().isoformat(timespec="seconds"),
    }
    lines = ["---"]
    for k, v in front.items():
        if isinstance(v, bool):          # YAML wants true/false, not Python's True/False
            lines.append(f"{k}: {str(v).lower()}")
        else:
            lines.append(f"{k}: {json.dumps(v)}")
    lines += ["---", "", body, ""]
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


class Mailer:
    """SMTP config from the environment. Nothing is sent unless it's all present."""

    def __init__(self):
        self.host = os.environ.get("THANKS_SMTP_HOST")
        self.port = int(os.environ.get("THANKS_SMTP_PORT", "587"))
        self.user = os.environ.get("THANKS_SMTP_USER")
        self.password = os.environ.get("THANKS_SMTP_PASS")
        self.from_addr = os.environ.get("THANKS_FROM")
        self.from_name = os.environ.get("THANKS_FROM_NAME")

    def missing(self):
        return [name for name, value in [
            ("THANKS_SMTP_HOST", self.host), ("THANKS_SMTP_USER", self.user),
            ("THANKS_SMTP_PASS", self.password), ("THANKS_FROM", self.from_addr),
        ] if not value]

    def send(self, to, subject, body):
        msg = EmailMessage()
        msg["From"] = f"{self.from_name} <{self.from_addr}>" if self.from_name else self.from_addr
        msg["To"] = to
        msg["Subject"] = subject
        msg["Auto-Submitted"] = "no"   # a person wrote this and a person pressed send
        msg.set_content(body)
        if self.port == 465:
            with smtplib.SMTP_SSL(self.host, self.port, context=ssl.create_default_context()) as s:
                s.login(self.user, self.password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(self.host, self.port, timeout=30) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(self.user, self.password)
                s.send_message(msg)


def blockers(target, ledger, mailer):
    """Every reason this particular letter must not be emailed."""
    reasons = []
    if not target.sendable:
        reasons.append(f"nobody to receive it ({target.channel})")
    if not target.email:
        reasons.append(f"no published email address — reach them via: {target.channel}")
    if ledger.emailed(target.email):
        reasons.append(f"already emailed {target.email} once; twice is a mailing list")
    if ledger.sent_since(24) >= DAILY_SEND_CAP:
        reasons.append(f"{DAILY_SEND_CAP} letters already sent in the last 24h")
    reasons += [f"{name} is not set" for name in mailer.missing()]
    return reasons


def confirm(target, subject, body):
    """Show the whole thing before it goes anywhere. No blind sends."""
    print(f"\n  To:      {target.name} <{target.email}>")
    print(f"  Found:   {target.url}")
    print(f"  Subject: {subject}\n")
    print("\n".join("  " + line for line in body.splitlines()))
    if not sys.stdin.isatty():
        print("\n  Not a terminal, so not sending. Re-run with --yes to skip this prompt.")
        return False
    return input("\n  Send this? [y/N] ").strip().lower() in ("y", "yes")
