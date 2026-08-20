#!/usr/bin/env python3
# Random target discovery. Every source uses a public, no-auth API and returns
# a Target with enough evidence for the letter writer to say something specific.

import json, os, re, urllib.error, urllib.parse, urllib.request
from dataclasses import dataclass, asdict
from datetime import date, timedelta

UA = "random-thank-you-letters/0.1 (+https://github.com/chrisshaw/helpful-little-scripts{contact})"
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


@dataclass
class Target:
    source: str                       # which finder produced this
    key: str                          # stable dedupe key, e.g. "wikipedia:User:Foo"
    name: str                         # who gets thanked
    did: str                          # one line on what they did ("wrote X", "maintains Y")
    thing: str                        # noun phrase that reads after "Thank you for ..."
    url: str                          # where anyone can go see it
    evidence: str                     # grounding text so the letter isn't a mail-merge
    email: str | None = None          # ONLY if they published one for contact
    channel: str | None = None        # human-readable "how to reach them"
    sendable: bool = True             # False when there's nobody alive to receive it
    note: str = ""                    # anything the letter writer should know

    def as_dict(self):
        return asdict(self)


def _ua():
    contact = os.environ.get("THANKS_FROM", "")
    return UA.format(contact=f"; {contact}" if contact else "")


def api(url, accept="application/json", raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": _ua(), "Accept": accept})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
    return body if raw else json.loads(body)


def _clip(text, n):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"


def _reading_order(name):
    """Gutenberg files authors as "Austen, Jane"; a letter needs "Jane Austen"."""
    if not name or name.count(",") != 1:
        return name
    surname, rest = (part.strip() for part in name.split(","))
    return f"{rest} {surname}".strip() if rest else surname


def _published_email(blob):
    """Pull an address out of a field the person filled in themselves."""
    m = EMAIL_RE.search(blob or "")
    return m.group(0) if m else None


# --- Wikipedia: a human who quietly improved an article -----------------------

def wikipedia(rng):
    page = api("https://en.wikipedia.org/api/rest_v1/page/random/summary")
    title = page["title"]
    q = urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "revisions", "titles": title, "rvlimit": "40",
        "rvprop": "user|comment|timestamp|size",
    })
    revs = api(f"https://en.wikipedia.org/w/api.php?{q}")["query"]["pages"][0].get("revisions", [])
    # Registered humans only: IPs have no talk-page identity worth writing to, and
    # bots don't read their mail.
    humans = [r for r in revs
              if not r.get("anon") and r.get("user")
              and not re.search(r"(?i)bot\b|bot$", r["user"])]
    if not humans:
        raise LookupError(f"no named human editors on {title!r}")
    pick = rng.choice(humans)
    user = pick["user"]
    edits = [r for r in humans if r["user"] == user]
    summaries = [f'{r["timestamp"][:10]}: {r.get("comment") or "(no edit summary)"}' for r in edits[:4]]
    return Target(
        source="wikipedia",
        key=f"wikipedia:{user}",
        name=user,
        did=f'edited the Wikipedia article "{title}"',
        thing=f'your edits to "{title}"',
        url=page["content_urls"]["desktop"]["page"],
        evidence=(f'Wikipedia article: "{title}"\n'
                  f'What the article covers: {_clip(page.get("extract"), 600)}\n'
                  f'This editor made {len(edits)} of the last {len(revs)} revisions.\n'
                  f'Their recent edit summaries:\n  ' + "\n  ".join(summaries)),
        channel=f"User talk page: https://en.wikipedia.org/wiki/User_talk:{urllib.parse.quote(user)}",
        note=("Wikipedia editors are volunteers and usually anonymous. A talk-page post is the "
              "normal way to reach one; there is no email address."),
    )


# --- GitHub: someone maintaining something in the open -----------------------

def github(rng):
    lo = rng.choice([5, 20, 50, 200, 800])
    since = (date.today() - timedelta(days=rng.randint(1, 45))).isoformat()
    q = urllib.parse.quote(f"stars:{lo}..{lo * 6} pushed:>{since}")
    page = rng.randint(1, 10)
    hits = api(f"https://api.github.com/search/repositories?q={q}&per_page=100&page={page}",
               accept="application/vnd.github+json").get("items", [])
    if not hits:
        raise LookupError("GitHub search came back empty")
    repo = rng.choice(hits)
    owner = api(repo["owner"]["url"], accept="application/vnd.github+json")
    try:
        readme = _clip(api(f'https://api.github.com/repos/{repo["full_name"]}/readme',
                           accept="application/vnd.github.raw", raw=True), 1200)
    except urllib.error.HTTPError:
        readme = "(no README)"
    name = owner.get("name") or owner["login"]
    return Target(
        source="github",
        key=f'github:{repo["full_name"]}',
        name=name,
        did=f'maintains the open-source project {repo["full_name"]}',
        thing=repo["full_name"],
        url=repo["html_url"],
        # owner.email is only ever populated when the user made it public.
        email=owner.get("email"),
        evidence=(f'Repo: {repo["full_name"]} ({repo["stargazers_count"]} stars, '
                  f'{repo.get("language") or "no primary language"})\n'
                  f'Description: {repo.get("description") or "(none)"}\n'
                  f'Topics: {", ".join(repo.get("topics") or []) or "(none)"}\n'
                  f'Last pushed: {repo.get("pushed_at", "")[:10]}\n'
                  f'Owner bio: {_clip(owner.get("bio"), 200) or "(none)"}\n'
                  f'README excerpt:\n{readme}'),
        channel=(f'Public email on their GitHub profile: {owner["email"]}' if owner.get("email")
                 else f'GitHub profile: {owner["html_url"]} (no public email)'),
    )


