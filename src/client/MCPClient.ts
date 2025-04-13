import { Client, SSEClientTransport, JSONRPCMessage } from '@modelcontextprotocol/sdk';
import { MCPValidator } from '../validator/MCPValidator.js'; // 既存のバリデーター

/**
 * フルMCP SDKクライアント実装
 * MCP SDKのClientクラスを完全に活用した高機能実装
 *
 * @remarks
 * このクラスはMCP SDKの {@link Client} クラスをラップし、より使いやすいAPIを提供します。
 * {@link MCPClientAdapter} よりも高機能で、MCP SDKの機能を最大限に活用したい場合に使用します。
 * 新規開発では、このクラスを使用することを推奨します。
 *
 * @example
 * ```typescript
 * // MCPClientの初期化と接続
 * const client = new MCPClient({
 *   baseUrl: 'https://api.example.com/mcp',
 *   headers: { 'API-Key': 'your-api-key' }
 * });
 *
 * await client.initialize(); // 接続を確立
 *
 * // ツールの一覧を取得
 * const tools = await client.listTools();
 *
 * // ツールを実行
 * const result = await client.executeTool('calculator', {
 *   operation: 'add',
 *   a: 5,
 *   b: 3
 * });
 *
 * // 接続を閉じる
 * await client.close();
 * ```
 *
 * @see {@link MCPClientAdapter} - 既存コードとの互換性が必要な場合はこちらを使用
 * @see {@link ValidatedMCPClient} - リクエスト/レスポンスの検証が必要な場合はこちらを使用
 */
export class MCPClient {
  private client: Client;
  private transport: SSEClientTransport;

  constructor(config: {
    baseUrl: string;
    headers?: Record<string, string>;
  }) {
    // SSEClientTransportを初期化
    this.transport = new SSEClientTransport({
      baseUrl: config.baseUrl,
      headers: config.headers || {},
    });

    // Clientインスタンスを作成
    this.client = new Client({
      transport: this.transport,
    });

    // イベントハンドラの設定
    this.setupEventHandlers();
  }

  /**
   * クライアントを初期化し、MCP接続を確立する
   *
   * @remarks
   * MCP SDKのClient初期化処理を実行します。
   * この処理によりハンドシェイクが実行され、セッションが確立されます。
   * 他のメソッドを呼び出す前に必ずこのメソッドを実行してください。
   *
   * @example
   * ```typescript
   * const client = new MCPClient({
   *   baseUrl: 'https://api.example.com/mcp',
   *   headers: { 'API-Key': 'your-api-key' }
   * });
   *
   * await client.initialize(); // 接続を確立
   * ```
   *
   * @returns 初期化が完了するとresolveするPromise
   * @throws 初期化に失敗した場合にエラーをスロー
   */
  async initialize(): Promise<void> {
    await this.client.initialize();
    console.log('MCP Client initialized successfully!');
  }

  /**
   * 利用可能なツールのリストを取得
   */
  async listTools(): Promise<any> {
    // リクエストオブジェクトを作成（バリデーション用）
    const request = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'tools/list',
      params: {}
    };

    // バリデーターがある場合はリクエストを検証
    if (MCPValidator) {
      const requestValidation = MCPValidator.validateListToolsRequest(request);
      if (!requestValidation.valid) {
        throw new Error(`Invalid request: ${JSON.stringify(requestValidation.errors)}`);
      }
    }

    // リクエスト実行
    const response = await this.client.call('tools/list', {});

    // バリデーターがある場合はレスポンスを検証
    if (MCPValidator) {
      const responseValidation = MCPValidator.validateListToolsResponse(response);
      if (!responseValidation.valid) {
        throw new Error(`Invalid response: ${JSON.stringify(responseValidation.errors)}`);
      }
    }

    return response;
  }

  /**
   * ツールを実行
   */
  async executeTool(name: string, params: any): Promise<any> {
    return this.client.call('tools/execute', {
      name,
      params,
    });
  }

  /**
   * リソースを取得
   */
  async getResource(id: string): Promise<any> {
    return this.client.call('resources/get', { id });
  }

  /**
   * プロンプトを作成
   */
  async createPrompt(content: string, options: any = {}): Promise<any> {
    return this.client.call('prompts/create', {
      content,
      ...options
    });
  }

  /**
   * プロンプトを実行
   */
  async runPrompt(promptId: string, params: any = {}): Promise<any> {
    return this.client.call('prompts/run', {
      id: promptId,
      params
    });
  }

  /**
   * MCP接続を閉じる
   */
  async close(): Promise<void> {
    await this.client.close();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventHandlers(): void {
    this.transport.onmessage = (message: JSONRPCMessage) => {
      console.log('Received message:', message);
      // 必要に応じてメッセージハンドリングの追加実装
    };

    this.transport.onclose = () => {
      console.log('Connection closed');
    };

    this.transport.onerror = (error: Error) => {
      console.error('Transport error:', error);
    };
  }

  /**
   * セッションID取得
   */
  get sessionId(): string | undefined {
    return this.transport.sessionId;
  }

  /**
   * メッセージハンドラを設定
   */
  setMessageHandler(handler: (message: JSONRPCMessage) => void): void {
    this.transport.onmessage = handler;
  }

  /**
   * クローズハンドラを設定
   */
  setCloseHandler(handler: () => void): void {
    this.transport.onclose = handler;
  }

  /**
   * エラーハンドラを設定
   */
  setErrorHandler(handler: (error: Error) => void): void {
    this.transport.onerror = handler;
  }
}
