// The leaderboard (popup "leaderboard"), opened from the coins in the top bar.
// Players by chips (a crown for a leader with chips, you
// highlighted, away players dimmed; the dealer can remove an away player, no confirm),
// "Rounds played" newest first, and "📋 Copy for Jira": the latest result per ticket as
// "KEY\tN pts\tSummary" lines through useGame().copy (an in-game dialog when the clipboard
// says no). Rounds scroll in their own ScrollArea.
import type { RoundResult } from "../../../../shared/protocol.ts";
import { Button, cx, Dialog, ScrollArea } from "../../ui/index.ts";
import { useGame, useMe, usePopup, useRoom } from "../game.tsx";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import { boardRows, jiraExport, roundOutcome, roundsNewestFirst, type BoardRow } from "./model.ts";
import s from "./LeaderboardDialog.module.css";

export function LeaderboardDialog() {
  const { actions, copy, dealerDo } = useGame();
  const popup = usePopup("leaderboard");
  const room = useRoom();
  const me = useMe();
  if (!room) return null;

  const rows = boardRows(room.players, me?.id, me?.isDealer ?? false);
  const history = room.history;
  const copyForJira = () => {
    const out = jiraExport(history);
    void copy.copy(out.text, { done: out.done, title: "Copy these into Jira" });
  };

  return (
    <Dialog open={popup.open} onClose={popup.close} title="Leaderboard" width="md"
      actions={<>
        {history.length > 0 && <Button onPress={copyForJira}>📋 Copy for Jira</Button>}
        {/* focus starts here, not on a "remove" */}
        <Button variant="primary" data-autofocus onPress={popup.close}>Done</Button>
      </>}>
      <ol className={s.board} aria-label="Players by coins">
        {rows.map((row) => (
          <Row key={row.player.id} row={row} onRemove={() => dealerDo(actions.dealer.kick(row.player.id))} />
        ))}
      </ol>

      {history.length > 0 && (
        <section className={s.rounds} aria-label="Rounds played">
          <h3 className={s.heading}>Rounds played <span className={s.count}>{history.length}</span></h3>
          <ScrollArea label="Rounds played, newest first" className={s.scroll}>
            <ul className={s.history}>
              {roundsNewestFirst(history).map((h, i) => <Round key={`${history.length - i}`} round={h} />)}
            </ul>
          </ScrollArea>
        </section>
      )}
    </Dialog>
  );
}

function Row({ row, onRemove }: { row: BoardRow; onRemove: () => void }) {
  const { player } = row;
  return (
    <li className={cx(s.row, row.me && s.me, row.away && s.away)}>
      <span className={cx(s.rank, row.rank === "👑" && s.crown)}>{row.rank}</span>
      <span className={s.dim}><PlayerDot player={player} /></span>
      <span className={cx(s.name, s.dim)} title={row.name}>
        {player.name}
        {player.isDealer && <span className={s.tag}> · dealer</span>}
        {row.away && <span className={s.tag}> · away</span>}
      </span>
      {row.me && <span className={s.you}>you</span>}
      <span className={cx(s.chips, s.dim)} aria-label={`${player.chips} coins`}>
        <span className={s.coin} aria-hidden />{player.chips}
      </span>
      {row.removable && (
        <Button size="sm" shape="pill" variant="danger" className={s.remove} aria-label={`Remove ${player.name}`} onPress={onRemove}>
          remove
        </Button>
      )}
    </li>
  );
}

function Round({ round }: { round: RoundResult }) {
  return (
    <li className={s.round} title={round.summary}>
      <span className={s.key}>{round.key}</span>
      <span className={s.arrow} aria-hidden>→</span>
      <span className={s.points}>{round.finalPoints} pts</span>
      <span className={s.sep} aria-hidden>·</span>
      <span className={cx(s.outcome, round.houseWon && s.house, !round.winners.length && s.nobody)}>{roundOutcome(round)}</span>
    </li>
  );
}
