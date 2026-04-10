import type { PropsWithChildren } from "react";

export function HomieShell({ children }: PropsWithChildren) {
  return <div className="homie-shell">{children}</div>;
}
