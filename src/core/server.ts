/**
 * MCPServerManager implementation.
 *
 * This module provides functionality for managing MCP (Model Context Protocol) server
 * instances during testing. It handles starting, stopping, monitoring, and
 * controlling server processes, making it easier to set up and tear down
 * test environments.
 *
 * Key features:
 * - Process-based server management
 * - Startup and shutdown with timeouts
 * - Event-based notifications for server lifecycle
 * - Stdout and stderr capture for debugging
 *
 * @module mcp-server-manager
 */

import { spawn, ChildProcess } from 'child_process';
import { MCPServerOptions, ServerStartError, TimeoutError } from '../core/types';

/**
 * MCPServerManager class.
 *
 * This class provides functionality for managing MCP server instances during testing.
 * It handles the lifecycle of server processes including starting, stopping,
 * monitoring, and event handling.
 *
 * The manager uses a process-based approach to server management, spawning the server
 * as a child process and monitoring its status. It provides callbacks for server
 * start, stop, and error events, allowing tests to react to server state changes.
 *
 * Example usage:
 * ```typescript
 * const server = new MCPServerManager({
 *   command: 'node',
 *   args: ['src/server.js'],
 *   env: { PORT: '6277' }
 * });
 *
 * await server.start();
 * // Run tests...
 * await server.stop();
 * ```
 */
