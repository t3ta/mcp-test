# MCP SDK Integration

This document explains how the MCP Testing Library integrates with the official MCP SDK.

## Overview

The MCP Testing Library now uses the official MCP SDK for communication with MCP servers. This provides several benefits:

- Compatibility with the latest protocol versions
- Automatic updates when the SDK is updated
- Standardized communication patterns
- Reduced maintenance burden

## Using SDK Types

If you need to work directly with the MCP SDK in your tests, the library exposes the core SDK classes with proper typing:

```typescript
import { SDKClient, SDKTransport, TypedSDKClient } from "mcp-test";

// Create a typed SDK client directly
const transport = new SDKTransport({
  baseUrl: "http://localhost:6277",
  headers: { Authorization: "Bearer token" },
});

const client = new SDKClient({
  transport,
  name: "My Test Client",
  version: "1.0.0",
});

// Access typed methods
const typedClient = client as TypedSDKClient;
const result = await typedClient.callTool({
  name: "myTool",
  arguments: { param1: "value1" },
});
```

## High-Level vs. Low-Level API

The library provides two levels of API:

1. **High-level API** (`MCPTestClient`): Provides a friendly, test-oriented interface that maps to standard MCP concepts. This is the recommended approach for most tests.

2. **Low-level API** (SDK direct access): For advanced users who need direct access to the MCP protocol details.

## Transitioning from HTTPAdapter

If you were previously using the `HTTPAdapter` directly, you should now use the SDK's `SSEClientTransport` instead:

```typescript
// Before (using HTTPAdapter)
const adapter = new HTTPAdapter({
  defaultTimeout: 5000,
  defaultHeaders: { "X-Custom-Header": "value" },
});

// After (using SDK transport)
import { SDKTransport } from "mcp-test";

const transport = new SDKTransport({
  baseUrl: "http://localhost:6277",
  headers: { "X-Custom-Header": "value" },
});
```

## Interface Mapping

The library provides mapping between MCPTestClient interfaces and SDK interfaces:

| MCPTestClient    | SDK Equivalent                                |
| ---------------- | --------------------------------------------- |
| `callTool()`     | `client.callTool()`                           |
| `getResources()` | `client.listResources()`                      |
| `getResource()`  | `client.listResources() + filtering`          |
| `getSchema()`    | `client.listTools() + client.listResources()` |

## Type Safety

The library provides type-safe wrappers around the SDK to ensure your tests are type-safe. The `TypedSDKClient` interface provides properly typed methods for SDK operations:

```typescript
import { TypedSDKClient } from "mcp-test";

// Example type-safe call
function callCalculator(client: TypedSDKClient) {
  return client.callTool({
    name: "calculator",
    arguments: {
      operation: "add",
      a: 5,
      b: 3,
    },
  });
}
```

## Versioning and Compatibility

The MCP Test Library is compatible with MCP SDK version 1.9.0 and later. When upgrading the SDK version, ensure you also update the Test Library to maintain compatibility.
