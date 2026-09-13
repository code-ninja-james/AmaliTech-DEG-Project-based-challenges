/**
 * Configures the shared Vitest browser-test environment.
 *
 * jest-dom adds DOM-specific assertions such as `toHaveStyle`, while the
 * explicit cleanup ensures every test starts with an empty document. Vitest
 * does not expose the same global lifecycle behaviour as Jest by default, so
 * we register cleanup ourselves rather than allowing rendered React trees to
 * leak between tests.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
