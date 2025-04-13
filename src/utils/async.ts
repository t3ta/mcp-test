/**
 * Utility functions for asynchronous testing.
 *
 * This module provides helper functions for working with asynchronous operations
 * in MCP (Model Context Protocol) tests. These utilities simplify common patterns
 * such as waiting for conditions, polling for results, collecting stream data,
 * introducing delays, and implementing retry logic.
 *
 * These helpers are designed to make tests more robust and reliable when dealing
 * with asynchronous operations, timeouts, and potential race conditions.
 *
 * @module async-helpers
 */

import { TimeoutError } from '../core/types';

/**
 * Configuration options for the waitForCondition utility.
 *
 * These options control the behavior of the waitForCondition method,
 * including timeouts, check intervals, and custom error messages.
 *
 * @interface
 */
export interface WaitForConditionOptions {
  /**
   * Maximum time to wait in milliseconds before timing out.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Interval between condition checks in milliseconds.
   * Lower values make the check more responsive but may increase CPU usage.
   * @default 100
   */
  interval?: number;

  /**
   * Custom message to include in the timeout error if the condition is not met.
   * @default 'Condition not met within timeout'
   */
  timeoutMessage?: string;
}

/**
 * Configuration options for the pollUntil utility.
 *
 * These options control the behavior of the pollUntil method,
 * including maximum attempts, intervals between attempts, and custom error messages.
 *
 * @interface
 */
export interface PollUntilOptions {
  /**
   * Maximum number of polling attempts before giving up.
   * @default 10
   */
  maxAttempts?: number;

  /**
   * Interval between polling attempts in milliseconds.
   * @default 1000 (1 second)
   */
  interval?: number;

  /**
   * Custom message to include in the timeout error if the maximum attempts are reached.
   * @default 'Maximum polling attempts reached'
   */
  timeoutMessage?: string;
}

/**
 * Configuration options for the collectStreamResponses utility.
 *
 * These options control the behavior of the collectStreamResponses method,
 * including timeouts, maximum items to collect, and error handling.
 *
 * @interface
 */
export interface CollectStreamOptions {
  /**
   * Maximum time to wait for stream completion in milliseconds.
   * The collection will stop after this time even if the stream is still active.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum number of items to collect from the stream.
   * The collection will stop after this many items even if the stream continues.
   * @default Number.MAX_SAFE_INTEGER (effectively unlimited)
   */
  maxItems?: number;

  /**
   * Whether to throw an error if the collection times out.
   * If false, the method will return the items collected so far when a timeout occurs.
   * @default true
   */
  throwOnTimeout?: boolean;
}

/**
 * AsyncHelpers class.
 *
 * This class provides utility functions for working with asynchronous operations
 * in tests. All methods are static and can be used without instantiating the class.
 *
 * The utilities include:
 * - Waiting for conditions to be met
 * - Polling until a condition is satisfied
 * - Collecting responses from asynchronous streams
 * - Adding delays to test execution
 * - Implementing retry logic for flaky operations
 *
 * These helpers make writing reliable asynchronous tests easier and reduce
 * the need for custom timeout and retry logic in individual tests.
 */
