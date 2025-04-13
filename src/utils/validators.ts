/**
 * Response validation utilities.
 *
 * This module provides functions and classes for validating MCP (Model Context Protocol)
 * responses against schemas without dependencies on external validation libraries.
 *
 * Unlike the mcp-validators module which uses Zod schemas from the MCP SDK,
 * this module implements its own schema validation logic for greater flexibility
 * and customization in validation rules.
 *
 * Key features:
 * - Schema-based validation for tool responses and resources
 * - Support for nested object validation
 * - Type checking for primitive types
 * - Customizable validation options and error messages
 *
 * @module validators
 */

import { ValidationResult } from '../core/types';

/**
 * Configuration options for schema validation.
 *
 * These options control the behavior of the schema validation process,
 * including how to handle additional properties, required properties,
 * and custom error messages.
 *
 * @interface
 */
export interface SchemaValidationOptions {
  /**
   * Whether to allow additional properties not defined in the schema.
   * When false, properties not defined in the schema will cause validation errors.
   * @default true
   */
  allowAdditionalProperties?: boolean;

  /**
   * Whether to require all properties defined in the schema.
   * When true, missing properties will cause validation errors even if not explicitly required.
   * @default false
   */
  requireAllProperties?: boolean;

  /**
   * Custom error messages for specific validation failures.
   * Keys should be error types (e.g., 'required', 'pattern', 'enum') or property paths.
   * Values are the custom error messages to display.
   */
  customErrorMessages?: Record<string, string>;
}

/**
 * ResponseValidator class.
 *
 * This class provides static methods for validating MCP responses and resources
 * against schemas. It includes dedicated methods for validating tool responses,
 * resources, and schemas themselves.
 *
 * The validator performs structural validation (checking required fields and types)
 * as well as schema-based validation for more complex validations when a schema
 * is provided.
 *
 * All validation methods return a ValidationResult object indicating success or
 * failure, with detailed error messages when validation fails.
 *
 * Example usage:
 * ```typescript
 * const response = await client.callTool('calculator', { operation: 'add', a: 5, b: 3 });
 * const validationResult = ResponseValidator.validateToolResponse(response);
 * if (!validationResult.valid) {
 *   console.error('Response validation failed:', validationResult.errors);
 * }
 * ```
 */
