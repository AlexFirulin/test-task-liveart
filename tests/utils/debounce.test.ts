import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '../../src/utils/debounce'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('debounce', () => {
  it('collapses rapid calls within the delay window into a single invocation', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced.run(1)
    debounced.run(2)
    debounced.run(3)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3) // last call's args win
  })

  it('fires independently for calls spaced further apart than the delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced.run('a')
    vi.advanceTimersByTime(100)
    debounced.run('b')
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 'a')
    expect(fn).toHaveBeenNthCalledWith(2, 'b')
  })

  it('cancel() prevents a pending invocation', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced.run()
    debounced.cancel()
    vi.advanceTimersByTime(100)

    expect(fn).not.toHaveBeenCalled()
  })

  it('cancel() is a no-op when nothing is pending', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    expect(() => debounced.cancel()).not.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })
})
