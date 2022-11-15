import {
  ComputeAlgorithm,
  ComputeAsset,
  ComputeClaim,
  ComputeEnvironment,
  ComputeJob,
  downloadFileBrowser,
  FileInfo,
  LoggerInstance,
  ProviderComputeInitializeResults,
  ProviderInstance
} from '@oceanprotocol/lib'
import Web3 from 'web3'
import fetch from 'cross-fetch'
import { getValidUntilTime } from './compute'
import { ComputeOutput } from '@oceanprotocol/lib'

async function signProviderRequest(
  web3: Web3,
  accountId: string,
  message: string,
  password?: string
): Promise<string> {
  const consumerMessage = web3.utils.soliditySha3({
    t: 'bytes',
    v: web3.utils.utf8ToHex(message)
  })
  const isMetaMask =
    web3 && web3.currentProvider && (web3.currentProvider as any).isMetaMask
  if (isMetaMask)
    return await web3.eth.personal.sign(consumerMessage, accountId, password)
  else return await web3.eth.sign(consumerMessage, accountId)
}

/** Instruct the provider to start a compute job
 * @param {string} did
 * @param {string} consumerAddress
 * @param {string} computeEnv
 * @param {ComputeAlgorithm} algorithm
 * @param {ComputeClaim} claim
 * @param {string} providerUri
 * @param {Web3} web3
 * @param {AbortSignal} signal abort signal
 * @param {ComputeOutput} output
 * @param {ComputeOutput} claimOutput
 * @return {Promise<ComputeJob | ComputeJob[]>}
 */
export async function computeStartWithClaim(
  providerUri: string,
  web3: Web3,
  consumerAddress: string,
  computeEnv: string,
  dataset: ComputeAsset,
  algorithm: ComputeAlgorithm,
  claim: ComputeAlgorithm,
  signal?: AbortSignal,
  additionalDatasets?: ComputeAsset[],
  output?: ComputeOutput,
  claimOutput?: ComputeOutput
): Promise<ComputeJob | ComputeJob[]> {
  const providerEndpoints = await getEndPoints(providerUri)
  const serviceEndpoints = await getServiceEndpoints(
    providerUri,
    providerEndpoints
  )
  const computeStartUrl = getEndpointURL(
    serviceEndpoints,
    'computeStartWithClaim'
  )
    ? getEndpointURL(serviceEndpoints, 'computeStartWithClaim').urlPath
    : null
  console.log('12.1 ', providerEndpoints, serviceEndpoints, computeStartUrl)
  const nonce = Date.now()
  let signatureMessage = consumerAddress
  signatureMessage += dataset.documentId
  signatureMessage += nonce
  const signature = await signProviderRequest(
    web3,
    consumerAddress,
    signatureMessage
  )
  const payload = Object()
  payload.consumerAddress = consumerAddress
  payload.signature = signature
  payload.nonce = nonce
  payload.environment = computeEnv
  payload.dataset = dataset
  payload.algorithm = algorithm
  payload.claim = claim
  console.log('12.2', payload)

  if (payload.additionalDatasets)
    payload.additionalDatasets = additionalDatasets
  if (output) payload.output = output
  if (claimOutput) payload.claimOutput = claimOutput
  if (!computeStartUrl) return null
  try {
    console.log('12.3')

    const response = await fetch(computeStartUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      signal
    })
    console.log('12.4', response)

    if (response?.ok) {
      const params = await response.json()
      return params
    }
    LoggerInstance.error(
      'Compute start failed: ',
      response.status,
      response.statusText,
      await response.json()
    )
    LoggerInstance.error('Payload was:', payload)
    console.log('12.5')
    return null
  } catch (e) {
    console.log(e)
    LoggerInstance.error('Compute start failed:')
    LoggerInstance.error(e)
    LoggerInstance.error('Payload was:', payload)
    throw new Error('HTTP request failed calling Provider')
  }
}

export interface ServiceEndpoint {
  serviceName: string
  method: string
  urlPath: string
}

function getEndpointURL(
  servicesEndpoints: ServiceEndpoint[],
  serviceName: string
): ServiceEndpoint {
  if (!servicesEndpoints) return null
  return servicesEndpoints.find(
    (s) => s.serviceName === serviceName
  ) as ServiceEndpoint
}

export async function initializeComputeWithClaim(
  assets: ComputeAsset[],
  algorithm: ComputeAlgorithm,
  claim: ComputeClaim,
  computeEnv: string,
  validUntil: number,
  providerUri: string,
  accountId: string,
  signal?: AbortSignal
): Promise<ProviderComputeInitializeResults> {
  console.log('*************** 3.3.1.1')

  const providerEndpoints = await getEndPoints(providerUri)
  const serviceEndpoints = await getServiceEndpoints(
    providerUri,
    providerEndpoints
  )
  console.log('*************** 3.3.1.2')

  console.log(providerEndpoints)
  console.log(serviceEndpoints)
  console.log(providerUri)
  const providerData = {
    datasets: assets,
    algorithm,
    claim,
    compute: { env: computeEnv, validUntil },
    consumerAddress: accountId
  }
  const initializeUrl = getEndpointURL(
    serviceEndpoints,
    'initializeComputeWithClaim'
  )
    ? getEndpointURL(serviceEndpoints, 'initializeComputeWithClaim').urlPath
    : null
  console.log('*************** 3.3.1.3')
  console.log(initializeUrl)
  console.log(providerData)
  if (!initializeUrl) return null
  try {
    const response = await fetch(initializeUrl, {
      method: 'POST',
      body: JSON.stringify(providerData),
      headers: { 'Content-Type': 'application/json' },
      signal
    })
    const results = await response.json()
    console.log('*************** 3.3.1.4')
    console.log(results)
    return results
  } catch (e) {
    LoggerInstance.error(e)
    throw new Error('ComputeJob cannot be initialized')
  }
}

