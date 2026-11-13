import type { PublicPlayer } from "../../../../shared/protocol.ts";
import { cx } from "../../ui/index.ts";
import s from "./PlayerDot.module.css";

export interface PlayerDotProps {
  player: Pick<PublicPlayer, "name" | "look">;
  /** Filled in their colour (default); `false` is an empty ring, like "still thinking". */
  filled?: boolean;
  size?: "sm" | "md";
  /** The tooltip; their name by default. */
  title?: string;
}

/** A player as a dot in their bean's colour. */
export function PlayerDot({ player, filled = true, size = "md", title }: PlayerDotProps) {
  return (
    <span
      className={cx(s.dot, s[size], filled && s.filled)}
      style={{ "--dot": player.look.color }}
      title={title ?? player.name}
      role="img"
      aria-label={title ?? player.name}
    />
  );
}
