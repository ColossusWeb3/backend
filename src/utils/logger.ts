enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
  }
  
  class Logger {
    private level: LogLevel;
    private context: string;
  
    constructor(context: string, level: string = 'info') {
      this.context = context;
      this.level = this.parseLevel(level);
    }
  
    private parseLevel(level: string): LogLevel {
      switch (level.toLowerCase()) {
        case 'debug': return LogLevel.DEBUG;
        case 'info': return LogLevel.INFO;
        case 'warn': return LogLevel.WARN;
        case 'error': return LogLevel.ERROR;
        default: return LogLevel.INFO;
      }
    }
  
    private formatMessage(message: string): string {
      const timestamp = new Date().toISOString();
      return `[${timestamp}] [${this.context}] ${message}`;
    }
  
    debug(message: string, ...args: any[]): void {
      if (this.level <= LogLevel.DEBUG) {
        console.debug(this.formatMessage(message), ...args);
      }
    }
  
    info(message: string, ...args: any[]): void {
      if (this.level <= LogLevel.INFO) {
        console.info(this.formatMessage(message), ...args);
      }
    }
  
    warn(message: string, ...args: any[]): void {
      if (this.level <= LogLevel.WARN) {
        console.warn(this.formatMessage(message), ...args);
      }
    }
  
    error(message: string, ...args: any[]): void {
      if (this.level <= LogLevel.ERROR) {
        console.error(this.formatMessage(message), ...args);
      }
    }
  }
  
  export function createLogger(context: string): Logger {
    return new Logger(context, process.env.LOG_LEVEL);
  }
  
  export default createLogger;