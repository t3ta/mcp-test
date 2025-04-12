# Best Practices for MCP Testing

This document outlines recommended best practices for testing MCP servers using the MCP Test Library.

## Server Management

### Isolate Test Environments

Always run tests in an isolated environment to prevent interference with production systems.

```typescript
const server = new MCPServerManager({
  command: 'node',
  args: ['src/mcp-server.js'],
  env: { 
    PORT: '6277',
    NODE_ENV: 'test',
    // Use test-specific configuration
    DATABASE_URL: 'sqlite::memory:',
    LOG_LEVEL: 'error'
  }
});
```

### Proper Server Lifecycle Management

Ensure servers are properly started before tests and stopped after tests, even if tests fail.

```typescript
beforeAll(async () => {
  try {
    await server.start();
    await server.waitForReady();
  } catch (error) {
    console.error('Failed to start server:', error);
    // Clean up any partial server start
    await server.stop();
    throw error;
  }
});

afterAll(async () => {
  await server.stop();
});
```

### Monitor Server Output

Capture and log server output for debugging test failures.

```typescript
const server = new MCPServerManager({
  // ...other options
  onStdout: (data) => {
    // In CI, you might want to save this to a file
    console.log(`[MCP Server]: ${data}`);
  },
  onStderr: (data) => {
    console.error(`[MCP Server Error]: ${data}`);
  }
});
```

## Test Design

### Test Tools Individually

Test each tool in isolation before testing complex workflows.

```typescript
// First test individual tools
describe('Individual Tool Tests', () => {
  it('should execute tool A correctly', async () => {
    // Test tool A
  });
  
  it('should execute tool B correctly', async () => {
    // Test tool B
  });
});

// Then test workflows that combine tools
describe('Workflow Tests', () => {
  it('should complete workflow using tools A and B', async () => {
    // Test workflow
  });
});
```

### Test Error Cases

Always test error cases and edge conditions, not just the happy path.

```typescript
describe('Calculator Tool Tests', () => {
  it('should add numbers correctly', async () => {
    // Test successful addition
  });
  
  it('should handle division by zero', async () => {
    // Test error case
    try {
      await client.callTool('calculator', {
        operation: 'divide',
        a: 5,
        b: 0
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.message).toContain('Division by zero');
    }
  });
  
  it('should handle invalid operations', async () => {
    // Test another error case
  });
});
```

### Use Parameterized Tests

Use parameterized tests to test multiple scenarios with the same test logic.

```typescript
// Vitest example
describe('Calculator Tool Tests', () => {
  const testCases = [
    { operation: 'add', a: 5, b: 3, expected: 8 },
    { operation: 'subtract', a: 10, b: 4, expected: 6 },
    { operation: 'multiply', a: 3, b: 4, expected: 12 },
    { operation: 'divide', a: 10, b: 2, expected: 5 }
  ];
  
  it.each(testCases)(
    'should perform $operation correctly',
    async ({ operation, a, b, expected }) => {
      const result = await client.callTool('calculator', { operation, a, b });
      
      expect(result.status).toBe('success');
      expect(result.result).toBe(expected);
    }
  );
});
```

### Test Asynchronous Operations Properly

Use appropriate utilities for testing asynchronous operations.

```typescript
it('should complete long-running task', async () => {
  // Start task
  const startResult = await client.callTool('longRunningTask', { 
    duration: 2000 
  });
  
  expect(startResult.status).toBe('accepted');
  expect(startResult.taskId).toBeDefined();
  
  // Poll for completion with timeout
  const result = await AsyncHelpers.pollUntil(
    () => client.callTool('checkTaskStatus', { taskId: startResult.taskId }),
    (status) => status.status === 'success' && status.result === 'completed',
    { maxAttempts: 10, interval: 500, timeoutMessage: 'Task did not complete in time' }
  );
  
  expect(result.status).toBe('success');
  expect(result.result).toBe('completed');
});
```

## Test Data Management

### Use Test Fixtures

Use test fixtures to maintain consistent test data.

