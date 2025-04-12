# Examples

This document provides practical examples of using the MCP Test Library for various testing scenarios.

## Basic Usage

### Setting Up a Test Environment

```typescript
import { MCPTestClient, MCPServerManager } from 'mcp-test';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Create client and server instances
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

const server = new MCPServerManager({
  command: 'node',
  args: ['src/mcp-server.js'],
  env: { PORT: '6277', NODE_ENV: 'test' }
});

// Set up test hooks
beforeAll(async () => {
  // Start the server before tests
  await server.start();
  await server.waitForReady();
});

afterAll(async () => {
  // Stop the server after tests
  await server.stop();
});

// Write your tests
describe('MCP Server Tests', () => {
  it('should execute echo tool correctly', async () => {
    const result = await client.callTool('echo', { message: 'Hello, MCP!' });
    
    expect(result.status).toBe('success');
    expect(result.result).toBe('Hello, MCP!');
  });
});
```

### Testing Tool Execution

```typescript
import { MCPTestClient } from 'mcp-test';

// Create a client
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

// Test a simple tool
async function testEchoTool() {
  const result = await client.callTool('echo', { message: 'Hello, MCP!' });
  console.log(result);
  // { status: 'success', result: 'Hello, MCP!' }
}

// Test a calculator tool
async function testCalculatorTool() {
  // Addition
  const addResult = await client.callTool('calculator', {
    operation: 'add',
    a: 5,
    b: 3
  });
  console.log('Addition:', addResult);
  // { status: 'success', result: 8 }
  
  // Division
  const divideResult = await client.callTool('calculator', {
    operation: 'divide',
    a: 10,
    b: 2
  });
  console.log('Division:', divideResult);
  // { status: 'success', result: 5 }
  
  // Error case
  try {
    const errorResult = await client.callTool('calculator', {
      operation: 'divide',
      a: 5,
      b: 0
    });
  } catch (error) {
    console.error('Error:', error.message);
    // Error: Failed to call tool calculator: Division by zero
  }
}

// Run the tests
testEchoTool().then(() => testCalculatorTool());
```

### Working with Resources

```typescript
import { MCPTestClient } from 'mcp-test';

// Create a client
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

// Get all resources
async function getAllResources() {
  const resources = await client.getResources();
  console.log('All resources:', resources);
}

// Get resources by type
async function getResourcesByType(type: string) {
  const allResources = await client.getResources();
  const filteredResources = allResources.filter(resource => resource.type === type);
  console.log(`Resources of type ${type}:`, filteredResources);
}

// Get a specific resource
async function getSpecificResource(id: string) {
  try {
    const resource = await client.getResource(id);
    console.log('Resource:', resource);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the resource tests
async function testResources() {
  await getAllResources();
  await getResourcesByType('document');
  await getSpecificResource('resource-1');
  await getSpecificResource('non-existent'); // This will throw an error
}

testResources();
```

## Advanced Usage

### Streaming Responses

```typescript
import { MCPTestClient, AsyncHelpers } from 'mcp-test';

// Create a client
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

// Process streaming responses in real-time
async function processStreamInRealTime() {
  const stream = client.callToolWithStream('streamingTool', { duration: 5000 });
  
  for await (const event of stream) {
    console.log('Received event:', event);
    
    // Process each event as it arrives
    if (event.type === 'progress') {
      console.log(`Progress: ${event.percentage}%`);
    } else if (event.type === 'result') {
      console.log('Final result:', event.data);
    }
  }
}

// Collect all streaming responses
async function collectAllStreamResponses() {
  const stream = client.callToolWithStream('streamingTool', { duration: 5000 });
  
  const events = await AsyncHelpers.collectStreamResponses(stream, {
    timeout: 10000,
    maxItems: 100
  });
  
  console.log(`Collected ${events.length} events`);
  
  // Process all events at once
  const progressEvents = events.filter(event => event.type === 'progress');
  const resultEvent = events.find(event => event.type === 'result');
  
  console.log(`Progress updates: ${progressEvents.length}`);
  console.log('Final result:', resultEvent?.data);
}

// Run the streaming tests
async function testStreaming() {
  console.log('Processing stream in real-time:');
  await processStreamInRealTime();
  
  console.log('\nCollecting all stream responses:');
  await collectAllStreamResponses();
}

testStreaming();
```

