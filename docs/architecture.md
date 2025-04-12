# MCP Server E2E Test Library Design Specification

## 1. Library Overview

`mcp-test` is a general-purpose testing library designed to simplify end-to-end testing for Model Context Protocol (MCP) servers. Its goal is to facilitate automated testing of MCP servers and promote integration into CI/CD pipelines.

## 2. Architecture

### 2.1 Overall Structure

```
mcp-test/
├── core/                  # Core features
│   ├── client.ts          # MCP client
│   ├── server.ts          # Server management
│   └── types.ts           # Type definitions
├── utils/                 # Utilities
│   ├── validators.ts      # Validation
│   ├── fixtures.ts        # Test fixtures
│   └── async.ts           # Async helpers
├── adapters/              # Adapters
│   ├── test-frameworks/   # Test frameworks
│   │   ├── vitest.ts      # For Vitest
│   │   └── jest.ts        # For Jest
│   └── transport/         # Transport methods
│       ├── http.ts        # HTTP
│       └── websocket.ts   # WebSocket
└── config/                # Configuration
    └── defaults.ts        # Default configuration
```

### 2.2 Module Dependencies

```
                  +-------------+
                  |    index    |
                  +------+------+
                         |
          +------+-------+-------+------+
          |              |              |
+---------v--+    +------v-----+    +---v--------+
|    core     |    |   utils    |    |  adapters  |
+------+------+    +------+-----+    +---+--------+
       |                  |              |
       |                  |              |
       |            +-----v-----+        |
       +----------->|  config   |<-------+
                    +-----------+
```

## 3. Core Module

### 3.1 MCPTestClient

The central class responsible for communication with the MCP server.

```typescript
interface MCPTestClientOptions {
  baseUrl: string;
  authToken?: string;
  timeout?: number;
  headers?: Record<string, string>;
  transport?: "http" | "websocket";
  responseFormat?: "json" | "text" | "binary";
}

class MCPTestClient {
  constructor(options: MCPTestClientOptions);

  // Authentication
  setAuthToken(token: string): void;

  // Tool operations
  async callTool<T = any>(
    toolName: string,
    params: any
  ): Promise<MCPToolResponse<T>>;
  async callToolWithStream(
    toolName: string,
    params: any
  ): AsyncGenerator<any, void, unknown>;

  // Resource operations
  async getResources(): Promise<MCPResource[]>;
  async getResource(resourceId: string): Promise<MCPResource>;

  // Schema operations
  async getSchema(): Promise<MCPSchema>;

  // Low-level API
  async request<T = any>(path: string, options?: RequestOptions): Promise<T>;
}
```

### 3.2 MCPServerManager

Class responsible for starting, stopping, and monitoring the MCP server.

```typescript
interface MCPServerOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  port?: number;
  startupTimeout?: number;
  shutdownTimeout?: number;
  // Note: HTTP health check options (healthCheckPath, healthCheckInterval) have been removed.
  // Server readiness is now determined by process status and startup timeout.
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

class MCPServerManager {
  constructor(options: MCPServerOptions);

  // Server control
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async restart(): Promise<void>;

  // Status check
  isRunning(): boolean;
  async waitForReady(): Promise<void>;

  // Events
  onStart(callback: () => void): void;
  onStop(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
}
```

### 3.3 Type Definitions

```typescript
// MCP response type
interface MCPToolResponse<T = any> {
  status: "success" | "error" | "accepted";
  result?: T;
  error?: string;
  taskId?: string;
  details?: any;
}

// MCP resource type
interface MCPResource {
  id: string;
  type: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

// MCP schema type
interface MCPSchema {
  tools: MCPToolSchema[];
  resources: MCPResourceSchema[];
}

interface MCPToolSchema {
  name: string;
  description?: string;
  parameters: any;
  returns?: any;
}

interface MCPResourceSchema {
  type: string;
  description?: string;
  properties: Record<string, any>;
}
```

## 4. Utility Module

### 4.1 ResponseValidator

