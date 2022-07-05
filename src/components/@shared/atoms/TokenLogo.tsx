import React, { ReactElement, useEffect, useState } from 'react'
import Ocean from '@images/logo.svg'
import H2O from '@images/h2o-logo.svg'

export interface LogoProps {
  tokenLogoKey?: string
}

export default function TokenLogo({ tokenLogoKey }: LogoProps): ReactElement {
  const [logo, setLogo] = useState<ReactElement>()

  useEffect(() => {
    switch (tokenLogoKey) {
      case 'ocean':
        setLogo(<Ocean />)
        break
      case 'h2o':
        setLogo(<H2O />)
        break
      default:
        setLogo(<Ocean />)
        break
    }
  }, [tokenLogoKey])

  return logo
}
