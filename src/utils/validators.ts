/**
 * Response validation utilities
 * Provides functions for validating MCP responses against schemas
 */

import { ValidationResult } from '../core/types';

/**
 * Schema validation options
 */
export interface SchemaValidationOptions {
  /** Whether to allow additional properties not defined in the schema */
  allowAdditionalProperties?: boolean;
  /** Whether to require all properties defined in the schema */
  requireAllProperties?: boolean;
  /** Custom error messages for specific validation failures */
  customErrorMessages?: Record<string, string>;
}

/**
 * ResponseValidator class
 * Provides utilities for validating MCP responses
 */
export class ResponseValidator {
  /**
   * Validate a tool response against a schema
   * @param response Response to validate
   * @param schema Schema to validate against (optional)
   * @returns Validation result
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
   * Validate a resource against a schema
   * @param resource Resource to validate
   * @param schema Schema to validate against (optional)
   * @returns Validation result
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
   * Validate a schema
   * @param schema Schema to validate
   * @returns Validation result
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
   * Create a schema validator function
   * @param schema Schema to validate against
   * @param options Validation options
   * @returns Validator function
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
