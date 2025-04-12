/**
 * Test fixtures for MCP testing
 * Provides reusable test data for MCP server tests
 */

import { MCPResource, MCPSchema, MCPToolResponse } from '../core/types';

/**
 * TestFixtures class
 * Provides reusable test data for MCP server tests
 */
export class TestFixtures {
  /**
   * Get sample tool requests for a specific tool
   * @param toolName Name of the tool
   * @returns Array of sample requests
   */
  static getToolRequests(toolName: string): any[] {
    const commonFixtures = this.getCommonToolRequests();
    const specificFixtures = this.getToolSpecificRequests(toolName);
    
    return [...commonFixtures, ...specificFixtures];
  }
  
  /**
   * Get sample tool responses for a specific tool
   * @param toolName Name of the tool
   * @returns Array of sample responses
   */
  static getToolResponses(toolName: string): MCPToolResponse[] {
    const commonFixtures = this.getCommonToolResponses();
    const specificFixtures = this.getToolSpecificResponses(toolName);
    
    return [...commonFixtures, ...specificFixtures];
  }
  
  /**
   * Get sample resources
   * @param type Optional resource type to filter by
   * @returns Array of sample resources
   */
  static getResources(type?: string): MCPResource[] {
    const resources = [
      {
        id: 'resource-1',
        type: 'document',
        name: 'Sample Document',
        description: 'A sample document resource',
        metadata: {
          created: '2025-04-01T12:00:00Z',
          size: 1024
        }
      },
      {
        id: 'resource-2',
        type: 'image',
        name: 'Sample Image',
        description: 'A sample image resource',
        metadata: {
          created: '2025-04-02T12:00:00Z',
          width: 800,
          height: 600
        }
      },
      {
        id: 'resource-3',
        type: 'document',
        name: 'Another Document',
        description: 'Another sample document resource',
        metadata: {
          created: '2025-04-03T12:00:00Z',
          size: 2048
        }
      }
    ];
    
    if (type) {
      return resources.filter(resource => resource.type === type);
    }
    
    return resources;
  }
  
  /**
   * Get sample schema
   * @returns Sample MCP schema
   */
  static getSchema(): MCPSchema {
    return {
      tools: [
        {
          name: 'echo',
          description: 'Echo the input message',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to echo'
              }
            },
            required: ['message']
          },
          returns: {
            type: 'string'
          }
        },
        {
          name: 'calculator',
          description: 'Perform a calculation',
          parameters: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['add', 'subtract', 'multiply', 'divide'],
                description: 'Operation to perform'
              },
              a: {
                type: 'number',
                description: 'First operand'
              },
              b: {
                type: 'number',
                description: 'Second operand'
              }
            },
            required: ['operation', 'a', 'b']
          },
          returns: {
            type: 'number'
          }
        },
        {
          name: 'fetchData',
          description: 'Fetch data from a source',
          parameters: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Data source'
              },
              filter: {
                type: 'object',
                description: 'Optional filter criteria'
              }
            },
            required: ['source']
          }
        }
      ],
      resources: [
        {
          type: 'document',
          description: 'Document resource',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            content: {
              type: 'string'
            },
            metadata: {
              type: 'object'
            }
          }
        },
        {
          type: 'image',
          description: 'Image resource',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            url: {
              type: 'string'
            },
            metadata: {
              type: 'object',
              properties: {
                width: {
                  type: 'number'
                },
                height: {
                  type: 'number'
                },
                format: {
                  type: 'string'
                }
              }
            }
          }
        }
      ]
    };
  }
  
  /**
   * Create a custom fixture by merging a template with overrides
   * @param template Base template object
   * @param overrides Properties to override
   * @returns Merged fixture
   */
  static createCustomFixture<T>(template: T, overrides?: Partial<T>): T {
    if (!overrides) {
      return { ...template };
    }
    
    return { ...template, ...overrides };
  }
  
  /**
   * Get common tool requests that work with most tools
   * @returns Array of common tool requests
   * @private
   */
  private static getCommonToolRequests(): any[] {
    return [
      {}, // Empty request
      { invalid: true }, // Invalid request
      { timeout: true } // Request that would cause timeout
    ];
  }
  
  /**
   * Get tool-specific sample requests
   * @param toolName Name of the tool
   * @returns Array of tool-specific requests
   * @private
   */
  private static getToolSpecificRequests(toolName: string): any[] {
    switch (toolName) {
      case 'echo':
        return [
          { message: 'Hello, world!' },
          { message: '' },
          { message: 'Special characters: !@#$%^&*()' }
        ];
        
      case 'calculator':
        return [
          { operation: 'add', a: 5, b: 3 },
          { operation: 'subtract', a: 10, b: 4 },
          { operation: 'multiply', a: 3, b: 4 },
          { operation: 'divide', a: 10, b: 2 },
          { operation: 'divide', a: 5, b: 0 } // Error case
        ];
        
      case 'fetchData':
        return [
          { source: 'test-db' },
          { source: 'test-db', filter: { status: 'active' } },
          { source: 'non-existent' } // Error case
        ];
        
      default:
        return [];
    }
  }
  
  /**
   * Get common tool responses
   * @returns Array of common tool responses
   * @private
   */
  private static getCommonToolResponses(): MCPToolResponse[] {
    return [
      {
        status: 'error',
        error: 'Invalid request'
      },
      {
        status: 'error',
        error: 'Tool not found'
      },
      {
        status: 'accepted',
        taskId: 'task-123'
      }
    ];
  }
  
  /**
   * Get tool-specific sample responses
   * @param toolName Name of the tool
   * @returns Array of tool-specific responses
   * @private
   */
  private static getToolSpecificResponses(toolName: string): MCPToolResponse[] {
    switch (toolName) {
      case 'echo':
        return [
          {
            status: 'success',
            result: 'Hello, world!'
          },
          {
            status: 'success',
            result: ''
          }
        ];
        
      case 'calculator':
        return [
          {
            status: 'success',
            result: 8 // 5 + 3
          },
          {
            status: 'success',
            result: 6 // 10 - 4
          },
          {
            status: 'success',
            result: 12 // 3 * 4
          },
          {
            status: 'success',
            result: 5 // 10 / 2
          },
          {
            status: 'error',
            error: 'Division by zero'
          }
        ];
        
      case 'fetchData':
        return [
          {
            status: 'success',
            result: {
              items: [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
              ],
              total: 2
            }
          },
          {
            status: 'success',
            result: {
              items: [
                { id: 1, name: 'Item 1', status: 'active' }
              ],
              total: 1
            }
          },
          {
            status: 'error',
            error: 'Data source not found'
          }
        ];
        
      default:
        return [];
    }
  }
}
