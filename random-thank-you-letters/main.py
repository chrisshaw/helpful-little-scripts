#!/usr/bin/env python3
# Find someone on the internet who did something useful, write them a thank-you
# letter, and either save it for review or actually send it.
#
#   uv run main.py                        # one draft, random source
#   uv run main.py --count 3 --source github
#   uv run main.py --send                 # really sends, with confirmation
#   uv run main.py --list                 # who has already been thanked

import argparse, os, random, subprocess, sys

import deliver, letter, sources


def sender_name():
    for name in (os.environ.get("THANKS_FROM_NAME"),
                 os.environ.get("THANKS_SENDER")):
        if name:
            return name
    try:
        name = subprocess.run(["git", "config", "user.name"], capture_output=True,
                              text=True, timeout=5).stdout.strip()
        if name:
            return name
    except (OSError, subprocess.SubprocessError):
        pass
    return "a stranger on the internet"


def parse_args(argv):
    p = argparse.ArgumentParser(
        description="Write thank-you letters to people found at random on the internet.")
    p.add_argument("--source", default="any", choices=["any", *sorted(sources.SOURCES)],
                   help="where to look for someone to thank (default: any)")
    p.add_argument("--count", type=int, default=1, help="how many letters (default: 1)")
    p.add_argument("--out", default="drafts", help="draft directory (default: drafts/)")
    p.add_argument("--send", action="store_true",
                   help="actually email it, if they published an address")
    p.add_argument("--yes", action="store_true", help="skip the send confirmation")
    p.add_argument("--from-name", help="how to sign the letters")
    p.add_argument("--effort", default="medium", choices=["low", "medium", "high"],
                   help="how hard Claude thinks about the letter (default: medium)")
    p.add_argument("--no-llm", action="store_true", help="use the offline template")
    p.add_argument("--seed", type=int, help="reproducible target selection")
    p.add_argument("--list", action="store_true", help="print the ledger and exit")
    return p.parse_args(argv)


def show_ledger():
    ledger = deliver.Ledger()
    if not ledger.rows:
        print(f"Nobody thanked yet. Ledger lives at {ledger.path}")
        return
    print(f"{len(ledger.rows)} letters written ({ledger.path}):\n")
    for r in ledger.rows:
        mark = "sent " if r.get("sent") else "draft"
        print(f'  {r.get("at", "")[:10]}  {mark}  {r.get("source", ""):11} {r.get("name", "")}')
    print(f'\n  {ledger.sent_since(24)} sent in the last 24h (cap {deliver.DAILY_SEND_CAP})')


def one_letter(args, rng, sender, ledger, mailer):
    # Don't write to anyone already in the ledger, however they got there.
    for _ in range(6):
        target = sources.find(rng, args.source)
        if not ledger.seen(target.key):
            break
    else:
        print("  Everyone I found is already in the ledger. Try a different --source.")
        return

    print(f"\n→ {target.name} — {target.did}\n  {target.url}")

    if args.no_llm or not (os.environ.get("ANTHROPIC_API_KEY")
                           or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        subject, body, model = letter.fallback(target, sender)
    else:
        try:
            subject, body, model = letter.write(target, sender, args.effort)
        except Exception as e:                                  # noqa: BLE001
            print(f"  Claude call failed ({type(e).__name__}: {e}); using the template.")
            subject, body, model = letter.fallback(target, sender)

    sent = False
    if args.send:
        stop = deliver.blockers(target, ledger, mailer)
        if stop:
            print("  Not sending:")
            for reason in stop:
                print(f"    - {reason}")
        elif args.yes or deliver.confirm(target, subject, body):
            mailer.send(target.email, subject, body)
            sent = True
            print(f"  Sent to {target.email}")

    path = deliver.write_draft(target, subject, body, args.out, model)
    ledger.record(target, subject, sent, path)
    if not sent:
        print(f"  Draft: {path}")


def main(argv=None):
    args = parse_args(argv)
    if args.list:
        show_ledger()
        return 0

    rng = random.Random(args.seed)
    sender = args.from_name or sender_name()
    ledger = deliver.Ledger()
    mailer = deliver.Mailer()

    if args.send and mailer.missing():
        print("Can't send — these are unset: " + ", ".join(mailer.missing()))
        print("Writing drafts instead. See the README for the SMTP variables.\n")
        args.send = False

    for i in range(max(1, args.count)):
        try:
            one_letter(args, rng, sender, ledger, mailer)
        except RuntimeError as e:
            print(f"  {e}")
        except KeyboardInterrupt:
            print("\nStopped.")
            return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
