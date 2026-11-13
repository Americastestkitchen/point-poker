// SLICE: round. The action dock (region "dock", bottom centre). Keep it within the inherited
// --dock-max height so the table stays clear; the toasts are lifted above that height.
// Waiting: "+ Add a Jira ticket" (dealer → popup "picker") or "The dealer is picking a ticket".
// Voting: your hand of cards (CARD_SUIT, cardValues(settings.deck); actions.vote(v); hover
// sound) with "You picked N", and for the dealer Reveal (dealerDo(actions.dealer.reveal())),
// "Restart vote" (dealerDo(deal)) and who we're waiting on (names()).
// Revealed / settled: the dealer's settle hand (tally, favourite: "most votes", vote dots;
// dealerDo(actions.dealer.settle(v))), "Vote again", "Next ticket →" (ticketLoad.run(
// actions.dealer.next(), "Dealing the next ticket…")) or "+ Next ticket" (popup "picker"),
// "Open in Jira ↗"; players see the spread of votes.
// Legacy parity: hud.ts renderDock() and cardHtml().
// Props: none.
import s from "./ActionDock.module.css";

export function ActionDock() {
  return <div className={s.placeholder}>ActionDock · round</div>;
}
