# Point Poker TODO

## 💰 Money system (needs a rethink)
- [ ] Coins become spendable: you can run out, so they're no longer only a score.
- [ ] Everyone starts with about 10 coins.
- [ ] Throwing a coin at someone (the flick) costs you that coin and the person you hit gets it.
- [ ] "The house never gets money." Decide how the house and dealer fit in. Today, when nobody is within one card, the dealer collects the pot.
- Open questions:
  - Where does the pot come from? Do players pay to play a card (an ante), or is the pot still just the sum of the card values?
  - What happens when someone hits 0? Can they still vote, and do they get a bailout?
  - Does the house keep its own bank that pays out, or should it never touch money at all?
  - Do coins carry over between tables or sessions? Right now everything resets when the server restarts.

## 🎩 Dealer controls (built, NOT deployed yet)
- [x] 🎩 Dealer panel: restart vote, skip ticket (no payout, deals the next one in the queue), cancel round (no payout, clears the ticket), pick a ticket.
- [x] Player list with Kick, which also works on connected players. A kicked browser can't rejoin.
- [x] "I play a card too" toggle in the panel.
- [ ] Deploy. This wipes open tables, so only do it when nobody is mid-session.

## 📝 Don't lose pointed tickets (built, NOT deployed yet)
- [x] Every pointed ticket is logged to the server logs (`fly logs`) as `POINTED {...}`, with its points and everyone's votes.
- [x] "📋 Copy for Jira" button in the leaderboard's Rounds played. It copies each ticket with its final points.
- [x] History holds up to 100 rounds instead of 12.
- [ ] Add a read-only way to fetch a table's history that doesn't take a seat (the "history check" bean problem).
- [ ] Optional: keep round history somewhere permanent (a Fly volume or small database), because Fly only keeps recent logs.
- [ ] Maybe: an end-of-session recap to paste into Slack.

## 🙋 Players
- [ ] A "Leave table" button, so people (and bots) can free their seat.

## 🎧 Zoom / Slack huddles integration (idea)
- [ ] Explore options, for example:
  - a Slack slash command or link unfurl that opens or announces a table,
  - posting round results to a Slack channel,
  - running as a Zoom App inside meetings,
  - using voice activity from the call instead of the browser mic.
- [ ] Pick one and size it.

## 🚢 Housekeeping
- [ ] Commit and push the latest changes to GitHub (1–8 deck without 0, dealer controls, logging).
- [ ] Turn off the Tailscale Funnel and local server now that Fly is the real link.
- [ ] Add `~/.fly/bin` to PATH.

## Later
- [ ] The user's upcoming list of improvements.
