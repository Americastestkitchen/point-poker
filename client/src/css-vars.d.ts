// Inline styles may set CSS custom properties (style={{ "--tilt": "4deg" }}) without a cast.
import "react";

declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
