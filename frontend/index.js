// using this guide to start: https://www.zastrin.com/tutorials/build-an-ethereum-dapp-using-ethersjs

const provider = new ethers.providers.Web3Provider(window.ethereum)

const signer = provider.getSigner(0);
let account 

window.SPC = {}

// wk2: 
// const spctContract = new ethers.Contract('0xC2CA5E96069d1678B62704F9791cdaE798dE1C4A', abi, signer)


// ToTheMoon address: 0x177111A80772e550238C1140019D4FfC2141A9f3
// spcl address: 0x84323ec80907bae060a76c40F4B18C7EAeaD92A5
// router address: 0x49b86b01169098910463728CfC66dB9bc88591F5


// wk3:
// ToTheMoon address: 0x84385c50b09B77cDB9058E94F78dce06D66E25De
const spctContract = new ethers.Contract('0x177111A80772e550238C1140019D4FfC2141A9f3', spctAbi, signer)
// spcl address: 0xb0655f7c94902bCb13e600Eb25eF423D1D7e75Af
const spclContract = new ethers.Contract('0x84323ec80907bae060a76c40F4B18C7EAeaD92A5', spclAbi, signer)
// router address: 0xAcAa4833646eE3d019F4904074A4B644E2222e93
const routerContract = new ethers.Contract('0x49b86b01169098910463728CfC66dB9bc88591F5', routerAbi, signer)

function enableOn(trigger) {
  // on-market-open
  // on-open-phase
  // on-have-spcl
  // on-have-spct
  const els = [...document.querySelectorAll("." + trigger)]
  els.forEach(el => el.classList.remove('disabled'))
  els.forEach(el => el.removeAttribute('disabled'))
}

// only allowed 18 digits of precision
function fixStringPrecision(n) {
  if (typeof n !== "string") n = String(n)
  return n.slice(0,17); 
}

// trims off numbers that are excessively precise without throwing errors
// technically, do not do this--handle it correctly in your inputs
// this is a proof of concept, though, and 18 points of precision is enough...
const originalFormatEther = ethers.utils.formatEther.bind(ethers.utils);
ethers.utils.formatEther = function(input) {
  originalFormatEther(fixStringPrecision(input))
}

/*
format hint:
addEventRow('transactions', {
  spct: ethers.utils.formatEther(ethers.BigNumber.from(log.args.eth).mul(5)),
  eth: ethers.utils.formatEther(log.args.eth),
  sender: log.args.sender,
  time: new Date((await log.getBlock()).timestamp*1000),
})
*/
const addEventRow = async (table, data) => {
  // table = transactions, liquidity-events, swap-events

  const row = document.createElement('tr')
  Object.keys(data).forEach(key => {
    const newCol = document.createElement('td')
    newCol.innerHTML = data[key]
    row.appendChild(newCol)
  })

  document.getElementById(table).prepend(row)
}

function addressIsUser(address) {
  return address.slice(0,userAddress.length) == userAddress;
}

