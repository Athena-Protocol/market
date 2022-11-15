import React, { useState, ReactElement, useEffect } from 'react'
import {
  Asset,
  DDO,
  FileInfo,
  Datatoken,
  ProviderInstance,
  ComputeAsset,
  ZERO_ADDRESS,
  ComputeEnvironment,
  LoggerInstance,
  ComputeAlgorithm,
  ComputeClaim,
  ComputeOutput,
  ComputeClaimOutput,
  ProviderComputeInitializeResults,
  unitsToAmount
} from '@oceanprotocol/lib'
import { toast } from 'react-toastify'
import Price from '@shared/Price'
import FileIcon from '@shared/FileIcon'
import Alert from '@shared/atoms/Alert'
import { useWeb3 } from '@context/Web3'
import { Formik } from 'formik'
import { getInitialValues, validationSchema } from './_constants'
import FormStartComputeDataset from './FormComputeDataset'
import styles from './index.module.css'
import SuccessConfetti from '@shared/SuccessConfetti'
import { getServiceByName, secondsToString } from '@utils/ddo'
import { getPublishedMeta, getPublishedAssets } from '@utils/aquarius'
import {
  isOrderable,
  getAlgorithmAssetSelectionList,
  getAlgorithmsForAsset,
  getClaimsForAsset,
  getClaimAssetSelectionList,
  getComputeEnviroment
} from '@utils/compute'
import { AssetSelectionAsset } from '@shared/FormFields/AssetSelection'
import AlgorithmDatasetsListForCompute from './AlgorithmDatasetsListForCompute'
import ComputeHistory from './History'
import ComputeJobs from '../../../Profile/History/ComputeJobs'
import { useCancelToken } from '@hooks/useCancelToken'
import { Decimal } from 'decimal.js'
import { useAbortController } from '@hooks/useAbortController'
import { getOrderPriceAndFees } from '@utils/accessDetailsAndPricing'
import { handleComputeOrder } from '@utils/order'
import { getComputeFeedback } from '@utils/feedback'
import { getDummyWeb3 } from '@utils/web3'
import {
  initializeProviderForCompute,
  computeStartWithClaim
} from '@utils/provider'

import { useUserPreferences } from '@context/UserPreferences'
import { setNftMetadata } from '@utils/nft'