### Error Handling

```typescript
import { 
  MCPTestClient, 
  ConnectionError, 
  AuthenticationError, 
  ToolExecutionError, 
  TimeoutError 
} from 'mcp-test';

// Create a client
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277',
  timeout: 5000
});

// Test with proper error handling
async function testWithErrorHandling() {
  try {
    // This might fail for various reasons
    const result = await client.callTool('riskyTool', { param: 'value' });
    console.log('Success:', result);
  } catch (error) {
    // Handle different error types
    if (error instanceof ConnectionError) {
      console.error('Connection error:', error.message);
      // Retry with backoff or report connectivity issue
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication error:', error.message);
      // Refresh authentication token or prompt for credentials
    } else if (error instanceof ToolExecutionError) {
      console.error('Tool execution error:', error.message);
      console.error('Details:', error.details);
      // Handle specific tool errors based on details
    } else if (error instanceof TimeoutError) {
      console.error('Timeout error:', error.message);
      // Retry with longer timeout or report performance issue
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Test with retry mechanism
async function testWithRetry() {
  try {
    const result = await AsyncHelpers.retry(
      () => client.callTool('flakyTool', { param: 'value' }),
      {
        maxAttempts: 3,
        interval: 1000,
        backoff: true
      }
    );
    console.log('Success after retry:', result);
  } catch (error) {
    console.error('Failed after multiple attempts:', error.message);
  }
}

// Run the error handling tests
async function testErrorHandling() {
  await testWithErrorHandling();
  await testWithRetry();
}

testErrorHandling();
```

### Using Test Fixtures

```typescript
import { MCPTestClient, TestFixtures, ResponseValidator } from 'mcp-test';
import { describe, it, expect } from 'vitest';

// Create a client
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

// Test with fixtures
describe('Calculator Tool Tests', () => {
  // Get test fixtures for the calculator tool
  const requests = TestFixtures.getToolRequests('calculator');
  const responses = TestFixtures.getToolResponses('calculator');
  
  // Test each fixture
  it.each(requests.slice(0, 4))('should handle valid calculator request %#', async (request) => {
    const result = await client.callTool('calculator', request);
    
    expect(result.status).toBe('success');
    expect(typeof result.result).toBe('number');
  });
  
  // Test error case
  it('should handle division by zero', async () => {
    const divideByZeroRequest = requests[4]; // { operation: 'divide', a: 5, b: 0 }
    
    try {
      await client.callTool('calculator', divideByZeroRequest);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.message).toContain('Division by zero');
    }
  });
  
  // Create custom test fixture
  it('should handle custom calculator request', async () => {
    const customRequest = TestFixtures.createCustomFixture(
      { operation: 'add', a: 5, b: 3 },
      { a: 10 }
    );
    
    const result = await client.callTool('calculator', customRequest);
    
    expect(result.status).toBe('success');
    expect(result.result).toBe(13); // 10 + 3
  });
  
  // Validate response against schema
  it('should return valid response format', async () => {
    const result = await client.callTool('calculator', { operation: 'add', a: 5, b: 3 });
    
    const validationResult = ResponseValidator.validateToolResponse(result);
    expect(validationResult.valid).toBe(true);
  });
});
```

## Integration with Test Frameworks

### Vitest Integration

