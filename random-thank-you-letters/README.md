# Random thank-you letters

Find someone on the internet who quietly did something useful, write them a real
thank-you letter about it, and either save it for review or actually send it.

<callout role="note" style="display:block;background:light-blue">

ℹ️ This is a `uv` project.

</callout>

## TL;DR

```zsh
cd helpful-little-scripts/random-thank-you-letters
uv run main.py                      # one letter, random source, saved as a draft
uv run main.py --count 3            # three of them
uv run main.py --source wikipedia   # pick where to look
uv run main.py --send               # actually email it, with a confirmation
uv run main.py --list               # everyone thanked so far
```

Drafts land in `drafts/` as markdown with YAML front matter, so you can read them
before anyone else does.

⸻

## Where the targets come from

Four public, no-auth APIs. Each one hands back a person plus enough evidence for the
letter to say something specific:

| `--source` | Who you end up thanking | Reachable how |
| --- | --- | --- |
| `wikipedia` | A named human from the last 40 revisions of a random article (bots and bare IPs filtered out) | Their user talk page — no email exists |
| `github` | The owner of a random actively-pushed repo | Their public profile email, if they published one |
| `hackernews` | Whoever posted a random recent story | An email in their HN profile blurb, if they put one there |
| `gutenberg` | The author of a random public-domain book | Nobody. They're dead. The letter is for the file. |

Default is `any`, which picks a source at random.

⸻

## About sending

Automatically emailing strangers whose addresses you scraped is spam, no matter how
nice the words are — it would also get your sending domain blocklisted in about a
week. So sending here is deliberately shaped like writing a letter rather than
running a campaign:

- **Drafts are the default.** `--send` is opt-in, every time.
- **Only addresses the person published themselves.** A GitHub profile email or an
  address someone typed into their own HN bio. Nothing harvested from a page that
  wasn't offering it, and never a guessed `first.last@company` pattern.
- **The whole letter is shown before it goes.** You confirm each one. `--yes` skips
  the prompt; nothing skips the draft being written.
- **Nobody is ever written to twice.** `ledger.jsonl` records every target and
  address, and both are checked before the next letter.
- **Five letters per 24 hours, maximum** (`DAILY_SEND_CAP` in `deliver.py`).
- **Wikipedia and Gutenberg letters are never emailed** — there's no address to use.
  The draft carries the talk-page link so you can post it yourself if you want to.

If any of that fails, the letter still gets written to `drafts/` and the reason is
printed.

#### SMTP setup

`--send` needs these set, and quietly falls back to drafts without them:

```zsh
export THANKS_SMTP_HOST="smtp.fastmail.com"
export THANKS_SMTP_PORT=587          # 465 switches to implicit TLS
export THANKS_SMTP_USER="you@example.com"
export THANKS_SMTP_PASS="an-app-password"
export THANKS_FROM="you@example.com"
export THANKS_FROM_NAME="Your Name"  # also used to sign the letters
```

⸻

## About the letters

`ANTHROPIC_API_KEY` gets you letters written by Claude (`claude-opus-5`), grounded in
whatever the source turned up — the actual edit summaries, the README, the post text.
The system prompt in `letter.py` is most of the work, and it's mostly a list of things
*not* to do:

- **Never claim experience the sender doesn't have.** The sender found this person at
  random and has almost certainly not used their library or read their book. "I came
  across" is honest; "your library saved my project" is a lie the script would be
  telling on your behalf. This is the rule worth keeping if you edit the prompt.
- No superlatives doing the work that specificity should do.
- Ask for nothing — no questions, no links, no "would love to connect".
- Acknowledge that an unsolicited note from a stranger is a slightly odd thing to
  receive, and don't apologise for it.
- 90–160 words, signed with your name.

Without an API key it falls back to a template letter that says plainly it's a
template. `--no-llm` forces that path.

⸻

## Options

| Flag | Default | What it does |
| --- | --- | --- |
| `--source` | `any` | `wikipedia`, `github`, `hackernews`, `gutenberg`, or `any` |
| `--count` | `1` | How many letters this run |
| `--out` | `drafts` | Where drafts go |
| `--send` | off | Actually email it, subject to everything above |
| `--yes` | off | Skip the send confirmation |
| `--from-name` | `git config user.name` | How the letters are signed |
| `--effort` | `medium` | How hard Claude thinks about the letter |
| `--no-llm` | off | Use the offline template |
| `--seed` | — | Reproducible target selection, for debugging |
| `--list` | — | Print the ledger and exit |

⸻

## Notes

- `ledger.jsonl` and `drafts/` are gitignored. The ledger is the only thing stopping
  a repeat letter, so don't delete it casually.
- Unauthenticated GitHub search allows 10 requests/minute; `--count` above ~4 on
  `--source github` will start hitting it.
- Every request sends a `User-Agent` with the repo URL and, if `THANKS_FROM` is set,
  a contact address — which is what Wikipedia's API policy asks for.
