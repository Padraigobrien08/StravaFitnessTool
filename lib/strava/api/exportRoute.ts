import { stravaGetText } from "./client";

export interface RouteExportResult {
  filename: string;
  contentBase64: string;
  mimeType: string;
}

export async function exportRouteGpx(
  accessToken: string,
  routeId: number
): Promise<RouteExportResult> {
  const text = await stravaGetText(
    accessToken,
    `/routes/${routeId}/export_gpx`,
    `export gpx route ${routeId}`
  );
  return {
    filename: `route-${routeId}.gpx`,
    contentBase64: Buffer.from(text, "utf-8").toString("base64"),
    mimeType: "application/gpx+xml",
  };
}

export async function exportRouteTcx(
  accessToken: string,
  routeId: number
): Promise<RouteExportResult> {
  const text = await stravaGetText(
    accessToken,
    `/routes/${routeId}/export_tcx`,
    `export tcx route ${routeId}`
  );
  return {
    filename: `route-${routeId}.tcx`,
    contentBase64: Buffer.from(text, "utf-8").toString("base64"),
    mimeType: "application/vnd.garmin.tcx+xml",
  };
}