export class ResponseValidator {
  /**
   * Validates a tool response against a schema.
   *
   * This method validates that a tool response has the correct structure
   * and contains all required fields based on its status. It checks:
   *
   * 1. Basic structure (non-null object)
   * 2. Presence of the required 'status' field with a valid value
   * 3. Status-specific fields:
   *    - 'success' status requires a 'result' field
   *    - 'error' status requires an 'error' field
   *    - 'accepted' status requires a 'taskId' field
   * 4. If a schema is provided, validates the 'result' field against that schema
   *
   * @param {any} response - The tool response to validate
   * @param {any} [schema] - Optional schema to validate the result field against
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateToolResponse(response: any, schema?: any): ValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    if (!response) {
      errors.push('Response is null or undefined');
      return { valid: false, errors };
    }

    if (typeof response !== 'object') {
      errors.push(`Response is not an object: ${typeof response}`);
      return { valid: false, errors };
    }

    // Status validation
    if (!response.status) {
      errors.push('Response is missing required "status" field');
    } else if (!['success', 'error', 'accepted'].includes(response.status)) {
      errors.push(`Invalid status value: ${response.status}`);
    }

    // Result validation for success status
    if (response.status === 'success' && response.result === undefined) {
      errors.push('Success response is missing "result" field');
    }

    // Error validation for error status
    if (response.status === 'error' && !response.error) {
      errors.push('Error response is missing "error" field');
    }

    // TaskId validation for accepted status
    if (response.status === 'accepted' && !response.taskId) {
      errors.push('Accepted response is missing "taskId" field');
    }

    // Schema validation if provided
    if (schema && response.result) {
      try {
        const schemaValidator = this.createSchemaValidator(schema);
        const schemaResult = schemaValidator(response.result);

        if (!schemaResult.valid) {
          errors.push(...(schemaResult.errors || []));
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push(`Schema validation error: ${error.message}`);
        } else {
          errors.push('Unknown schema validation error');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validates a resource against a schema.
   *
   * This method validates that a resource has the correct structure
   * and contains all required fields. It checks:
   *
   * 1. Basic structure (non-null object)
   * 2. Presence of required fields:
   *    - id: unique identifier
   *    - type: resource type
   *    - name: human-readable name
   * 3. If a schema is provided, validates the resource against that schema
   *
   * @param {any} resource - The resource to validate
   * @param {any} [schema] - Optional schema to validate the resource against
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateResource(resource: any, schema?: any): ValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    if (!resource) {
      errors.push('Resource is null or undefined');
      return { valid: false, errors };
    }

    if (typeof resource !== 'object') {
      errors.push(`Resource is not an object: ${typeof resource}`);
      return { valid: false, errors };
    }

    // Required fields validation
    if (!resource.id) {
      errors.push('Resource is missing required "id" field');
    }

    if (!resource.type) {
      errors.push('Resource is missing required "type" field');
    }

    if (!resource.name) {
      errors.push('Resource is missing required "name" field');
    }

    // Schema validation if provided
    if (schema) {
      try {
        const schemaValidator = this.createSchemaValidator(schema);
        const schemaResult = schemaValidator(resource);

        if (!schemaResult.valid) {
          errors.push(...(schemaResult.errors || []));
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push(`Schema validation error: ${error.message}`);
        } else {
          errors.push('Unknown schema validation error');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validates an MCP schema for structural correctness.
   *
   * This method validates that a schema has the correct structure
   * and contains all required sections and fields. It checks:
   *
   * 1. Basic structure (non-null object)
   * 2. Tools section:
   *    - Must be an array
   *    - Each tool must have a name and parameters
   * 3. Resources section:
   *    - Must be an array
   *    - Each resource must have a type and properties
   *
   * This validation ensures that the schema itself is well-formed
   * before it is used to validate other objects.
   *
   * @param {any} schema - The schema to validate
   * @returns {ValidationResult} Object indicating validation success or failure with errors
   */
  static validateSchema(schema: any): ValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    if (!schema) {
      errors.push('Schema is null or undefined');
      return { valid: false, errors };
    }

    if (typeof schema !== 'object') {
      errors.push(`Schema is not an object: ${typeof schema}`);
      return { valid: false, errors };
    }

    // Tools validation
    if (!Array.isArray(schema.tools)) {
      errors.push('Schema is missing or has invalid "tools" array');
    } else {
      // Validate each tool
      schema.tools.forEach((tool: any, index: number) => {
        if (!tool.name) {
          errors.push(`Tool at index ${index} is missing required "name" field`);
        }

        if (!tool.parameters) {
          errors.push(`Tool at index ${index} is missing required "parameters" field`);
        }
      });
    }

