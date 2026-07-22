import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchStravaApi } from "./client.js";

export function registerMcpResources(server: McpServer) {
  server.registerResource(
    "activity-gpx",
    new ResourceTemplate("strideiq://activity/{activityId}/gpx", {
      list: undefined,
    }),
    {
      description: "GPX file built from activity GPS streams",
      mimeType: "application/gpx+xml",
    },
    async (uri, { activityId }) => {
      const data = (await fetchStravaApi("workout_gpx", {
        id: String(activityId),
      })) as {
        contentBase64?: string;
        filename?: string;
      };
      const text = data.contentBase64
        ? Buffer.from(data.contentBase64, "base64").toString("utf-8")
        : "";
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/gpx+xml",
            text,
          },
        ],
      };
    },
  );
}
