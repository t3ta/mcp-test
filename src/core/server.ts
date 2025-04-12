/**
 * MCPServerManager implementation
 * Manages MCP server instances for testing
 */

import { spawn, ChildProcess } from 'child_process';
import { MCPServerOptions, ServerStartError, TimeoutError } from '../core/types';
import { HTTPAdapter } from '../adapters/transport/http';

/**
 * MCPServerManager
 * Handles starting, stopping, and monitoring MCP server instances
 */
export class MCPServerManager {
  private options: Required<MCPServerOptions>;
  private process: ChildProcess | null = null;
  private isAlive: boolean = false;
  private startCallbacks: Array<() => void> = [];
  private stopCallbacks: Array<() => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new MCP Server Manager
   * @param options Server configuration options
   */
  constructor(options: MCPServerOptions) {
    this.options = {
      command: options.command,
      args: options.args || [],
      env: options.env || {},
      cwd: options.cwd || process.cwd(),
      port: options.port || 6277,
      startupTimeout: options.startupTimeout || 5000,
      shutdownTimeout: options.shutdownTimeout || 3000,
      healthCheckPath: options.healthCheckPath || '/health',
      healthCheckInterval: options.healthCheckInterval || 1000,
      onStdout: options.onStdout || (() => {}),
      onStderr: options.onStderr || (() => {})
    };
  }

  /**
   * Start the MCP server
   * @returns Promise that resolves when the server is started
   * @throws ServerStartError if the server fails to start
   */
  async start(): Promise<void> {
    if (this.process) {
      return; // Server already running
    }

    return new Promise<void>((resolve, reject) => {
      try {
        // Spawn the server process
        this.process = spawn(this.options.command, this.options.args, {
          env: { ...process.env, ...this.options.env },
          cwd: this.options.cwd
        });

        // Set up stdout handler
        this.process.stdout?.on('data', (data) => {
          const output = data.toString();
          this.options.onStdout(output);
        });

        // Set up stderr handler
        this.process.stderr?.on('data', (data) => {
          const output = data.toString();
          this.options.onStderr(output);
        });

        // Set up error handler
        this.process.on('error', (error) => {
          this.isAlive = false;
          this.notifyError(new ServerStartError(`Failed to start MCP server: ${error.message}`, {
            cause: error
          }));
          reject(error);
        });

        // Set up exit handler
        this.process.on('exit', (code, signal) => {
          this.isAlive = false;
          if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
          }
          
          // Notify stop callbacks
          this.notifyStop();
          
          if (code !== 0 && code !== null) {
            const error = new Error(`MCP server exited with code ${code}`);
            this.notifyError(error);
          }
        });

        // Wait for server to be ready
        this.waitForReady()
          .then(() => {
            this.isAlive = true;
            this.startHealthCheck();
            this.notifyStart();
            resolve();
          })
          .catch((error) => {
            this.stop().finally(() => {
              reject(new ServerStartError(`Failed to start MCP server: ${error.message}`, {
                cause: error
              }));
            });
          });
      } catch (error) {
        if (error instanceof Error) {
          reject(new ServerStartError(`Failed to start MCP server: ${error.message}`, {
            cause: error
          }));
        } else {
          reject(new ServerStartError(`Failed to start MCP server: Unknown error`));
        }
      }
    });
  }

  /**
   * Stop the MCP server
   * @returns Promise that resolves when the server is stopped
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return; // Server not running
    }

    return new Promise<void>((resolve) => {
      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Set up timeout for forced kill
      const killTimeout = setTimeout(() => {
        if (this.process && this.process.pid) {
          console.warn('MCP server did not exit gracefully, killing process');
          this.process.kill('SIGKILL');
        }
      }, this.options.shutdownTimeout);

      // Set up exit handler
      const exitHandler = () => {
        clearTimeout(killTimeout);
        this.process = null;
        this.isAlive = false;
        resolve();
      };

      // If process is already exited
      if (!this.process || !this.process.pid) {
        exitHandler();
        return;
      }

      // Set up one-time exit listener
      this.process.once('exit', exitHandler);

      // Send SIGTERM to allow graceful shutdown
      this.killProcess();
    });
  }

  /**
   * Restart the MCP server
   * @returns Promise that resolves when the server is restarted
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Check if the server is running
   * @returns True if the server is running
   */
  isRunning(): boolean {
    return this.isAlive && this.process !== null && this.process.pid !== undefined;
  }

  /**
   * Wait for the server to be ready
   * @returns Promise that resolves when the server is ready
   * @throws TimeoutError if the server does not become ready within the timeout
   */
  async waitForReady(): Promise<void> {
    const startTime = Date.now();
    const adapter = new HTTPAdapter();
    const healthUrl = `http://localhost:${this.options.port}${this.options.healthCheckPath}`;

    while (Date.now() - startTime < this.options.startupTimeout) {
      try {
        await adapter.request(healthUrl, {
          timeout: 1000,
          responseFormat: 'text'
        });
        return; // Server is ready
      } catch (error) {
        // Wait a bit before trying again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new TimeoutError(`Server did not become ready within ${this.options.startupTimeout}ms`);
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.process) {
        this.isAlive = false;
        return;
      }

      try {
        const adapter = new HTTPAdapter();
        const healthUrl = `http://localhost:${this.options.port}${this.options.healthCheckPath}`;
        
        await adapter.request(healthUrl, {
          timeout: 1000,
          responseFormat: 'text'
        });
        
        this.isAlive = true;
      } catch (error) {
        this.isAlive = false;
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Register a callback to be called when the server starts
   * @param callback Function to call when the server starts
   */
  onStart(callback: () => void): void {
    this.startCallbacks.push(callback);
  }

  /**
   * Register a callback to be called when the server stops
   * @param callback Function to call when the server stops
   */
  onStop(callback: () => void): void {
    this.stopCallbacks.push(callback);
  }

  /**
   * Register a callback to be called when an error occurs
   * @param callback Function to call when an error occurs
   */
  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify all start callbacks
   */
  private notifyStart(): void {
    for (const callback of this.startCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in start callback:', error);
      }
    }
  }

  /**
   * Notify all stop callbacks
   */
  private notifyStop(): void {
    for (const callback of this.stopCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in stop callback:', error);
      }
    }
  }

  /**
   * Notify all error callbacks
   * @param error Error that occurred
   */
  private notifyError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    }
  }
  
  // Helper method to safely kill the process
  private killProcess(): void {
    if (this.process && this.process.pid) {
      this.process.kill('SIGTERM');
    }
  }
}
