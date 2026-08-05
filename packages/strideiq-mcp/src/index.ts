#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerIntelligenceTools } from "./register-intelligence.js";
import { registerStravaTools } from "./strava-tools.js";
import { registerCompositeTools } from "./composite-tools.js";
import { registerMcpResources } from "./resources.js";

const server = new McpServer({
  name: "strideiq",
  version: "0.5.0",
});

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

registerIntelligenceTools(server, textResult);
registerStravaTools(server, textResult);
registerCompositeTools(server, textResult);
registerMcpResources(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StrideIQ MCP server running on stdio");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
