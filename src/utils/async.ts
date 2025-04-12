/**
 * Utility functions for asynchronous testing
 * Provides helpers for handling async operations in MCP tests
 */

import { TimeoutError } from '../core/types';

/**
 * Options for waitForCondition
 */
export interface WaitForConditionOptions {
  /** Maximum time to wait in milliseconds */
  timeout?: number;
  /** Interval between condition checks in milliseconds */
  interval?: number;
  /** Message to include in timeout error */
  timeoutMessage?: string;
}

/**
 * Options for pollUntil
 */
export interface PollUntilOptions {
  /** Maximum number of attempts */
  maxAttempts?: number;
  /** Interval between attempts in milliseconds */
  interval?: number;
  /** Message to include in timeout error */
  timeoutMessage?: string;
}

/**
 * Options for collectStreamResponses
 */
export interface CollectStreamOptions {
  /** Maximum time to wait for stream completion in milliseconds */
  timeout?: number;
  /** Maximum number of items to collect */
  maxItems?: number;
  /** Whether to throw an error if timeout is reached */
  throwOnTimeout?: boolean;
}

/**
 * AsyncHelpers class
 * Provides utility functions for asynchronous testing
 */
export class AsyncHelpers {
  /**
   * Wait for a condition to be true
   * @param condition Function that returns a boolean or Promise<boolean>
   * @param options Wait options
   * @returns Promise that resolves when the condition is true
   * @throws TimeoutError if the condition is not true within the timeout
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
   * Poll a function until a predicate is true
   * @param fn Function to poll
   * @param predicate Function that checks if the result meets the criteria
   * @param options Poll options
   * @returns Promise that resolves with the result when the predicate is true
   * @throws TimeoutError if the predicate is not true within the maximum attempts
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
   * Collect responses from an async stream
   * @param stream AsyncGenerator yielding stream events
   * @param options Collection options
   * @returns Promise that resolves with an array of collected items
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
   * Delay execution for a specified time
   * @param ms Time to delay in milliseconds
   * @returns Promise that resolves after the delay
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Retry a function until it succeeds or reaches maximum attempts
   * @param fn Function to retry
   * @param options Retry options
   * @returns Promise that resolves with the result when the function succeeds
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
