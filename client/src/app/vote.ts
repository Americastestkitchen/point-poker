// Your card. You see it the moment you play it. While the server hasn't
// answered, a view it sent before your vote arrived can't put your old card
// back; once every vote you sent is answered, your view decides again. (The
// server sends the view with your vote before it answers, so by then the
// view is up to date.)
//
// A new round arriving while a vote is out doesn't clear it either: the
// server counts a vote in whatever round is open when it gets there, and it
// handles each socket's messages in order, so that vote is about to land in
// the new round. If the new phase takes no votes, the answer hands your card
// back to the view.

export interface VoteState {
  /** The card you see in your hand as played. */
  myVote: number | null;
  /** Votes you've sent that the server hasn't answered yet. */
  votesInFlight: number;
}

export type VoteAction =
  | { t: "played"; value: number }
  /** The server answered one of your votes, yes or no. `server` is your card in the latest view. */
  | { t: "answered"; server: number | null }
  /** A new view arrived; `server` is your card in it. */
  | { t: "view"; server: number | null };

export function vote(s: VoteState, a: VoteAction): VoteState {
  switch (a.t) {
    case "played":
      return { myVote: a.value, votesInFlight: s.votesInFlight + 1 };
    case "answered": {
      const votesInFlight = Math.max(0, s.votesInFlight - 1);
      return votesInFlight ? { ...s, votesInFlight } : { myVote: a.server, votesInFlight };
    }
    case "view":
      return s.votesInFlight || s.myVote === a.server ? s : { ...s, myVote: a.server };
    default:
      return a satisfies never;
  }
}
