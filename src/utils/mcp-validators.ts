/**
 * MCP SDK Validation utilities.
 *
 * This module provides functions and classes for validating MCP (Model Context Protocol)
 * requests and responses using the schemas defined in the MCP SDK.
 *
 * The validation is primarily performed using Zod schemas, which provide
 * type checking and validation with detailed error messages.
 *
 * Key features:
 * - Validation of JSON-RPC request and response objects
 * - Support for all standard MCP endpoint schemas
 * - Custom validation options and error messages
 * - Type-safe validation results
 *
 * @module mcp-validators
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
 * Configuration options for MCP validation.
 *
 * These options control the behavior of the validation process,
 * including handling of additional properties and custom error messages.
 *
 * @interface
 */
export interface MCPValidationOptions {
  /**
   * Whether to allow additional properties not defined in the schema.
   * When true, extra properties not in the schema won't cause validation errors.
   * @default false
   */
  allowExtraProperties?: boolean;

  /**
   * Custom error message for validation failure.
   * When provided, this message will be used instead of the detailed Zod error messages.
   * Useful for providing more user-friendly error messages.
   */
  customErrorMessage?: string;
}

/**
 * MCP Validator class.
 *
 * This class provides static methods for validating MCP requests and responses
 * using the Zod schemas defined in the MCP SDK. It supports validation for all
 * standard MCP endpoints including tools and resources operations.
 *
 * The class provides both generic validation using any Zod schema as well as
 * specific validation methods for each MCP endpoint type.
 *
 * Usage example:
 * ```typescript
 * const request = {
 *   jsonrpc: '2.0',
 *   id: '123',
 *   method: 'tools/list',
 *   params: {}
 * };
 *
 * const validationResult = MCPValidator.validateListToolsRequest(request);
 * if (!validationResult.valid) {
 *   console.error('Invalid request:', validationResult.errors);
 * }
 * ```
 */
export class MCPValidator {
  /**
   * Validates data against a Zod schema.
   *
   * This is the core validation method that all other validation methods use.
   * It takes any data and validates it against a Zod schema, returning
   * a ValidationResult object indicating success or failure.
   *
   * In case of validation failure, detailed error messages are included
   * in the result, unless a custom error message is provided in the options.
   *
   * @param {unknown} data - The data to validate
   * @param {z.ZodType<any>} schema - The Zod schema to validate against
   * @param {MCPValidationOptions} [options={}] - Validation options
   * @returns {ValidationResult} Object indicating validation success or failure with errors
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
   * Validates a tools/list request.
   *
   * This method validates that a request conforms to the MCP tools/list
   * request schema. A valid tools/list request is a JSON-RPC message with
   * method 'tools/list' and appropriate parameters.
   *
   * @param {unknown} request - The request object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateListToolsRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, ListToolsRequestSchema);
  }

  /**
   * Validates a tools/list response.
   *
   * This method validates that a response conforms to the MCP tools/list
   * response schema. A valid tools/list response contains a list of available
   * tools with their metadata.
   *
   * @param {unknown} response - The response object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateListToolsResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, ListToolsResultSchema);
  }

  /**
   * Validates a tools/call request.
   *
   * This method validates that a request conforms to the MCP tools/call
   * request schema. A valid tools/call request is a JSON-RPC message with
   * method 'tools/call' and parameters that include the tool name and
   * tool-specific arguments.
   *
   * @param {unknown} request - The request object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateCallToolRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, CallToolRequestSchema);
  }

  /**
   * Validates a tools/call response.
   *
   * This method validates that a response conforms to the MCP tools/call
   * response schema. A valid tools/call response contains the result of
   * the tool execution or error information.
   *
   * @param {unknown} response - The response object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateToolCallResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, CallToolResultSchema);
  }

  /**
   * Validates a resources/list request.
   *
   * This method validates that a request conforms to the MCP resources/list
   * request schema. A valid resources/list request is a JSON-RPC message with
   * method 'resources/list' and optional filter parameters.
   *
   * @param {unknown} request - The request object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateListResourcesRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, ListResourcesRequestSchema);
  }

  /**
   * Validates a resources/list response.
   *
   * This method validates that a response conforms to the MCP resources/list
   * response schema. A valid resources/list response contains a list of available
   * resources with their metadata.
   *
   * @param {unknown} response - The response object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateListResourcesResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, ListResourcesResultSchema);
  }

  /**
   * Validates a resources/read request.
   *
   * This method validates that a request conforms to the MCP resources/read
   * request schema. A valid resources/read request is a JSON-RPC message with
   * method 'resources/read' and parameters that include the resource identifier.
   *
   * @param {unknown} request - The request object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateReadResourceRequest(request: unknown): ValidationResult {
    return this.validateWithZod(request, ReadResourceRequestSchema);
  }

  /**
   * Validates a resources/read response.
   *
   * This method validates that a response conforms to the MCP resources/read
   * response schema. A valid resources/read response contains the content and
   * metadata of the requested resource.
   *
   * @param {unknown} response - The response object to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateReadResourceResponse(response: unknown): ValidationResult {
    return this.validateWithZod(response, ReadResourceResultSchema);
  }
}
