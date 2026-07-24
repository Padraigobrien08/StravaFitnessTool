import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STRAVA_OPTIONAL_FEATURES,
  STRAVA_SCOPE_GROUPS,
  DEFAULT_STRAVA_SCOPES,
} from "@/lib/strava/mcpScopes";

export function StravaMcpScopesCard({ connected }: { connected: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strava & MCP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-zinc-400">
          The built-in StrideIQ MCP server uses your app OAuth token — connect Strava here, then
          configure Claude/Cursor with <code className="text-zinc-300">STRIDEIQ_API_KEY</code>. See{" "}
          <span className="text-teal-400">docs/MCP_INTEGRATION.md</span>.
        </p>
        <p className="text-zinc-500">
          Status:{" "}
          <span className={connected ? "text-teal-400" : "text-amber-400"}>
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
              <li key={g.scope} className="rounded-lg border border-zinc-800 p-3">
                <p className="font-mono text-xs text-teal-400/90">{g.scope}</p>
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
      </CardContent>
    </Card>
  );
}