    // Resources validation
    if (!Array.isArray(schema.resources)) {
      errors.push('Schema is missing or has invalid "resources" array');
    } else {
      // Validate each resource
      schema.resources.forEach((resource: any, index: number) => {
        if (!resource.type) {
          errors.push(`Resource at index ${index} is missing required "type" field`);
        }

        if (!resource.properties || typeof resource.properties !== 'object') {
          errors.push(`Resource at index ${index} is missing or has invalid "properties" field`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Creates a schema validator function based on the provided schema.
   *
   * This method dynamically generates a validation function tailored to
   * a specific schema. The returned function can be used to validate
   * data against that schema, following these validation rules:
   *
   * - For array schemas: validates that the data is an array and optionally
   *   validates each item against an item schema
   * - For object schemas: validates object structure, required properties,
   *   property types, and handles nested validation
   * - For primitive types: validates type, format, range, and enumeration constraints
   *
   * The generated validator respects the provided options for allowing
   * additional properties, requiring all properties, and custom error messages.
   *
   * @param {any} schema - Schema to validate against
   * @param {SchemaValidationOptions} [options={}] - Validation options
   * @returns {function(any): ValidationResult} A validator function that takes data and returns validation results
   */
  static createSchemaValidator(schema: any, options: SchemaValidationOptions = {}): (data: any) => ValidationResult {
    const allowAdditional = options.allowAdditionalProperties !== false;
    const requireAll = options.requireAllProperties === true;
    const customMessages = options.customErrorMessages || {};

    return (data: any): ValidationResult => {
      const errors: string[] = [];

      // Handle different schema types
      if (!schema || typeof schema !== 'object') {
        errors.push('Invalid schema: must be an object');
        return { valid: false, errors };
      }

      // Handle array schema
      if (Array.isArray(schema)) {
        if (!Array.isArray(data)) {
          errors.push(`Expected array, got ${typeof data}`);
          return { valid: false, errors };
        }

        // If schema has an item definition, validate each item
        if (schema.length > 0) {
          const itemSchema = schema[0];
          data.forEach((item, index) => {
            const itemResult = this.createSchemaValidator(itemSchema, options)(item);
            if (!itemResult.valid && itemResult.errors) {
              errors.push(...itemResult.errors.map(err => `[${index}] ${err}`));
            }
          });
        }

        return {
          valid: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined
        };
      }

      // Handle object schema
      if (schema.type === 'object' || schema.properties) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          errors.push(`Expected object, got ${Array.isArray(data) ? 'array' : typeof data}`);
          return { valid: false, errors };
        }

        // Check required properties
        if (schema.required && Array.isArray(schema.required)) {
          schema.required.forEach((prop: string) => {
            if (data[prop] === undefined) {
              const message = customMessages[`required.${prop}`] || `Missing required property: ${prop}`;
              errors.push(message);
            }
          });
        }

        // Check all properties if requireAll is true
        if (requireAll && schema.properties) {
          Object.keys(schema.properties).forEach((prop: string) => {
            if (data[prop] === undefined) {
              const message = customMessages[`missing.${prop}`] || `Missing property: ${prop}`;
              errors.push(message);
            }
          });
        }

        // Validate defined properties
        if (schema.properties) {
          Object.keys(schema.properties).forEach((prop: string) => {
            if (data[prop] !== undefined) {
              const propSchema = schema.properties[prop];
              const propResult = this.createSchemaValidator(propSchema, options)(data[prop]);
              if (!propResult.valid && propResult.errors) {
                errors.push(...propResult.errors.map(err => `${prop}: ${err}`));
              }
            }
          });
        }

        // Check for additional properties
        if (!allowAdditional && schema.properties) {
          Object.keys(data).forEach((prop: string) => {
            if (!schema.properties[prop]) {
              const message = customMessages['additionalProperties'] || `Additional property not allowed: ${prop}`;
              errors.push(message);
            }
          });
        }

        return {
          valid: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined
        };
      }

      // Handle primitive types
      if (schema.type) {
        switch (schema.type) {
          case 'string':
            if (typeof data !== 'string') {
              errors.push(`Expected string, got ${typeof data}`);
            } else if (schema.pattern) {
              const regex = new RegExp(schema.pattern);
              if (!regex.test(data)) {
                const message = customMessages['pattern'] || `String does not match pattern: ${schema.pattern}`;
                errors.push(message);
              }
            } else if (schema.enum && Array.isArray(schema.enum)) {
              if (!schema.enum.includes(data)) {
                const message = customMessages['enum'] || `Value must be one of: ${schema.enum.join(', ')}`;
                errors.push(message);
              }
            }
            break;

          case 'number':
          case 'integer':
            if (typeof data !== 'number') {
              errors.push(`Expected ${schema.type}, got ${typeof data}`);
            } else if (schema.type === 'integer' && !Number.isInteger(data)) {
              errors.push('Expected integer');
            } else {
              if (schema.minimum !== undefined && data < schema.minimum) {
                const message = customMessages['minimum'] || `Value must be >= ${schema.minimum}`;
                errors.push(message);
              }
              if (schema.maximum !== undefined && data > schema.maximum) {
                const message = customMessages['maximum'] || `Value must be <= ${schema.maximum}`;
                errors.push(message);
              }
            }
            break;

          case 'boolean':
            if (typeof data !== 'boolean') {
              errors.push(`Expected boolean, got ${typeof data}`);
            }
            break;

          case 'null':
            if (data !== null) {
              errors.push(`Expected null, got ${typeof data}`);
            }
            break;

          default:
            errors.push(`Unsupported schema type: ${schema.type}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    };
  }
}
