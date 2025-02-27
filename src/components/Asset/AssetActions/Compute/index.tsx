import React, { useState, ReactElement, useEffect } from 'react'
import { ProviderInstance } from '@utils/providerUpdated'
import {
  Asset,
  DDO,
  FileInfo,
  Datatoken,
  ComputeAsset,
  ZERO_ADDRESS,
  ComputeEnvironment,
  LoggerInstance,
  ComputeAlgorithm,
  ComputeOutput,
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
import { initializeProviderForCompute } from '@utils/provider'
import {
  CommentMetaData,
  CommentMetaDataItem,
  MetaTemplateType
} from '../../AssetContent/Comments/CommentConstant'
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

  const [validOrderTx, setValidOrderTx] = useState('')
  const [validAlgorithmOrderTx, setValidAlgorithmOrderTx] = useState('')

  const [isConsumablePrice, setIsConsumablePrice] = useState(true)
  const [isConsumableaAlgorithmPrice, setIsConsumableAlgorithmPrice] =
    useState(true)
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
  const [isRequestingAlgoOrderPrice, setIsRequestingAlgoOrderPrice] =
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

  async function checkAssetDTBalance(asset: DDO): Promise<boolean> {
    if (!asset?.services[0].datatokenAddress) return
    const web3 = await getDummyWeb3(asset?.chainId)
    const datatokenInstance = new Datatoken(web3)
    const dtBalance = await datatokenInstance.balance(
      asset?.services[0].datatokenAddress,
      accountId
    )
    setAlgorithmDTBalance(new Decimal(dtBalance).toString())
    const hasAlgoDt = Number(dtBalance) >= 1
    setHasAlgoAssetDatatoken(hasAlgoDt)
    return hasAlgoDt
  }

  function appendCommentString(metaNFT: Asset) {
    LoggerInstance.log('[compute] getCommentsString')
    console.log(selectedClaimAsset)
    console.log(selectedAlgorithmAsset)
    console.log(asset)
    // Just to clean up previous version's data
    if (!metaNFT.metadata.description.startsWith('{'))
      metaNFT.metadata.description = ''

    const item = new CommentMetaDataItem(
      MetaTemplateType.ClaimHistory,
      asset.id,
      selectedAlgorithmAsset.id,
      selectedClaimAsset.id,
      accountId,
      Date.now() / 1000
    )

    metaNFT.metadata.description = JSON.stringify(
      CommentMetaData.addMeta(metaNFT.metadata.description, item)
    )
    console.log(JSON.stringify(metaNFT.metadata.description))
  }

  // Umesh initialize claim
  async function setMetaForClaimNFT() {
    try {
      setComputeStatusText(getComputeFeedback()[5])
      const result = await getPublishedMeta(
        accountId,
        chainIds,
        null,
        null,
        null
      )

      console.log(result.results)
      setAssets(result.results)

      // If it does not exist create here
      const metaNFT = result.results[0]
      console.log('----------------------------Meta NFT-------------')
      console.log(metaNFT)
      console.log(metaNFT.nft.owner)
      console.log(metaNFT.DID)
      console.log('----------------------------Meta NFT end-------------')

      appendCommentString(metaNFT)
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
      const computeEnv = await getComputeEnviroment(asset)
      if (!computeEnv || !computeEnv.id)
        throw new Error(`Error getting compute environments!`)

      setComputeEnv(computeEnv)
      const initializedProvider = await initializeProviderForCompute(
        asset,
        selectedAlgorithmAsset,
        accountId,
        computeEnv
      )
      if (
        !initializedProvider ||
        !initializedProvider?.datasets ||
        !initializedProvider?.algorithm
      )
        throw new Error(`Error initializing provider for the compute job!`)

      setInitializedProviderResponse(initializedProvider)
      setProviderFeeAmount(
        await unitsToAmount(
          web3,
          initializedProvider?.datasets?.[0]?.providerFee?.providerFeeToken,
          initializedProvider?.datasets?.[0]?.providerFee?.providerFeeAmount
        )
      )
      const computeDuration = (
        parseInt(initializedProvider?.datasets?.[0]?.providerFee?.validUntil) -
        Math.floor(Date.now() / 1000)
      ).toString()
      setComputeValidUntil(computeDuration)

      if (
        asset?.accessDetails?.addressOrId !== ZERO_ADDRESS &&
        asset?.accessDetails?.type !== 'free' &&
        initializedProvider?.datasets?.[0]?.providerFee
      ) {
        setComputeStatusText(
          getComputeFeedback(
            asset.accessDetails?.baseToken?.symbol,
            asset.accessDetails?.datatoken?.symbol,
            asset.metadata.type
          )[0]
        )
        const datasetPriceAndFees = await getOrderPriceAndFees(
          asset,
          ZERO_ADDRESS,
          initializedProvider?.datasets?.[0]?.providerFee
        )
        if (!datasetPriceAndFees)
          throw new Error('Error setting dataset price and fees!')

        setDatasetOrderPriceAndFees(datasetPriceAndFees)
      }

      if (
        selectedAlgorithmAsset?.accessDetails?.addressOrId !== ZERO_ADDRESS &&
        selectedAlgorithmAsset?.accessDetails?.type !== 'free' &&
        initializedProvider?.algorithm?.providerFee
      ) {
        setComputeStatusText(
          getComputeFeedback(
            selectedAlgorithmAsset?.accessDetails?.baseToken?.symbol,
            selectedAlgorithmAsset?.accessDetails?.datatoken?.symbol,
            selectedAlgorithmAsset?.metadata?.type
          )[0]
        )
        const algorithmOrderPriceAndFees = await getOrderPriceAndFees(
          selectedAlgorithmAsset,
          ZERO_ADDRESS,
          initializedProvider.algorithm.providerFee
        )
        if (!algorithmOrderPriceAndFees)
          throw new Error('Error setting algorithm price and fees!')

        setAlgoOrderPriceAndFees(algorithmOrderPriceAndFees)
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
    setIsConsumableAlgorithmPrice(
      selectedAlgorithmAsset?.accessDetails?.isPurchasable
    )
    setValidAlgorithmOrderTx(
      selectedAlgorithmAsset?.accessDetails?.validOrderTx
    )
    setAlgoOrderPriceAndFees(null)

    async function initSelectedAlgo() {
      await checkAssetDTBalance(selectedAlgorithmAsset)
      await initPriceAndFees()
      setIsRequestingAlgoOrderPrice(false)
    }

    initSelectedAlgo()
  }, [selectedAlgorithmAsset, accountId])

  useEffect(() => {
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

    getClaimsForAsset(asset, accountId, newCancelToken()).then(
      (claimAssets) => {
        setDdoClaimList(claimAssets)
        getClaimAssetSelectionList(asset, claimAssets).then(
          (claimSelectionList) => {
            setClaimList(claimSelectionList)
          }
        )
      }
    )
  }, [asset, selectedClaimAsset, accountId])

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

      console.log('job starting')
      console.log(selectedClaimAsset)
      let computeClaim: ComputeAlgorithm = {
        documentId: null,
        serviceId: null
      }
      if (selectedClaimAsset) {
        computeClaim.documentId = selectedClaimAsset.id
        computeClaim.serviceId = selectedClaimAsset.services[0].id
      } else computeClaim = null

      const allowed = await isOrderable(
        asset,
        computeService.id,
        computeAlgorithm,
        selectedAlgorithmAsset
      )
      LoggerInstance.log('[compute] Is dataset orderable?', allowed)
      if (!allowed)
        throw new Error(
          'Dataset is not orderable in combination with selected algorithm.'
        )

      await initPriceAndFees()
      // await setMetaForClaimNFT()

      setComputeStatusText(
        getComputeFeedback(
          selectedAlgorithmAsset.accessDetails.baseToken?.symbol,
          selectedAlgorithmAsset.accessDetails.datatoken?.symbol,
          selectedAlgorithmAsset.metadata.type
        )[selectedAlgorithmAsset.accessDetails?.type === 'fixed' ? 2 : 3]
      )
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

      setComputeStatusText(
        getComputeFeedback(
          asset.accessDetails.baseToken?.symbol,
          asset.accessDetails.datatoken?.symbol,
          asset.metadata.type
        )[asset.accessDetails?.type === 'fixed' ? 2 : 3]
      )
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

      setComputeStatusText(
        getComputeFeedback(
          selectedClaimAsset.accessDetails.baseToken?.symbol,
          selectedClaimAsset.accessDetails.datatoken?.symbol,
          selectedClaimAsset.metadata.type
        )[asset.accessDetails?.type === 'fixed' ? 2 : 3]
      )

      // Umesh - correct fees and other parameters here
      const claimOrderTx = await handleComputeOrder(
        web3,
        selectedClaimAsset,
        algoOrderPriceAndFees,
        accountId,
        hasAlgoAssetDatatoken,
        initializedProviderResponse.algorithm,
        computeEnv.consumerAddress
      )
      if (!claimOrderTx) throw new Error('Failed to order claim.')

      LoggerInstance.log('[compute] Starting compute job.')
      const computeAsset: ComputeAsset = {
        documentId: asset.id,
        serviceId: asset.services[0].id,
        transferTxId: datasetOrderTx
      }
      computeAlgorithm.transferTxId = algorithmOrderTx
      const output: ComputeOutput = {
        publishAlgorithmLog: true,
        publishOutput: true
      }
      setComputeStatusText(getComputeFeedback()[4])

      computeClaim.transferTxId = claimOrderTx

      const response = await ProviderInstance.computeStart(
        asset.services[0].serviceEndpoint,
        web3,
        accountId,
        computeEnv?.id,
        computeAsset,
        computeAlgorithm,
        computeClaim,
        newAbortController(),
        null,
        output
      )
      if (!response) throw new Error('Error starting compute job.')

      LoggerInstance.log('[compute] Starting compute job response: ', response)
      setIsOrdered(true)
      setRefetchJobs(!refetchJobs)
      initPriceAndFees()
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
            if (selectedClaimAsset !== undefined) {
              console.log('umesh ' + selectedClaimAsset)
              await setMetaForClaimNFT()
            }
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
