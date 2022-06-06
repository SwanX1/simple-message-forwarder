import { coloredIdentifier, Logger, LoggerLevel } from "logerian";

export interface LoggerInterface {
  debug(...data: any[]): void;
  info(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;
  fatal(...data: any[]): void;
}

export function isHeartbeatLog(message: string): boolean {
  return /^\[WS => Shard \d+\] (\[HeartbeatTimer\] Sending a heartbeat.|Heartbeat acknowledged, latency of \d+ms.)$/.test(
    message
  );
}

export function getChildLogger(
  logger: LoggerInterface,
  name: string,
  identifierColor: number,
  bracketColor: number
): LoggerInterface {
  if (logger instanceof Logger) {
    const identifierPrefix = coloredIdentifier(identifierColor, bracketColor);
    return new Logger({
      identifier: name,
      identifierPrefix,
      streams: [
        {
          level: LoggerLevel.DEBUG,
          stream: logger,
        },
      ],
    });
  } else {
    return logger;
  }
}

export function formatBytes(bytes: number): string {
  return formatNumber(bytes, ["b", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]);
}

export function formatNumber(num: number, suffixes: string[] = ["", "k", "m", "b", "t"]): string {
  const index = Math.max(0, Math.min(suffixes.length - 1, Math.floor(num == 0 ? 0 : Math.log10(Math.abs(num)) / 3)));
  return `${Math.floor((num * 10) / 10 ** (3 * index)) / 10}${suffixes[index]}`;
}
