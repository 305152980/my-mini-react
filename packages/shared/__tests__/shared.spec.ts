import { describe, expect, test } from 'vitest'
import { isStr } from '../utils'

describe('shared', () => {
  test('test', () => {
    expect(isStr(1)).toBe(false)
    expect(isStr('1')).toBe(true)
  })
})
