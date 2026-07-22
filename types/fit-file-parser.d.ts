declare module "fit-file-parser" {
  interface FitParserOptions {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
    mode?: string;
  }

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(
      content: Uint8Array,
      callback: (error: Error | undefined, data: Record<string, unknown>) => void,
    ): void;
  }
}
