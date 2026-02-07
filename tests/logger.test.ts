import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, logger } from '../src/core/logger.js';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('info() outputs structured JSON with timestamp, level, message', () => {
    logger.info('test message');

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.timestamp).toBeDefined();
    expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
  });

  it('error() includes error context', () => {
    logger.error('fail', { error: 'something broke' });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

    expect(output.level).toBe('error');
    expect(output.message).toBe('fail');
    expect(output.error).toBe('something broke');
  });

  it('child() inherits parent context', () => {
    const child = logger.child({ component: 'test', request_id: '123' });
    child.info('hello');

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

    expect(output.level).toBe('info');
    expect(output.message).toBe('hello');
    expect(output.component).toBe('test');
    expect(output.request_id).toBe('123');
  });

  it('child() context can be overridden', () => {
    const child = logger.child({ component: 'parent' });
    child.info('msg', { component: 'override' });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

    expect(output.component).toBe('override');
  });

  it('debug level is filtered by default (minLevel=info)', () => {
    logger.debug('hidden');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('debug level works when minLevel=debug', () => {
    const debugLogger = new Logger({}, 'debug');
    debugLogger.debug('visible');

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

    expect(output.level).toBe('debug');
    expect(output.message).toBe('visible');
  });

  it('warn level works with default minLevel', () => {
    logger.warn('warning');

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

    expect(output.level).toBe('warn');
    expect(output.message).toBe('warning');
  });
});
