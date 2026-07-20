# What Bucky Can Do

Bucky is the assistant built into the dashboard — the chat icon in the corner of the screen. Anyone signed in can open it and type a question or request in plain English, the same way you'd message a coworker.

A few things worth knowing before the details below:

- **Bucky remembers your conversation.** If you close the dashboard and come back later, your chat with Bucky is still there. There's a small trash-can icon in Bucky's header if you ever want to start a fresh conversation.
- **Bucky never does anything serious without asking you first.** For any action that changes real data in a meaningful way, Bucky will show a card describing exactly what it's about to do, with **Confirm** and **Cancel** buttons. Nothing happens until you click Confirm. A smaller set of low-risk, routine actions (marked **Instant** below) run right away, the same way clicking a button in the dashboard would.
- **What Bucky can do depends on who's logged in.** Everyone can ask Bucky questions. Beyond that, Admins, Leads, and Operators each get a different set of actions, matching what that role is already responsible for in the dashboard. Each is covered separately below.
- **The pipeline has 5 stages.** Every video moves through **Not Started → Design → Production → In Review → Published**. The Design stage is where the storyboard and script get written and approved; Production is where the video itself gets made.
- **You can talk to Bucky instead of typing.** Look for a microphone icon next to the message box — click it, say what you want, and it fills in the message box for you to review (it never sends automatically, so you always get to check it first). There's also a speaker icon in Bucky's header you can turn on to have replies read aloud, plus a small speaker icon on each individual reply if you just want to hear that one. Not every browser supports voice input — if you don't see the microphone icon, yours doesn't yet, but reading replies aloud works almost everywhere.
- **Bucky proactively surfaces things once a day even if nobody's looking.** Separately from the "watches things for you" sections below (which check the moment you open the chat), the same checks also run automatically once a day in the background and show up as a regular notification in the bell icon at the top of the dashboard — so a stale item or a pacing problem still gets flagged even on a day nobody opens Bucky at all.

For every capability, there's a sample message in quotes — copy it, paste it into Bucky, and swap in your own details (a real product number, a real name, etc).

---

## Ask Bucky Anything (every role)

These questions work the same for Admin, Lead, and Operator:

| What Bucky can tell you | Try typing this |
|---|---|
| What's currently in production | "What's currently in production?" |
| Full details on one video | "Give me the full details on product #12." |
| High-priority videos | "Which videos are marked high priority?" |
| Today's or this week's output | "How many videos did we publish today?" |
| An overall summary of where things stand | "Give me a quick summary of where we stand." |
| Open issues on any video | "What issues are currently open?" |
| Storyboards/scripts waiting on review | "What deliverables are waiting on review right now?" |
| The current production plan and deadline | "What's our current production plan and deadline?" |
| Who's on the team | "Who's on the team, and what are their roles?" |
| How many videos each person owns, or what's unclaimed | "How many videos does each operator own, and what's still unclaimed?" |
| The BuckedUp product catalog | "Search the catalog for 'protein powder'." |

---

## 1. Admin

Admins have the widest reach: they manage accounts and the production plan (which no one else can touch), **and** they can do everything a Lead can — review work, move videos between stages, create and delete videos, and manage the catalog. Every Admin action asks for confirmation first, except the instant ones noted below.

### Accounts (confirm first)

**1. Create a new account**
Invites someone by email and sets their role.
> "Create a new operator account for jane@example.com."

**2. Delete an account**
Removes someone's access entirely.
> "Delete the account for jane@example.com."

**3. Change someone's role**
Switches an existing account between Operator, Lead, and Admin.
> "Change mike@example.com's role to Lead."

### Production plan (confirm first — Admin is the only role that can change it)

**4. Update the production plan**
Change the deadline, targets, or notes — only what you mention gets changed, everything else (including any Excel-imported daily pacing schedule) stays as-is.
> "Update our production plan — change the deadline to December 15th."

### Pipeline & catalog

Admin also gets every Lead action below — approving/rejecting storyboards, scripts, and videos, moving videos between stages, creating and deleting videos, managing the catalog, and the undo tools. They work exactly as described in the Lead section, so they aren't repeated here.

### Reviewing Bucky's Conversations

Admins also get an extra tab in the dashboard called **Bucky**, next to the Admin tab. It lists every account that's ever talked to Bucky — email, role, how many messages, when they last chatted — and clicking one opens the full conversation, read-only. This isn't something you type to Bucky; it's a separate screen for keeping an eye on how Bucky's being used across the team.

---

## 2. Lead

Leads run the day-to-day pipeline — reviewing work, moving videos forward, and managing the catalog. Bucky mirrors everything a Lead can already do in the dashboard. (One change from before: the production plan is now managed by Admins, so Leads can read it but not change it.)

### Instant Actions (run right away, no confirmation needed)

**1. Report an issue**
Logs a problem against a video.
> "Report a high severity issue on product #7: the audio is out of sync."

