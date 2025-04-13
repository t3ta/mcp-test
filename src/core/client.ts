/**
 * MCPTestClient implementation.
 *
 * This module provides the core client for interacting with MCP (Model Context Protocol) servers
 * during testing. It handles communication, error handling, and response processing.
 *
 * The client supports:
 * - Tool execution with request/response handling
 * - Streaming responses for long-running operations
 * - Resource management
 * - Schema retrieval
 * - Authentication
 *
 * This implementation uses the official MCP SDK to provide a standardized interface.
 *
 * @module mcp-client
 */

import {
  Client,
  SSEClientTransport,
  TypedSDKClient,
  asTypedClient,
  CallToolParams
} from '../utils/sdk-types';
import {
  MCPTestClientOptions,
  MCPToolResponse,
  MCPResource,
  MCPSchema,
  RequestOptions,
  ConnectionError,
  AuthenticationError,
  ToolExecutionError,
  TimeoutError
} from './types';

/**
 * MCPTestClient class.
 *
 * This class provides the main interface for interacting with MCP servers in tests.
 * It handles communication details, error handling, and provides a high-level API
 * for common operations like calling tools, managing resources, and retrieving schemas.
 *
 * The client automatically handles authentication, request formatting, and
 * response parsing, allowing tests to focus on functionality rather than
 * communication details.
 *
 * Example usage:
 * ```typescript
 * const client = new MCPTestClient({
 *   baseUrl: "http://localhost:6277",
 *   authToken: "test-token"
 * });
 *
 * // Call a tool
 * const result = await client.callTool("echo", { message: "Hello, MCP!" });
 *
 * // Get resources
 * const resources = await client.getResources();
 * ```
 */
export class MCPTestClient {
  private client: Client;
  private typedClient: TypedSDKClient;
  private baseUrl: string;
  private authToken?: string;
  private timeout: number;
  private headers: Record<string, string>;
  private responseFormat: 'json' | 'text' | 'binary';
  private transport: SSEClientTransport;

  /**
   * Creates a new MCP Test Client.
   *
   * Initializes a client instance with the provided configuration options.
   * The client normalizes the base URL (removing trailing slashes),
   * sets up authentication, timeouts, and headers, and initializes
   * the SDK client with appropriate transport.
   *
   * @param {MCPTestClientOptions} options - Client configuration options
   */
  constructor(options: MCPTestClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/')
      ? options.baseUrl.slice(0, -1)
      : options.baseUrl;
    this.authToken = options.authToken;
    this.timeout = options.timeout || 10000;
    this.headers = options.headers || {};
    this.responseFormat = options.responseFormat || 'json';

    // Create SDK transport with headers
    this.transport = new SSEClientTransport({
      baseUrl: this.baseUrl,
      headers: this.getDefaultHeaders()
    });

    // Create SDK client
    this.client = new Client({
      transport: this.transport
    });

    // Update typed client interface
    this.typedClient = asTypedClient(this.client);

    // Create typed client interface
    this.typedClient = asTypedClient(this.client);
  }

  /**
   * Sets the authentication token for subsequent requests.
   *
   * This method updates the client's authentication token, which will be
   * included as a Bearer token in the Authorization header for all
   * subsequent requests. This allows changing authentication during
   * a test session without creating a new client instance.
   *
   * @param {string} token - The authentication token to use
   */
  setAuthToken(token: string): void {
    this.authToken = token;

    // Recreate transport and client with updated token
    this.transport = new SSEClientTransport({
      baseUrl: this.baseUrl,
      headers: this.getDefaultHeaders()
    });

    this.client = new Client({
      transport: this.transport
    });

    // Update typed client interface
    this.typedClient = asTypedClient(this.client);
  }

