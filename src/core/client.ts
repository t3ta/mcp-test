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
 * - Various transport mechanisms
 *
 * @module mcp-client
 */

import {
  MCPTestClientOptions,
  MCPToolResponse,
  MCPResource,
  MCPSchema,
  RequestOptions,
  TransportAdapter,
  AuthenticationError,
  ConnectionError,
  ToolExecutionError,
  TimeoutError
} from '../core/types';
import { HTTPAdapter } from '../adapters/transport/http';

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
  private baseUrl: string;
  private authToken?: string;
  private timeout: number;
  private headers: Record<string, string>;
  private transport: TransportAdapter;
  private responseFormat: 'json' | 'text' | 'binary';

  /**
   * Creates a new MCP Test Client.
   *
   * Initializes a client instance with the provided configuration options.
   * The client normalizes the base URL (removing trailing slashes),
   * sets up authentication, timeouts, and headers, and initializes
   * the appropriate transport adapter.
   *
   * Currently, only HTTP transport is fully implemented, with WebSocket
   * transport planned for future implementation.
   *
   * @param {MCPTestClientOptions} options - Client configuration options
   * @throws {Error} If an unsupported transport type is specified
   */
  constructor(options: MCPTestClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/')
      ? options.baseUrl.slice(0, -1)
      : options.baseUrl;
    this.authToken = options.authToken;
    this.timeout = options.timeout || 10000;
    this.headers = options.headers || {};
    this.responseFormat = options.responseFormat || 'json';

    // Initialize transport adapter
    if (options.transport === 'websocket') {
      // WebSocket adapter would be implemented and used here
      throw new Error('WebSocket transport not yet implemented');
    } else {
      this.transport = new HTTPAdapter({
        defaultTimeout: this.timeout,
        defaultHeaders: this.getDefaultHeaders()
      });
    }
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
   * This method sends a request to the specified tool endpoint with the given parameters
   * and returns the response. The method handles error conditions and throws appropriate
   * typed exceptions for different failure scenarios.
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
      const url = `${this.baseUrl}/tools/${toolName}`;

      const response = await this.transport.request<MCPToolResponse<T>>(url, {
        method: 'POST',
        headers: this.getDefaultHeaders(),
        body: params,
        timeout: this.timeout,
        responseFormat: this.responseFormat
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Tool call to ${toolName} timed out after ${this.timeout}ms`, {
            cause: error,
            details: { toolName, params }
          });
        }

        if (error.message.includes('401')) {
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

      throw error;
    }
  }

  /**
   * Calls an MCP tool and receives streaming responses.
   *
   * This method is similar to callTool but instead of returning a single response,
   * it yields events as they are received from the server. This is particularly
   * useful for long-running operations where progress updates are desired.
   *
   * The method uses Server-Sent Events (SSE) for streaming and handles error
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
      const url = `${this.baseUrl}/stream/tools/${toolName}`;

      const stream = this.transport.openStream(url, {
        method: 'POST',
        headers: this.getDefaultHeaders(),
        body: params,
        timeout: this.timeout
      });

      for await (const event of stream) {
        yield event;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Streaming tool call to ${toolName} timed out after ${this.timeout}ms`, {
            cause: error,
            details: { toolName, params }
          });
        }

        if (error.message.includes('401')) {
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

      throw error;
    }
  }

  /**
   * Retrieves all resources from the MCP server.
   *
   * This method fetches the list of available resources from the server's
   * resources endpoint. Resources are server-managed objects with metadata
   * that can be used by tools or clients.
   *
   * The method handles error conditions with appropriate typed exceptions.
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
      const url = `${this.baseUrl}/resources`;

      const response = await this.transport.request<MCPResource[]>(url, {
        method: 'GET',
        headers: this.getDefaultHeaders(),
        timeout: this.timeout,
        responseFormat: this.responseFormat
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Get resources timed out after ${this.timeout}ms`, {
            cause: error
          });
        }

        if (error.message.includes('401')) {
          throw new AuthenticationError('Authentication failed when getting resources', {
            cause: error
          });
        }

        throw new ConnectionError(`Failed to get resources: ${error.message}`, {
          cause: error
        });
      }

      throw error;
    }
  }

  /**
   * Retrieves a specific resource by ID from the MCP server.
   *
   * This method fetches a single resource with the specified ID from the
   * server's resources endpoint. This is useful when you need detailed
   * information about a specific resource rather than the full resource list.
   *
   * The method handles error conditions with appropriate typed exceptions,
   * including a specific case for resources that don't exist (404 errors).
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
      const url = `${this.baseUrl}/resources/${resourceId}`;

      const response = await this.transport.request<MCPResource>(url, {
        method: 'GET',
        headers: this.getDefaultHeaders(),
        timeout: this.timeout,
        responseFormat: this.responseFormat
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Get resource ${resourceId} timed out after ${this.timeout}ms`, {
            cause: error,
            details: { resourceId }
          });
        }

        if (error.message.includes('401')) {
          throw new AuthenticationError(`Authentication failed when getting resource ${resourceId}`, {
            cause: error,
            details: { resourceId }
          });
        }

        if (error.message.includes('404')) {
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

      throw error;
    }
  }

  /**
   * Retrieves the MCP server schema.
   *
   * This method fetches the schema from the server's schema endpoint.
   * The schema describes the available tools and resource types supported
   * by the server, including their parameters, return types, and properties.
   *
   * This is particularly useful for dynamic validation and introspection
   * of the server's capabilities during testing.
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
      const url = `${this.baseUrl}/schema`;

      const response = await this.transport.request<MCPSchema>(url, {
        method: 'GET',
        headers: this.getDefaultHeaders(),
        timeout: this.timeout,
        responseFormat: this.responseFormat
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Get schema timed out after ${this.timeout}ms`, {
            cause: error
          });
        }

        if (error.message.includes('401')) {
          throw new AuthenticationError('Authentication failed when getting schema', {
            cause: error
          });
        }

        throw new ConnectionError(`Failed to get schema: ${error.message}`, {
          cause: error
        });
      }

      throw error;
    }
  }

  /**
   * Sends a raw request to the MCP server.
   *
   * This method provides a low-level interface for sending custom requests
   * to the MCP server when the higher-level methods don't provide the needed
   * functionality. It allows full control over the request path, method,
   * headers, and other options.
   *
   * The method normalizes the URL path (ensuring it starts with a slash) and
   * merges the default headers with any request-specific headers.
   *
   * Error handling:
   * - Timeouts: Throws TimeoutError
   * - Authentication issues: Throws AuthenticationError
   * - Connection problems: Throws ConnectionError
   *
   * @template T - The expected response type
   * @param {string} path - Request path (will be appended to baseUrl)
   * @param {RequestOptions} [options={}] - Request options
   * @returns {Promise<T>} Promise resolving to the response
   * @throws {TimeoutError} If the request times out
   * @throws {AuthenticationError} If authentication fails
   * @throws {ConnectionError} If a connection error occurs
   */
  async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const response = await this.transport.request<T>(url, {
        ...options,
        headers: {
          ...this.getDefaultHeaders(),
          ...options.headers
        },
        timeout: options.timeout || this.timeout,
        responseFormat: options.responseFormat || this.responseFormat
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Request to ${path} timed out after ${options.timeout || this.timeout}ms`, {
            cause: error,
            details: { path, options }
          });
        }

        if (error.message.includes('401')) {
          throw new AuthenticationError(`Authentication failed for request to ${path}`, {
            cause: error,
            details: { path }
          });
        }

        throw new ConnectionError(`Request to ${path} failed: ${error.message}`, {
          cause: error,
          details: { path, options }
        });
      }

      throw error;
    }
  }

  /**
   * Closes the client and cleans up resources.
   *
   * This method should be called when the client is no longer needed
   * to properly close any open connections and free resources. It
   * delegates to the transport adapter's close method to handle
   * transport-specific cleanup.
   *
   * It's good practice to call this method in test teardown or in
   * try/finally blocks to ensure resources are properly released,
   * especially for long-running tests or applications.
   */
  close(): void {
    this.transport.close();
  }
}
