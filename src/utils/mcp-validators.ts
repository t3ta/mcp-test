/**
 * MCP SDK Validation utilities
 * Provides functions for validating MCP requests and responses using MCP SDK schemas
 */

import * as z from 'zod';
import { ValidationResult } from '../core/types';
import {
  ListToolsRequestSchema,
  ListToolsResultSchema,
  CallToolRequestSchema,
  CallToolResultSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema
} from '@modelcontextprotocol/sdk/types';

/**
 * JSONRPC Response validation options
 */
export interface MCPValidationOptions {
  /** Whether to allow additional properties not defined in the schema */
  allowExtraProperties?: boolean;
  /** Custom error message for validation failure */
  customErrorMessage?: string;
}

/**
 * MCP Validator class
 * Provides utilities for validating MCP requests and responses using MCP SDK schemas
 */
export class MCPValidator {
  /**
   * Validate a MCP request or response against a Zod schema
   * @param data Data to validate
   * @param schema Zod schema to validate against
   * @param options Validation options
   * @returns Validation result
   */
  static validateWithZod(data: unknown, schema: any, options: MCPValidationOptions = {}): ValidationResult {
    try {
      schema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = options.customErrorMessage
          ? [options.customErrorMessage]
          : error.errors.map(err => `${err.path.join('.')}: ${err.message}`);

        return { valid: false, errors };
      }

      return {
        valid: false,
        errors: [(error as Error).message || 'Unknown validation error']
      };
    }
  }

  /**
   * Validate tools/list request
   * @param request Request to validate
   * @returns Validation result
   */
  static validateListToolsRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, ListToolsRequestSchema);
  }

  /**
   * Validate tools/list response
   * @param response Response to validate
   * @returns Validation result
   */
  static validateListToolsResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, ListToolsResultSchema);
  }

  /**
   * Validate tools/call request
   * @param request Request to validate
   * @returns Validation result
   */
  static validateCallToolRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, CallToolRequestSchema);
  }

  /**
   * Validate tools/call response
   * @param response Response to validate
   * @returns Validation result
   */
  static validateToolCallResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, CallToolResultSchema);
  }

  /**
   * Validate resources/list request
   * @param request Request to validate
   * @returns Validation result
   */
  static validateListResourcesRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, ListResourcesRequestSchema);
  }

  /**
   * Validate resources/list response
   * @param response Response to validate
   * @returns Validation result
   */
  static validateListResourcesResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, ListResourcesResultSchema);
  }

  /**
   * Validate resources/read request
   * @param request Request to validate
   * @returns Validation result
   */
  static validateReadResourceRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, ReadResourceRequestSchema);
  }

  /**
   * Validate resources/read response
   * @param response Response to validate
   * @returns Validation result
   */
  static validateReadResourceResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, ReadResourceResultSchema);
  }
}
