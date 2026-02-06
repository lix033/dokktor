import * as winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { getCorrelationId } from "./core/request-context";

export class LoggerService {
  private logger: winston.Logger;

  constructor(private provider: string = "doktor-service") {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const isProd = process.env.NODE_ENV === "production";

    const baseFormat = winston.format.printf((info) => {
      const correlation = getCorrelationId() ?? "-";
      return `${info.timestamp}; ${correlation}; ${info.level.toUpperCase()}; ${this.provider}; ${info.message}`;
    });

    const transports: winston.transport[] = [
      // Toujours console (stdout)
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: !isProd }),
          winston.format.timestamp({ format: "DD/MM/YYYY HH:mm:ss" }),
          baseFormat
        )
      })
    ];

    // Logs fichiers UNIQUEMENT hors prod
    if (!isProd) {
      const logsPath = process.env.LOGS_PATH ?? "./logs";

      transports.push(
        new DailyRotateFile({
          filename: `${logsPath}/%DATE%.log`,
          datePattern: "YYYY-MM-DD",
          zippedArchive: false,
          maxSize: process.env.LOG_MAXSIZE ?? "5m",
          maxFiles: process.env.LOG_MAXFILES ?? "30d",
          format: winston.format.combine(
            winston.format.timestamp({ format: "DD/MM/YYYY HH:mm:ss" }),
            baseFormat
          )
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL ?? "info",
      transports
    });
  }

  info(message: string): void {
    this.logger.info(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }

  error(message: string): void {
    this.logger.error(message);
  }
}
