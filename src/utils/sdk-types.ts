/**
 * SDK Type Definitions Bridge
 * Provides mapping between MCP SDK types and our custom types
 */

import { Client, SSEClientTransport } from '@modelcontextprotocol/sdk';
import type { RequestOptions } from '../core/types';

// Export the SDK types we need
export { Client, SSEClientTransport };

/**
 * Type definitions from MCP SDK
 * Note: These are inferred from the SDK and might change between versions
 */

// SDK CallTool Types
export interface CallToolParams {
  name: string;
  arguments: any;
}

// SDK ListResources Types
export interface ListResourcesResult {
  resources: Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
  }>;
  nextCursor?: string;
}

// SDK ListTools Types
export interface ListToolsResult {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, any>;
    };
  }>;
  nextCursor?: string;
}

/**
 * Type-safe methods for the SDK Client class
 * Acts as a bridge between our types and the SDK types
 */
export interface TypedSDKClient {
  /**
   * Call a tool with typed parameters
   */
  callTool(params: CallToolParams): Promise<any>;

  /**
   * List resources with typed results
   */
  listResources(params?: any): Promise<ListResourcesResult>;

  /**
   * List tools with typed results
   */
  listTools(params?: any): Promise<ListToolsResult>;
}

/**
 * Type assertion helper to convert any Client to TypedSDKClient
 * @param client SDK Client instance
 * @returns The same client with type-safe methods
 */
export function asTypedClient(client: Client): TypedSDKClient {
  return client as unknown as TypedSDKClient;
}
