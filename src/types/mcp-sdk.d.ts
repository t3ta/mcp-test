/**
 * @modelcontextprotocol/sdk の型定義
 */

declare module '@modelcontextprotocol/sdk' {
  /**
   * JSONRPCメッセージの型定義
   */
  export interface JSONRPCMessage {
    jsonrpc: '2.0';
    id: string;
    method?: string;
    params?: any;
    result?: any;
    error?: {
      code: number;
      message: string;
      data?: any;
    };
  }

  /**
   * MCP SDKのTransportインターフェース
   */
  export interface Transport {
    start(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
    close(): Promise<void>;
    onmessage?: (message: JSONRPCMessage) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    sessionId?: string;
  }

  /**
   * SSEClientTransportクラス
   */
  export class SSEClientTransport implements Transport {
    constructor(config: {
      baseUrl: string;
      headers?: Record<string, string>;
    });

    start(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
    close(): Promise<void>;
    onmessage?: (message: JSONRPCMessage) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    sessionId?: string;

    getHeaders(): Record<string, string>;
  }

  /**
   * MCP Clientクラス
   */
  export class Client {
    constructor(config: {
      transport: Transport;
    });

    initialize(): Promise<void>;
    call(method: string, params: any): Promise<any>;
    close(): Promise<void>;
  }
}