```typescript
// tests/mcp.test.ts
import { MCPTestClient, MCPServerManager, AsyncHelpers } from 'mcp-test';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Create client and server instances
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

const server = new MCPServerManager({
  command: 'node',
  args: ['src/mcp-server.js'],
  env: { PORT: '6277', NODE_ENV: 'test' },
  onStdout: (data) => console.log(`[MCP Server]: ${data}`),
  onStderr: (data) => console.error(`[MCP Server Error]: ${data}`)
});

// Global setup and teardown
beforeAll(async () => {
  await server.start();
  await server.waitForReady();
  console.log('MCP Server started');
});

afterAll(async () => {
  await server.stop();
  console.log('MCP Server stopped');
});

// Test suite
describe('MCP Server E2E Tests', () => {
  // Basic tool test
  it('should execute echo tool correctly', async () => {
    const result = await client.callTool('echo', { message: 'Hello, MCP!' });
    
    expect(result.status).toBe('success');
    expect(result.result).toBe('Hello, MCP!');
  });
  
  // Test with async helpers
  it('should handle long-running operations', async () => {
    // Start a long-running task
    const startResult = await client.callTool('longRunningTask', { 
      duration: 2000 
    });
    
    expect(startResult.status).toBe('accepted');
    expect(startResult.taskId).toBeDefined();
    
    // Poll for completion
    const result = await AsyncHelpers.pollUntil(
      () => client.callTool('checkTaskStatus', { taskId: startResult.taskId }),
      (status) => status.status === 'success' && status.result === 'completed',
      { maxAttempts: 10, interval: 500 }
    );
    
    expect(result.status).toBe('success');
    expect(result.result).toBe('completed');
  });
  
  // Resource test
  it('should retrieve and validate resources', async () => {
    const resources = await client.getResources();
    
    expect(Array.isArray(resources)).toBe(true);
    expect(resources.length).toBeGreaterThan(0);
    
    // Check resource structure
    resources.forEach(resource => {
      expect(resource).toHaveProperty('id');
      expect(resource).toHaveProperty('type');
      expect(resource).toHaveProperty('name');
    });
  });
  
  // Schema test
  it('should retrieve and validate schema', async () => {
    const schema = await client.getSchema();
    
    expect(schema).toHaveProperty('tools');
    expect(schema).toHaveProperty('resources');
    expect(Array.isArray(schema.tools)).toBe(true);
    expect(Array.isArray(schema.resources)).toBe(true);
  });
});
```

### Jest Integration

```typescript
// tests/mcp.test.js
const { MCPTestClient, MCPServerManager, AsyncHelpers } = require('mcp-test');

// Create client and server instances
const client = new MCPTestClient({
  baseUrl: 'http://localhost:6277'
});

const server = new MCPServerManager({
  command: 'node',
  args: ['src/mcp-server.js'],
  env: { PORT: '6277', NODE_ENV: 'test' }
});

// Global setup and teardown
beforeAll(async () => {
  await server.start();
  await server.waitForReady();
}, 10000);

afterAll(async () => {
  await server.stop();
});

// Test suite
describe('MCP Server E2E Tests', () => {
  // Basic tool test
  test('should execute echo tool correctly', async () => {
    const result = await client.callTool('echo', { message: 'Hello, MCP!' });
    
    expect(result.status).toBe('success');
    expect(result.result).toBe('Hello, MCP!');
  });
  
  // Test with async helpers
  test('should handle long-running operations', async () => {
    // Start a long-running task
    const startResult = await client.callTool('longRunningTask', { 
      duration: 2000 
    });
    
    expect(startResult.status).toBe('accepted');
    expect(startResult.taskId).toBeDefined();
    
    // Poll for completion
    const result = await AsyncHelpers.pollUntil(
      () => client.callTool('checkTaskStatus', { taskId: startResult.taskId }),
      (status) => status.status === 'success' && status.result === 'completed',
      { maxAttempts: 10, interval: 500 }
    );
    
    expect(result.status).toBe('success');
    expect(result.result).toBe('completed');
  }, 15000);
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/mcp-tests.yml
name: MCP E2E Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Start MCP server in background
      run: |
        npm run build
        node dist/server.js &
        echo $! > server.pid
        
    - name: Wait for server to be ready
      run: |
        npx wait-on http://localhost:6277/health -t 30000
        
    - name: Run E2E tests
      run: npm run test:e2e
      
    - name: Stop MCP server
      if: always()
      run: |
        if [ -f server.pid ]; then
          kill $(cat server.pid)
        fi
```

### Package.json Scripts

```json
{
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsc",
    "test": "vitest run",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "ci": "npm run build && npm run test:e2e"
  }
}
```
