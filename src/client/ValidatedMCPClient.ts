import { Client } from '@modelcontextprotocol/sdk';
import { MCPValidator } from '../validator/MCPValidator.js'; // 既存のバリデーター

/**
 * バリデーション機能付きMCPクライアントデコレーター
 * エンドポイントごとにリクエストとレスポンスの検証を行う
 *
 * @remarks
 * このクラスはデコレーターパターンを使用して、MCP SDKの {@link Client} に
 * リクエストとレスポンスのバリデーション機能を追加します。
 * データの整合性や型安全性を重視するケースで使用します。
 *
 * @example
 * ```typescript
 * // まずMCPClientを初期化
 * const mcpClient = new MCPClient({
 *   baseUrl: 'https://api.example.com/mcp',
 *   headers: { 'API-Key': 'your-api-key' }
 * });
 *
 * await mcpClient.initialize();
 *
 * // SDK Client取得（内部実装から取り出す必要あり）
 * const sdkClient = mcpClient['client'];
 *
 * // バリデーション付きクライアントを作成
 * const validatedClient = new ValidatedMCPClient(sdkClient);
 *
 * // バリデーション付きでツール一覧を取得
 * const tools = await validatedClient.listTools();
 * ```
 *
 * @see {@link MCPClient} - 通常のクライアント実装
 * @see {@link MCPValidator} - 使用されるバリデーション機能
 */
export class ValidatedMCPClient {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * バリデーション付きツール一覧取得
   */
  async listTools(): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'tools/list',
      params: {}
    };

    // リクエストのバリデーション
    const requestValidation = MCPValidator.validateListToolsRequest(request);
    if (!requestValidation.valid) {
      throw new Error(`Invalid request: ${JSON.stringify(requestValidation.errors)}`);
    }

    // リクエスト実行
    const response = await this.client.call(request.method, request.params);

    // レスポンスのバリデーション
    const responseValidation = MCPValidator.validateListToolsResponse(response);
    if (!responseValidation.valid) {
      throw new Error(`Invalid response: ${JSON.stringify(responseValidation.errors)}`);
    }

    return response;
  }

  /**
   * バリデーション付きツール実行
   */
  async executeTool(name: string, params: any): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'tools/execute',
      params: { name, params }
    };

    // リクエストのバリデーション
    const requestValidation = MCPValidator.validateExecuteToolRequest(request);
    if (!requestValidation.valid) {
      throw new Error(`Invalid request: ${JSON.stringify(requestValidation.errors)}`);
    }

    // リクエスト実行
    const response = await this.client.call(request.method, request.params);

    // レスポンスのバリデーション
    const responseValidation = MCPValidator.validateExecuteToolResponse(response);
    if (!responseValidation.valid) {
      throw new Error(`Invalid response: ${JSON.stringify(responseValidation.errors)}`);
    }

    return response;
  }

  /**
   * バリデーション付きリソース取得
   */
  async getResource(id: string): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'resources/get',
      params: { id }
    };

    // リクエストのバリデーション
    const requestValidation = MCPValidator.validateGetResourceRequest(request);
    if (!requestValidation.valid) {
      throw new Error(`Invalid request: ${JSON.stringify(requestValidation.errors)}`);
    }

    // リクエスト実行
    const response = await this.client.call(request.method, request.params);

    // レスポンスのバリデーション
    const responseValidation = MCPValidator.validateGetResourceResponse(response);
    if (!responseValidation.valid) {
      throw new Error(`Invalid response: ${JSON.stringify(responseValidation.errors)}`);
    }

    return response;
  }

  /**
   * バリデーション付きカスタムメソッド呼び出し
   * 任意のメソッドに対してバリデーション付きで実行するためのユーティリティメソッド
   */
  async callValidated(
    method: string,
    params: any,
    validateRequest: (req: any) => any,
    validateResponse: (res: any) => any
  ): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method,
      params
    };

    // リクエストのバリデーション
    const requestValidation = validateRequest(request);
    if (!requestValidation.valid) {
      throw new Error(`Invalid request: ${JSON.stringify(requestValidation.errors)}`);
    }

    // リクエスト実行
    const response = await this.client.call(method, params);

    // レスポンスのバリデーション
    const responseValidation = validateResponse(response);
    if (!responseValidation.valid) {
      throw new Error(`Invalid response: ${JSON.stringify(responseValidation.errors)}`);
    }

    return response;
  }
}