export default function Compute({
  asset,
  dtBalance,
  file,
  fileIsLoading,
  consumableFeedback
}: {
  asset: AssetExtended
  dtBalance: string
  file: FileInfo
  fileIsLoading?: boolean
  consumableFeedback?: string
}): ReactElement {
  const { accountId, web3 } = useWeb3()
  const { chainIds } = useUserPreferences()
  const newAbortController = useAbortController()
  const newCancelToken = useCancelToken()
  const [assets, setAssets] = useState<Asset[]>()

  const [isOrdering, setIsOrdering] = useState(false)
  const [isOrdered, setIsOrdered] = useState(false)
  const [error, setError] = useState<string>()

  const [algorithmList, setAlgorithmList] = useState<AssetSelectionAsset[]>()
  const [ddoAlgorithmList, setDdoAlgorithmList] = useState<Asset[]>()
  const [selectedAlgorithmAsset, setSelectedAlgorithmAsset] =
    useState<AssetExtended>()

  const [claimList, setClaimList] = useState<AssetSelectionAsset[]>()
  const [ddoClaimList, setDdoClaimList] = useState<Asset[]>()
  const [selectedClaimAsset, setSelectedClaimAsset] = useState<AssetExtended>()

  const [hasAlgoAssetDatatoken, setHasAlgoAssetDatatoken] = useState<boolean>()
  const [algorithmDTBalance, setAlgorithmDTBalance] = useState<string>()

  const [hasClaimAssetDatatoken, setHasClaimAssetDatatoken] =
    useState<boolean>()
  const [claimDTBalance, setClaimDTBalance] = useState<string>()

  const [validOrderTx, setValidOrderTx] = useState('')
  const [validAlgorithmOrderTx, setValidAlgorithmOrderTx] = useState('')

  const [validClaimTx, setValidClaimTx] = useState('')
  const [validClaimOrderTx, setValidClaimOrderTx] = useState('')

  const [isConsumablePrice, setIsConsumablePrice] = useState(true)
  const [isConsumableaAlgorithmPrice, setIsConsumableAlgorithmPrice] =
    useState(true)
  const [isConsumableaClaimPrice, setIsConsumableClaimPrice] = useState(true)
  const [computeStatusText, setComputeStatusText] = useState('')
  const [computeEnv, setComputeEnv] = useState<ComputeEnvironment>()
  const [initializedProviderResponse, setInitializedProviderResponse] =
    useState<ProviderComputeInitializeResults>()
  const [providerFeeAmount, setProviderFeeAmount] = useState<string>('0')
  const [computeValidUntil, setComputeValidUntil] = useState<string>('0')
  const [datasetOrderPriceAndFees, setDatasetOrderPriceAndFees] =
    useState<OrderPriceAndFees>()
  const [algoOrderPriceAndFees, setAlgoOrderPriceAndFees] =
    useState<OrderPriceAndFees>()
  const [claimOrderPriceAndFees, setClaimOrderPriceAndFees] =
    useState<OrderPriceAndFees>()
  const [isRequestingAlgoOrderPrice, setIsRequestingAlgoOrderPrice] =
    useState(false)
  const [isRequestingClaimOrderPrice, setIsRequestingClaimOrderPrice] =
    useState(false)
  const [refetchJobs, setRefetchJobs] = useState(false)

  const hasDatatoken = Number(dtBalance) >= 1
  const isComputeButtonDisabled =
    isOrdering === true ||
    file === null ||
    (!validOrderTx && !hasDatatoken && !isConsumablePrice) ||
    (!validAlgorithmOrderTx &&
      !hasAlgoAssetDatatoken &&
      !isConsumableaAlgorithmPrice)

  const isUnsupportedPricing = asset?.accessDetails?.type === 'NOT_SUPPORTED'

  // console.log(selectedClaimAsset)
  // console.log(selectedAlgorithmAsset)
  // console.log(asset)

  async function checkAssetDTBalance(asset: DDO): Promise<boolean> {
    if (!asset?.services[0].datatokenAddress) return
    const web3 = await getDummyWeb3(asset?.chainId)
    const datatokenInstance = new Datatoken(web3)
    const dtBalance = await datatokenInstance.balance(
      asset?.services[0].datatokenAddress,
      accountId
    )
    setAlgorithmDTBalance(new Decimal(dtBalance).toString())
    setClaimDTBalance(new Decimal(dtBalance).toString())
    const hasAlgoDt = Number(dtBalance) >= 1
    const hasClaimDt = Number(dtBalance) >= 1
    setHasAlgoAssetDatatoken(hasAlgoDt)
    setHasClaimAssetDatatoken(hasClaimDt)
    return hasAlgoDt
  }

  function getCommentString() {
    LoggerInstance.log('[compute] getCommentsString')

    return (
      selectedAlgorithmAsset.id +
      '|' +
      'Claim ' +
      selectedClaimAsset.nft.name +
      ' is executed after execution of algorithm ' +
      selectedAlgorithmAsset.nft.name +
      ' on dataset ' +
      asset.nft.name +
      ','
    )
  }

  // Umesh initialize claim
  async function setMetaForClaimNFT() {
    try {
      // debugger

      const result = await getPublishedMeta(
        accountId,
        chainIds,
        null,
        1,
        null,
        null
      )

      console.log(result.results)
      setAssets(result.results)

      // If it does not exist create here
      const metaNFT = result.results[0]
      console.log(metaNFT)

      metaNFT.metadata.description += getCommentString()
      LoggerInstance.log(
        '[compute] New Meta Description ' + metaNFT.metadata.description
      )

      const setMetadataTx = await setNftMetadata(
        metaNFT,
        accountId,
        web3,
        newAbortController()
      )

      LoggerInstance.log('[compute] setMetadata result', setMetadataTx)

      if (!setMetadataTx) {
        LoggerInstance.error('Error setting metadata')
        return
      }
    } catch (error) {
      LoggerInstance.error('Error setMetaForClaimNFT', error.message)
    }
  }

  async function initPriceAndFees() {
    try {
      console.log('*************** 3.1')
      const computeEnv = await getComputeEnviroment(asset)
      if (!computeEnv || !computeEnv.id)
        throw new Error(`Error getting compute environments!`)
      console.log('*************** 3.2')
      setComputeEnv(computeEnv)
      console.log('*************** 3.3')
      // console.log('Amit: ', asset)
      // console.log('Amit: ', selectedAlgorithmAsset)
      // console.log('Amit: ', selectedClaimAsset)
      // console.log(claimList)
      const initializedProvider = await initializeProviderForCompute(
        asset,
        selectedAlgorithmAsset,
        selectedClaimAsset,
        accountId,
        computeEnv
      )
      console.log('*************** 3.4')
      if (
        !initializedProvider ||
        !initializedProvider?.datasets ||
        !initializedProvider?.algorithm ||
        !initializedProvider?.claim
      )
        throw new Error(`Error initializing provider for the compute job!`)
      console.log('*************** 3.5')
      setInitializedProviderResponse(initializedProvider)
      console.log('*************** 3.6')
      setProviderFeeAmount(
        await unitsToAmount(
          web3,
          initializedProvider?.datasets?.[0]?.providerFee?.providerFeeToken,
          initializedProvider?.datasets?.[0]?.providerFee?.providerFeeAmount
        )
      )
      console.log('*************** 3.7')
      const computeDuration = (
        parseInt(initializedProvider?.datasets?.[0]?.providerFee?.validUntil) -
        Math.floor(Date.now() / 1000)
      ).toString()
      console.log('*************** 3.8')
      setComputeValidUntil(computeDuration)
      console.log('*************** 3.9')
      if (
        asset?.accessDetails?.addressOrId !== ZERO_ADDRESS &&
        asset?.accessDetails?.type !== 'free' &&
        initializedProvider?.datasets?.[0]?.providerFee
      ) {
        console.log('*************** 3.10')
        setComputeStatusText(
          getComputeFeedback(
            asset.accessDetails?.baseToken?.symbol,
            asset.accessDetails?.datatoken?.symbol,
            asset.metadata.type
          )[0]
        )
        console.log('*************** 3.11')
        const datasetPriceAndFees = await getOrderPriceAndFees(
          asset,
          ZERO_ADDRESS,
          initializedProvider?.datasets?.[0]?.providerFee
        )
        console.log('*************** 3.12', datasetOrderPriceAndFees)
        if (!datasetPriceAndFees)
          throw new Error('Error setting dataset price and fees!')
        console.log('*************** 3.13')
        setDatasetOrderPriceAndFees(datasetPriceAndFees)
        console.log('*************** 3.14')
      }
      if (
        selectedAlgorithmAsset?.accessDetails?.addressOrId !== ZERO_ADDRESS &&
        selectedAlgorithmAsset?.accessDetails?.type !== 'free' &&
        initializedProvider?.algorithm?.providerFee
      ) {
        console.log('*************** 3.15')
        setComputeStatusText(
          getComputeFeedback(
            selectedAlgorithmAsset?.accessDetails?.baseToken?.symbol,
            selectedAlgorithmAsset?.accessDetails?.datatoken?.symbol,
            selectedAlgorithmAsset?.metadata?.type
          )[0]
        )
        console.log('*************** 3.16')
        const algorithmOrderPriceAndFees = await getOrderPriceAndFees(
          selectedAlgorithmAsset,
          ZERO_ADDRESS,
          initializedProvider.algorithm.providerFee
        )
        console.log('*************** 3.17', algorithmOrderPriceAndFees)
        if (!algorithmOrderPriceAndFees)
          throw new Error('Error setting algorithm price and fees!')
        console.log('*************** 3.18')
        setAlgoOrderPriceAndFees(algorithmOrderPriceAndFees)
        console.log('*************** 3.19')
      }
      if (
        selectedClaimAsset?.accessDetails?.addressOrId !== ZERO_ADDRESS &&
        selectedClaimAsset?.accessDetails?.type !== 'free' &&
        initializedProvider?.claim?.providerFee
      ) {
        console.log('*************** 3.20')
        setComputeStatusText(
          getComputeFeedback(
            selectedClaimAsset?.accessDetails?.baseToken?.symbol,
            selectedClaimAsset?.accessDetails?.datatoken?.symbol,
            selectedClaimAsset?.metadata?.type
          )[0]
        )
        console.log('*************** 3.21')
        const claimOrderPriceAndFees = await getOrderPriceAndFees(
          selectedClaimAsset,
          ZERO_ADDRESS,
          initializedProvider.claim.providerFee
        )
        console.log('*************** 3.22', claimOrderPriceAndFees)
        if (!claimOrderPriceAndFees)
          throw new Error('Error setting claim price and fees!')
        setClaimOrderPriceAndFees(claimOrderPriceAndFees)
      }
    } catch (error) {
      setError(error.message)
      LoggerInstance.error(`[compute] ${error.message} `)
    }
  }

  useEffect(() => {
    if (!asset?.accessDetails || !accountId || isUnsupportedPricing) return

    setIsConsumablePrice(asset?.accessDetails?.isPurchasable)
    setValidOrderTx(asset?.accessDetails?.validOrderTx)
  }, [asset?.accessDetails, accountId, isUnsupportedPricing])

  useEffect(() => {
    if (!selectedAlgorithmAsset?.accessDetails || !accountId) return

    setIsRequestingAlgoOrderPrice(true)
    setIsRequestingClaimOrderPrice(true)
    setIsConsumableAlgorithmPrice(
      selectedAlgorithmAsset?.accessDetails?.isPurchasable
    )
    setIsConsumableClaimPrice(selectedClaimAsset?.accessDetails?.isPurchasable)
    setValidAlgorithmOrderTx(
      selectedAlgorithmAsset?.accessDetails?.validOrderTx
    )
    setValidClaimOrderTx(selectedClaimAsset?.accessDetails?.validOrderTx)
    // setAlgoOrderPriceAndFees(null)
    // setClaimOrderPriceAndFees(null)

    async function initSelectedAlgo() {
      await checkAssetDTBalance(selectedAlgorithmAsset)
      // await initPriceAndFees()
      setIsRequestingAlgoOrderPrice(false)
    }
    async function initSelectedClaim() {
      await checkAssetDTBalance(selectedClaimAsset)
      // await initPriceAndFees()
      setIsRequestingClaimOrderPrice(false)
    }
    initSelectedAlgo()
    initSelectedClaim()
  }, [selectedAlgorithmAsset, selectedClaimAsset, accountId])

  useEffect(() => {
    debugger
    if (!asset?.accessDetails || isUnsupportedPricing) return

    getAlgorithmsForAsset(asset, newCancelToken()).then((algorithmsAssets) => {
      setDdoAlgorithmList(algorithmsAssets)
      getAlgorithmAssetSelectionList(asset, algorithmsAssets).then(
        (algorithmSelectionList) => {
          setAlgorithmList(algorithmSelectionList)
        }
      )
    })
  }, [asset, isUnsupportedPricing])

  useEffect(() => {
    if (!asset?.accessDetails || isUnsupportedPricing) return

    getClaimsForAsset(asset, newCancelToken()).then((claimAssets) => {
      setDdoClaimList(claimAssets)
      getClaimAssetSelectionList(asset, claimAssets).then(
        (claimSelectionList) => {
          setClaimList(claimSelectionList)
        }
      )
    })
  }, [asset, isUnsupportedPricing])

  // Output errors in toast UI
  useEffect(() => {
    const newError = error
    if (!newError) return
    toast.error(newError)
  }, [error])

  async function startJob(): Promise<void> {
    try {
      setIsOrdering(true)
      setIsOrdered(false)
      setError(undefined)
      const computeService = getServiceByName(asset, 'compute')
      const computeAlgorithm: ComputeAlgorithm = {
        documentId: selectedAlgorithmAsset.id,
        serviceId: selectedAlgorithmAsset.services[0].id
      }
      const computeClaim: ComputeClaim = {
        documentId: selectedClaimAsset.id,
        serviceId: selectedClaimAsset.services[0].id
      }
      console.log('*************** 1')
      const allowed = await isOrderable(
        asset,
        computeService.id,
        computeAlgorithm,
        selectedAlgorithmAsset
      )
      console.log('*************** 2')
      LoggerInstance.log('[compute] Is dataset orderable?', allowed)
      if (!allowed)
        throw new Error(
          'Dataset is not orderable in combination with selected algorithm.'
        )

      console.log('*************** 3')
      await initPriceAndFees()
      // await setMetaForClaimNFT()
      console.log('*************** 4')
      setComputeStatusText(
        getComputeFeedback(
          selectedAlgorithmAsset.accessDetails.baseToken?.symbol,
          selectedAlgorithmAsset.accessDetails.datatoken?.symbol,
          selectedAlgorithmAsset.metadata.type
        )[selectedAlgorithmAsset.accessDetails?.type === 'fixed' ? 2 : 3]
      )
      console.log('*************** 5', algoOrderPriceAndFees)
      // Umesh here change

      const algorithmOrderTx = await handleComputeOrder(
        web3,
        selectedAlgorithmAsset,
        algoOrderPriceAndFees,
        accountId,
        hasAlgoAssetDatatoken,
        initializedProviderResponse.algorithm,
        computeEnv.consumerAddress
      )

      if (!algorithmOrderTx) throw new Error('Failed to order algorithm.')
      console.log('*************** 6')
      const claimOrderTx = await handleComputeOrder(
        web3,
        selectedClaimAsset,
        claimOrderPriceAndFees,
        accountId,
        hasClaimAssetDatatoken,
        initializedProviderResponse.claim,
        computeEnv.consumerAddress
      )
      if (!claimOrderTx) throw new Error('Failed to order claim.')
      console.log('*************** 7')
      setComputeStatusText(
        getComputeFeedback(
          asset.accessDetails.baseToken?.symbol,
          asset.accessDetails.datatoken?.symbol,
          asset.metadata.type
        )[asset.accessDetails?.type === 'fixed' ? 2 : 3]
      )
      console.log('*************** 8')
      const datasetOrderTx = await handleComputeOrder(
        web3,
        asset,
        datasetOrderPriceAndFees,
        accountId,
        hasDatatoken,
        initializedProviderResponse.datasets[0],
        computeEnv.consumerAddress
      )
      if (!datasetOrderTx) throw new Error('Failed to order dataset.')
      console.log('*************** 9')
      LoggerInstance.log('[compute] Starting compute job.')
      const computeAsset: ComputeAsset = {
        documentId: asset.id,
        serviceId: asset.services[0].id,
        transferTxId: datasetOrderTx
      }
      console.log('*************** 10')
      computeAlgorithm.transferTxId = algorithmOrderTx
      const output: ComputeOutput = {
        publishAlgorithmLog: true,
        publishOutput: true
      }
      console.log('*************** 11')
      computeClaim.transferTxId = claimOrderTx
      const claimOutput: ComputeClaimOutput = {
        publishClaimLog: true,
        publishOutput: true
      }
      console.log('*************** 12')
      setComputeStatusText(getComputeFeedback()[4])
      console.log('Amit: ', computeEnv)
      console.log('Amit: ', computeAsset)
      console.log('Amit: ', computeAlgorithm)
      // const response = await ProviderInstance.computeStart(
      const response = await computeStartWithClaim(
        asset.services[0].serviceEndpoint,
        web3,
        accountId,
        computeEnv?.id,
        computeAsset,
        computeAlgorithm,
        computeClaim,
        newAbortController(),
        null,
        output,
        claimOutput
      )
      if (!response) throw new Error('Error starting compute job.')
      console.log('*************** 13')
      LoggerInstance.log('[compute] Starting compute job response: ', response)
      console.log('*************** 14')
      setIsOrdered(true)
      console.log('*************** 15')
      setRefetchJobs(!refetchJobs)
      console.log('*************** 16')
      initPriceAndFees()
      console.log('*************** 17')
    } catch (error) {
      setError(error.message)
      LoggerInstance.error(`[compute] ${error.message} `)
    } finally {
      setIsOrdering(false)
    }
  }

  return (
    <>
      <div
        className={`${styles.info} ${
          isUnsupportedPricing ? styles.warning : null
        }`}
      >
        <FileIcon file={file} isLoading={fileIsLoading} small />
        {isUnsupportedPricing ? (
          <Alert
            text={`No pricing schema available for this asset.`}
            state="info"
          />
        ) : (
          <Price
            accessDetails={asset?.accessDetails}
            orderPriceAndFees={datasetOrderPriceAndFees}
            conversion
            size="large"
          />
        )}
      </div>

      {isUnsupportedPricing ? null : asset.metadata.type === 'algorithm' ? (
        <>
          {asset.services[0].type === 'compute' && (
            <Alert
              text={
                "This algorithm has been set to private by the publisher and can't be downloaded. You can run it against any allowed datasets though!"
              }
              state="info"
            />
          )}
          <AlgorithmDatasetsListForCompute
            algorithmDid={asset.id}
            asset={asset}
          />
        </>
      ) : (
        <Formik
          initialValues={getInitialValues()}
          validateOnMount
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            if (!values.algorithm) return
            await setMetaForClaimNFT()
            await startJob()
          }}
        >
          <FormStartComputeDataset
            algorithms={algorithmList}
            claims={claimList}
            ddoListAlgorithms={ddoAlgorithmList}
            ddoListClaims={ddoClaimList}
            selectedAlgorithmAsset={selectedAlgorithmAsset}
            setSelectedAlgorithm={setSelectedAlgorithmAsset}
            selectedClaimAsset={selectedClaimAsset}
            setSelectedClaim={setSelectedClaimAsset}
            isLoading={isOrdering || isRequestingAlgoOrderPrice}
            isComputeButtonDisabled={isComputeButtonDisabled}
            hasPreviousOrder={validOrderTx !== undefined}
            hasDatatoken={hasDatatoken}
            dtBalance={dtBalance}
            assetType={asset?.metadata.type}
            assetTimeout={secondsToString(asset?.services[0].timeout)}
            hasPreviousOrderSelectedComputeAsset={
              validAlgorithmOrderTx !== undefined
            }
            hasDatatokenSelectedComputeAsset={hasAlgoAssetDatatoken}
            oceanSymbol={
              asset?.accessDetails?.baseToken?.symbol ||
              selectedAlgorithmAsset?.accessDetails?.baseToken?.symbol ||
              'OCEAN'
            }
            dtSymbolSelectedComputeAsset={
              selectedAlgorithmAsset?.datatokens[0]?.symbol
            }
            dtBalanceSelectedComputeAsset={algorithmDTBalance}
            selectedComputeAssetType="algorithm"
            selectedComputeAssetTimeout={secondsToString(
              selectedAlgorithmAsset?.services[0]?.timeout
            )}
            // lazy comment when removing pricingStepText
            stepText={computeStatusText}
            isConsumable={isConsumablePrice}
            consumableFeedback={consumableFeedback}
            datasetOrderPriceAndFees={datasetOrderPriceAndFees}
            algoOrderPriceAndFees={algoOrderPriceAndFees}
            providerFeeAmount={providerFeeAmount}
            validUntil={computeValidUntil}
          />
        </Formik>
      )}

      <footer className={styles.feedback}>
        {isOrdered && (
          <SuccessConfetti success="Your job started successfully! Watch the progress below or on your profile." />
        )}
      </footer>
      {accountId && asset?.accessDetails?.datatoken && (
        <ComputeHistory title="Your Compute Jobs">
          <ComputeJobs
            minimal
            assetChainIds={[asset?.chainId]}
            refetchJobs={refetchJobs}
          />
        </ComputeHistory>
      )}
    </>
  )
}
