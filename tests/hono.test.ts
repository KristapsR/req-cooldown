import { describe, expect, it } from 'vitest'

import { honoCoolDown } from '../src'

describe('hono', async () => {
  describe('definitions', async () => {
    it('Middleware should be a function', () => {
      expect(typeof honoCoolDown).toEqual('function')
    })
  })
})