export class MCPServerManager {
  private options: Required<MCPServerOptions>;
  private process: ChildProcess | null = null;
  private isAlive: boolean = false;
  private startCallbacks: Array<() => void> = [];
  private stopCallbacks: Array<() => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];

  /**
   * Creates a new MCP Server Manager.
   *
   * Initializes a server manager with the provided configuration options.
   * The constructor normalizes the options, setting default values where
   * necessary, and prepares the manager for server lifecycle operations.
   *
   * The options specify the command to run, its arguments, environment variables,
   * working directory, port, timeouts, and callbacks for output capturing.
   *
   * Note: The health check mechanism has been removed in favor of a process-based
   * approach to server status monitoring.
   *
   * @param {MCPServerOptions} options - Server configuration options
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
      // healthCheckPath and healthCheckInterval are removed as health check is now process-based
      onStdout: options.onStdout || (() => { }),
      onStderr: options.onStderr || (() => { })
    };
  }

  /**
   * Starts the MCP server.
   *
   * This method spawns the server process using the configured command,
   * arguments, environment variables, and working directory. It sets up
   * event handlers for the process stdout, stderr, errors, and exit events.
   *
   * The method waits for the server to be ready (either by a short delay or
   * by detecting specific output) before resolving. If the server fails to
   * start properly, it attempts to clean up and throws an appropriate error.
   *
   * If the server is already running, the method returns immediately without
   * taking any action.
   *
   * @returns {Promise<void>} Promise that resolves when the server is started and ready
   * @throws {ServerStartError} If the server fails to start or times out during startup
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
          // Health check interval cleanup removed

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
            // startHealthCheck call removed
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
   * Stops the MCP server.
   *
   * This method gracefully shuts down the server process by sending a SIGTERM
   * signal and waiting for it to exit. If the server does not exit within the
   * configured shutdown timeout, it will be forcefully terminated with SIGKILL.
   *
   * The method sets up appropriate event handlers to detect when the process
   * has exited and to clean up resources afterward. It also notifies any
   * registered stop callbacks.
   *
   * If the server is not running, the method returns immediately without
   * taking any action.
   *
   * @returns {Promise<void>} Promise that resolves when the server is fully stopped
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return; // Server not running
    }

    return new Promise<void>((resolve) => {
      // Health check interval cleanup removed

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
   * Restarts the MCP server.
   *
   * This method stops the server if it's running and then starts it again.
   * It's a convenience method that combines the stop and start operations
   * in sequence, ensuring a clean restart of the server process.
   *
   * This is useful for tests that need to reset the server state completely
   * or to apply configuration changes that require a restart.
   *
   * @returns {Promise<void>} Promise that resolves when the server is fully restarted
   * @throws {ServerStartError} If the server fails to start during the restart
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Checks if the server is running.
   *
   * This method determines if the server process is currently active
   * by checking several conditions:
   * 1. The isAlive flag is true (set by internal state tracking)
   * 2. The process reference is not null
   * 3. The process has a valid PID
   *
   * This method can be used to verify server status before attempting
   * operations that require the server to be running or to make decisions
   * based on server state in tests.
   *
   * @returns {boolean} True if the server is running, false otherwise
   */
  isRunning(): boolean {
    return this.isAlive && this.process !== null && this.process.pid !== undefined;
  }

  /**
   * Waits for the server to be ready.
   *
   * This method implements a simple readiness check by waiting for a short period
   * and then verifying that the process is still running. It's a basic approach
   * that assumes the server is ready if it hasn't crashed shortly after starting.
   *
   * The method uses timeouts and process status checks rather than HTTP health checks,
   * making it more suitable for servers that don't expose a health endpoint or
   * for early startup phases before the server is accepting connections.
   *
   * For more robust detection, a future implementation could monitor specific
   * stdout/stderr messages or implement polling of a health endpoint.
   *
   * @returns {Promise<void>} Promise that resolves when the server is determined to be ready
   * @throws {TimeoutError} If the server does not become ready within the configured timeout
   * @throws {ServerStartError} If the server process exits prematurely during startup
   */
  async waitForReady(): Promise<void> {
    // Wait for a short period to allow the process to potentially fail early
    // Or wait for a specific output indicating readiness if the server provides one
    // For now, we'll just wait for a fixed short duration or rely on the startupTimeout.
    // A more robust approach would involve checking process status or listening for specific stdout/stderr messages.

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Check if the process is still alive after the initial wait
        if (this.process && !this.process.killed && this.process.exitCode === null) {
          resolve(); // Assume ready if process is still running after a short delay
        } else {
          reject(new ServerStartError('Server process exited or failed to start quickly.'));
        }
      }, Math.min(this.options.startupTimeout, 1000)); // Wait for 1 second or startupTimeout

      // If the process exits early, reject the promise
      this.process?.once('exit', (code) => {
        clearTimeout(timer);
        reject(new ServerStartError(`Server process exited prematurely with code ${code}.`));
      });
      this.process?.once('error', (err) => {
        clearTimeout(timer);
        reject(new ServerStartError(`Server process failed to spawn: ${err.message}`));
      });

      // If the overall startup timeout is reached, reject
      const startupTimeoutTimer = setTimeout(() => {
        clearTimeout(timer); // Clear the shorter timer
        this.process?.removeListener('exit', exitHandler); // Clean up listener
        this.process?.removeListener('error', errorHandler); // Clean up listener
        reject(new TimeoutError(`Server did not become ready within ${this.options.startupTimeout}ms`));
      }, this.options.startupTimeout);

      const exitHandler = (code: number | null) => {
        clearTimeout(startupTimeoutTimer);
        reject(new ServerStartError(`Server process exited prematurely with code ${code}.`));
      };
      const errorHandler = (err: Error) => {
        clearTimeout(startupTimeoutTimer);
        reject(new ServerStartError(`Server process failed to spawn: ${err.message}`));
      };

      this.process?.once('exit', exitHandler);
      this.process?.once('error', errorHandler);

      // Resolve immediately if process is already confirmed running (e.g., pid exists)
      // This part might need refinement based on how quickly `spawn` returns and sets up the process.
      if (this.process?.pid) {
        // Potentially resolve earlier if PID is immediately available,
        // but waiting a short duration is safer.
      }
    });
  }

  // startHealthCheck method removed

  /**
   * Registers a callback to be called when the server starts.
   *
   * This method adds a function to the list of callbacks that will be
   * invoked when the server successfully starts. This can be used to
   * execute setup code that depends on the server being active, such
   * as initializing clients or preparing test data.
   *
   * Multiple callbacks can be registered, and they will be called in
   * the order they were added.
   *
   * @param {Function} callback - Function to call when the server starts
   */
  onStart(callback: () => void): void {
    this.startCallbacks.push(callback);
  }

  /**
   * Registers a callback to be called when the server stops.
   *
   * This method adds a function to the list of callbacks that will be
   * invoked when the server stops, either through a normal shutdown or
   * due to an error. This can be used to execute cleanup code, such as
   * closing connections or resetting test state.
   *
   * Multiple callbacks can be registered, and they will be called in
   * the order they were added.
   *
   * @param {Function} callback - Function to call when the server stops
   */
  onStop(callback: () => void): void {
    this.stopCallbacks.push(callback);
  }

  /**
   * Registers a callback to be called when an error occurs.
   *
   * This method adds a function to the list of callbacks that will be
   * invoked when an error occurs during server operation. This can be
   * used for error logging, alerting, or implementing custom recovery
   * strategies.
   *
   * The callback receives the error object as its parameter, providing
   * access to error details such as message, stack trace, and any
   * custom properties.
   *
   * Multiple callbacks can be registered, and they will be called in
   * the order they were added.
   *
   * @param {Function} callback - Function to call when an error occurs, receives the error object
   */
  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notifies all registered start callbacks.
   *
   * This private method is called internally when the server has
   * successfully started. It iterates through all registered start
   * callbacks and calls them in order, catching and logging any
   * errors that occur during callback execution to prevent one
   * callback's failure from affecting others.
   *
   * @private
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
   * Notifies all registered stop callbacks.
   *
   * This private method is called internally when the server has
   * stopped, either through normal shutdown or due to an error.
   * It iterates through all registered stop callbacks and calls them
   * in order, catching and logging any errors that occur during
   * callback execution to prevent one callback's failure from
   * affecting others.
   *
   * @private
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
   * Notifies all registered error callbacks.
   *
   * This private method is called internally when an error occurs
   * during server operation. It iterates through all registered error
   * callbacks and calls them in order with the error object, catching
   * and logging any errors that occur during callback execution to prevent
   * one callback's failure from affecting others.
   *
   * This two-level error handling (catching errors in error handlers)
   * ensures that the notification process is robust even in the face
   * of poorly implemented callbacks.
   *
   * @private
   * @param {Error} error - The error that occurred
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

  /**
   * Safely kills the server process.
   *
   * This private helper method sends a SIGTERM signal to the server process
   * if it exists and has a valid PID. This is a graceful termination signal
   * that allows the process to perform cleanup operations before exiting.
   *
   * The method includes safety checks to ensure it only attempts to kill
   * the process if it's actually running, preventing potential errors.
   *
   * @private
   */
  private killProcess(): void {
    if (this.process && this.process.pid) {
      this.process.kill('SIGTERM');
    }
  }
}