```typescript
// Import standard fixtures
import { TestFixtures } from 'mcp-test';

// Or create a custom fixtures file for your specific MCP server
// fixtures.ts
export const customFixtures = {
  tools: {
    myCustomTool: {
      validRequests: [
        { param1: 'value1', param2: 42 },
        { param1: 'value2', param2: 84 }
      ],
      invalidRequests: [
        { param1: 'invalid' }, // Missing param2
        { param1: 123, param2: 'string' } // Wrong types
      ]
    }
  }
};

// In tests
import { customFixtures } from './fixtures';

describe('Custom Tool Tests', () => {
  it.each(customFixtures.tools.myCustomTool.validRequests)(
    'should handle valid request %#',
    async (request) => {
      const result = await client.callTool('myCustomTool', request);
      expect(result.status).toBe('success');
    }
  );
});
```

### Reset State Between Tests

Ensure tests don't interfere with each other by resetting state.

```typescript
beforeEach(async () => {
  // Reset database or other state
  await client.callTool('resetTestData', {});
});
```

## Validation

### Validate Responses Against Schema

Validate responses against schema to catch API changes.

```typescript
it('should return valid response format', async () => {
  const result = await client.callTool('myTool', { param: 'value' });
  
  // Get schema from server
  const schema = await client.getSchema();
  const toolSchema = schema.tools.find(t => t.name === 'myTool');
  
  // Validate response against schema
  const validationResult = ResponseValidator.validateToolResponse(result, toolSchema?.returns);
  expect(validationResult.valid).toBe(true);
});
```

### Check Resource Consistency

Verify resources maintain consistent structure.

```typescript
it('should maintain consistent resource structure', async () => {
  const resources = await client.getResources();
  
  // Check all resources have required fields
  resources.forEach(resource => {
    expect(resource).toHaveProperty('id');
    expect(resource).toHaveProperty('type');
    expect(resource).toHaveProperty('name');
    
    // Type-specific validation
    if (resource.type === 'document') {
      expect(resource.metadata).toHaveProperty('size');
    } else if (resource.type === 'image') {
      expect(resource.metadata).toHaveProperty('width');
      expect(resource.metadata).toHaveProperty('height');
    }
  });
});
```

## Error Handling

### Use Specific Error Types

Catch and handle specific error types for better error reporting.

```typescript
try {
  await client.callTool('riskyTool', { param: 'value' });
} catch (error) {
  if (error instanceof ConnectionError) {
    // Handle connection issues
  } else if (error instanceof AuthenticationError) {
    // Handle authentication issues
  } else if (error instanceof ToolExecutionError) {
    // Handle tool-specific errors
    if (error.details?.errorCode === 'RESOURCE_NOT_FOUND') {
      // Handle specific error code
    }
  } else if (error instanceof TimeoutError) {
    // Handle timeouts
  } else {
    // Handle unexpected errors
  }
}
```

### Implement Retry Logic for Flaky Tests

Use retry logic for tests that might be flaky due to external dependencies.

```typescript
it('should handle external API call', async () => {
  const result = await AsyncHelpers.retry(
    () => client.callTool('externalApiTool', { param: 'value' }),
    {
      maxAttempts: 3,
      interval: 1000,
      backoff: true
    }
  );
  
  expect(result.status).toBe('success');
});
```

## Performance Testing

### Test Response Times

Monitor and assert on response times to catch performance regressions.

```typescript
it('should respond within acceptable time', async () => {
  const start = Date.now();
  
  await client.callTool('performanceCriticalTool', { 
    size: 'medium',
    operation: 'transform'
  });
  
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000); // Should respond within 1 second
});
```

### Test Concurrent Requests

Test how the server handles concurrent requests.

```typescript
it('should handle multiple concurrent requests', async () => {
  const concurrentRequests = 10;
  const requests = Array(concurrentRequests).fill(null).map((_, i) => 
    client.callTool('simpleOperation', { value: i })
  );
  
  const results = await Promise.all(requests);
  
  // All requests should succeed
  results.forEach(result => {
    expect(result.status).toBe('success');
  });
});
```

## CI/CD Integration

### Automate Tests in CI Pipeline

Set up automated tests in your CI pipeline.

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

### Generate Test Reports

