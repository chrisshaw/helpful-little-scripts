#!/usr/bin/env python3
# Turns a Target into a letter. Uses Claude when a key is available, and a plain
# template when it isn't, so the script still does something useful offline.

import json, textwrap

MODEL = "claude-opus-5"

SYSTEM = """\
You write short thank-you letters from one real person to another. The recipient did \
something public and useful, and nobody has thanked them for it.

The sender found this person at random and does not know them. That constraint is the \
whole job: write something worth receiving without pretending to a relationship or an \
experience the sender doesn't have.

Rules, in priority order:

1. Never fabricate. The sender has not necessarily used, read, run, or benefited from \
this person's work — assume they haven't. You may only reference what is in the \
evidence provided. "I came across", "I noticed", "someone has clearly spent years on" \
are honest. "Your library saved my project" is a lie unless the evidence says so.
2. Be specific. Name the actual thing — the article, the repo, the book, the post — and \
one concrete detail from the evidence that shows you looked. A letter that would work \
for anyone is worthless.
3. Don't inflate. No "incredible", "amazing", "life-changing", no stacked superlatives, \
no flattery doing the work that specificity should do. Warm and plain beats effusive. \
Understatement is more credible than praise.
4. Ask for nothing. No questions, no offers, no links, no suggestions for their work, \
no "would love to connect". The letter is complete in itself and needs no reply.
5. Be honest about what this is. A stranger sending an unsolicited note is slightly odd; \
a sentence acknowledging that, lightly and without apology, makes it land better than \
pretending it's normal.
6. 90–160 words of body. Short paragraphs. No bullet points, no headings, no emoji, no \
em-dash-heavy prose. Sign off with the sender's name on its own line.

The subject line should be plain and specific enough to survive a spam filter and a \
skeptical glance — no "A note of gratitude!", no exclamation marks.\
"""

SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "subject": {"type": "string"},
            "body": {"type": "string"},
        },
        "required": ["subject", "body"],
        "additionalProperties": False,
    },
}


def prompt_for(target, sender):
    delivery = ("This will be emailed to them." if target.email
                else f"There is no email address. Delivery, if any: {target.channel}")
    return (f"Write the letter.\n\n"
            f"Sender's name (sign with this): {sender}\n"
            f"Recipient: {target.name}\n"
            f"What they did: {target.did}\n"
            f"Where: {target.url}\n"
            f"Delivery: {delivery}\n"
            + (f"Also relevant: {target.note}\n" if target.note else "")
            + f"\nEvidence — everything you are allowed to reference:\n{target.evidence}")


def write(target, sender, effort="medium"):
    """Ask Claude for the letter. Returns (subject, body, model_used)."""
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt_for(target, sender)}],
        output_config={"format": SCHEMA, "effort": effort},
    )
    text = next(b.text for b in response.content if b.type == "text")
    letter = json.loads(text)
    return letter["subject"], letter["body"].strip(), MODEL


def fallback(target, sender):
    """No API key: a plain template, honest about being one."""
    para = lambda s: textwrap.fill(" ".join(s.split()), width=74)
    opening = para(
        f"You don't know me. I run a small script that picks something useful off the "
        f"internet at random and writes a thank-you note to whoever made it, on the "
        f"theory that most people who quietly keep things going never hear from anyone. "
        f"Today it picked you, because of {target.thing}.")
    closing = para(
        "I'm not after anything. I just wanted it on the record that someone went and "
        "looked, and that the work registered with a stranger."
        + ("" if target.sendable else
           " This one can't be delivered, of course. Consider it filed anyway."))
    body = f"Hello {target.name},\n\n{opening}\n\n{closing}\n\nThank you,\n{sender}"
    return f"Thank you for {target.thing}", body, "template (no API key)"
