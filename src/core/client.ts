/**
 * MCPTestClient implementation
 * Core client for interacting with MCP servers during testing
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
 * MCPTestClient
 * Main client for interacting with MCP servers in tests
 */
export class MCPTestClient {
  private baseUrl: string;
  private authToken?: string;
  private timeout: number;
  private headers: Record<string, string>;
  private transport: TransportAdapter;
  private responseFormat: 'json' | 'text' | 'binary';

  /**
   * Create a new MCP Test Client
   * @param options Client configuration options
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
   * Set authentication token for subsequent requests
   * @param token Authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get default headers including authentication if available
   * @returns Headers object
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
   * Call an MCP tool
   * @param toolName Name of the tool to call
   * @param params Parameters to pass to the tool
   * @returns Promise resolving to the tool response
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
   * Call an MCP tool and receive streaming responses
   * @param toolName Name of the tool to call
   * @param params Parameters to pass to the tool
   * @returns AsyncGenerator yielding stream events
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
   * Get all resources from the MCP server
   * @returns Promise resolving to an array of resources
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
   * Get a specific resource by ID
   * @param resourceId ID of the resource to get
   * @returns Promise resolving to the resource
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
   * Get the MCP server schema
   * @returns Promise resolving to the schema
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
   * Send a raw request to the MCP server
   * @param path Request path (will be appended to baseUrl)
   * @param options Request options
   * @returns Promise resolving to the response
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
   * Close the client and clean up resources
   */
  close(): void {
    this.transport.close();
  }
}
