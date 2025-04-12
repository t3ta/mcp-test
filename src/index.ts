/**
 * Main entry point for the MCP Test Library
 * Exports all public components
 */

// Core exports
export { MCPTestClient } from './core/client';
export { MCPServerManager } from './core/server';
export {
  MCPTestClientOptions,
  MCPServerOptions,
  MCPToolResponse,
  MCPResource,
  MCPSchema,
  MCPToolSchema,
  MCPResourceSchema,
  RequestOptions,
  ValidationResult,
  TransportAdapter,
  MCPTestPlugin,
  PluginContext,
  Logger,
  LogLevel,
  MCPTestError,
  ConnectionError,
  AuthenticationError,
  ToolExecutionError,
  ServerStartError,
  TimeoutError
} from './core/types';

// Utility exports
export { AsyncHelpers } from './utils/async';
export { ResponseValidator } from './utils/validators';
export { TestFixtures } from './utils/fixtures';

// Adapter exports
export { HTTPAdapter, HTTPAdapterOptions } from './adapters/transport/http';

// Version information
export const VERSION = '0.1.0';
