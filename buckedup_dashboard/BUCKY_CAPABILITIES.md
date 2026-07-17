# What Bucky Can Do

Bucky is the assistant built into the dashboard — the chat icon in the corner of the screen. Anyone signed in can open it and type a question or request in plain English, the same way you'd message a coworker.

A few things worth knowing before the details below:

- **Bucky remembers your conversation.** If you close the dashboard and come back later, your chat with Bucky is still there. There's a small trash-can icon in Bucky's header if you ever want to start a fresh conversation.
- **Bucky never does anything serious without asking you first.** For any action that changes real data in a meaningful way, Bucky will show a card describing exactly what it's about to do, with **Confirm** and **Cancel** buttons. Nothing happens until you click Confirm. A smaller set of low-risk, routine actions (marked **Instant** below) run right away, the same way clicking a button in the dashboard would.
- **What Bucky can do depends on who's logged in.** Everyone can ask Bucky questions. Beyond that, Admins, Leads, and Operators each get a different set of actions, matching what that role is already responsible for in the dashboard. Each is covered separately below.

For every capability, there's a sample message in quotes — copy it, paste it into Bucky, and swap in your own details (a real product number, a real name, etc).

---

## 1. Admin

Admins manage who has access to the dashboard. Admin's Bucky is focused on accounts, not on the video pipeline itself — an Admin can ask Bucky anything about production, but the actions available to an Admin are strictly about people, not products.

### Ask Bucky Anything

| What Bucky can tell you | Try typing this |
|---|---|
| What's currently in production | "What's currently in production?" |
| Full details on one video | "Give me the full details on product #12." |
| Today's or this week's output | "How many videos did we publish today?" |
| An overall summary of where things stand | "Give me a quick summary of where we stand." |
| Open issues on any video | "What issues are currently open?" |
| Scripts/storyboards/prompts waiting on review | "What deliverables are waiting on review right now?" |
| The current production plan and deadline | "What's our current production plan and deadline?" |
| Who's on the team | "Who's on the team, and what are their roles?" |
| The BuckedUp product catalog | "Search the catalog for 'protein powder'." |

### Actions (always ask you to confirm first)

**1. Create a new account**
Invites someone by email and sets their role.
> "Create a new operator account for jane@example.com."

**2. Delete an account**
Removes someone's access entirely.
> "Delete the account for jane@example.com."

**3. Change someone's role**
Switches an existing account between Operator, Lead, and Admin.
> "Change mike@example.com's role to Lead."

That's the full list for Admin — by design, Admin can't edit videos, move them between stages, or touch the production plan. Those belong to Lead and Operator, below.

---

## 2. Lead

Leads run the day-to-day pipeline — reviewing work, moving videos forward, and managing the production plan and catalog. Bucky mirrors everything a Lead can already do in the dashboard.

### Ask Bucky Anything

| What Bucky can tell you | Try typing this |
|---|---|
| What's currently in production | "What's currently in production?" |
| Full details on one video | "Give me the full details on product #12." |
| Today's or this week's output | "How many videos did we publish this week?" |
| An overall summary of where things stand | "Give me a quick summary of where we stand." |
| Open issues on any video | "What issues are currently open?" |
| Scripts/storyboards/prompts waiting on review | "What deliverables are waiting on review right now?" |
| The current production plan and deadline | "What's our current production plan and deadline?" |
| Who's on the team | "Who's on the team, and what are their roles?" |
| The BuckedUp product catalog | "Search the catalog for 'protein powder'." |

### Instant Actions (run right away, no confirmation needed)

**1. Report an issue**
Logs a problem against a video.
> "Report a high severity issue on product #7: the audio is out of sync."

**2. Resolve an issue**
Marks a reported problem as fixed.
> "Mark the audio sync issue on product #7 as resolved."

### Actions That Ask You to Confirm First

