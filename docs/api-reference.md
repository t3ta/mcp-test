# API Reference

This document provides detailed information about the MCP Test Library API.

## Core Components

### MCPTestClient

The main client for interacting with MCP servers during testing.

```typescript
import { MCPTestClient } from "mcp-test";

const client = new MCPTestClient({
  baseUrl: "http://localhost:6277",
  authToken: "optional-auth-token",
  timeout: 10000,
});
```

#### Constructor Options

| Option           | Type   | Description                                           | Default    |
| ---------------- | ------ | ----------------------------------------------------- | ---------- |
| `baseUrl`        | string | Base URL of the MCP server                            | (required) |
| `authToken`      | string | Authentication token                                  | undefined  |
| `timeout`        | number | Request timeout in milliseconds                       | 10000      |
| `headers`        | object | Default headers to include in all requests            | {}         |
| `transport`      | string | Transport mechanism ('http' or 'websocket')           | 'http'     |
| `responseFormat` | string | Default response format ('json', 'text', or 'binary') | 'json'     |

#### Methods

##### `setAuthToken(token: string): void`

Sets the authentication token for subsequent requests.

```typescript
client.setAuthToken("new-auth-token");
```

##### `async callTool<T = any>(toolName: string, params: any): Promise<MCPToolResponse<T>>`

Calls an MCP tool with the specified parameters.

```typescript
const result = await client.callTool("echo", { message: "Hello, MCP!" });
// { status: 'success', result: 'Hello, MCP!' }
```

##### `async *callToolWithStream(toolName: string, params: any): AsyncGenerator<any, void, unknown>`

Calls an MCP tool and receives streaming responses.

```typescript
const stream = client.callToolWithStream("streamingTool", { duration: 5000 });
for await (const event of stream) {
  console.log(event);
}
```

##### `async getResources(): Promise<MCPResource[]>`

Gets all resources from the MCP server.

```typescript
const resources = await client.getResources();
```

##### `async getResource(resourceId: string): Promise<MCPResource>`

Gets a specific resource by ID.

```typescript
const resource = await client.getResource("resource-123");
```

##### `async getSchema(): Promise<MCPSchema>`

Gets the MCP server schema.

```typescript
const schema = await client.getSchema();
```

##### `async request<T = any>(path: string, options?: RequestOptions): Promise<T>`

Sends a raw request to the MCP server.

```typescript
const result = await client.request("/custom/endpoint", {
  method: "POST",
  body: { key: "value" },
});
```

##### `close(): void`

Closes the client and cleans up resources.

```typescript
client.close();
```

### MCPServerManager

Manages MCP server instances for testing.

```typescript
import { MCPServerManager } from "mcp-test";

const server = new MCPServerManager({
  command: "node",
  args: ["src/mcp-server.js"],
  env: { PORT: "6277" },
});
```

#### Constructor Options

| Option                | Type     | Description                                 | Default       |
| --------------------- | -------- | ------------------------------------------- | ------------- |
| `command`             | string   | Command to start the server                 | (required)    |
| `args`                | string[] | Command arguments                           | []            |
| `env`                 | object   | Environment variables                       | {}            |
| `cwd`                 | string   | Working directory                           | process.cwd() |
| `port`                | number   | Server port                                 | 6277          |
| `startupTimeout`      | number   | Timeout for server startup in milliseconds  | 5000          |
| `shutdownTimeout`     | number   | Timeout for server shutdown in milliseconds | 3000          |
| `healthCheckPath`     | string   | Path for health check                       | '/health'     |
| `healthCheckInterval` | number   | Interval for health checks in milliseconds  | 1000          |
| `onStdout`            | function | Callback for stdout data                    | () => {}      |
| `onStderr`            | function | Callback for stderr data                    | () => {}      |

#### Methods

##### `async start(): Promise<void>`

Starts the MCP server.

```typescript
await server.start();
```

##### `async stop(): Promise<void>`

Stops the MCP server.

```typescript
await server.stop();
```

##### `async restart(): Promise<void>`

Restarts the MCP server.

```typescript
await server.restart();
```

##### `isRunning(): boolean`

Checks if the server is running.

```typescript
if (server.isRunning()) {
  console.log("Server is running");
}
```

##### `async waitForReady(): Promise<void>`

Waits for the server to be ready.

```typescript
await server.waitForReady();
```

##### `onStart(callback: () => void): void`

Registers a callback to be called when the server starts.

```typescript
server.onStart(() => {
  console.log("Server started");
});
```

##### `onStop(callback: () => void): void`

Registers a callback to be called when the server stops.

```typescript
server.onStop(() => {
  console.log("Server stopped");
});
```

##### `onError(callback: (error: Error) => void): void`

Registers a callback to be called when an error occurs.

```typescript
server.onError((error) => {
  console.error("Server error:", error);
});
```

## Utility Components

### AsyncHelpers

Provides utility functions for asynchronous testing.

```typescript
import { AsyncHelpers } from "mcp-test";
```

#### Methods

##### `static async waitForCondition(condition: () => boolean | Promise<boolean>, options?: WaitForConditionOptions): Promise<void>`

Waits for a condition to be true.

```typescript
await AsyncHelpers.waitForCondition(() => server.isRunning(), {
  timeout: 5000,
  interval: 100,
});
```

##### `static async pollUntil<T>(fn: () => Promise<T>, predicate: (result: T) => boolean, options?: PollUntilOptions): Promise<T>`

Polls a function until a predicate is true.

```typescript
const result = await AsyncHelpers.pollUntil(
  () => client.getTaskStatus("task-123"),
  (status) => status === "completed",
  { maxAttempts: 10, interval: 1000 }
);
```

