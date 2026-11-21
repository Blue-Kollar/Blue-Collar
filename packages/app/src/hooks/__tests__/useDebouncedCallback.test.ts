import { renderHook, act } from '@testing-library/react';
import { useDebouncedCallback } from '../useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('fires the callback once after the delay', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('uses the latest arguments when debounced', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 200));

    act(() => {
      result.current('first');
      result.current('second');
      result.current('latest');
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('latest');
  });

  it('resets the timer on each call', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current('a');
    });
    act(() => {
      jest.advanceTimersByTime(80);
    });
    act(() => {
      result.current('b');
    });
    act(() => {
      jest.advanceTimersByTime(80);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('b');
  });

  it('cancel prevents the pending callback from firing', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current('a');
    });
    act(() => {
      result.current.cancel();
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('flush invokes the pending callback immediately', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current('a');
    });
    act(() => {
      result.current.flush();
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('a');

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('flush does nothing when no call is pending', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current.flush();
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('clears the pending timer on unmount', () => {
    const callback = jest.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, 100),
    );

    act(() => {
      result.current('a');
    });
    unmount();
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('keeps a stable identity across renders', () => {
    const callback = jest.fn();
    const { result, rerender } = renderHook(() =>
      useDebouncedCallback(callback, 100),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});