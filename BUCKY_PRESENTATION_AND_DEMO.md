# Bucky Section — Slide Content, Presentation Script, Demo Script

Everything you asked for, for your part of the deck: what to put on the two
empty Bucky slides (6.0 is currently just a title card with nothing under
it), a script for narrating those slides, and a **separate** script for the
live dashboard demo. Two scripts on purpose — presenting is talking over
static slides, demoing is driving a live browser and adapting to whatever
actually happens on screen.

Everything below is grounded in what's actually built and verified in this
codebase (`BUCKY_CAPABILITIES.md`) — no invented features, no rounded-up
numbers.

---

## Part 1 — What to put on slide 6.0

Look at the rest of your deck again: `1.0`, `2.0`, `3.0`, `5.0`, `7.0`,
`8.0` are each **one slide** that carries the title *and* the content
together. `6.0` (Bucky) is currently the odd one out — a bare title with
nothing under it. It's not supposed to stay bare; it just hasn't been
filled in. The only slide that's *meant* to be title-only is `11.0` (Live
Demonstration), since that one is deliberately just a hand-off into you
driving a live browser.

So: **no new slide numbers.** Put this directly on the existing `6.0`
slide, in the same two-column dense layout your `8.0` "Current Status"
slide already uses (two columns, several short bullets each — that slide
proves a single slide in this deck can comfortably hold this much).

### Slide 6.0 — "Bucky - AI Assistant/Agent"

**Left column — "How It Works"**
- **Ask it anything** — pulls real, live answers straight from the
  database. "What's currently in production?" · "Who owns the most
  videos?" · "What's waiting on review?"
- **Instant actions** — routine, self-scoped tasks (claiming a video,
  submitting a script, reporting an issue) run immediately, same as
  clicking the button.
- **Confirm-gated actions** — anything consequential (publishing,
  deleting, account changes) shows an explicit confirm card first.
  Nothing happens until someone clicks Confirm.

**Right column — "Built for Production"**
- **Full audit trail** — every action logged: who, what, when, outcome.
- **Proactive, not just reactive** — flags stale items and pacing gaps
  unprompted, live in chat and once daily via the notification bell,
  even if nobody opens Bucky that day.
- **Safety rails** — rate limiting, a 24-hour undo window on deletions,
  DB-enforced role permissions — the same boundary as the rest of the
  dashboard.
- **Two-way voice** — talk to Bucky instead of typing; have replies read
  back.

**Callout bar underneath** (matches the "The UI hides..." callout style
on your `2.0`/`3.0` slides):
> Bucky's tools are gated by the exact same database permissions as the
> dashboard itself. It can never do more than the signed-in role could
> already do by hand.

*(Optional stat line, matching `1.0`'s "10 categories, 42 subcategories"
style: 27 tools total — 11 shared read tools, plus 7 for Operator, 11 for
Lead, 15 for Admin.)*

If that genuinely feels tight once it's actually laid out in Slides,
the one acceptable trim is dropping the stat line and/or shortening the
right column to 3 bullets — but try it as one slide first. It's meant to
be a single, complete stop, not a lead-in to more slides.

---

## Part 2 — Presentation Script (narrating the slide, before the demo)

This covers the single `6.0` slide. Conversational, not read word-for-word
— roughly 90 seconds to 2 minutes, matching how much content is actually
on it.

> Everything you just saw, from the pipeline to the various capabilities of each user roles, someone can also do by *typing* or by *talking* — this is
> Bucky, the AI assistant we built directly into the dashboard.
>
> Bucky isn't just a chatbot bolted on the side that just answers questions —
> it's wired into the same actions the dashboard already has. Ask it
> something, and it pulls the real, live answer straight from the
> database — 'what's in production,' 'who's got the most videos,' 'what's
> waiting on review' — no digging through tables yourself.
>
> Beyond questions, every role gets a set of actions that match what
> they're already allowed to do in the UI. The routine, low-risk stuff —
> claiming a video, submitting a script, reporting an issue — runs
> instantly, exactly like clicking the button would. But anything with
> real consequences — publishing a video live, deleting something,
> creating a user account — Bucky stops and shows a confirm card first.
> Nothing happens until a person actually clicks Confirm. That's not a
> prompt-level promise, either — the tool list itself is scoped per role
> at the database level, the same enforcement you saw on the roles slide.
> Bucky literally cannot be talked into doing something the signed-in
> role isn't allowed to do.
>
> A few things that make this closer to a real production system than a
> chatbot demo. Every action Bucky takes gets logged — who did what,
> when, and whether it worked — so there's a real audit trail. It's also
> proactive: if something's been sitting In Review too long, or the team's
> falling behind today's target, Bucky brings that up the moment you open
> the chat, and that same check runs once a day automatically in the
> background — so even on a day nobody opens Bucky at all, a stale item
> still shows up as a notification. And there's a real safety net under
> all of it — rate limiting, a 24-hour undo window if a delete turns out
> to be a mistake, and you can even talk to it instead of typing, and
> have it talk back.
>
> Let's stop talking about it and actually use it."