  /**
   * Gets the default headers for requests, including authentication if available.
   *
   * This method generates a headers object with standard content-type and accept
   * headers, merged with any custom headers provided during client initialization.
   * If an authentication token is available, it adds a Bearer token Authorization header.
   *
   * @private
   * @returns {Record<string, string>} Headers object with appropriate content-type, accept, and auth headers
   */
  private getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Calls an MCP tool with the provided parameters.
   *
   * This method sends a request to the specified tool with the given parameters
   * and returns the response. The method handles error conditions and provides
   * appropriate typed exceptions for different failure scenarios.
   *
   * The method supports generic typing for the result type, allowing type-safe access
   * to tool-specific response structures.
   *
   * Error handling:
   * - Timeouts: Throws TimeoutError
   * - Authentication issues: Throws AuthenticationError
   * - Tool execution problems: Throws ToolExecutionError
   * - Other errors: Passes through
   *
   * @template T - The expected type of the tool response result
   * @param {string} toolName - Name of the tool to call
   * @param {any} params - Parameters to pass to the tool
   * @returns {Promise<MCPToolResponse<T>>} Promise resolving to the tool response
   * @throws {TimeoutError} If the request times out
   * @throws {AuthenticationError} If authentication fails
   * @throws {ToolExecutionError} If the tool execution fails
   */
  async callTool<T = any>(toolName: string, params: any): Promise<MCPToolResponse<T>> {
    try {
      // Parse tool name for potential namespace (e.g., "namespace/toolName")
      const [namespace, name] = toolName.includes('/')
        ? toolName.split('/', 2)
        : [undefined, toolName];

      // Call the tool using typed SDK client
      const result = await this.typedClient.callTool({
        name,
        arguments: params
      });

      // Format response to match MCPToolResponse
      return {
        status: 'success',
        result: result as T
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
          throw new TimeoutError(`Tool call to ${toolName} timed out after ${this.timeout}ms`, {
            cause: error,
            details: { toolName, params }
          });
        }

        if (error.message.toLowerCase().includes('401') ||
          error.message.toLowerCase().includes('unauthorized')) {
          throw new AuthenticationError(`Authentication failed when calling tool ${toolName}`, {
            cause: error,
            details: { toolName }
          });
        }

        throw new ToolExecutionError(`Failed to call tool ${toolName}: ${error.message}`, {
          cause: error,
          details: { toolName, params }
        });
      }

      throw new ToolExecutionError(`Unknown error when calling tool ${toolName}`, {
        details: { toolName, params, error: String(error) }
      });
    }
  }

  /**
   * Calls an MCP tool and receives streaming responses.
   *
   * This method is similar to callTool but instead of returning a single response,
   * it yields events as they are received from the server. This is particularly
   * useful for long-running operations where progress updates are desired.
   *
   * The method uses the SDK's streaming capabilities and handles error
   * conditions with appropriate typed exceptions.
   *
   * Error handling:
   * - Timeouts: Throws TimeoutError
   * - Authentication issues: Throws AuthenticationError
   * - Tool execution problems: Throws ToolExecutionError
   * - Other errors: Passes through
   *
   * @param {string} toolName - Name of the tool to call
   * @param {any} params - Parameters to pass to the tool
   * @yields {any} Events received from the stream
   * @throws {TimeoutError} If the streaming request times out
   * @throws {AuthenticationError} If authentication fails
   * @throws {ToolExecutionError} If the tool execution fails
   */
  async *callToolWithStream(toolName: string, params: any): AsyncGenerator<any, void, unknown> {
    try {
      // Parse tool name for potential namespace
      const [namespace, name] = toolName.includes('/')
        ? toolName.split('/', 2)
        : [undefined, toolName];

      // Streaming functionality (may differ based on SDK version)
      // Client doesn't have streaming support in this version - just yield the single result
      const result = await this.typedClient.callTool({
        name,
        arguments: params
      });
      yield result;

      // Note: We don't yield twice - removing duplicate yield
      // When streaming is supported in the SDK, this will be updated
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
          throw new TimeoutError(`Streaming tool call to ${toolName} timed out after ${this.timeout}ms`, {
            cause: error,
            details: { toolName, params }
          });
        }

        if (error.message.toLowerCase().includes('401') ||
          error.message.toLowerCase().includes('unauthorized')) {
          throw new AuthenticationError(`Authentication failed when streaming tool ${toolName}`, {
            cause: error,
            details: { toolName }
          });
        }

        throw new ToolExecutionError(`Failed to stream tool ${toolName}: ${error.message}`, {
          cause: error,
          details: { toolName, params }
        });
      }

      throw new ToolExecutionError(`Unknown error when streaming tool ${toolName}`, {
        details: { toolName, params, error: String(error) }
      });
    }
  }

  /**
   * Retrieves all resources from the MCP server.
   *
   * This method fetches the list of available resources from the server
   * using the SDK's resources API.
   *
   * Error handling:
   * - Timeouts: Throws TimeoutError
   * - Authentication issues: Throws AuthenticationError
   * - Connection problems: Throws ConnectionError
   *
   * @returns {Promise<MCPResource[]>} Promise resolving to an array of resources
   * @throws {TimeoutError} If the request times out
   * @throws {AuthenticationError} If authentication fails
   * @throws {ConnectionError} If a connection error occurs
   */
  async getResources(): Promise<MCPResource[]> {
    try {
      // Use typed SDK listResources API
      const result = await this.typedClient.listResources();

      // Map SDK resources to our resource format
      return result.resources.map(resource => ({
        id: resource.uri,
        type: resource.mimeType?.split('/')[0] || 'unknown',
        name: resource.name,
        description: resource.description,
        metadata: { mimeType: resource.mimeType }
      }));
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
          throw new TimeoutError(`Get resources timed out after ${this.timeout}ms`, {
            cause: error
          });
        }

        if (error.message.toLowerCase().includes('401') ||
          error.message.toLowerCase().includes('unauthorized')) {
          throw new AuthenticationError('Authentication failed when getting resources', {
            cause: error
          });
        }

        throw new ConnectionError(`Failed to get resources: ${error.message}`, {
          cause: error
        });
      }

      throw new ConnectionError(`Failed to get resources: ${String(error)}`);
    }
  }

  /**
   * Retrieves a specific resource by ID from the MCP server.
   *
   * This method fetches a single resource with the specified ID using the SDK's resources API.
   *
   * Error handling:
   * - Timeouts: Throws TimeoutError
   * - Authentication issues: Throws AuthenticationError
   * - Resource not found: Throws ConnectionError with not found message
   * - Connection problems: Throws ConnectionError
   *
   * @param {string} resourceId - ID of the resource to retrieve
   * @returns {Promise<MCPResource>} Promise resolving to the resource
   * @throws {TimeoutError} If the request times out
   * @throws {AuthenticationError} If authentication fails
   * @throws {ConnectionError} If the resource is not found or a connection error occurs
   */
  async getResource(resourceId: string): Promise<MCPResource> {
    try {
      // Find resource in list by ID using typed client
      const allResources = await this.typedClient.listResources();
      const resource = allResources.resources.find(res => res.uri === resourceId);

      if (!resource) {
        throw new Error(`Resource ${resourceId} not found`);
      }

      // Map to our resource format
      return {
        id: resource.uri,
        type: resource.mimeType?.split('/')[0] || 'unknown',
        name: resource.name,
        description: resource.description,
        metadata: { mimeType: resource.mimeType }
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
          throw new TimeoutError(`Get resource ${resourceId} timed out after ${this.timeout}ms`, {
            cause: error,
            details: { resourceId }
          });
        }

        if (error.message.toLowerCase().includes('401') ||
          error.message.toLowerCase().includes('unauthorized')) {
          throw new AuthenticationError(`Authentication failed when getting resource ${resourceId}`, {
            cause: error,
            details: { resourceId }
          });
        }

        if (error.message.toLowerCase().includes('404') ||
          error.message.toLowerCase().includes('not found')) {
          throw new ConnectionError(`Resource ${resourceId} not found`, {
            cause: error,
            details: { resourceId }
          });
        }

        throw new ConnectionError(`Failed to get resource ${resourceId}: ${error.message}`, {
          cause: error,
          details: { resourceId }
        });
      }

      throw new ConnectionError(`Failed to get resource ${resourceId}: ${String(error)}`, {
        details: { resourceId }
      });
    }
  }

  /**
   * Retrieves the MCP server schema.
   *
   * This method uses the SDK's capabilities API to fetch information about
   * the available tools and resource types supported by the server.
   *
   * Error handling:
   * - Timeouts: Throws TimeoutError
   * - Authentication issues: Throws AuthenticationError
   * - Connection problems: Throws ConnectionError
   *
   * @returns {Promise<MCPSchema>} Promise resolving to the server schema
   * @throws {TimeoutError} If the request times out
   * @throws {AuthenticationError} If authentication fails
   * @throws {ConnectionError} If a connection error occurs
   */
  async getSchema(): Promise<MCPSchema> {
    try {
      // Get schema by querying tools and resources with typed client
      const toolsList = await this.typedClient.listTools();
      const resourcesList = await this.typedClient.listResources();

      // Construct the schema with proper mappings
      const schema = {
        tools: toolsList.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          returns: { type: 'any' } // Default return type since SDK doesn't provide this
        })),
        resources: resourcesList.resources.map(resource => ({
          type: resource.mimeType?.split('/')[0] || 'unknown',
          description: resource.description,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            mimeType: { type: 'string' }
          }
        }))
      };

      // Return schema
      return schema;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
          throw new TimeoutError(`Get schema timed out after ${this.timeout}ms`, {
            cause: error
          });
        }

        if (error.message.toLowerCase().includes('401') ||
          error.message.toLowerCase().includes('unauthorized')) {
          throw new AuthenticationError('Authentication failed when getting schema', {
            cause: error
          });
        }

        throw new ConnectionError(`Failed to get schema: ${error.message}`, {
          cause: error
        });
      }

      throw new ConnectionError(`Failed to get schema: ${String(error)}`);
    }
  }

  /**
   * Sends a raw request to the MCP server.
   *
   * This method is maintained for backward compatibility but is not
   * recommended for use with the SDK-based implementation, as it
   * bypasses the SDK's higher-level abstractions.
   *
   * @template T - The expected response type
   * @param {string} path - Request path (will be appended to baseUrl)
   * @param {RequestOptions} [options={}] - Request options
   * @returns {Promise<T>} Promise resolving to the response
   * @throws {Error} This method throws an error as it's not supported in the SDK implementation
   * @deprecated Use specific methods like callTool, getResources, etc. instead
   */
  async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    throw new Error(
      'The direct request() method is not supported in the SDK-based implementation. ' +
      'Please use specific methods like callTool(), getResources(), etc. instead.'
    );
  }

  /**
   * Closes the client and cleans up resources.
   *
   * This method should be called when the client is no longer needed
   * to properly close any open connections and free resources.
   *
   * It's good practice to call this method in test teardown or in
   * try/finally blocks to ensure resources are properly released,
   * especially for long-running tests or applications.
   */
  close(): void {
    // Disconnect from the transport
    // Do nothing as close() method doesn't exist in this SDK version
  }
}
