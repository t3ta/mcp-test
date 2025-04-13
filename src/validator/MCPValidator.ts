import { z } from 'zod';
import { ValidationResult, MCPValidationOptions } from '../types/index.js';

/**
 * MCP通信のバリデーション機能を提供するクラス
 * Zodスキーマを使ってMCPリクエスト/レスポンスを検証
 *
 * @remarks
 * このクラスは {@link z | Zod} を使って、MCP通信のリクエストとレスポンスを
 * 検証するためのユーティリティメソッドを提供します。
 * 各MCP SDKの主要エンドポイントに対応するバリデーションメソッドが含まれています。
 *
 * @example
 * ```typescript
 * // リクエストのバリデーション
 * const request = {
 *   jsonrpc: '2.0',
 *   id: '123',
 *   method: 'tools/list',
 *   params: {}
 * };
 *
 * const validation = MCPValidator.validateListToolsRequest(request);
 * if (!validation.valid) {
 *   console.error('Invalid request:', validation.errors);
 * }
 *
 * // レスポンスのバリデーション
 * const response = await client.callTool('list', {});
 * const responseValidation = MCPValidator.validateListToolsResponse(response);
 * if (!responseValidation.valid) {
 *   console.error('Invalid response:', responseValidation.errors);
 * }
 * ```
 *
 * @see {@link ValidatedMCPClient} - このバリデーターを使用したクライアント実装
 */
export class MCPValidator {
  /**
   * Zodスキーマを使ってデータをバリデーション
   */
  static validateWithZod(
    data: unknown,
    schema: z.ZodType<any>,
    options: MCPValidationOptions = {}
  ): ValidationResult {
    try {
      schema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors
        };
      }
      return {
        valid: false,
        errors: [{ message: 'Unknown validation error', error }]
      };
    }
  }

  /**
   * tools/listリクエストのバリデーション
   */
  static validateListToolsRequest(request: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      method: z.literal('tools/list'),
      params: z.object({}).optional()
    });

    return MCPValidator.validateWithZod(request, schema);
  }

  /**
   * tools/listレスポンスのバリデーション
   */
  static validateListToolsResponse(response: unknown): ValidationResult {
    const toolSchema = z.object({
      name: z.string(),
      description: z.string().optional(),
      version: z.string().optional(),
      parameters: z.any().optional()
    });

    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      result: z.object({
        tools: z.array(toolSchema)
      })
    });

    return MCPValidator.validateWithZod(response, schema);
  }

  /**
   * tools/executeリクエストのバリデーション
   */
  static validateExecuteToolRequest(request: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      method: z.literal('tools/execute'),
      params: z.object({
        name: z.string(),
        params: z.any()
      })
    });

    return MCPValidator.validateWithZod(request, schema);
  }

  /**
   * tools/executeレスポンスのバリデーション
   */
  static validateExecuteToolResponse(response: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      result: z.any()
    });

    return MCPValidator.validateWithZod(response, schema);
  }

  /**
   * resources/getリクエストのバリデーション
   */
  static validateGetResourceRequest(request: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      method: z.literal('resources/get'),
      params: z.object({
        id: z.string()
      })
    });

    return MCPValidator.validateWithZod(request, schema);
  }

  /**
   * resources/getレスポンスのバリデーション
   */
  static validateGetResourceResponse(response: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      result: z.object({
        id: z.string(),
        type: z.string(),
        data: z.any()
      })
    });

    return MCPValidator.validateWithZod(response, schema);
  }

  /**
   * prompts/createリクエストのバリデーション
   */
  static validateCreatePromptRequest(request: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      method: z.literal('prompts/create'),
      params: z.object({
        content: z.string(),
        metadata: z.any().optional()
      })
    });

    return MCPValidator.validateWithZod(request, schema);
  }

  /**
   * prompts/createレスポンスのバリデーション
   */
  static validateCreatePromptResponse(response: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      result: z.object({
        id: z.string(),
        content: z.string(),
        metadata: z.any().optional()
      })
    });

    return MCPValidator.validateWithZod(response, schema);
  }

  /**
   * prompts/runリクエストのバリデーション
   */
  static validateRunPromptRequest(request: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      method: z.literal('prompts/run'),
      params: z.object({
        id: z.string(),
        params: z.any().optional()
      })
    });

    return MCPValidator.validateWithZod(request, schema);
  }

  /**
   * prompts/runレスポンスのバリデーション
   */
  static validateRunPromptResponse(response: unknown): ValidationResult {
    const schema = z.object({
      jsonrpc: z.literal('2.0'),
      id: z.string(),
      result: z.any()
    });

    return MCPValidator.validateWithZod(response, schema);
  }
}