Generate and publish test reports for better visibility.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default', 'html', 'junit'],
    outputFile: {
      html: './test-results/index.html',
      junit: './test-results/junit.xml'
    },
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage'
    }
  }
});
```

## Security Testing

### Test Authentication

Test authentication mechanisms thoroughly.

```typescript
describe('Authentication Tests', () => {
  it('should reject requests without authentication', async () => {
    // Create client without auth token
    const unauthenticatedClient = new MCPTestClient({
      baseUrl: 'http://localhost:6277'
    });
    
    try {
      await unauthenticatedClient.callTool('securedTool', {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationError);
    }
  });
  
  it('should accept requests with valid authentication', async () => {
    // Create client with auth token
    const authenticatedClient = new MCPTestClient({
      baseUrl: 'http://localhost:6277',
      authToken: 'valid-test-token'
    });
    
    const result = await authenticatedClient.callTool('securedTool', {});
    expect(result.status).toBe('success');
  });
  
  it('should reject requests with invalid authentication', async () => {
    // Create client with invalid auth token
    const invalidAuthClient = new MCPTestClient({
      baseUrl: 'http://localhost:6277',
      authToken: 'invalid-token'
    });
    
    try {
      await invalidAuthClient.callTool('securedTool', {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationError);
    }
  });
});
```

### Test Authorization

Test that authorization rules are enforced.

```typescript
describe('Authorization Tests', () => {
  it('should enforce tool-level permissions', async () => {
    // Create client with limited permissions
    const limitedClient = new MCPTestClient({
      baseUrl: 'http://localhost:6277',
      authToken: 'limited-permissions-token'
    });
    
    // Should be able to access allowed tools
    const allowedResult = await limitedClient.callTool('publicTool', {});
    expect(allowedResult.status).toBe('success');
    
    // Should not be able to access restricted tools
    try {
      await limitedClient.callTool('adminTool', {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toContain('unauthorized');
    }
  });
});
```

## Debugging

### Enable Verbose Logging for Debugging

Enable detailed logging when debugging test failures.

```typescript
// Set environment variable before running tests
process.env.MCP_TEST_LOG_LEVEL = 'debug';

// Or configure in code
import { LogLevel } from 'mcp-test';

// Create a custom logger
const logger = new ConsoleLogger(LogLevel.DEBUG);
LogManager.setLogger(logger);
```

### Save Test Artifacts

Save relevant artifacts for debugging test failures.

```typescript
it('should process complex data correctly', async () => {
  try {
    const result = await client.callTool('complexDataTool', { 
      data: complexTestData 
    });
    
    expect(result.status).toBe('success');
  } catch (error) {
    // Save request and error details for debugging
    const fs = require('fs');
    fs.writeFileSync(
      './test-artifacts/failed-request.json', 
      JSON.stringify({ 
        tool: 'complexDataTool',
        request: complexTestData,
        error: {
          message: error.message,
          details: error.details,
          stack: error.stack
        }
      }, null, 2)
    );
    throw error;
  }
});
```

## Maintenance

### Keep Tests Focused

Keep tests focused on specific functionality to make them easier to maintain.

```typescript
// Good: Focused test
it('should validate input parameters', async () => {
  // Only test parameter validation
});

it('should process valid input correctly', async () => {
  // Only test processing logic
});

// Bad: Unfocused test
it('should validate input and process data and handle errors', async () => {
  // Too many responsibilities in one test
});
```

### Use Descriptive Test Names

Use descriptive test names that explain what is being tested and what the expected outcome is.

```typescript
// Good: Descriptive test names
it('should return error when dividing by zero', async () => {
  // Test implementation
});

// Bad: Vague test names
it('division test', async () => {
  // Test implementation
});
```

### Regularly Update Test Fixtures

Keep test fixtures up to date with the latest API changes.

```typescript
// Schedule regular reviews of test fixtures
// Update fixtures when API changes
beforeAll(async () => {
  // Optionally, generate fixtures dynamically based on current schema
  const schema = await client.getSchema();
  // Update fixtures based on schema
});
```

## Conclusion

Following these best practices will help you create robust, maintainable tests for your MCP servers. Remember that good tests not only verify that your code works correctly but also serve as documentation and help prevent regressions as your codebase evolves.