# --- Hacker News: someone who shipped a thing and posted it ------------------

def hackernews(rng):
    top = api("https://hacker-news.firebaseio.com/v0/maxitem.json")
    story = None
    for _ in range(40):
        item = api(f"https://hacker-news.firebaseio.com/v0/item/{rng.randint(top - 400_000, top)}.json")
        if (item and item.get("type") == "story" and item.get("by") and item.get("title")
                and not item.get("dead") and not item.get("deleted")):
            story = item
            break
    if not story:
        raise LookupError("couldn't land on a live HN story")
    who = story["by"]
    profile = api(f"https://hacker-news.firebaseio.com/v0/user/{urllib.parse.quote(who)}.json") or {}
    about = re.sub(r"<[^>]+>", " ", profile.get("about") or "")
    email = _published_email(about)
    return Target(
        source="hackernews",
        key=f'hackernews:{story["id"]}',
        name=who,
        did=f'posted "{story["title"]}" to Hacker News',
        thing=f'"{story["title"]}"',
        url=story.get("url") or f'https://news.ycombinator.com/item?id={story["id"]}',
        email=email,
        evidence=(f'HN submission: "{story["title"]}"\n'
                  f'Link: {story.get("url") or "(text post)"}\n'
                  f'Points: {story.get("score", 0)}, comments: {story.get("descendants", 0)}\n'
                  f'Post text: {_clip(re.sub(r"<[^>]+>", " ", story.get("text") or ""), 600) or "(none)"}\n'
                  f'Their HN profile says: {_clip(about, 300) or "(nothing)"}'),
        channel=(f"Email published in their HN profile: {email}" if email
                 else f"HN profile: https://news.ycombinator.com/user?id={urllib.parse.quote(who)}"),
    )


# --- Project Gutenberg: a letter that can never be delivered -----------------

def gutenberg(rng):
    books = api(f"https://gutendex.com/books/?page={rng.randint(1, 300)}")["results"]
    book = rng.choice([b for b in books if b.get("authors")] or books)
    author = (book.get("authors") or [{}])[0]
    who = _reading_order(author.get("name")) or "an anonymous author"
    lived = "–".join(str(y) for y in (author.get("birth_year"), author.get("death_year")) if y)
    return Target(
        source="gutenberg",
        key=f'gutenberg:{book["id"]}',
        name=who,
        did=f'wrote "{book["title"]}", still being read on Project Gutenberg',
        thing=f'"{book["title"]}"',
        url=f'https://www.gutenberg.org/ebooks/{book["id"]}',
        evidence=(f'Book: "{book["title"]}"\n'
                  f'Author: {who}{f" ({lived})" if lived else ""}\n'
                  f'Subjects: {", ".join((book.get("subjects") or [])[:6]) or "(none listed)"}\n'
                  f'Downloads from Project Gutenberg in the last 30 days: {book.get("download_count", 0)}'),
        sendable=False,
        channel="No delivery possible — this one is for the file.",
        note=("This author is almost certainly long dead. Write the letter to them anyway, "
              "and let it acknowledge plainly that it cannot be delivered."),
    )


SOURCES = {
    "wikipedia": wikipedia,
    "github": github,
    "hackernews": hackernews,
    "gutenberg": gutenberg,
}


def find(rng, source="any", attempts=4):
    """Pick a source (or the named one) and return a Target, retrying flaky lookups."""
    last = None
    for _ in range(attempts):
        name = rng.choice(sorted(SOURCES)) if source == "any" else source
        try:
            return SOURCES[name](rng)
        except (LookupError, KeyError, IndexError, urllib.error.URLError, TimeoutError,
                json.JSONDecodeError) as e:
            last = f"{name}: {type(e).__name__}: {e}"
    raise RuntimeError(f"gave up finding a target (last error — {last})")
