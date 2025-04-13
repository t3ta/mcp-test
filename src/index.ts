/**
 * Main entry point for the MCP Test Library.
 * This module exports all public components needed for testing MCP (Model Context Protocol) servers.
 *
 * The library provides:
 * - Core client for interacting with MCP servers
 * - Server management utilities for testing
 * - Validation tools for requests and responses
 * - Asynchronous operation helpers
 * - Test fixtures for common testing scenarios
 * - Transport adapters for various communication methods
 *
 * @module mcp-test
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
export { MCPValidator, MCPValidationOptions } from './utils/mcp-validators';
export { TestFixtures } from './utils/fixtures';

// Adapter exports
export { HTTPAdapter, HTTPAdapterOptions } from './adapters/transport/http.js';
export { MCPClientAdapter } from './adapter/MCPClientAdapter.js';

// MCP SDK Client exports
export { MCPClient } from './client/MCPClient.js';
export { ValidatedMCPClient } from './client/ValidatedMCPClient.js';

/**
 * Current version of the MCP Test Library.
 * This version follows semantic versioning (major.minor.patch).
 *
 * @constant {string}
 */
export const VERSION = '0.1.2';
