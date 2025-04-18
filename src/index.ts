/**
 * Main entry point for the MCP Test Library.
 * This module exports all public components needed for testing MCP servers.
 *
 * The library provides:
 * - Core client for interacting with MCP servers
 * - Server management utilities for testing
 * - Validation tools for requests and responses
 * - Asynchronous operation helpers
 * - Test fixtures for common testing scenarios
 */

// Core exports
export { MCPTestClient } from "./core/client";
export { MCPServerManager } from "./core/server";
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
} from "./core/types";

// Utility exports
export { AsyncHelpers } from "./utils/async";
export { ResponseValidator } from "./utils/validators";
export { MCPValidator, MCPValidationOptions } from "./utils/mcp-validators";
export { TestFixtures } from "./utils/fixtures";

// Note: HTTPAdapter is no longer used directly as we use SDK's transport

// SDK type exports
export {
  Client as SDKClient,
  SSEClientTransport as SDKTransport,
  TypedSDKClient
} from './utils/sdk-types';

// Version information
export const VERSION = "0.1.2";
