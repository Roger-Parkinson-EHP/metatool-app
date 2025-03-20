/**
 * Resource Tracking Logger
 * 
 * Provides logging utilities for resource tracking components.
 * Helps with debugging and monitoring the resource prioritization process.
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Default log level - can be overridden at runtime
let currentLogLevel = LogLevel.INFO;

/**
 * Set the current log level for resource tracking
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Format a log message with timestamp and component name
 */
function formatLogMessage(component: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${component}] ${message}`;
}

/**
 * Logger class for resource tracking components
 */
export class ResourceLogger {
  private componentName: string;
  
  /**
   * Create a new logger for a component
   * 
   * @param componentName Name of the component using this logger
   */
  constructor(componentName: string) {
    this.componentName = componentName;
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.debug(
        formatLogMessage(this.componentName, message),
        ...args
      );
    }
  }
  
  /**
   * Log an info message
   */
  info(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.info(
        formatLogMessage(this.componentName, message),
        ...args
      );
    }
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(
        formatLogMessage(this.componentName, message),
        ...args
      );
    }
  }
  
  /**
   * Log an error message
   */
  error(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(
        formatLogMessage(this.componentName, message),
        ...args
      );
    }
  }
  
  /**
   * Log resource operation with timing
   */
  async timeOperation<T>(
    operationName: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    this.debug(`Starting operation: ${operationName}`);
    
    try {
      const result = await operation();
      const duration = Math.round(performance.now() - startTime);
      this.debug(`Completed operation: ${operationName} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.error(`Failed operation: ${operationName} (${duration}ms)`, error);
      throw error;
    }
  }
}

export default ResourceLogger;
