import { describe, expect, it } from 'vitest'
import { koaCoolDown } from '../src'

describe('koa', async () => {
  describe('definitions', async () => {
    it('Middleware should be a function', () => {
      expect(typeof koaCoolDown).toEqual('function')
    })
  })
})