async function spclSetup() {
  let marketOpen = await spclContract.marketOpen();
  if (marketOpen) {
    enableOn('on-market-open');
    trackEthSpctRate()
  } else {
    console.log("swap market closed")
  }

  window.SPC.userSPCL = await spclContract.balanceOf(userAddress);
  try {
    console.log(window.SPC.userSPCL, window.SPC.userSPCL > 0, window.SPC.userSPCL.gt(0), window.SPC.userSPCL.toString());
  } catch(e) {
    console.warn(e)
  }
  if (window.SPC.userSPCL > 0) {
    enableOn('on-have-spcl')
  } else {
    console.log("no spcl", window.SPC.userSPCL)
  }


  // set spcl table data
  async function liquidityTableData() {
    console.log("updating liquidity table")
    window.SPC.spclTotalSupply = await spclContract.totalSupply();
    if (window.SPC.spclTotalSupply > 0) {
      enableOn('on-liquidity')
      trackEthSpctRate()
    } else {
      console.warn("TODO: if all liquidity removed, handle reverse on-liquidity gui event")
    }

    let poolPercent = ethers.utils.formatEther(window.SPC.userSPCL) / ethers.utils.formatEther(window.SPC.spclTotalSupply);
    let spclEthBal = (await provider.getBalance(spclContract.address))
    let spclSpctBal = (await spctContract.balanceOf(spclContract.address))
    window.SPC.userSPCL = await spclContract.balanceOf(userAddress);
    
    document.querySelector('#spcl-val-one').innerHTML = window.SPC.spclTotalSupply <= 0 ? "-" : `${(1 / window.SPC.spclTotalSupply) * spclEthBal} ETH + ${(1 / window.SPC.spclTotalSupply) * spclSpctBal} SPCT`;  
    document.querySelector('#spcl-balance').innerHTML = poolPercent <= 0 ? "-" : ethers.utils.formatEther(window.SPC.userSPCL);
    document.querySelector('#spcl-pool-total').innerHTML = window.SPC.spclTotalSupply <= 0 ? "-" : ethers.utils.formatEther(window.SPC.spclTotalSupply) + " SPCL";
    
    const showPercent = window.SPC.spclTotalSupply > 0 && poolPercent > 0; 
    document.querySelector('#spcl-pool-percent').innerHTML = !showPercent ? "-" : `${poolPercent*100}%`;

    // console.log('used to underflow on:', spclEthBal, spclSpctBal, poolPercent)

    document.querySelector('#spcl-eth-val').innerHTML = !showPercent ? "-" : `${ethers.utils.formatEther( ((spclEthBal * poolPercent) + "").split(".")[0] )} ETH`;
    document.querySelector('#spcl-spct-val').innerHTML = !showPercent ? "-" : `${ethers.utils.formatEther( ((spclSpctBal * poolPercent) + "").split(".")[0] )} SPCT`;

    swapTableData();
  }
  liquidityTableData();
  window.SPC.liquidityTableData = liquidityTableData


  // set spcl table data
  async function swapTableData() {
    console.log("updating swap table")
    window.SPC.userSPCT = await spctContract.balanceOf(userAddress);
    if (window.SPC.userSPCT > 0) {
      console.log("HAVE SPCT",window.SPC.userSPCT, window.SPC.userSPCT>0)
      enableOn('on-have-spct');
    }
    window.SPC.spclTotalSupply = await spclContract.totalSupply();
    let poolPercent = ethers.utils.formatEther(window.SPC.userSPCL) / ethers.utils.formatEther(window.SPC.spclTotalSupply);
    let spclEthBal = (await provider.getBalance(spclContract.address))
    let spclSpctBal = (await spctContract.balanceOf(spclContract.address))

    document.querySelector('#current-rate').innerHTML = `Current Rate: 1 ETH = ${await window.currentSPCTtoETH()} SPCT`;
    document.querySelector('#swap-pool-all').innerHTML = window.SPC.spclTotalSupply <= 0 ? "-" : `${(1 / window.SPC.spclTotalSupply) * spclEthBal} ETH + ${(1 / window.SPC.spclTotalSupply) * spclSpctBal} SPCT`
    document.querySelector('#swap-user-spct').innerHTML = ethers.utils.formatEther(window.SPC.userSPCT)
    document.querySelector('#swap-user-eth').innerHTML = ethers.utils.formatEther((await provider.getBalance(userAddress)))
  }
  

  if (window.SPC.spclTotalSupply) {
    enableOn('on-liquidity')
  }


/*
// Get the filter (the second null could be omitted)
const filter = spctContract.filters.Buy(null, null);

// Query the filter (the latest could be omitted)
const logs = await spctContract.queryFilter(filter, 0);

*/

  //
  // get the historical event record:
  //
  // Get the filter (the second null could be omitted)
  const mintFilter = spclContract.filters.Mint(null, null);

  // Query the mintFilter (the latest could be omitted)
  const mintLogs = await spclContract.queryFilter(mintFilter, 0);

  const burnFilter = spclContract.filters.Burn(null, null);

  // Query the burnFilter (the latest could be omitted)
  const burnLogs = await spclContract.queryFilter(burnFilter, 0);

  const liquidityLogs = mintLogs.concat(burnLogs).sort(async (a,b) => {
    return (await a.getBlock()).timestamp - (await a.getBlock()).timestamp
  })

  // console.warn("liquidity logs:", liquidityLogs)

  // Print out all the values:
  mintLogs.forEach(async (log) => {
    // The log object contains lots of useful things, but the args are what you prolly want)
    // console.log('time', new Date((await log.getBlock()).timestamp*1000) ); 
    // console.log('args', log.args);
    // console.log('full tx event log',log)

    // {
    //   spct: ethers.utils.formatEther(ethers.BigNumber.from(log.args.eth).mul(5)),
    //   eth: ethers.utils.formatEther(log.args.eth),
    //   sender: log.args.sender,
    // }

    if (log.event === "Mint") {
      // liquidityProvider, ethIn, spctIn, spclOut
      addEventRow('liquidity-events', {
        address: log.args.liquidityProvider, 
        ethIn: "-" + ethers.utils.formatEther(log.args.ethIn), 
        spctIn: "-" + ethers.utils.formatEther(log.args.spctIn), 
        spclOut: "+" + ethers.utils.formatEther(log.args.spclOut),
        time: new Date((await log.getBlock()).timestamp*1000),
      })
    } else {
      // liquidityProvider, spclIn, ethOut, spctOut
      addEventRow('liquidity-events', {
        address: log.args.liquidityProvider,
        ethOut: "+" + ethers.utils.formatEther(log.args.ethOut),
        spctOut: "+" + ethers.utils.formatEther(log.args.spctOut), 
        spclIn: "-" + ethers.utils.formatEther(log.args.spclIn),
        time: new Date((await log.getBlock()).timestamp*1000),
      })
    }
  });




  const swapEthFilter = spclContract.filters.SwapEth(null, null);
  // Query the swapEthFilter (the latest could be omitted)
  const swapEthLogs = await spclContract.queryFilter(swapEthFilter, 0);

  const swapSpctFilter = spclContract.filters.SwapSpct(null, null);
  // Query the swapSpctFilter (the latest could be omitted)
  const swapSpctLogs = await spclContract.queryFilter(swapSpctFilter, 0);

  // attempt to time sort them (untested)
  const swapLogs = swapEthLogs.concat(swapSpctLogs).sort(async (a,b) => {
    return (await a.getBlock()).timestamp - (await a.getBlock()).timestamp
  })

  // console.warn("swap logs:", swapLogs)

  // Print out all the values:
  swapLogs.forEach(async (log) => {
    // The log object contains lots of useful things, but the args are what you prolly want)
    // console.log('time', new Date((await log.getBlock()).timestamp*1000) ); 
    // console.log('args', log.args);
    // console.log('full tx event log',log)

    // {
    //   spct: ethers.utils.formatEther(ethers.BigNumber.from(log.args.eth).mul(5)),
    //   eth: ethers.utils.formatEther(log.args.eth),
    //   sender: log.args.sender,
    // }

    // if (log.event === "SwapEth") {
      // liquidityProvider, ethIn, spctIn, spclOut
      addEventRow('swap-events', {
        address: log.args[0],
        in: ethers.utils.formatEther(log.args[1]) + (log.event === "SwapEth" ? " ETH" : " SPCT"), 
        out: ethers.utils.formatEther(log.args[2]) + (log.event === "SwapEth" ? " SPCT" : " ETH"), 
        time: new Date((await log.getBlock()).timestamp*1000),
      })
  });




  async function trackEthSpctRate() {
    let lastBlock = window.currentBlock;
    window.currentSPCTtoETH = async function() {
      if (!window.SPC.lastRate || window.currentBlock !== lastBlock) {
        console.log("raw rate",(await routerContract.getSPCTtoETH10000000(0)).toNumber(), (await routerContract.getSPCTtoETH10000000(0)).toNumber() / 10000000)
        window.SPC.lastRate = (await routerContract.getSPCTtoETH10000000(0)).toNumber() / 10000000
      }
      return window.SPC.lastRate
    }
    window.currentSPCTtoETH()
  }

  spclContract.on("Mint", async (liquidityProvider, ethIn, spctIn, spclOut, event) => {
    console.log("EVENT: Mint", liquidityProvider, ethIn, spctIn, spclOut, event);
    if (!marketOpen) {
      marketOpen = true;
      enableOn('on-market-open');
    }

    addEventRow('liquidity-events', {
      liquidityProvider, 
      ethIn: "-" + ethers.utils.formatEther(ethIn), 
      spctIn: "-" + ethers.utils.formatEther(spctIn), 
      spclOut: "+" + ethers.utils.formatEther(spclOut),
      time: new Date((await event.getBlock()).timestamp * 1000),
    })
    liquidityTableData()
  })
  spclContract.on("Burn", async (liquidityProvider, spclIn, ethOut, spctOut, event) => {
    console.log("EVENT: Burn", liquidityProvider, spclIn, ethOut, spctOut, event);
    
    addEventRow('liquidity-events', {
      liquidityProvider, 
      ethOut: "+" + ethers.utils.formatEther(ethOut), 
      spctOut: "+" + ethers.utils.formatEther(spctOut),
      spclIn: "-" + ethers.utils.formatEther(spclIn), 
      time: new Date((await event.getBlock()).timestamp*1000),
    })
    liquidityTableData()
  }) 
  spclContract.on("SwapEth", async (swapper, ethIn, spctOut, event) => {
    console.log("EVENT: SwapEth", swapper, ethIn, spctOut, event);
    
    if (window.SPC.callOnSwap && addressIsUser(swapper)) {
      window.SPC.callOnSwap()
    } else {
      console.warn("other user swap or nothing to call")
    }

    addEventRow('swap-events', {
      swapper: ethers.utils.formatEther(swapper), 
      ethIn: ethers.utils.formatEther(ethIn) + " ETH", 
      spctOut: ethers.utils.formatEther(spctOut) + " SPCT",
      time: new Date((await event.getBlock()).timestamp*1000),
    })
    liquidityTableData()
  }) 
  spclContract.on("SwapSpct", async (swapper, spctIn, ethOut, event) => {
    console.log("EVENT: SwapSpct", swapper, spctIn, ethOut, event);

    if (window.SPC.callOnSwap && addressIsUser(swapper)) {
      window.SPC.callOnSwap()
    } else {
      console.warn("other user swap or nothing to call")
    }
    
    addEventRow('swap-events', {
      swapper: ethers.utils.formatEther(swapper), 
      spctIn: ethers.utils.formatEther(spctIn) + " SPCT", 
      ethOut: ethers.utils.formatEther(ethOut)+ " ETH",
      time: new Date((await event.getBlock()).timestamp*1000),
    })
    liquidityTableData()
  })

  window.SPC.addLiquidity = async function() {
    const spctToStake = fixStringPrecision(document.querySelector('#spct-spcl-input').value);
    const ethToStake = fixStringPrecision(document.querySelector('#eth-spcl-input').value);
    console.log("staking",{spctToStake, ethToStake})
    const parsed = {
      spctToStake: ethers.utils.parseEther(spctToStake).toString(),
      ethToStake: ethers.utils.parseEther(ethToStake).toString(),
    }
    console.log("parsed", parsed)
    // ethers.utils.parseEther(spctToStake).toString()
    try {
      await routerContract.addLiquidity(
        parsed.spctToStake,
        userAddress,
        {
          value: parsed.ethToStake
        }
      )
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }

  if (!window.SPC.swapDirection) window.SPC.swapDirection = "fromETH"; 
  //  function swap(uint _maxSlip, uint _spctToSwap, bool _simulate) external payable returns(uint) {


  window.SPC.getPredictedSlip = async function() {
    if (!window.SPC.spclTotalSupply) return "no liquidity"

    const ethIn = window.SPC.swapDirection === "fromETH" ? window.SPC.swapInput : 0; // if 0, this will be removed and not sent
    const spctIn = window.SPC.swapDirection === "fromSPCT" ? window.SPC.swapInput : '0'; // this value will stick around
    
    if (!ethIn && (!spctIn || spctIn == 0)) {
      window.SPC.predictedSlip = "";
      return window.SPC.predictedSlip;
    }
    const slip = 100 // document.querySelector('#swap-max-slip').value;
    const simulation = true;


    let args = [(slip*100)+"", spctIn, /*simulation*/false, ethIn]
    console.log('args before', args)
    if (args[3] === 0) {
      args.pop()
    } else {
      args[3] = { value: ethers.utils.parseEther( args[3] ).toString() }
    }

    if (args[1] !== 0) {
      args[1] = ethers.utils.parseEther( fixStringPrecision(args[1]) ).toString()
    }

    // ethers.utils.parseEther(spctToStake).toString()
    try {
      console.log("attempting simulation with callStatic")
      const slip10000 = await routerContract.callStatic.swap(
        ...args
      )
      window.SPC.predictedSlip = slip10000.toString() / 100 
      return window.SPC.predictedSlip;
    } catch (e) {
      console.error('error during simulation', e)
      console.log(e, e.message)
      window.SPC.predictedSlip = ""      
      return ">99.99";
    }
  }

  window.SPC.Swap = async function() {
    if (!window.SPC.spclTotalSupply) return

    const ethIn = window.SPC.swapDirection === "fromETH" ? window.SPC.swapInput : 0; // if 0, this will be removed and not sent
    const spctIn = window.SPC.swapDirection === "fromSPCT" ? window.SPC.swapInput : '0'; // this value will stick around
    
    if (!ethIn && (!spctIn || spctIn == 0)) {
      alert("cannot swap 0")
      return
    } else {
      console.log("will swap",{ethIn, spctIn})
    }
    const slip = document.querySelector('#swap-max-slip').value;
    const simulation = document.getElementById('simulate').checked;

    let args = [(slip*100)+"", spctIn, /*simulation*/false, ethIn]
    console.log('args before', args)
    if (args[3] === 0) {
      args.pop()
    } else {
      args[3] = { value: ethers.utils.parseEther( args[3] ).toString() }
    }

    if (args[1] !== 0) {
      args[1] = ethers.utils.parseEther( fixStringPrecision(args[1]) ).toString()
    }

    console.log('swap:', {ethIn, spctIn, slip}, args)
    // ethers.utils.parseEther(spctToStake).toString()
    try {
      if (!simulation) {
        await routerContract.swap(
          ...args
        )
      } else {
        console.log("attempting simulation with callStatic")
        const slip10000 = await routerContract.callStatic.swap(
          ...args
        )
        const expectedReturn = window.SPC.expectToReceive - (window.SPC.expectToReceive * (slip10000.toString()/10000) );
        console.log(ethIn, window.SPC.expectToReceive, slip10000)
        console.log(ethIn ? ethIn + " ETH" : spctIn + " SPCT", window.SPC.expectToReceive + (ethIn ?" SPCT" : " ETH"), slip10000.toString() / 10000)
        alert(`${simulation ? 'SIMULATION: ' : ''}\nTrade In:\n${
          ethIn ? ethIn + " ETH" : spctIn + " SPCT"  
        }\nPredicted to Receive:\n${
          expectedReturn + (ethIn ?" SPCT" : " ETH")
        }\nvs. Nominal:\n${
          window.SPC.expectToReceive + (ethIn ?" SPCT" : " ETH")
        }\nPredicted Slippage:\n${
          slip10000.toString() / 100
        }%\nPredicted Effective Rate:\n1 ETH : ${
          ethIn ? expectedReturn/ethIn : spctIn/expectedReturn
        } SPCT\nvs. Nominal:\n1 ETH : ${
          await window.currentSPCTtoETH()
        } SPCT`)
      }

      // (swapper, ethIn, spctOut, event)
      window.SPC.callOnSwap = ((predictedSlip, expectToReceive, nominalRate) => (unitIn, swapIn, swapOut) => {
        console.log('was expected pre-swap:', ethIn, spctIn, expectToReceive, predictedSlip)
        alert(`Trade Complete\n\nExpected\n: Trade in: ${
          ethIn ? ethIn + " ETH" : spctIn + " SPCT"  
        }, Receive: ${
          expectToReceive + (ethIn ?" SPCT" : " ETH")
        }, Slip: ${
          predictedSlip
        }%\n\nActual:\n Trade In: ${swapIn} ${unitIn} Receive: ${swapOut} ${unitIn === "ETH" ? "SPCT" : "ETH"}, Slip: `)
      })(window.SPC.predictedSlip, window.SPC.expectToReceive, await window.currentSPCTtoETH())
      
    } catch (e) {
      console.error(e)
      alert("Error attempting swap:\nlikely slip is outside permitted range.\n\n" + e.message)
    }
  }


  // removeLiquidity(_howMuchSPCL, _withdrawTo,_minEth,_minSPCT)
  window.SPC.removeLiquidity = async function() {
    const howMuchSPCL = document.querySelector('#spcl-burn-input').value || "0";
    const minETH = document.querySelector('#spcl-burn-min-eth').value || "0";
    const minSPCT = document.querySelector('#spcl-burn-min-spct').value || "0";
    console.log('burn with params:',howMuchSPCL, minETH, minSPCT)
    // ethers.utils.parseEther(spctToStake).toString()
    try {
      await routerContract.removeLiquidity(
        ethers.utils.parseEther(fixStringPrecision(howMuchSPCL)).toString(),
        userAddress, 
        ethers.utils.parseEther(fixStringPrecision(minETH)).toString(), 
        ethers.utils.parseEther(fixStringPrecision(minSPCT)).toString(), 
      )
      document.querySelector('#spcl-burn-input').value = 0;
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }


  window.Withdraw = async function () {
    if (this.classList.contains("disabled")) return
    const ethBal = await provider.getBalance(spctContract.address);
    const userIsSure = confirm(`Withdraw ${ethers.utils.formatEther(ethBal)} eth & ${marketOpen ? "market rate" : ethers.utils.formatEther(ethBal.mul(5)) } spct to liquidity pool?`);
    if (userIsSure) {
      try {
        await spctContract.withdraw()
        alert("funds deposited to liquidity pool")
      } catch (e) {
        console.error(e)
        alert(e.message)
      }
    }
  }
}

;(async function() {
  // if I don't have this little block, won't work when deployed, only locally...
  try {
    [account] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
  } catch (e) {
    alert("metamask error, unable to get account\n\n"+e)
  }

  // put on window for debugging, obvs don't do this.
  window.userAddress = await signer.getAddress();
  console.log('user address', userAddress)

  if ((await spctContract.owner()).toUpperCase() == userAddress.toUpperCase()) {
    console.log("owner, showing admin buttons")
    ;[...document.querySelectorAll('.owner-only')].forEach(el => {
      el.style.display = "unset";
    })
  } else {
    console.log("not spctContract owner")
  }

  async function ICOTableUpdate() {

    console.log('treasury', ethers.utils.formatEther(await spctContract.totalSupply()) );

    window.SPC.userSPCT = await spctContract.balanceOf(userAddress);
    document.querySelector('#user-balance').innerHTML = ethers.utils.formatEther(window.SPC.userSPCT);
    document.querySelector('#invested').innerHTML = ethers.utils.formatEther(await spctContract.fundraiseTotal());
    document.querySelector('#all-spct').innerHTML = ethers.utils.formatEther(ethers.BigNumber.from(await spctContract.fundraiseTotal()).mul(5));

    const phase = (await spctContract.phase());
    document.querySelector('#phase').innerHTML = phase == 0 ? "Seed" : phase == 1 ? "General" : "Open";
    if (phase == 2) {
      enableOn('on-open-phase')
    }

    let paused = await spctContract.paused();
    document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";

    if (!paused) {
      // todo: add in whitelist check here
      document.querySelector('#buy-button').classList.remove('disabled')
    }
    
    let taxStatus = await spctContract.taxOn();
    document.querySelector('#tax').innerHTML = taxStatus ? "2%" /*await spctContract.taxPercent()*/ : "0%";
  }
  ICOTableUpdate()

  window.currentBlock;
  // set up live block listener
  provider.on("block", blockN => {
    window.currentBlock = blockN;
    [...document.querySelectorAll('.blocknum')].forEach(el => {
      el.innerHTML = `block: ${blockN}`
    })
  })

  //
  // get the historical event record:
  //
  // Get the filter (the second null could be omitted)
  const filter = spctContract.filters.Buy(null, null);

  // Query the filter (the latest could be omitted)
  const logs = await spctContract.queryFilter(filter, 0);

  // Print out all the values:
  logs.forEach(async (log) => {
    // The log object contains lots of useful things, but the args are what you prolly want)
    // console.log('time', new Date((await log.getBlock()).timestamp*1000) ); 
    // console.log('args', log.args.eth, log.args.sender);
    // console.log('full tx event log',log)
    addEventRow('transactions', {
      spct: ethers.utils.formatEther(ethers.BigNumber.from(log.args.eth).mul(5)),
      eth: ethers.utils.formatEther(log.args.eth),
      sender: log.args.sender,
      time: new Date((await log.getBlock()).timestamp*1000),
    })
  });

  // live updates
  spctContract.on("Buy", async (sender, eth, event) => {
    console.log("EVENT: Buy",sender, eth, event)
    addEventRow('transactions', {
      spct: ethers.utils.formatEther(ethers.BigNumber.from(event.args.eth).mul(5)),
      eth: ethers.utils.formatEther(event.args.eth),
      sender: event.args.sender,
      time: new Date((await event.getBlock()).timestamp*1000),
    })
    document.querySelector('#user-balance').innerHTML = ethers.utils.formatEther(await spctContract.balanceOf(userAddress));
    document.querySelector('#invested').innerHTML = ethers.utils.formatEther(await spctContract.fundraiseTotal());
    document.querySelector('#all-spct').innerHTML = ethers.utils.formatEther(ethers.BigNumber.from(await spctContract.fundraiseTotal()).mul(5));
    ICOTableUpdate()
    window.SPC.liquidityTableData()
  })
  spctContract.on("Phase", (phase) => {
    console.log("EVENT: Phase",phase)
    document.querySelector('#phase').innerHTML = phase == 0 ? "Seed" : phase == 1 ? "General" : "Open";
    if (phase == 2) {
      // enable withdraw button
      enableOn('on-open-phase');
    }
  })
  spctContract.on("Pause", (paused) => {
    // also, grey out buy button
    console.log("EVENT: Pause",paused, event);
    document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";
    if (paused) {
      document.querySelector('#buy-button').classList.add('disabled')
    } else {
      document.querySelector('#buy-button').classList.remove('disabled')
    }
  })
  spctContract.on("Tax", (taxOn) => {
    console.log("EVENT: Tax",taxOn, event)
    document.querySelector('#tax').innerHTML = taxOn ? "2%" /*await spctContract.taxPercent()*/ : "0%";
  })

  // button handlers
  window.Tax = async function() {
      try {
        await spctContract.setTaxStatus(!taxStatus);
      } catch (e) {
        console.error(e)
        alert(e.message)
      }
  };

  window.Buy = async function() {
    try {
      await spctContract.buy({
        value: ethers.utils.parseEther( (document.querySelector('#buy-input').value/5) + "")
      })
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }

  window.Phase = async function() {
    if (!confirm("Are you sure you want to progress phase? cannot undo this action.")) {
      return
    }

    try {
      await spctContract.progressPhase();
      alert("progressed phase")
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }

  window.Pause = async function() {
    try {
      await spctContract.togglePause();
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }



  spclSetup()
})()


// new contracts:
// Deploying contracts with the account: 0xCA6b8EaB76F76B458b1c43c0C5f500b33f63F475
// Account balance before deploy: 5603615802277069226
// ToTheMoon address: 0x84385c50b09B77cDB9058E94F78dce06D66E25De
// spcl address: 0xb0655f7c94902bCb13e600Eb25eF423D1D7e75Af
// router address: 0xAcAa4833646eE3d019F4904074A4B644E2222e93
// Whitelisted contributors: [
//   '0x92c9Ce45fdBA89F810F8580120adacB6e9e7657F',
//   '0xCA6b8EaB76F76B458b1c43c0C5f500b33f63F475',
//   '0xeF3d604297aF0FA63d175233B01Db945F9676Fdb'
// ]
