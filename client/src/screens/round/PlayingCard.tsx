// One playing card you can press: the value in the middle, its suit in the corners, a small
// tilt so the hand looks dealt. Self-contained (it knows nothing about rounds or the store), so
// the 3D hand (#7) can replace it without touching the dock.
import { useId, type KeyboardEvent } from "react";
import type { PublicPlayer } from "../../../../shared/protocol.ts";
import { cx, useFocusable } from "../../ui/index.ts";
import { names } from "../text.ts";
import { PlayerDot } from "../parts/PlayerDot.tsx";
import { cardFace } from "./card.ts";
import s from "./PlayingCard.module.css";

export interface PlayingCardProps {
  value: number;
  /** Lit up: the card you played, or the final call. */
  selected?: boolean;
  /** Faded back, because another card is lit. */
  dimmed?: boolean;
  /** A green ring and a ribbon saying so ("most votes"). */
  ribbon?: string;
  /** Who played it, as dots along the bottom edge. */
  voters?: readonly Pick<PublicPlayer, "id" | "name" | "look">[];
  /** Where it sits in the hand, for the deal-in stagger. */
  index?: number;
  onPress(): void;
  /** From the hand's useRoving(): arrow keys move between cards, one Tab stop. */
  roving: { ref: (el: HTMLElement | null) => void; tabIndex: number; onFocusCapture: () => void };
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

export function PlayingCard({
  value,
  selected = false,
  dimmed = false,
  ribbon,
  voters = [],
  index = 0,
  onPress,
  roving,
  onKeyDown,
}: PlayingCardProps) {
  const face = cardFace(value);
  const focus = useFocusable();
  const about = useId();
  const said = [
    ribbon,
    voters.length
      ? `${voters.length === 1 ? "1 vote" : `${voters.length} votes`}: ${names(voters.map((p) => p.name))}`
      : "",
  ]
    .filter(Boolean)
    .join(". ");
  const corner = (
    <>
      <span>{value}</span>
      <span>{face.glyph}</span>
    </>
  );
  return (
    <button
      type="button"
      {...focus}
      {...roving}
      onKeyDown={onKeyDown}
      className={cx(s.card, face.red && s.red, selected && s.selected, dimmed && s.dimmed, ribbon && s.suggested)}
      style={{ "--tilt": `${face.tilt}deg`, "--i": index }}
      aria-label={`${value} ${value === 1 ? "point" : "points"}`}
      aria-pressed={selected}
      aria-describedby={said ? about : undefined}
      onClick={onPress}
    >
      <span className={s.face} aria-hidden>
        <span className={cx(s.corner, s.tl)}>{corner}</span>
        <span className={s.suit}>{face.glyph}</span>
        <span className={s.num}>{value}</span>
        <span className={cx(s.corner, s.br)}>{corner}</span>
      </span>
      {ribbon && (
        <span className={s.ribbon} aria-hidden>
          {ribbon}
        </span>
      )}
      {voters.length > 0 && (
        <span className={s.votes} aria-hidden>
          {voters.map((p) => (
            <PlayerDot key={p.id} player={p} size="sm" />
          ))}
        </span>
      )}
      {said && (
        <span id={about} className={s.hidden}>
          {said}
        </span>
      )}
    </button>
  );
}
