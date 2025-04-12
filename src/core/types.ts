import { ChildProcess } from 'child_process';

/**
 * Core type definitions for the MCP Test Library
 */

/**
 * MCP Tool Response interface
 * Represents the standard response format from MCP tool calls
 */
export interface MCPToolResponse<T = any> {
  /** Status of the tool execution */
  status: 'success' | 'error' | 'accepted';
  /** Result data when status is success */
  result?: T;
  /** Error message when status is error */
  error?: string;
  /** Task ID for asynchronous operations when status is accepted */
  taskId?: string;
  /** Additional details about the response */
  details?: any;
}

/**
 * MCP Resource interface
 * Represents a resource exposed by an MCP server
 */
export interface MCPResource {
  /** Unique identifier for the resource */
  id: string;
  /** Resource type */
  type: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * MCP Schema interface
 * Represents the schema of tools and resources exposed by an MCP server
 */
export interface MCPSchema {
  /** Available tools */
  tools: MCPToolSchema[];
  /** Available resources */
  resources: MCPResourceSchema[];
}

/**
 * MCP Tool Schema interface
 * Describes the schema of a tool exposed by an MCP server
 */
export interface MCPToolSchema {
  /** Tool name */
  name: string;
  /** Optional description */
  description?: string;
  /** Tool parameters schema */
  parameters: any;
  /** Optional return value schema */
  returns?: any;
}

/**
 * MCP Resource Schema interface
 * Describes the schema of a resource type exposed by an MCP server
 */
export interface MCPResourceSchema {
  /** Resource type */
  type: string;
  /** Optional description */
  description?: string;
  /** Resource properties schema */
  properties: Record<string, any>;
}

/**
 * Request options for MCP client
 */
export interface RequestOptions {
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: any;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Response format */
  responseFormat?: 'json' | 'text' | 'binary';
}

/**
 * MCP Test Client options
 */
export interface MCPTestClientOptions {
  /** Base URL of the MCP server */
  baseUrl: string;
  /** Optional authentication token */
  authToken?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default headers to include in all requests */
  headers?: Record<string, string>;
  /** Transport mechanism */
  transport?: 'http' | 'websocket';
  /** Default response format */
  responseFormat?: 'json' | 'text' | 'binary';
}

/**
 * MCP Server options
 */
export interface MCPServerOptions {
  /** Command to start the server */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Server port */
  port?: number;
  /** Timeout for server startup in milliseconds */
  startupTimeout?: number;
  /** Timeout for server shutdown in milliseconds */
  shutdownTimeout?: number;
  /** Path for health check */
  healthCheckPath?: string;
  /** Interval for health checks in milliseconds */
  healthCheckInterval?: number;
  /** Callback for stdout data */
  onStdout?: (data: string) => void;
  /** Callback for stderr data */
  onStderr?: (data: string) => void;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors?: string[];
}

/**
 * Transport adapter interface
 */
export interface TransportAdapter {
  /**
   * Send a request to the MCP server
   * @param url Request URL
   * @param options Request options
   * @returns Promise resolving to the response
   */
  request<T = any>(url: string, options: RequestOptions): Promise<T>;
  
  /**
   * Open a stream to the MCP server
   * @param url Stream URL
   * @param options Request options
   * @returns AsyncGenerator yielding stream events
   */
  openStream(url: string, options: RequestOptions): AsyncGenerator<any, void, unknown>;
  
  /**
   * Close the transport
   */
  close(): void;
}

/**
 * MCP Test Plugin interface
 */
export interface MCPTestPlugin {
  /** Plugin name */
  name: string;
  
  /**
   * Initialize the plugin
   * @param context Plugin context
   */
  initialize(context: PluginContext): void;
  
  /**
   * Hook called before sending a request
   * @param request Request options
   * @returns Modified request options
   */
  beforeRequest?(request: RequestOptions): RequestOptions;
  
  /**
   * Hook called after receiving a response
   * @param response Response data
   * @returns Modified response data
   */
  afterResponse?(response: any): any;
  
  /**
   * Hook called before starting the server
   * @param options Server options
   * @returns Modified server options
   */
  beforeServerStart?(options: MCPServerOptions): MCPServerOptions;
  
  /**
   * Hook called after stopping the server
   */
  afterServerStop?(): void;
}

/**
 * Plugin context interface
 */
export interface PluginContext {
  /** Configuration manager */
  config: any;
  /** Logger */
  logger: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  /**
   * Log debug message
   * @param message Message to log
   * @param args Additional arguments
   */
  debug(message: string, ...args: any[]): void;
  
  /**
   * Log info message
   * @param message Message to log
   * @param args Additional arguments
   */
  info(message: string, ...args: any[]): void;
  
  /**
   * Log warning message
   * @param message Message to log
   * @param args Additional arguments
   */
  warn(message: string, ...args: any[]): void;
  
  /**
   * Log error message
   * @param message Message to log
   * @param args Additional arguments
   */
  error(message: string, ...args: any[]): void;
  
  /**
   * Set log level
   * @param level Log level
   */
  setLevel(level: LogLevel): void;
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

/**
 * MCP Test Error class
 */
export class MCPTestError extends Error {
  /** Error code */
  code: string;
  /** Error details */
  details?: any;
  /** Original error that caused this error */
  cause?: Error;
  
  /**
   * Create a new MCP Test Error
   * @param message Error message
   * @param options Error options
   */
  constructor(message: string, options?: { cause?: Error; code?: string; details?: any }) {
    super(message);
    this.name = this.constructor.name;
    this.code = options?.code || 'UNKNOWN_ERROR';
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

/**
 * Connection error class
 */
export class ConnectionError extends MCPTestError {
  constructor(message: string, options?: { cause?: Error; details?: any }) {
    super(message, { ...options, code: 'CONNECTION_ERROR' });
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends MCPTestError {
  constructor(message: string, options?: { cause?: Error; details?: any }) {
    super(message, { ...options, code: 'AUTHENTICATION_ERROR' });
  }
}

/**
 * Tool execution error class
 */
export class ToolExecutionError extends MCPTestError {
  constructor(message: string, options?: { cause?: Error; details?: any }) {
    super(message, { ...options, code: 'TOOL_EXECUTION_ERROR' });
  }
}

/**
 * Server start error class
 */
export class ServerStartError extends MCPTestError {
  constructor(message: string, options?: { cause?: Error; details?: any }) {
    super(message, { ...options, code: 'SERVER_START_ERROR' });
  }
}

/**
 * Timeout error class
 */
export class TimeoutError extends MCPTestError {
  constructor(message: string, options?: { cause?: Error; details?: any }) {
    super(message, { ...options, code: 'TIMEOUT_ERROR' });
  }
}
