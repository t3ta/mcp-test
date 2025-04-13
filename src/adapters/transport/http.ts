/**
 * HTTP Transport Adapter implementation.
 *
 * This module provides HTTP-based communication with MCP (Model Context Protocol) servers.
 * It implements both the TransportAdapter interface for standard HTTP requests and
 * the MCP Transport interface for standardized JSON-RPC communication.
 *
 * Key features:
 * - Support for HTTP requests with various formats (JSON, text, binary)
 * - Server-Sent Events (SSE) streaming support
 * - Timeout handling with automatic request abortion
 * - JSON-RPC message formatting and handling
 * - Session management
 *
 * @module http-adapter
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { RequestOptions, TransportAdapter } from '../../core/types';

/**
 * Configuration options for the HTTP Adapter.
 *
 * These options control the behavior of the HTTP adapter
 * including timeouts, headers, redirect handling, and base URL.
 *
 * @interface
 */
export interface HTTPAdapterOptions {
  /**
   * Default request timeout in milliseconds.
   * Requests that take longer than this will be aborted.
   * @default 10000
   */
  defaultTimeout?: number;

  /**
   * Default headers to include in all requests.
   * These headers will be merged with request-specific headers.
   * @default {}
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Whether to follow HTTP redirects automatically.
   * @default true
   */
  followRedirects?: boolean;

  /**
   * Maximum number of redirects to follow before aborting.
   * Only used when followRedirects is true.
   * @default 5
   */
  maxRedirects?: number;

  /**
   * Base URL for the MCP server.
   * This will be used to construct the message endpoint URL.
   * @default ''
   */
  baseUrl?: string;
}

/**
 * HTTP Transport Adapter class.
 *
 * This class provides HTTP-based communication with MCP servers.
 * It implements both the TransportAdapter interface for standard HTTP requests
 * and the MCP Transport interface for standardized JSON-RPC communication.
 *
 * The adapter supports:
 * - Regular HTTP requests with various response formats
 * - Streaming responses using Server-Sent Events (SSE)
 * - JSON-RPC message handling according to the MCP specification
 * - Timeout handling and request cancellation
 * - Session management
 *
 * @implements {TransportAdapter}
 * @implements {Transport}
 */
export class HTTPAdapter implements TransportAdapter, Transport {
  private options: HTTPAdapterOptions;
  private controller: AbortController | null = null;
  private baseUrl: string;
  private endpoint: URL | null = null;

  // MCP Transport interface callbacks
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sessionId?: string;