**2. Resolve an issue**
Marks a reported problem as fixed.
> "Mark the audio sync issue on product #7 as resolved."

**3. See what's been deleted and can still be restored**
Lists anything recently deleted through Bucky that's still within its undo window.
> "What have I deleted recently that I can still restore?"

**4. Bring back a deleted video**
Restores a deleted video and everything attached to it — issues, deliverables, video versions, history — exactly as it was. Works within 24 hours of deleting it; after that it's gone for good.
> "Restore the product named Winter Sale Promo."

**5. Bring back a deleted catalog product**
Restores a deleted catalog listing. No time limit — catalog deletions stay recoverable indefinitely.
> "Restore the catalog product named Old Logo Tee."

### Actions That Ask You to Confirm First

**6. Move a video to a different stage**
Skips it straight to any of the 5 stages — useful for corrections, not for normal reviews. Also the tool to reach for if you published something by mistake and want it back in Production (this only fixes the record in this dashboard — if the video's already gone out publicly somewhere else, that part can't be undone).
> "Move product #5 back to the Production stage."

**7. Approve or reject a storyboard or script**
Both are written during the Design stage. Once **both** the storyboard and the script are approved, the video automatically moves on to Production. Rejecting keeps it in Design and records your note on the video.
> "Approve the storyboard submitted for product #9."

**8. Approve or reject a finished video**
This is the big one — approving **publishes the video live**. Rejecting sends it back to Production for rework, with your note.
> "Approve and publish the video for product #3."

**9. Create a new video**
Start from scratch, or pull the details straight from a catalog item. You can set a priority (High/Medium/Low) too.
> "Create a new high-priority product called 'Winter Sale Promo' in the Marketing category, Ads subcategory."

**10. Delete a video**
Removes it completely, along with its issues and history — but it's recoverable for the next 24 hours if that turns out to be a mistake (see "Bring back a deleted video" above).
> "Delete product #22, it was a duplicate."

**11. Add or update a catalog product**
Add a new BuckedUp product to the catalog, or edit an existing listing.
> "Add a new catalog product called 'BuckedUp Shaker Bottle' in the Merchandise category."

**12. Delete a catalog product**
Hides the listing rather than destroying it — recoverable any time (see "Bring back a deleted catalog product" above), and any video still linked to it keeps that link.
> "Delete the catalog product called 'Old Logo Tee'."

### Bucky Also Watches Things For You

You don't need to ask for these — Lead's Bucky checks automatically every time the dashboard loads, and shows a small red dot on its icon if it has something to flag. The same checks also run once a day in the background (see the note near the top of this doc) and show up in the notification bell even if nobody opens the chat:

- **Videos stuck in review too long.** If anything has been sitting In Review for 3 or more days, Bucky will mention it as soon as you open the chat.
- **Falling behind today's target.** If the team is behind pace on today's video output, Bucky will let you know how many more are needed to stay on track.

---

## 3. Operator

Operators do the hands-on work — claiming videos, writing storyboards and scripts, and submitting finished videos. Bucky's actions for Operator match exactly what an Operator can already do in the dashboard, and every one of them runs immediately, no approval step, the same as clicking the equivalent button.

### Instant Actions (all run right away, no confirmation needed)

**1. Report an issue**
Logs a problem against a video.
> "Report a medium severity issue on product #7: the voiceover has a typo."

**2. Resolve an issue**
Marks a reported problem as fixed.
> "Mark the voiceover typo issue on product #7 as resolved."

**3. Claim a video to work on**
Assigns an unclaimed, not-yet-started video to yourself and moves it into the Design stage.
> "Claim product #15 for myself."

**4. Give back a claimed video**
Changed your mind, or picked the wrong one? As long as it hasn't moved past Design, unclaiming puts it back to Not Started, unowned, for someone else to pick up.
> "Unclaim product #15."

**5. Submit your storyboard or script**
Turns in your write-up for the Design stage — tell Bucky which one it is (storyboard or script). Once a Lead approves both, the video moves on to Production automatically.
> "Submit my storyboard for product #15: [paste your write-up here]."

**6. Submit a finished video for review**
Moves a video you own from Production into the review queue. At least one video version has to be uploaded first (through the dashboard or by giving Bucky a link — see below).
> "Submit product #15's video for review."

**7. Update a video's link**
Points a video at a new file/link.
> "Update product #15's video link to [paste the link here]."

### Bucky Also Watches Things For You

You don't need to ask for these — Operator's Bucky checks automatically every time the dashboard loads, and shows a small red dot on its icon if it has something to flag. The same checks also run once a day in the background (see the note near the top of this doc) and show up in the notification bell even if nobody opens the chat:

- **Your own claimed videos stuck too long.** If something you've claimed hasn't moved in 3 or more days, Bucky will remind you as soon as you open the chat.
- **Falling behind today's target.** If the team is behind pace on today's video output, Bucky will mention it.