**3. Move a video to a different stage**
Skips it straight to any stage — useful for corrections, not for normal reviews.
> "Move product #5 to the Editing stage."

**4. Approve or reject a script, storyboard, or prompt**
Approving sends it to the next stage; rejecting sends it back with your note.
> "Approve the storyboard submitted for product #9."

**5. Approve or reject a finished video**
This is the big one — approving **publishes the video live**. Rejecting sends it back to editing with your note.
> "Approve and publish the video for product #3."

**6. Create a new video**
Start from scratch, or pull the details straight from a catalog item.
> "Create a new product called 'Winter Sale Promo' in the Marketing category, Ads subcategory."

**7. Delete a video**
Removes it completely, along with its issues and history. Can't be undone.
> "Delete product #22, it was a duplicate."

**8. Update the production plan**
Change the deadline, targets, or notes — only what you mention gets changed, everything else stays as-is.
> "Update our production plan — change the deadline to December 15th."

**9. Add or update a catalog product**
Add a new BuckedUp product to the catalog, or edit an existing listing.
> "Add a new catalog product called 'BuckedUp Shaker Bottle' in the Merchandise category."

**10. Delete a catalog product**
Removes the listing. If a video is linked to it, the video itself is untouched — just unlinked.
> "Delete the catalog product called 'Old Logo Tee'."

### Bucky Also Watches Things For You

You don't need to ask for these — Lead's Bucky checks automatically every time the dashboard loads, and shows a small red dot on its icon if it has something to flag:

- **Videos stuck in review too long.** If anything has been sitting In Review for 3 or more days, Bucky will mention it as soon as you open the chat.
- **Falling behind today's target.** If the team is behind pace on today's video output, Bucky will let you know how many more are needed to stay on track.

---

## 3. Operator

Operators do the hands-on work — claiming videos, writing scripts/storyboards/prompts, and submitting finished videos. Bucky's actions for Operator match exactly what an Operator can already do in the dashboard, and every one of them runs immediately, no approval step, the same as clicking the equivalent button.

### Ask Bucky Anything

| What Bucky can tell you | Try typing this |
|---|---|
| What's currently in production | "What's currently in production?" |
| Full details on one video | "Give me the full details on product #12." |
| Today's or this week's output | "How many videos did we publish today?" |
| An overall summary of where things stand | "Give me a quick summary of where we stand." |
| Open issues on any video | "What issues are currently open?" |
| Scripts/storyboards/prompts waiting on review | "What deliverables are waiting on review right now?" |
| The current production plan and deadline | "What's our current production plan and deadline?" |
| Who's on the team | "Who's on the team, and what are their roles?" |
| The BuckedUp product catalog | "Search the catalog for 'protein powder'." |

### Instant Actions (all run right away, no confirmation needed)

**1. Report an issue**
Logs a problem against a video.
> "Report a medium severity issue on product #7: the voiceover has a typo."

**2. Resolve an issue**
Marks a reported problem as fixed.
> "Mark the voiceover typo issue on product #7 as resolved."

**3. Claim a video to work on**
Assigns an unclaimed video to yourself.
> "Claim product #15 for myself."

**4. Submit your write-up for the current stage**
Turns in your storyboard, script, or prompt for whichever stage the video is currently in.
> "Submit my storyboard for product #15: [paste your write-up here]."

**5. Submit a finished video for review**
Moves a video you're editing into the review queue.
> "Submit product #15's video for review."

**6. Update a video's link**
Points a video at a new file/link.
> "Update product #15's video link to [paste the link here]."

### Bucky Also Watches Things For You

You don't need to ask for these — Operator's Bucky checks automatically every time the dashboard loads, and shows a small red dot on its icon if it has something to flag:

- **Your own claimed videos stuck too long.** If something you've claimed hasn't moved in 3 or more days, Bucky will remind you as soon as you open the chat.
- **Falling behind today's target.** If the team is behind pace on today's video output, Bucky will mention it.
