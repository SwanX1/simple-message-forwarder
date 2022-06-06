import chalk from "chalk";
import { Client, ClientOptions as DiscordClientOptions } from "discord.js";
import { getChildLogger, isHeartbeatLog, LoggerInterface } from "./util/Util";

export interface ClientOptions extends DiscordClientOptions {
  logger?: LoggerInterface;
}

export class Bot extends Client {
  private logger: LoggerInterface = this.setLogger();

  public constructor(options: ClientOptions) {
    super(options);

    this.setLogger(options.logger);

    this.on("debug", message => {
      if (!isHeartbeatLog(message)) {
        const matches = message.match(/^\[WS => (Shard \d+|Manager)\] /);
        let prefix: string;
        if (matches) {
          prefix = chalk`{gray [${matches[0].slice(7, -2)}]}`;
          message = message.slice(matches[0].length);
        } else {
          prefix = "";
          message = message;
        }

        for (const line of message.split("\n")) {
          this.logger.debug(`${prefix}${prefix ? " " : ""}${line}`);
        }
      }
    });

    this.on("ready", () => {
      this.logger.info(chalk`Logged in as {cyan ${(this as Client<true>).user.username}}`);
    });
  }

  public setLogger(logger?: LoggerInterface): LoggerInterface {
    if (logger) {
      this.logger = getChildLogger(logger, "Discord", 34, 90);
    } else {
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
      };
    }

    return this.logger;
  }

  public getLogger(): LoggerInterface {
    return this.logger;
  }
}