*(Transition line into the demo — hand off to whoever's driving the
keyboard, or into your own live demo if you're doing both.)*

---

## Part 3 — Live Demo Script (driving the actual dashboard)

This is a **separate track** from the slide narration above — you're now
clicking through the real, running app, not talking over static slides.

Organized **by role, one at a time** — same order as your `2.0` slide
(Operator → Lead → Admin). Finish everything in one account before
switching windows, instead of bouncing back and forth: it mirrors how the
slide already framed the three roles, and it's easier to keep straight
live than jumping around by feature. Each role-section is self-contained
and opens with its own one-line framing so it also works as a
mini-recap of that role's card from `2.0`.

### Before you go on stage

- [ ] Dev server running and confirmed reachable (`localhost:3000` loads,
      not a stale build).
- [ ] Three browser profiles/windows ready, already logged in, so you're
      not typing passwords live — arranged in the order you'll present
      them (Operator, Lead, Admin):
      - **Operator** — your operator test account
      - **Lead** — `test2@gmail.com` / `123`
      - **Admin** — `testadmin@lifewood.com` / `123`
- [ ] Bucky panel already opened once in each window (so the first click
      isn't the audience's first look at the loading state).
- [ ] Pick one real, currently-existing product to reference by name/rank
      throughout — decide this 5 minutes before you go on, not live.
- [ ] Know the free-tier model's honest latency: a reply can take
      **10–30 seconds**, occasionally more. Don't panic-narrate a silence —
      see "If something's slow" at the end.
- [ ] Voice demo: use **Chrome or Edge**, not Brave (Brave shows the mic
      button but the browser itself blocks speech recognition — confirmed,
      not a bug you'll hit live and have to explain away).

---

### Section A — Operator: "I do the work" (~60–75s)

Open on the Operator window.

> "Starting where the work actually starts — Operator."

**A1. Read**
Type:
> "What's currently in production?"

While it's thinking: *"Same live database query any role can make."*

**A2. Instant action**
Type:
> "Claim product #[rank] for myself."

Point out: no confirm card, ran immediately — *"routine, self-scoped
work runs right away, exactly as frictionless as clicking Claim in the
UI, because it's the same permission tier."*

**A3. Voice (optional, only in Chrome/Edge)**
Click the mic, say a short question out loud, let it populate the draft
box (don't auto-send):
> "It fills the box in for me to review before sending — never sends on
> its own, so a misheard word never accidentally triggers a real action."

---

### Section B — Lead: "I own the pipeline" (~75–90s)

Switch to the Lead window.

> "Now the person who owns getting that video out the door — Lead."

**B1. Read**
Type:
> "What deliverables are waiting on review right now?"

**B2. Confirm-gated action — the storyboard/script review**
Type:
> "Approve the storyboard submitted for product #[rank]."

Pause on the confirm card before clicking:
> "This is the moment that matters — Bucky proposed it, but nothing's
> happened yet. It's waiting on me."

Click **Confirm**.

**B3. Confirm-gated action — the big one**
Type:
> "Approve and publish the video for product #[rank]."

Same pause-then-confirm beat — this is the highest-stakes action in the
whole system, worth letting it land:
> "Confirming this publishes it live. Same rule as before — nothing
> moves until I click."

Click **Confirm**.

**B4. Proactive alert (point, don't necessarily type anything)**
Point at the notification bell / the dot on Bucky's icon if one is
currently lit from a real stale item or pacing gap:
> "Nobody asked for this one — Bucky already noticed and flagged it,
> here and the moment I opened the chat."

If nothing's flagged (clean pipeline), say so rather than forcing it:
> "Nothing's flagged right now, which is a good sign — but this runs
> automatically once a day even if nobody's looking, so it's not
> something anyone has to remember to check."

**B5. Undo (optional, only if something's actually been deleted this
session — otherwise narrate it instead of running it)**
> "What have I deleted recently that I can still restore?"
>
> "If I'd deleted something by mistake, this is where I'd find it and
> bring it back — full undo, 24-hour window."

---

### Section C — Admin: "I oversee" (~45–60s)

Switch to the Admin window.

> "And the role that oversees all of it — Admin."

**C1. Read**
Type:
> "Who's on the team, and what are their roles?"

**C2. Confirm-gated action**
Type:
> "Create a new operator account for [a clearly fake demo email]."

Pause on the confirm card the same way as Lead's — consistency matters
here, it reinforces that every role plays by the same rule:
> "Same pattern again — proposed, not executed, until I confirm."

Click **Confirm**.

**C3. The conversation viewer (closing loop)**
Navigate to the **Bucky** tab (Admin-only).
> "And this is the piece that ties the whole thing together — every
> conversation, on every account, including everything we just did
> live, is sitting right here, read-only, for Admin to review. That's
> the audit trail from the slide — not just a claim, it's this screen."

---

### Closing line

> "Every one of those actions, across all three roles, was gated by the
> exact same permissions as the rest of the dashboard — Bucky doesn't
> have a back door. It's the same system, you're just talking to it
> instead of clicking through it."

### If something's slow or breaks live (say this, don't hide it)

- **Long pause / no reply yet**: *"This is running on a free-tier model —
  it can take up to 30 seconds. Real tradeoff for zero added cost."* Keep
  talking about something else on screen while it finishes.
- **Model gives a slightly garbled or oddly-worded reply**: don't
  over-apologize — *"the free model occasionally phrases things
  imperfectly — the underlying data and the action are always verified
  correct regardless, that's not left to the model to get right."*
- **A request gets refused/misunderstood**: rephrase once, naturally, the
  way you'd re-ask a person who misheard you. If it still doesn't land,
  move on to the next beat within that role's section — don't get stuck
  fighting one prompt on stage.
