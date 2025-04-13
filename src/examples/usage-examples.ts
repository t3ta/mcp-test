import { Client } from '@modelcontextprotocol/sdk';
import { MCPClientAdapter } from '../adapter/MCPClientAdapter.js';
import { MCPClient } from '../client/MCPClient.js';
import { ValidatedMCPClient } from '../client/ValidatedMCPClient.js';

/**
 * MCPの実装を使用する例
 */

// 1. HTTPAdapterの代わりにMCPClientAdapterを使う例
async function exampleWithAdapter() {
  console.log('=== 1. アダプタークラスを使った例 ===');

  // アダプターを初期化
  const adapter = new MCPClientAdapter({
    baseUrl: 'https://api.example.com/mcp',
    defaultHeaders: { 'API-Key': 'your-api-key' }
  });

  try {
    // 接続を開始
    await adapter.start();
    console.log('Connected with session ID:', adapter.sessionId);

    // メッセージ受信時のコールバック設定
    adapter.onmessage = (message) => {
      console.log('Received message:', message);
    };

    // JSONRPCメッセージを送信
    await adapter.send({
      jsonrpc: '2.0',
      id: '123',
      method: 'tools/list',
      params: {}
    });

    // 従来の方法でHTTPリクエストを送信（互換性）
    const tools = await adapter.request('https://api.example.com/mcp/tools/list', {
      method: 'POST',
      body: { jsonrpc: '2.0', id: '124', method: 'tools/list', params: {} }
    });

    console.log('Available tools:', tools);

    // 接続終了
    await adapter.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

// 2. 新しいMCPClientクラスを使う例
async function exampleWithClient() {
  console.log('=== 2. フルMCPクライアントを使った例 ===');

  // MCPClientを初期化
  const client = new MCPClient({
    baseUrl: 'https://api.example.com/mcp',
    headers: { 'API-Key': 'your-api-key' }
  });

  try {
    // 初期化
    await client.initialize();
    console.log('Client initialized with session ID:', client.sessionId);

    // イベントハンドラ設定
    client.setMessageHandler((message) => {
      console.log('Message received:', message);
    });

    // 利用可能なツールを取得
    const tools = await client.listTools();
    console.log('Available tools:', tools);

    // ツールを実行
    const result = await client.executeTool('calculator', {
      operation: 'add',
      a: 5,
      b: 3
    });
    console.log('Tool execution result:', result);

    // プロンプトを作成
    const prompt = await client.createPrompt('Hello, this is a test prompt');
    console.log('Created prompt:', prompt);

    // プロンプトを実行
    const promptResult = await client.runPrompt(prompt.id);
    console.log('Prompt execution result:', promptResult);

    // 接続終了
    await client.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

// 3. バリデーション付きクライアントを使う例
async function exampleWithValidation() {
  console.log('=== 3. バリデーション付きクライアントを使った例 ===');

  // MCPClientを初期化
  const mcpClient = new MCPClient({
    baseUrl: 'https://api.example.com/mcp',
    headers: { 'API-Key': 'your-api-key' }
  });

  try {
    // 初期化
    await mcpClient.initialize();

    // SDK Client取得（内部実装から取り出す必要あり）
    const sdkClient = mcpClient['client'] as Client;

    // バリデーション付きクライアントを作成
    const validatedClient = new ValidatedMCPClient(sdkClient);

    // バリデーション付きでツール一覧を取得
    const tools = await validatedClient.listTools();
    console.log('Validated tools:', tools);

    // バリデーション付きでツール実行
    const result = await validatedClient.executeTool('calculator', {
      operation: 'add',
      a: 5,
      b: 3
    });
    console.log('Validated tool execution:', result);

    // 接続終了
    await mcpClient.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    // バリデーションエラーがあればより詳細に表示される
  }
}

// 4. 段階的に移行する例
async function migrationExample() {
  console.log('=== 4. 段階的移行の例 ===');

  console.log('Step 1: 既存のHTTPAdapterを使用');
  // 既存のHTTPAdapterを使ったコード
  // const httpAdapter = new HTTPAdapter({...});
  // await httpAdapter.request(...);

  console.log('Step 2: MCPClientAdapterを導入（互換性あり）');
  const adapter = new MCPClientAdapter({
    baseUrl: 'https://api.example.com/mcp',
    defaultHeaders: { 'API-Key': 'your-api-key' }
  });
  await adapter.start();
  // 既存と同じインターフェースで使用可能
  // await adapter.request(...);

  console.log('Step 3: アダプター経由でSDKの機能を使用');
  await adapter.send({
    jsonrpc: '2.0',
    id: '123',
    method: 'tools/list',
    params: {}
  });

  console.log('Step 4: 新しいMCPClientへ完全移行');
  const client = new MCPClient({
    baseUrl: 'https://api.example.com/mcp',
    headers: { 'API-Key': 'your-api-key' }
  });
  await client.initialize();
  await client.listTools();

  console.log('Migration complete!');
  await adapter.close();
  await client.close();
}

// 実行例
async function runExamples() {
  // 各例を順番に実行
  await exampleWithAdapter();
  console.log('\n');

  await exampleWithClient();
  console.log('\n');

  await exampleWithValidation();
  console.log('\n');

  await migrationExample();
}

// コマンドライン実行用
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  exampleWithAdapter,
  exampleWithClient,
  exampleWithValidation,
  migrationExample
};
