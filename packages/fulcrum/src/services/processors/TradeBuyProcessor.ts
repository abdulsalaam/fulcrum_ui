import { BigNumber } from "@0x/utils";
import { RequestTask } from "../../domain/RequestTask";
import { TradeRequest } from "../../domain/TradeRequest";
import { FulcrumProvider } from "../FulcrumProvider";
import { PositionType } from "../../domain/PositionType";
import { Asset } from "../../domain/Asset";
import { AssetsDictionary } from "../../domain/AssetsDictionary";
import { erc20Contract } from "../../contracts/erc20";

export class TradeBuyProcessor {
  public run = async (task: RequestTask, account: string, skipGas: boolean) => {
    if (!(FulcrumProvider.Instance.contractsSource && FulcrumProvider.Instance.contractsSource.canWrite)) {
      throw new Error("No provider available!");
    }

    // Initializing loan
    const taskRequest: TradeRequest = (task.request as TradeRequest);
    const isLong = taskRequest.positionType === PositionType.LONG;

    const loanToken = isLong
      ? taskRequest.quoteToken
      : taskRequest.asset;
    const depositToken = taskRequest.depositToken;
    const collateralToken = isLong
      ? taskRequest.asset
      : taskRequest.quoteToken;

    const decimals: number = AssetsDictionary.assets.get(depositToken)!.decimals || 18;

    const amountInBaseUnits = new BigNumber(taskRequest.amount.multipliedBy(10 ** decimals).toFixed(0, 1));

    const tokenContract = await FulcrumProvider.Instance.contractsSource.getITokenContract(loanToken);
    if (!tokenContract) {
      throw new Error("No iToken contract available!");
    }

    let approvePromise: Promise<string> | null = null;

    let tokenErc20Contract: erc20Contract | null = null;
    let assetErc20Address: string | null = "";
    let erc20allowance = new BigNumber(0);
    if (taskRequest.depositToken === Asset.WETH || taskRequest.depositToken === Asset.ETH) {
      task.processingStart([
        "Initializing",
        "Submitting trade",
        "Updating the blockchain",
        "Transaction completed"
      ]);

      assetErc20Address = "0x0000000000000000000000000000000000000000";

      // no additional inits or checks
      task.processingStepNext();
    } else {
      task.processingStart([
        "Initializing",
        "Detecting token allowance",
        "Prompting token allowance",
        "Waiting for token allowance",
        "Submitting trade",
        "Updating the blockchain",
        "Transaction completed"
      ]);

      assetErc20Address = FulcrumProvider.Instance.getErc20AddressOfAsset(taskRequest.depositToken);
      if (assetErc20Address) {
        tokenErc20Contract = await FulcrumProvider.Instance.contractsSource.getErc20Contract(assetErc20Address);
      } else {
        throw new Error("No ERC20 contract available!");
      }

      if (!tokenErc20Contract) {
        throw new Error("No ERC20 contract available!");
      }
      task.processingStepNext();

      // Detecting token allowance
      erc20allowance = await tokenErc20Contract.allowance.callAsync(account, tokenContract.address);
      task.processingStepNext();
    }

    try {
      //FulcrumProvider.Instance.eventEmitter.emit(FulcrumProviderEvents.AskToOpenProgressDlg);

      // Prompting token allowance
      if (amountInBaseUnits.gt(erc20allowance)) {
        approvePromise = tokenErc20Contract!.approve.sendTransactionAsync(tokenContract.address, FulcrumProvider.Instance.getLargeApprovalAmount(taskRequest.depositToken, amountInBaseUnits), { from: account });
      }
      task.processingStepNext();
      task.processingStepNext();
    }
    catch (e) {
      //console.log(e);
    }

    let gasAmountBN;

    const leverageAmount = taskRequest.positionType === PositionType.LONG
      ? new BigNumber(taskRequest.leverage - 1).times(10 ** 18)
      : new BigNumber(taskRequest.leverage).times(10 ** 18);

    const loanTokenSent = depositToken === loanToken
      ? amountInBaseUnits
      : new BigNumber(0);

    const collateralTokenSent = depositToken === collateralToken
      ? amountInBaseUnits
      : new BigNumber(0);

    //const depositTokenAddress = FulcrumProvider.Instance.getErc20AddressOfAsset(depositToken);
    const collateralTokenAddress = collateralToken !== Asset.ETH
      ? FulcrumProvider.Instance.getErc20AddressOfAsset(collateralToken)
      : FulcrumProvider.ZERO_ADDRESS;
    const loanData = "0x";

    //console.log("depositAmount: " + amountInBaseUnits.toFixed());
    console.log("leverageAmount: " + leverageAmount.toFixed());
    console.log("loanTokenSent: " + loanTokenSent.toFixed());
    console.log("collateralTokenSent: " + collateralTokenSent.toFixed());
    //console.log("deposit token: " + depositToken + " address: " + depositTokenAddress!);
    console.log("collateral token: " + collateralToken + " address: " + collateralTokenAddress!);
    console.log("trader: " + account);
    console.log("loan data: " + loanData);


    const sendAmountForValue = taskRequest.depositToken === Asset.WETH || taskRequest.depositToken === Asset.ETH ?
      amountInBaseUnits :
      new BigNumber(0)

    const isGasTokenEnabled = localStorage.getItem('isGasTokenEnabled') === "true";
    const ChiTokenBalance = await FulcrumProvider.Instance.getAssetTokenBalanceOfUser(Asset.CHI);
    // Waiting for token allowance
    if (approvePromise || skipGas) {
      await approvePromise;
      gasAmountBN = new BigNumber(FulcrumProvider.Instance.gasLimit);
    } else {
      const gasAmount = isGasTokenEnabled && ChiTokenBalance.gt(0)
        ? await tokenContract.marginTradeWithGasToken.estimateGasAsync(
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          leverageAmount,
          loanTokenSent,
          collateralTokenSent,
          collateralTokenAddress!,
          account,
          account,
          loanData,
          {
            from: account,
            value: sendAmountForValue,
            gas: FulcrumProvider.Instance.gasLimit
          })
        : await tokenContract.marginTrade.estimateGasAsync(
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          leverageAmount,
          loanTokenSent,
          collateralTokenSent,
          collateralTokenAddress!,
          account,
          loanData,
          {
            from: account,
            value: sendAmountForValue,
            gas: FulcrumProvider.Instance.gasLimit
          });
      gasAmountBN = new BigNumber(gasAmount).multipliedBy(FulcrumProvider.Instance.gasBufferCoeff).integerValue(BigNumber.ROUND_UP);
    }

    let txHash: string = "";
    try {
      //FulcrumProvider.Instance.eventEmitter.emit(FulcrumProviderEvents.AskToOpenProgressDlg);

      // Submitting trade
      txHash = isGasTokenEnabled && ChiTokenBalance.gt(0)
        ? await tokenContract.marginTradeWithGasToken.sendTransactionAsync(
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          leverageAmount,
          loanTokenSent,
          collateralTokenSent,
          collateralTokenAddress!,
          account,
          account,
          loanData,
          {
            from: account,
            value: sendAmountForValue,
            gas: gasAmountBN.toString(),
            gasPrice: await FulcrumProvider.Instance.gasPrice()
          })
        : await tokenContract.marginTrade.sendTransactionAsync(
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          leverageAmount,
          loanTokenSent,
          collateralTokenSent,
          collateralTokenAddress!,
          account,
          loanData,
          {
            from: account,
            value: sendAmountForValue,
            gas: gasAmountBN.toString(),
            gasPrice: await FulcrumProvider.Instance.gasPrice()
          });
      task.setTxHash(txHash);
    }
    catch (e) {
      throw e;
    }

    task.processingStepNext();
    const txReceipt = await FulcrumProvider.Instance.waitForTransactionMined(txHash, task.request);
    if (!txReceipt.status) {
      throw new Error("Reverted by EVM");
    }

    task.processingStepNext();
    await FulcrumProvider.Instance.sleep(FulcrumProvider.Instance.successDisplayTimeout);
  }
}
