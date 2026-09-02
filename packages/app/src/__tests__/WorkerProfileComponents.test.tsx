import { render, screen } from '@testing-library/react'
import { describe, expect,it } from 'vitest'

import { WorkerContactDetails } from '@/app/[locale]/workers/[id]/components/WorkerContactDetails'
import { WorkerHeader } from '@/app/[locale]/workers/[id]/components/WorkerHeader'
import { WorkerTipSection } from '@/app/[locale]/workers/[id]/components/WorkerTipSection'
import type { Worker } from '@/types'

const worker: Worker = {
  id: 'w1',
  name: 'Alex Rivera',
  bio: 'Experienced electrician',
  avatar: null,
  phone: '+1 555-0123',
  email: 'alex@example.com',
  location: 'Austin, TX',
  isVerified: true,
  walletAddress: 'GABCD1234EXAMPLE',
  category: { id: 'c1', name: 'Electrician' },
}

describe('WorkerHeader', () => {
  it('renders name, category, and verified state', () => {
    render(<WorkerHeader worker={worker} averageRating={4.8} reviewCount={12} />)

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.getByText('Electrician')).toBeInTheDocument()
    expect(screen.getByText(/12 review/)).toBeInTheDocument()
  })
})

describe('WorkerContactDetails', () => {
  it('renders location, email, and phone when available', () => {
    render(<WorkerContactDetails worker={worker} />)

    expect(screen.getByText('Austin, TX')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByText('+1 555-0123')).toBeInTheDocument()
  })

  it('renders nothing when no contact details exist', () => {
    render(
      <WorkerContactDetails
        worker={{
          ...worker,
          email: null,
          phone: null,
          location: null,
        }}
      />
    )

    expect(screen.queryByText('Austin, TX')).not.toBeInTheDocument()
    expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument()
    expect(screen.queryByText('+1 555-0123')).not.toBeInTheDocument()
  })
})

describe('WorkerTipSection', () => {
  it('shows tip UI when wallet address is present', () => {
    render(<WorkerTipSection workerName={worker.name} walletAddress={worker.walletAddress} />)

    expect(screen.getByText('Support this worker')).toBeInTheDocument()
    expect(screen.getByText(/Send XLM directly to their Stellar wallet/)).toBeInTheDocument()
  })

  it('shows a fallback message when wallet is missing', () => {
    render(<WorkerTipSection workerName={worker.name} walletAddress={null} />)

    expect(screen.getByText("This worker hasn't connected a wallet yet.")).toBeInTheDocument()
  })
})
