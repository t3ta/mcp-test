import { SSEClientTransport, Transport, JSONRPCMessage, Client } from '@modelcontextprotocol/sdk';
import { TransportAdapter, RequestOptions } from '../types/index.js';

/**
 * MCPクライアントアダプター - MCP SDKを使いつつ既存APIとの互換性を保つ
 * 段階的移行のためのアダプタークラス
 * 
 * @remarks
 * このクラスは既存の {@link TransportAdapter} と MCP SDKの {@link Transport} 両方を実装しています。
 * 古いAPIから新しいMCP SDKへの段階的な移行を可能にするアダプターパターンの実装です。
 * 
 * @example
 * ```typescript
 * // MCPClientAdapterの初期化
 * const adapter = new MCPClientAdapter({
 *   baseUrl: 'https://api.example.com/mcp',
 *   defaultHeaders: { 'API-Key': 'your-api-key' }
 * });
 * 
 * // 既存のAPIとして使用（互換モード）
 * const result = await adapter.request('/tools/list', {
 *   method: 'POST',
 *   body: { jsonrpc: '2.0', id: '123', method: 'tools/list', params: {} }
 * });
 * 
 * // MCP SDKのTransportとして使用
 * await adapter.start();
 * await adapter.send({
 *   jsonrpc: '2.0',
 *   id: '123',
 *   method: 'tools/list',
 *   params: {}
 * });
 * ```
 * 
 * @see {@link MCPClient} - SDKのClientクラスを完全に活用したい場合はこちらを使用
 * @see {@link HTTPAdapter} - 従来の実装（将来的にはこのクラスに置き換え予定）
 */
export class MCPClientAdapter implements TransportAdapter, Transport {
  private transport: SSEClientTransport;
  private client: Client | null = null;

  constructor(config: {
    baseUrl: string;
    defaultHeaders?: Record<string, string>;
  }) {
    // SDKのSSEClientTransportを初期化
    this.transport = new SSEClientTransport({
      baseUrl: config.baseUrl,
      headers: config.defaultHeaders || {},
    });

    // コールバックのプロキシ設定
    this.transport.onmessage = (message: JSONRPCMessage) => {
      if (this.onmessage) this.onmessage(message);
    };

    this.transport.onclose = () => {
      if (this.onclose) this.onclose();
    };

    this.transport.onerror = (error: Error) => {
      if (this.onerror) this.onerror(error);
    };
  }

  // --- TransportAdapter インターフェースの実装 (既存互換) ---

  /**
   * HTTP経由でリクエストを送信
   * 
   * @remarks
   * 既存の {@link TransportAdapter} インターフェースの実装です。
   * HTTPリクエストを送信し、レスポンスを返します。
   * 
   * @param url - リクエスト先のURL
   * @param options - リクエストオプション
   * @returns レスポンス（JSONにパースされたもの）
   */
  async request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    // SDK Clientがあればそれを使い、なければフォールバック実装
    if (this.client) {
      // SDKクライアントを使って適切なエンドポイントを呼び出す
      const methodName = this.extractMethodFromUrl(url);
      return this.client.call(methodName, options.body || {}) as Promise<T>;
    }

    // レガシー実装 (SDK Transportを使用して実装)
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...this.transport.getHeaders(),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * ストリーミングリクエストを開始
   * 
   * @remarks
   * 既存の {@link TransportAdapter} インターフェースの実装です。
   * SSEを使用してストリーミングリクエストを開始し、
   * AsyncGeneratorでデータを返します。
   * 
   * @param url - ストリーミングリクエスト先のURL
   * @param options - リクエストオプション
   * @returns データを生成するAsyncGenerator
   */
  async *openStream(url: string, options: RequestOptions = {}): AsyncGenerator<any, void, unknown> {
    // ストリーミングリクエストの実装
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...this.transport.getHeaders(),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream not available');

    try {
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // バイナリデータを文字列に変換して蓄積
        buffer += decoder.decode(value, { stream: true });

        // 完全なSSEメッセージを探す
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最後の不完全な行は次回のために保持

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                const data = JSON.parse(jsonStr);
                yield data;
              }
            } catch (e) {
              console.error('Failed to parse JSON:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // --- Transport インターフェースの実装 (SDK互換) ---

  /**
   * MCP通信を開始し、接続を確立する
   * 
   * @remarks
   * MCP SDKの {@link Transport} インターフェースの実装です。
   * 接続を確立し、メッセージの送受信ができるようにします。
   * 
   * @example
   * ```typescript
   * const adapter = new MCPClientAdapter({...});
   * await adapter.start(); // 接続を開始
   * ```
   * 
   * @returns 接続が確立されると解決されるPromise
   * @throws 接続の確立に失敗した場合にエラーをスロー
   */
  async start(): Promise<void> {
    await this.transport.start();
    
    // Client初期化はオプション - 使用時にコメントアウトを外す
    // this.client = new Client({
    //   transport: this.transport,
    // });
    // await this.client.initialize();
  }
  
  /**
   * MCP JSONRPCメッセージを送信する
   * 
   * @remarks
   * MCP SDKの {@link Transport} インターフェースの実装です。
   * JSONRPCメッセージをMCPサーバーに送信します。
   * 
   * @example
   * ```typescript
   * await adapter.send({
   *   jsonrpc: '2.0',
   *   id: '123',
   *   method: 'tools/list',
   *   params: {}
   * });
   * ```
   * 
   * @param message - 送信するJSONRPCメッセージ
   * @returns メッセージの送信が完了すると解決されるPromise
   * @throws メッセージの送信に失敗した場合にエラーをスロー
   */
  async send(message: JSONRPCMessage): Promise<void> {
    await this.transport.send(message);
  }
  
  /**
   * MCP接続を閉じる
   * 
   * @remarks
   * MCP SDKの {@link Transport} インターフェースの実装です。
   * 確立されたMCP接続を閉じます。
   * 
   * @example
   * ```typescript
   * await adapter.close(); // 接続を閉じる
   * ```
   * 
   * @returns 接続が閉じられると解決されるPromise
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    await this.transport.close();
  }

  // コールバックハンドラ
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  
  // セッション情報
  get sessionId(): string | undefined {
    return this.transport.sessionId;
  }
  
  // ヘルパーメソッド
  private extractMethodFromUrl(url: string): string {
    // URLからメソッド名を抽出するロジック
    // 例: /tools/list → tools/list
    const path = new URL(url, 'http://dummy-base').pathname;
    const segments = path.split('/').filter(s => s);
    if (segments.length >= 2) {
      return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    }
    return path.substring(1); // フォールバック
  }
}
