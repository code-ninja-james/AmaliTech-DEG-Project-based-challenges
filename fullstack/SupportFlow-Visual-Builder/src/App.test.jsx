import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App.jsx'

describe('SupportFlow application', () => {
  it('renders the product identity', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: 'SupportFlow Studio',
      }),
    ).toBeInTheDocument()
  })
})