export class AsyncHelpers {
  /**
   * Waits for a specified condition to become true.
   *
   * This method repeatedly checks a condition function and resolves when it returns true.
   * If the condition doesn't become true within the specified timeout, it throws a TimeoutError.
   *
   * This is useful for waiting for asynchronous operations to complete, such as waiting
   * for a server to start, a resource to become available, or a state change to occur.
   *
   * Example:
   * ```typescript
   * // Wait for server to become responsive
   * await AsyncHelpers.waitForCondition(
   *   async () => {
   *     try {
   *       const response = await fetch('http://localhost:8080/health');
   *       return response.status === 200;
   *     } catch {
   *       return false;
   *     }
   *   },
   *   { timeout: 5000, interval: 200 }
   * );
   * ```
   *
   * @param {function(): boolean | Promise<boolean>} condition - Function that returns a boolean or Promise<boolean>
   * @param {WaitForConditionOptions} [options={}] - Configuration options
   * @returns {Promise<void>} Promise that resolves when the condition is true
   * @throws {TimeoutError} If the condition is not true within the timeout period
   */
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options: WaitForConditionOptions = {}
  ): Promise<void> {
    const timeout = options.timeout || 30000;
    const interval = options.interval || 100;
    const timeoutMessage = options.timeoutMessage || 'Condition not met within timeout';

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await Promise.resolve(condition());

      if (result) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new TimeoutError(timeoutMessage, {
      details: { timeout, interval }
    });
  }

  /**
   * Polls a function until its result satisfies a predicate function.
   *
   * This method repeatedly calls a function and checks its result against a predicate.
   * It resolves with the result when the predicate returns true, or throws a TimeoutError
   * after a maximum number of attempts.
   *
   * This is especially useful for checking the status of long-running operations,
   * such as background tasks, asynchronous job processing, or eventual consistency.
   *
   * Example:
   * ```typescript
   * // Poll for task completion
   * const result = await AsyncHelpers.pollUntil(
   *   () => client.getTaskStatus(taskId),
   *   (status) => status === 'completed' || status === 'failed',
   *   { maxAttempts: 10, interval: 2000 }
   * );
   * ```
   *
   * @template T - The type returned by the polled function
   * @param {function(): Promise<T>} fn - Async function to poll
   * @param {function(T): boolean} predicate - Function that checks if the result meets the criteria
   * @param {PollUntilOptions} [options={}] - Configuration options
   * @returns {Promise<T>} Promise that resolves with the result when the predicate is true
   * @throws {TimeoutError} If the predicate is not true within the maximum attempts
   */
  static async pollUntil<T>(
    fn: () => Promise<T>,
    predicate: (result: T) => boolean,
    options: PollUntilOptions = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || 10;
    const interval = options.interval || 1000;
    const timeoutMessage = options.timeoutMessage || 'Maximum polling attempts reached';

    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      const result = await fn();

      if (predicate(result)) {
        return result;
      }

      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new TimeoutError(timeoutMessage, {
      details: { maxAttempts, interval, attempts }
    });
  }

  /**
   * Collects items from an asynchronous stream into an array.
   *
   * This method consumes an AsyncGenerator and collects its yielded values
   * into an array until the stream completes, a maximum number of items
   * is reached, or a timeout occurs.
   *
   * This is particularly useful for testing streaming APIs or events,
   * allowing you to collect the stream events for later assertions.
   *
   * Example:
   * ```typescript
   * // Collect stream events
   * const events = await AsyncHelpers.collectStreamResponses(
   *   client.callToolWithStream('streamingTool', { duration: 5000 }),
   *   { timeout: 10000, maxItems: 100 }
   * );
   * expect(events.length).toBeGreaterThan(0);
   * ```
   *
   * @template T - The type of items yielded by the stream
   * @param {AsyncGenerator<T, void, unknown>} stream - AsyncGenerator yielding stream events
   * @param {CollectStreamOptions} [options={}] - Configuration options
   * @returns {Promise<T[]>} Promise that resolves with an array of collected items
   * @throws {TimeoutError} If throwOnTimeout is true and the timeout is reached
   */
  static async collectStreamResponses<T>(
    stream: AsyncGenerator<T, void, unknown>,
    options: CollectStreamOptions = {}
  ): Promise<T[]> {
    const timeout = options.timeout || 30000;
    const maxItems = options.maxItems || Number.MAX_SAFE_INTEGER;
    const throwOnTimeout = options.throwOnTimeout !== false;

    const results: T[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      await Promise.race([
        // Stream collection
        (async () => {
          for await (const item of stream) {
            results.push(item);

            if (results.length >= maxItems) {
              break;
            }
          }
        })(),

        // Timeout
        new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            if (throwOnTimeout) {
              reject(new TimeoutError(`Stream collection timed out after ${timeout}ms`, {
                details: { timeout, collectedItems: results.length }
              }));
            }
          }, timeout);
        })
      ]);

      return results;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Delays execution for a specified time.
   *
   * This method creates a promise that resolves after the specified
   * number of milliseconds, effectively pausing execution in an
   * async function when used with await.
   *
   * This is useful for adding deliberate delays in tests, such as
   * waiting for background processes to complete, simulating network
   * latency, or enforcing sequence in asynchronous operations.
   *
   * Example:
   * ```typescript
   * // Wait for 2 seconds
   * await AsyncHelpers.delay(2000);
   * // Continue execution after delay
   * ```
   *
   * @param {number} ms - Time to delay in milliseconds
   * @returns {Promise<void>} Promise that resolves after the delay
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retries a function until it succeeds or reaches the maximum number of attempts.
   *
   * This method repeatedly calls an async function, catching any errors that occur.
   * If the function succeeds, it returns the result. If it fails, it retries
   * up to the maximum number of attempts with an optional exponential backoff.
   *
   * This is essential for testing flaky operations or systems that may have
   * temporary failures, such as network requests, database operations, or
   * race-condition-prone interactions.
   *
   * Example:
   * ```typescript
   * // Retry fetching data with exponential backoff
   * const data = await AsyncHelpers.retry(
   *   () => fetchExternalAPI('https://example.com/api/data'),
   *   { maxAttempts: 3, interval: 1000, backoff: true }
   * );
   * ```
   *
   * @template T - The type returned by the function
   * @param {function(): Promise<T>} fn - Async function to retry
   * @param {Object} [options={}] - Retry configuration options
   * @param {number} [options.maxAttempts=3] - Maximum number of attempts
   * @param {number} [options.interval=1000] - Base interval between attempts in milliseconds
   * @param {boolean} [options.backoff=true] - Whether to use exponential backoff
   * @returns {Promise<T>} Promise that resolves with the result when the function succeeds
   * @throws The last error encountered if all attempts fail
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; interval?: number; backoff?: boolean } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || 3;
    const initialInterval = options.interval || 1000;
    const useBackoff = options.backoff !== false;

    let attempts = 0;
    let lastError: Error | unknown;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempts < maxAttempts) {
          const delay = useBackoff
            ? initialInterval * Math.pow(2, attempts - 1)
            : initialInterval;

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('All retry attempts failed');
  }
}