Utility to assist with response validation.

```typescript
class ResponseValidator {
  static validateToolResponse(response: any, schema?: any): ValidationResult;
  static validateResource(resource: any, schema?: any): ValidationResult;
  static validateSchema(schema: any): ValidationResult;
  static createSchemaValidator(schema: any): (data: any) => ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
```

### 4.2 TestFixtures

Provides reusable test data.

```typescript
class TestFixtures {
  static getToolRequests(toolName: string): any[];
  static getToolResponses(toolName: string): any[];
  static getResources(type?: string): MCPResource[];
  static getSchema(): MCPSchema;
  static createCustomFixture<T>(template: T, overrides?: Partial<T>): T;
}
```

### 4.3 AsyncHelpers

Utility to assist with asynchronous testing.

```typescript
class AsyncHelpers {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options?: { timeout?: number; interval?: number }
  ): Promise<void>;

  static async pollUntil<T>(
    fn: () => Promise<T>,
    predicate: (result: T) => boolean,
    options?: { maxAttempts?: number; interval?: number }
  ): Promise<T>;

  static async collectStreamResponses<T>(
    stream: AsyncGenerator<T, void, unknown>,
    options?: { timeout?: number; maxItems?: number }
  ): Promise<T[]>;
}
```

## 5. Adapter Module

### 5.1 Test Framework Adapters

Integration features for various test frameworks.

```typescript
// Vitest adapter
class VitestAdapter {
  static setupMCPServer(options: MCPServerOptions): void;
  static createMCPTest(
    client: MCPTestClient
  ): (name: string, fn: (t: any) => Promise<void>) => void;
  static mockMCPResponse(
    client: MCPTestClient,
    toolName: string,
    response: any
  ): void;
}

// Jest adapter
class JestAdapter {
  static setupMCPServer(options: MCPServerOptions): void;
  static createMCPTest(
    client: MCPTestClient
  ): (name: string, fn: (done: jest.DoneCallback) => void) => void;
  static mockMCPResponse(
    client: MCPTestClient,
    toolName: string,
    response: any
  ): void;
}
```

### 5.2 Transport Adapters

Supports different communication methods.

```typescript
interface TransportAdapter {
  request<T = any>(url: string, options: RequestOptions): Promise<T>;
  openStream(
    url: string,
    options: RequestOptions
  ): AsyncGenerator<any, void, unknown>;
  close(): void;
}

class HTTPAdapter implements TransportAdapter {
  constructor(options?: HTTPAdapterOptions);
  request<T = any>(url: string, options: RequestOptions): Promise<T>;
  openStream(
    url: string,
    options: RequestOptions
  ): AsyncGenerator<any, void, unknown>;
  close(): void;
}

class WebSocketAdapter implements TransportAdapter {
  constructor(options?: WebSocketAdapterOptions);
  request<T = any>(url: string, options: RequestOptions): Promise<T>;
  openStream(
    url: string,
    options: RequestOptions
  ): AsyncGenerator<any, void, unknown>;
  close(): void;
}
```

## 6. Configuration Module

### 6.1 Default Configuration

```typescript
const defaultConfig = {
  client: {
    baseUrl: "http://localhost:6277",
    timeout: 10000,
    transport: "http",
    responseFormat: "json",
  },
  server: {
    startupTimeout: 5000,
    shutdownTimeout: 3000,
    // healthCheckPath and healthCheckInterval removed from default config
  },
  async: {
    defaultTimeout: 30000,
    defaultInterval: 500,
    maxAttempts: 10,
  },
};
```

### 6.2 Configuration Manager

```typescript
class ConfigManager {
  static getConfig(): Config;
  static setConfig(config: Partial<Config>): void;
  static resetConfig(): void;
  static loadFromFile(path: string): void;
  static loadFromEnv(prefix?: string): void;
}
```

## 7. Usage Examples

### 7.1 Basic Usage Example