##### `static async collectStreamResponses<T>(stream: AsyncGenerator<T, void, unknown>, options?: CollectStreamOptions): Promise<T[]>`

Collects responses from an async stream.

```typescript
const events = await AsyncHelpers.collectStreamResponses(
  client.callToolWithStream("streamingTool", { duration: 5000 }),
  { timeout: 10000, maxItems: 100 }
);
```

##### `static async delay(ms: number): Promise<void>`

Delays execution for a specified time.

```typescript
await AsyncHelpers.delay(1000); // Wait for 1 second
```

##### `static async retry<T>(fn: () => Promise<T>, options?: { maxAttempts?: number; interval?: number; backoff?: boolean }): Promise<T>`

Retries a function until it succeeds or reaches maximum attempts.

```typescript
const result = await AsyncHelpers.retry(
  () => client.callTool("flaky-tool", { param: "value" }),
  { maxAttempts: 3, interval: 1000, backoff: true }
);
```

### ResponseValidator

Provides utilities for validating MCP responses.

```typescript
import { ResponseValidator } from "mcp-test";
```

#### Methods

##### `static validateToolResponse(response: any, schema?: any): ValidationResult`

Validates a tool response against a schema.

```typescript
const result = ResponseValidator.validateToolResponse(response, schema);
if (!result.valid) {
  console.error("Validation errors:", result.errors);
}
```

##### `static validateResource(resource: any, schema?: any): ValidationResult`

Validates a resource against a schema.

```typescript
const result = ResponseValidator.validateResource(resource, schema);
```

##### `static validateSchema(schema: any): ValidationResult`

Validates a schema.

```typescript
const result = ResponseValidator.validateSchema(schema);
```

##### `static createSchemaValidator(schema: any, options?: SchemaValidationOptions): (data: any) => ValidationResult`

Creates a schema validator function.

```typescript
const validator = ResponseValidator.createSchemaValidator(schema, {
  allowAdditionalProperties: false,
  requireAllProperties: true,
});

const result = validator(data);
```

### TestFixtures

Provides reusable test data for MCP server tests.

```typescript
import { TestFixtures } from "mcp-test";
```

#### Methods

##### `static getToolRequests(toolName: string): any[]`

Gets sample tool requests for a specific tool.

```typescript
const requests = TestFixtures.getToolRequests("calculator");
```

##### `static getToolResponses(toolName: string): MCPToolResponse[]`

Gets sample tool responses for a specific tool.

```typescript
const responses = TestFixtures.getToolResponses("calculator");
```

##### `static getResources(type?: string): MCPResource[]`

Gets sample resources.

```typescript
const resources = TestFixtures.getResources("document");
```

##### `static getSchema(): MCPSchema`

Gets a sample schema.

```typescript
const schema = TestFixtures.getSchema();
```

##### `static createCustomFixture<T>(template: T, overrides?: Partial<T>): T`

Creates a custom fixture by merging a template with overrides.

```typescript
const customRequest = TestFixtures.createCustomFixture(
  { operation: "add", a: 5, b: 3 },
  { a: 10 }
);
// { operation: 'add', a: 10, b: 3 }
```

## Transport Adapters

### HTTPAdapter

Implements the TransportAdapter interface for HTTP communication.

```typescript
import { HTTPAdapter } from "mcp-test";

const adapter = new HTTPAdapter({
  defaultTimeout: 5000,
  defaultHeaders: { "X-Custom-Header": "value" },
});
```

#### Constructor Options

| Option            | Type    | Description                                | Default |
| ----------------- | ------- | ------------------------------------------ | ------- |
| `defaultTimeout`  | number  | Default request timeout in milliseconds    | 10000   |
| `defaultHeaders`  | object  | Default headers to include in all requests | {}      |
| `followRedirects` | boolean | Whether to follow redirects                | true    |
| `maxRedirects`    | number  | Maximum number of redirects to follow      | 5       |

#### Methods

##### `async request<T = any>(url: string, options?: RequestOptions): Promise<T>`

Sends an HTTP request.

```typescript
const result = await adapter.request("http://localhost:6277/tools/echo", {
  method: "POST",
  body: { message: "Hello" },
});
```

##### `async *openStream(url: string, options?: RequestOptions): AsyncGenerator<any, void, unknown>`

Opens a stream using Server-Sent Events.

```typescript
const stream = adapter.openStream("http://localhost:6277/stream/tools/echo", {
  method: "POST",
  body: { message: "Hello" },
});

for await (const event of stream) {
  console.log(event);
}
```

##### `close(): void`

Closes the adapter and aborts any pending requests.

```typescript
adapter.close();
```

## Error Types

The library provides several error types for different failure scenarios:

- `MCPTestError`: Base error class for all MCP test errors
- `ConnectionError`: Error connecting to the MCP server
- `AuthenticationError`: Authentication failure
- `ToolExecutionError`: Error executing an MCP tool
- `ServerStartError`: Error starting the MCP server
- `TimeoutError`: Operation timed out

```typescript
import { ConnectionError, TimeoutError } from "mcp-test";

try {
  await client.callTool("echo", { message: "Hello" });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error("Connection error:", error.message);
  } else if (error instanceof TimeoutError) {
    console.error("Timeout error:", error.message);
  }
}
```

## Interfaces

### MCPToolResponse

```typescript
interface MCPToolResponse<T = any> {
  status: "success" | "error" | "accepted";
  result?: T;
  error?: string;
  taskId?: string;
  details?: any;
}
```

### MCPResource

```typescript
interface MCPResource {
  id: string;
  type: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}
```

### MCPSchema

```typescript
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

### RequestOptions

```typescript
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  responseFormat?: "json" | "text" | "binary";
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
```