async function getData(url: string): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-type': 'application/json'
    }
  })
}

/**
 * Returns the provider endpoints
 * @return {Promise<ServiceEndpoint[]>}
 */

async function getEndPoints(providerUri: string): Promise<any> {
  try {
    const endpoints = await getData(providerUri)
    return await endpoints.json()
  } catch (e) {
    LoggerInstance.error('Finding the service endpoints failed:', e)
    throw new Error('HTTP request failed calling Provider')
  }
}
export interface ServiceEndpoint {
  serviceName: string
  method: string
  urlPath: string
}
async function getServiceEndpoints(providerEndpoint: string, endpoints: any) {
  const serviceEndpoints: ServiceEndpoint[] = []
  for (const i in endpoints.serviceEndpoints) {
    const endpoint: ServiceEndpoint = {
      serviceName: i,
      method: endpoints.serviceEndpoints[i][0],
      urlPath: providerEndpoint + endpoints.serviceEndpoints[i][1]
    }
    serviceEndpoints.push(endpoint)
  }
  return serviceEndpoints
}

export async function initializeProviderForCompute(
  dataset: AssetExtended,
  algorithm: AssetExtended,
  claim: AssetExtended,
  accountId: string,
  computeEnv: ComputeEnvironment = null
): Promise<ProviderComputeInitializeResults> {
  console.log('*************** 3.3.1')
  const computeAsset: ComputeAsset = {
    documentId: dataset.id,
    serviceId: dataset.services[0].id,
    transferTxId: dataset.accessDetails.validOrderTx
  }
  console.log('*************** 3.3.2')
  const computeAlgo: ComputeAlgorithm = {
    documentId: algorithm.id,
    serviceId: algorithm.services[0].id,
    transferTxId: algorithm.accessDetails.validOrderTx
  }
  console.log('*************** 3.3.3')
  const computeClaim: ComputeClaim = {
    documentId: claim.id,
    serviceId: claim.services[0].id,
    transferTxId: claim.accessDetails.validOrderTx
  }
  console.log('*************** 3.3.4')
  const validUntil = getValidUntilTime(
    computeEnv?.maxJobDuration,
    dataset.services[0].timeout,
    algorithm.services[0].timeout,
    claim.services[0].timeout
  )
  console.log('*************** 3.3.5', dataset)
  console.log(dataset.services[0].serviceEndpoint)
  const providerEndpoints = await getEndPoints(
    dataset.services[0].serviceEndpoint
  )
  console.log(providerEndpoints)
  const serviceEndpoints = await getServiceEndpoints(
    dataset.services[0].serviceEndpoint,
    providerEndpoints
  )
  console.log(serviceEndpoints)
  try {
    debugger
    // return await ProviderInstance.initializeComputeWithClaim(
    return await initializeComputeWithClaim(
      [computeAsset],
      computeAlgo,
      computeClaim,
      computeEnv?.id,
      validUntil,
      dataset.services[0].serviceEndpoint,
      accountId
    )
    // return await ProviderInstance.initializeCompute(
    //   [computeAsset],
    //   computeAlgo,
    //   computeEnv?.id,
    //   validUntil,
    //   dataset.services[0].serviceEndpoint,
    //   accountId
    // )
    console.log('*************** 3.3.6')
  } catch (error) {
    // LoggerInstance.error(`Error initializing provider for the compute job!`)
    console.log(`3.3.6 Error initializing provider for the compute job!`, error)
    return null
  }
}

// TODO: Why do we have these one line functions ?!?!?!
export async function getEncryptedFiles(
  files: any,
  providerUrl: string
): Promise<string> {
  try {
    // https://github.com/oceanprotocol/provider/blob/v4main/API.md#encrypt-endpoint
    const response = await ProviderInstance.encrypt(files, providerUrl)
    return response
  } catch (error) {
    console.error('Error parsing json: ' + error.message)
  }
}

export async function getFileDidInfo(
  did: string,
  serviceId: string,
  providerUrl: string,
  withChecksum = false
): Promise<FileInfo[]> {
  try {
    const response = await ProviderInstance.checkDidFiles(
      did,
      serviceId,
      providerUrl,
      withChecksum
    )
    return response
  } catch (error) {
    LoggerInstance.error(error.message)
  }
}

export async function getFileUrlInfo(
  url: string,
  providerUrl: string
): Promise<FileInfo[]> {
  try {
    const response = await ProviderInstance.checkFileUrl(url, providerUrl)
    return response
  } catch (error) {
    LoggerInstance.error(error.message)
  }
}

export async function downloadFile(
  web3: Web3,
  asset: AssetExtended,
  accountId: string,
  validOrderTx?: string
) {
  const downloadUrl = await ProviderInstance.getDownloadUrl(
    asset.id,
    accountId,
    asset.services[0].id,
    0,
    validOrderTx || asset.accessDetails.validOrderTx,
    asset.services[0].serviceEndpoint,
    web3
  )
  await downloadFileBrowser(downloadUrl)
}