```typescript
import { MCPTestClient, MCPServerManager } from "mcp-test";

// Create client
const client = new MCPTestClient({
  baseUrl: "http://localhost:6277",
});

// Start server
const server = new MCPServerManager({
  command: "node",
  args: ["src/mcp-server.js"],
  env: { PORT: "6277" },
});

// Run test
async function runTest() {
  try {
    // Start server
    await server.start();
    await server.waitForReady();

    // Call tool
    const result = await client.callTool("echo", { message: "Hello, MCP!" });
    console.log(result);

    // Get resources
    const resources = await client.getResources();
    console.log(resources);
  } finally {
    // Stop server
    await server.stop();
  }
}

runTest().catch(console.error);
```

### 7.2 Example Integration with Vitest

```typescript
import { MCPTestClient, MCPServerManager, VitestAdapter } from "mcp-test";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test configuration
const client = new MCPTestClient({
  baseUrl: "http://localhost:6277",
});

const server = new MCPServerManager({
  command: "node",
  args: ["src/mcp-server.js"],
  env: { PORT: "6277" },
});

// Setup and teardown
beforeAll(async () => {
  await server.start();
  await server.waitForReady();
});

afterAll(async () => {
  await server.stop();
});

// Test cases
describe("MCP Server Tests", () => {
  it("should execute echo tool correctly", async () => {
    const result = await client.callTool("echo", { message: "Hello, MCP!" });

    expect(result.status).toBe("success");
    expect(result.result).toBe("Hello, MCP!");
  });

  it("should retrieve resources", async () => {
    const resources = await client.getResources();

    expect(resources).toBeInstanceOf(Array);
    expect(resources.length).toBeGreaterThan(0);
  });
});
```

## 8. Extensibility

### 8.1 Plugin System

```typescript
interface MCPTestPlugin {
  name: string;
  initialize(context: PluginContext): void;
  beforeRequest?(request: RequestOptions): RequestOptions;
  afterResponse?(response: any): any;
  beforeServerStart?(options: MCPServerOptions): MCPServerOptions;
  afterServerStop?(): void;
}

class PluginManager {
  static register(plugin: MCPTestPlugin): void;
  static unregister(pluginName: string): void;
  static getPlugins(): MCPTestPlugin[];
}
```

### 8.2 Custom Transport

```typescript
class CustomTransportAdapter implements TransportAdapter {
  constructor(options?: any);
  request<T = any>(url: string, options: RequestOptions): Promise<T>;
  openStream(
    url: string,
    options: RequestOptions
  ): AsyncGenerator<any, void, unknown>;
  close(): void;
}

// Registration
TransportRegistry.register("custom", CustomTransportAdapter);

// Usage
const client = new MCPTestClient({
  baseUrl: "custom://endpoint",
  transport: "custom",
});
```

## 9. Error Handling

```typescript
class MCPTestError extends Error {
  constructor(
    message: string,
    options?: { cause?: Error; code?: string; details?: any }
  );

  code: string;
  details?: any;
  cause?: Error;
}

// Specific error classes
class ConnectionError extends MCPTestError {}
class AuthenticationError extends MCPTestError {}
class ToolExecutionError extends MCPTestError {}
class ServerStartError extends MCPTestError {}
class TimeoutError extends MCPTestError {}
```

## 10. Logging

```typescript
enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  setLevel(level: LogLevel): void;
}

class ConsoleLogger implements Logger {
  constructor(level?: LogLevel);
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  setLevel(level: LogLevel): void;
}

// Set default logger
LogManager.setLogger(new ConsoleLogger(LogLevel.INFO));
```

## 11. Package Information

```json
{
  "name": "mcp-test",
  "version": "0.1.0",
  "description": "E2E testing library for Model Context Protocol (MCP) servers",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "lint": "eslint src",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "testing", "e2e", "model-context-protocol"],
  "author": "",
  "license": "MIT",
  "peerDependencies": {
    "vitest": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsup": "^7.0.0",
    "eslint": "^8.0.0",
    "vitest": "^1.0.0"
  }
}
```
