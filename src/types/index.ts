/**
 * 既存のTransportAdapter用の型定義
 */

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * 既存のHTTPAdapterが実装しているTransportAdapter
 */
export interface TransportAdapter {
  request<T = any>(url: string, options?: RequestOptions): Promise<T>;
  openStream(url: string, options?: RequestOptions): AsyncGenerator<any, void, unknown>;
}

/**
 * バリデーション結果の型
 */
export interface ValidationResult {
  valid: boolean;
  errors?: any[];
}

/**
 * MCPバリデーションオプション
 */
export interface MCPValidationOptions {
  strict?: boolean;
  allowUnknownProperties?: boolean;
}
