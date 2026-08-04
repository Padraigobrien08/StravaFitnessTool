import { Panel, Eyebrow } from "@/components/console/console-kit";
import {
  STRAVA_OPTIONAL_FEATURES,
  STRAVA_SCOPE_GROUPS,
  DEFAULT_STRAVA_SCOPES,
} from "@/lib/strava/mcpScopes";

export function StravaMcpScopesCard({ connected }: { connected: boolean }) {
  return (
    <Panel>
      <Eyebrow className="mb-3">Strava & MCP</Eyebrow>
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          The built-in StrideIQ MCP server uses your app OAuth token. Connect Strava here, then
          configure Claude/Cursor with <code className="text-zinc-300">STRIDEIQ_API_KEY</code>. See{" "}
          <span className="text-accent">docs/MCP_INTEGRATION.md</span>.
        </p>
        <p className="text-zinc-500">
          Status:{" "}
          <span className={connected ? "font-medium text-accent" : "font-medium text-amber-400"}>
            {connected ? "Connected" : "Not connected"}
          </span>
          {connected && (
            <>
              {" "}
              · Scopes requested: <code className="text-zinc-400">{DEFAULT_STRAVA_SCOPES}</code>
            </>
          )}
        </p>

        <div>
          <h3 className="mb-2 font-medium text-zinc-300">OAuth scopes</h3>
          <ul className="space-y-3">
            {STRAVA_SCOPE_GROUPS.map((g) => (
              <li
                key={g.scope}
                className="rounded-lg bg-[var(--surface-subdued)] p-3 ring-1 ring-[var(--border-subtle)]"
              >
                <p className="font-mono text-xs text-accent">{g.scope}</p>
                <p className="mt-1 text-zinc-500">{g.description}</p>
                <p className="mt-2 text-xs text-zinc-600">Tools: {g.tools.join(", ")}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-medium text-zinc-300">Feature groups</h3>
          <ul className="space-y-2 text-zinc-500">
            {STRAVA_OPTIONAL_FEATURES.map((f) => (
              <li key={f.feature}>
                <span className="text-zinc-400">{f.feature}</span>
                {"note" in f && f.note ? (
                  <span className="block text-xs text-zinc-600">{f.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
