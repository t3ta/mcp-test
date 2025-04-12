# mcp-test

A comprehensive testing library for Model Context Protocol (MCP) servers.

## Overview

MCP Test Library provides a robust framework for testing MCP servers, enabling automated end-to-end testing with support for various test frameworks including Vitest. The library offers tools for server management, client communication, response validation, and test fixtures.

## Features

- **MCPTestClient**: Core client for interacting with MCP servers
- **MCPServerManager**: Utilities for starting, stopping, and monitoring MCP servers
- **Test Utilities**: Helpers for async operations, response validation, and test fixtures
- **Framework Integration**: Support for popular test frameworks
- **Comprehensive Documentation**: Detailed API documentation and examples

## Installation

```bash
npm install mcp-test --save-dev
```

## Quick Start

```typescript
import { MCPTestClient, MCPServerManager } from "mcp-test";

// Create a client
const client = new MCPTestClient({
  baseUrl: "http://localhost:6277",
});

// Create a server manager
const server = new MCPServerManager({
  command: "node",
  args: ["src/mcp-server.js"],
  env: { PORT: "6277" },
});

// Start the server
await server.start();

// Call a tool
const result = await client.callTool("echo", { message: "Hello, MCP!" });
console.log(result);

// Stop the server
await server.stop();
```

## Documentation

- [API Reference](./docs/api-reference.md)
- [Examples](./docs/examples.md)
- [Best Practices](./docs/best-practices.md)

## License

MIT
