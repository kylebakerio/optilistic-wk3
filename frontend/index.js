// using this guide to start: https://www.zastrin.com/tutorials/build-an-ethereum-dapp-using-ethersjs

const provider = new ethers.providers.Web3Provider(window.ethereum)

const signer = provider.getSigner(0);
let account 

window.SPC = {}

// wk2: 
// const spctContract = new ethers.Contract('0xC2CA5E96069d1678B62704F9791cdaE798dE1C4A', abi, signer)

// wk3:
// ToTheMoon address: 0x84385c50b09B77cDB9058E94F78dce06D66E25De
const spctContract = new ethers.Contract('0xc8DCb2C889F3Ac4a8d72F252FCAa7bbb479F1EB6', spctAbi, signer)
// spcl address: 0xb0655f7c94902bCb13e600Eb25eF423D1D7e75Af
const spclContract = new ethers.Contract('0x967CE2e50377a127bBa39d765463987d0C93af0D', spclAbi, signer)
// router address: 0xAcAa4833646eE3d019F4904074A4B644E2222e93
const routerContract = new ethers.Contract('0xbDaB82FC9A446F23D604C21075cB3A6ae5799224', routerAbi, signer)

function enableOn(trigger) {
  // on-market-open
  // on-open-phase
  // on-have-spcl
  const els = [...document.querySelectorAll("." + trigger)]
  els.forEach(el => el.classList.remove('disabled'))
  els.forEach(el => el.removeAttribute('disabled'))
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

async function spclSetup() {
  let marketOpen = await spclContract.marketOpen();
  if (marketOpen) {
    enableOn('on-market-open');
    trackEthSpctRate()
  } else {
    console.log("swap market closed")
  }

  let userSPCL = await spclContract.balanceOf(userAddress);
  if (userSPCL > 0) {
    enableOn('on-have-spcl')
  } else {
    console.log("no spcl", userSPCL)
  }


  function trackEthSpctRate() {
    let lastBlock = window.currentBlock;
    let lastRate = routerContract.getETHtoSPCT10000000() / 10000000;
    window.currentEthToSpct = function() {
      if (window.currentBlock !== lastBlock) {
        lastRate = routerContract.getETHtoSPCT10000000() / 10000000;
      }
      return lastRate
    }
  }


  spclContract.on("Mint", (liquidityProvider, ethIn, spctIn, spclOut) => {
    console.log("EVENT: Mint", liquidityProvider, ethIn, spctIn, spclOut);
    if (!marketOpen) {
      marketOpen = true;
      enableOn('on-market-open');
      trackEthSpctRate()
    }

    addEventRow('liquidity-events', {
      liquidityProvider, 
      ethIn, 
      spctIn, 
      spclOut,
    })
    // document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";
    // if (paused) {
    //   document.querySelector('#buy-button').classList.add('disabled')
    // } else {
    //   document.querySelector('#buy-button').classList.remove('disabled')
    // }
  })
  spclContract.on("Burn", (liquidityProvider, spclIn, ethOut, spctOut) => {
    console.log("EVENT: Burn", liquidityProvider, spclIn, ethOut, spctOut);

    addEventRow('liquidity-events', {liquidityProvider, spclIn, ethOut, spctOut})
    // document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";
    // if (paused) {
    //   document.querySelector('#buy-button').classList.add('disabled')
    // } else {
    //   document.querySelector('#buy-button').classList.remove('disabled')
    // }
  }) 
  spclContract.on("SwapEth", (swapper, ethIn, spctOut) => {
    console.log("EVENT: SwapEth", swapper, ethIn, spctOut);

    addEventRow('swap-events', {swapper, ethIn, spctOut})
    // document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";
    // if (paused) {
    //   document.querySelector('#buy-button').classList.add('disabled')
    // } else {
    //   document.querySelector('#buy-button').classList.remove('disabled')
    // }
  }) 
  spclContract.on("SwapSpct", (swapper, spctIn, ethOut) => {
    console.log("EVENT: SwapSpct", swapper, spctIn, ethOut);

    addEventRow('swap-events', {swapper, spctIn, ethOut})
    // document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";
    // if (paused) {
    //   document.querySelector('#buy-button').classList.add('disabled')
    // } else {
    //   document.querySelector('#buy-button').classList.remove('disabled')
    // }
  }) 

  window.SPC.addLiquidity = async function() {
    const spctToStake = document.querySelector('#spct-spcl-input');
    try {
      await router.addLiquidity(spctToStake, {
        value: ethers.utils.parseEther( (document.querySelector('#eth-spcl-input').value) + "")
      })
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
  [account] = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  // put on window for debugging, obvs don't do this.
  window.userAddress = await signer.getAddress();
  console.log(userAddress)

  if ((await spctContract.owner()).toUpperCase() == userAddress.toUpperCase()) {
    console.log("owner, showing admin buttons")
    ;[...document.querySelectorAll('.owner-only')].forEach(el => {
      el.style.display = "unset";
    })
  } else {
    console.log("not spctContract owner")
  }
  
  console.log('treasury', ethers.utils.formatEther(await spctContract.totalSupply()) );

  document.querySelector('#user-balance').innerHTML = ethers.utils.formatEther(await spctContract.balanceOf(userAddress));
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
    console.log('time', new Date((await log.getBlock()).timestamp*1000) ); 
    console.log('args', log.args.eth, log.args.sender);
    console.log('full tx event log',log)
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
