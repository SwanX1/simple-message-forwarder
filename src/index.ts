import chalk from "chalk";
import { GuildBasedChannel, WebhookMessageOptions } from "discord.js";
import dotenv from "dotenv";
import { createWriteStream, ensureFile, readJSON } from "fs-extra";
import { coloredLog, getLoggerLevelName, Logger, LoggerLevel } from "logerian";
import { cpus, totalmem } from "os";
import path from "path";
import { Bot } from "./Bot";
import { formatBytes } from "./util/Util";

void (async function main() {
  dotenv.config({ path: path.join(__dirname, "../.env") });

  const logfile = path.join(__dirname, `../log/${new Date().toISOString()}.txt`);
  await ensureFile(logfile);

  const logger = new Logger({
    streams: [
      {
        level: process.env.ENVIRONMENT === "DEV" ? LoggerLevel.DEBUG : LoggerLevel.INFO,
        stream: process.stdout,
        prefix: coloredLog,
      },
      {
        level: LoggerLevel.DEBUG,
        stream: createWriteStream(logfile),
        prefix: (level: LoggerLevel) => `[${new Date().toISOString()}] [${getLoggerLevelName(level)}] `,
      },
    ],
  });

  if (typeof process.env.NODE_APP_INSTANCE !== "undefined") {
    logger.info(chalk`Instance\t{yellow ${process.env.NODE_APP_INSTANCE}}`);
  }
  logger.info(chalk`NodeJS\t{yellow ${process.version}}`);
  logger.info(chalk`OS\t{yellow ${process.platform} ${process.arch}}`);
  logger.info(chalk`CPUs\t{yellow ${cpus().length}}`);
  logger.info(chalk`Memory\t{yellow ${formatBytes(totalmem())}}`);

  logger.info("Loading config...");
  const config: { forwarding: { from: string; to: string }[] } = await readJSON(path.join(__dirname, "../config.json"));
  const forwardingMap: Map<string, string[]> = new Map();
  for (const { from, to } of config.forwarding) {
    const tos = forwardingMap.get(from) || [];
    tos.push(to);
    forwardingMap.set(from, tos);
  }

  const client = new Bot({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_WEBHOOKS"],
    logger,
  });

  client.on("messageCreate", async message => {
    if (client.user?.id && message.inGuild()) {
      const tos = forwardingMap.get(message.channel.id);
      if (tos) {
        const forwardedMessage: WebhookMessageOptions = {
          // content: `From **${message.author.username}**:\n` + (message.content ?? ""),
          content: message.content,
          embeds: message.embeds,
          files: message.attachments.map(a => a),
          avatarURL: message.author.avatarURL() ?? undefined,
          username: message.author.username,
        };

        for (const to of tos) {
          const channel = (await client.channels.fetch(to)) as GuildBasedChannel;
          if (channel && (channel as GuildBasedChannel).guild && channel.isText() && !channel.isThread()) {
            let webhooks;
            try {
              webhooks = await channel.fetchWebhooks();
            } catch (e) {
              logger.warn(chalk`Missing permissions to fetch webhooks in guild {yellow ${channel.id}}`);
              continue;
            }
            let webhook = webhooks.find(w => w.owner?.id === client.user?.id);
            if (!webhook) {
              logger.info(chalk`Couldn't find webhook for {yellow ${channel.id}}, creating new one`);
              try {
                ``;
                webhook = await channel.createWebhook(client.user?.username + "'s forwarded messages", {
                  avatar: client.user?.displayAvatarURL(),
                });
              } catch (e) {
                logger.warn(chalk`Couldn't create webhook for {yellow ${channel.id}}`, e);
                continue;
              }
            }
            logger.info(chalk`Forwarding message from {yellow ${message.channel.id}} to {yellow ${to}}`);
            webhook
              .send(forwardedMessage)
              .then(() => logger.info(chalk`Forwarded message from {yellow ${message.channel.id}} to {yellow ${to}}`))
              .catch(e =>
                logger.warn(
                  chalk`Failed to forward message from {yellow ${message.channel.id}} to {yellow ${to}}: ${e}`
                )
              );
          }
        }
      }
    }
  });

  client.login(process.env.DISCORD_API_KEY);

  for (const signal of ["SIGABRT", "SIGHUP", "SIGINT", "SIGQUIT", "SIGTERM", "SIGUSR1", "SIGUSR2", "SIGBREAK"]) {
    process.on(signal, () => {
      if (signal === "SIGINT" && process.stdout.isTTY) {
        // We clear the line to get rid of nasty ^C characters.
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }
      logger.info(chalk`Recieved signal {yellow ${signal}}`);
      process.exit();
    });
  }

  process.on("uncaughtException", err => {
    logger.fatal(chalk`An uncaught exception occurred: {red ${err.message}}`);
    err.stack?.split("\n").forEach((line, index) => index && logger.fatal(line)); // Skips index == 0
    process.exit(1);
  });

  process.on("exit", code => {
    logger.info(chalk`Exiting with code {yellow ${code}}`);
    client.destroy();
  });
})();
