import { ConfigHelper, Config } from '@oceanprotocol/lib'
// import contractAddresses from '@oceanprotocol/contracts/artifacts/address.json'

export function getOceanConfig(network: string | number): Config {
  let config = new Config()
  if (network === 44787) {
    config = {
      chainId: 44787,
      network: 'alfajores',
      metadataCacheUri: 'http://aquarius.athenaprotocol.tech',
      nodeUri: 'https://alfajores-forno.celo-testnet.org',
      providerUri: 'http://provider.athenaprotocol.tech',
      // subgraphUri: 'https://v4.subgraph.mumbai.oceanprotocol.com',
      subgraphUri: 'http://subgraph.athenaprotocol.tech',
      explorerUri: 'https://alfajores-blockscout.celo-testnet.org',
      oceanTokenAddress: '0xd8992Ed72C445c35Cb4A2be468568Ed1079357c8',
      oceanTokenSymbol: 'OCEAN',
      fixedRateExchangeAddress: '0x3c21a90599b5B7f37014cA5Bf30d3f1b73d7e391',
      dispenserAddress: '0xc313e19146Fc9a04470689C9d41a4D3054693531',
      startBlock: 16422659,
      transactionBlockTimeout: 50,
      transactionConfirmationBlocks: 1,
      transactionPollingTimeout: 750,
      gasFeeMultiplier: 1.1,
      nftFactoryAddress: '0x98679D582AB3398C03D3308dEB9c7AeC50B52ded',
      opfCommunityFeeCollector: '0xEF62FB495266C72a5212A11Dce8baa79Ec0ABeB1'
    }
  } else {
    config = new ConfigHelper().getConfig(
      network,
      network === 'polygon' ||
        network === 'moonbeamalpha' ||
        network === 1287 ||
        network === 'bsc' ||
        network === 56 ||
        network === 'gaiaxtestnet' ||
        network === 2021000
        ? undefined
        : process.env.NEXT_PUBLIC_INFURA_PROJECT_ID
    ) as Config
  }

  return config as Config
}

export function getDevelopmentConfig(): Config {
  return {
    // factoryAddress: contractAddresses.development?.DTFactory,
    // poolFactoryAddress: contractAddresses.development?.BFactory,
    // fixedRateExchangeAddress: contractAddresses.development?.FixedRateExchange,
    // metadataContractAddress: contractAddresses.development?.Metadata,
    // oceanTokenAddress: contractAddresses.development?.Ocean,
    // There is no subgraph in barge so we hardcode the Rinkeby one for now
    subgraphUri: 'https://v4.subgraph.rinkeby.oceanprotocol.com'
  } as Config
}