  /**
   * Create a new HTTP adapter
   * @param options Adapter options
   */
  constructor(options: HTTPAdapterOptions = {}) {
    this.options = {
      defaultTimeout: 10000,
      followRedirects: true,
      maxRedirects: 5,
      ...options
    };

    this.baseUrl = options.baseUrl || '';
    this.sessionId = `session-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Starts the transport connection to the MCP server.
   *
   * This method initializes the connection to the MCP server
   * by setting up the message endpoint URL. In a more complex
   * implementation, this might involve establishing a connection
   * or performing a handshake with the server.
   *
   * For HTTP-based transport, this primarily involves setting up
   * the endpoint URL for message exchange.
   *
   * This is a required method from the MCP Transport interface.
   *
   * @returns {Promise<void>} A promise that resolves when the connection is established
   * @throws {Error} If the connection cannot be established
   */
  async start(): Promise<void> {
    try {
      // In a real implementation, we might need to establish a connection
      // or perform a handshake with the server here.

      // For HTTP-based transports, we may use SSE to receive messages
      // and a separate POST endpoint to send messages.
      // We're setting a default endpoint based on the baseUrl
      this.endpoint = new URL(`${this.baseUrl}/messages`);
    } catch (error) {
      if (error instanceof Error && this.onerror) {
        this.onerror(error);
      }
      throw error;
    }
  }

  /**
   * Sends a JSON-RPC message to the MCP server.
   *
   * This method sends a JSON-RPC formatted message to the configured
   * endpoint URL. The message is sent as a POST request with
   * a JSON body. The Content-Type header is automatically set to
   * application/json.
   *
   * This is a required method from the MCP Transport interface.
   *
   * @param {JSONRPCMessage} message - The JSON-RPC message to send
   * @returns {Promise<void>} A promise that resolves when the message is sent
   * @throws {Error} If the endpoint is not set or the request fails
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.endpoint) {
      throw new Error('Transport not started or endpoint not set');
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.options.defaultHeaders
      };

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: this.controller?.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error && this.onerror) {
        this.onerror(error);
      }
      throw error;
    }
  }

  /**
   * Sends an HTTP request to the MCP server.
   *
   * This method sends an HTTP request to the specified URL with the provided options.
   * It supports various request methods, headers, body formats, and response formats.
   * The method includes automatic timeout handling and will abort the request if it
   * takes longer than the specified timeout.
   *
   * Response parsing is handled automatically based on the responseFormat option.
   * Supported formats are 'json', 'text', and 'binary'.
   *
   * @template T - The expected return type of the request
   * @param {string} url - The URL to send the request to
   * @param {RequestOptions} [options={}] - Request configuration options
   * @returns {Promise<T>} A promise that resolves to the parsed response
   * @throws {Error} If the request fails or times out
   */
  async request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.options.defaultTimeout,
      responseFormat = 'json'
    } = options;

    // Create abort controller for timeout handling
    this.controller = new AbortController();
    const { signal } = this.controller;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.controller?.abort();
    }, timeout);

    try {
      // Prepare headers
      const mergedHeaders: Record<string, string> = {
        ...this.options.defaultHeaders,
        ...headers
      };

      // Add content-type header for requests with body
      if (body && !mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }

      // Prepare request options
      const fetchOptions: RequestInit = {
        method,
        headers: mergedHeaders,
        signal,
        redirect: this.options.followRedirects ? 'follow' : 'manual'
      };

      // Add body if present
      if (body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      // Send request
      const response = await fetch(url, fetchOptions);

      // Handle response status
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      // Parse response based on format
      let result: T;
      switch (responseFormat) {
        case 'json':
          result = await response.json() as T;
          break;
        case 'text':
          result = await response.text() as unknown as T;
          break;
        case 'binary':
          result = await response.arrayBuffer() as unknown as T;
          break;
        default:
          result = await response.json() as T;
      }

      return result;
    } finally {
      clearTimeout(timeoutId);
      this.controller = null;
    }
  }

  /**
   * Opens a streaming connection to the MCP server using Server-Sent Events (SSE).
   *
   * This method establishes a streaming connection to the specified URL and yields
   * events as they are received. The connection automatically sets the Accept header
   * to 'text/event-stream' to request SSE format.
   *
   * The method includes automatic timeout handling and will reset the timeout
   * on each received event. This allows for long-running connections that won't
   * time out as long as events are being received.
   *
   * Events are parsed as JSON when possible and yielded as objects. If JSON parsing
   * fails, the raw event data is yielded instead.
   *
   * Events that match the JSON-RPC message format are also dispatched to the
   * onmessage callback if it's defined.
   *
   * @param {string} url - The URL to open the stream connection to
   * @param {RequestOptions} [options={}] - Request configuration options
   * @yields {any} Events received from the server
   * @throws {Error} If the connection fails or times out
   */
  async *openStream(url: string, options: RequestOptions = {}): AsyncGenerator<any, void, unknown> {
    const {
      headers = {},
      timeout = this.options.defaultTimeout
    } = options;

    // Create abort controller for timeout handling
    this.controller = new AbortController();
    const { signal } = this.controller;

    // Set up timeout
    let timeoutId = setTimeout(() => {
      this.controller?.abort();
    }, timeout);

    try {
      // Prepare headers
      const mergedHeaders: Record<string, string> = {
        ...this.options.defaultHeaders,
        ...headers,
        'Accept': 'text/event-stream'
      };

      // Send request
      const response = await fetch(url, {
        headers: mergedHeaders,
        signal
      });

      // Handle response status
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      // Ensure we have a readable stream
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete events in buffer
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep the last incomplete event in the buffer

        for (const event of events) {
          if (!event.trim()) continue;

          // Parse event data
          const lines = event.split('\n');
          const dataLine = lines.find(line => line.startsWith('data: '));

          if (dataLine) {
            const data = dataLine.substring(6);
            try {
              const parsedData = JSON.parse(data);

              // If this is a JSON-RPC message and we have an onmessage callback
              // from the MCP Transport interface, call it
              if (this.onmessage &&
                (parsedData.jsonrpc === '2.0' ||
                  parsedData.id !== undefined ||
                  parsedData.method !== undefined ||
                  parsedData.result !== undefined ||
                  parsedData.error !== undefined)) {
                this.onmessage(parsedData as JSONRPCMessage);
              }

              yield parsedData;

              // Reset timeout on each event
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                this.controller?.abort();
              }, timeout);
            } catch (e) {
              // If not JSON, yield raw data
              yield data;
            }
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      this.controller = null;
    }
  }

  /**
   * Closes the transport and aborts any pending requests.
   *
   * This method aborts any pending HTTP requests or SSE connections
   * by signaling the abort controller. It also calls the onclose
   * callback if it's defined.
   *
   * This is a required method from both the TransportAdapter and
   * MCP Transport interfaces.
   *
   * @returns {Promise<void>} A promise that resolves when the transport is closed
   */
  async close(): Promise<void> {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }

    // Call the onclose callback if it exists
    if (this.onclose) {
      this.onclose();
    }
  }
}
