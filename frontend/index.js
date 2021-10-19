// using this guide to start: https://www.zastrin.com/tutorials/build-an-ethereum-dapp-using-ethersjs

const provider = new ethers.providers.Web3Provider(window.ethereum)

const signer = provider.getSigner(0);
let account 


// wk2: 
// const spctContract = new ethers.Contract('0xC2CA5E96069d1678B62704F9791cdaE798dE1C4A', abi, signer)

// wk3:
// ToTheMoon address: 0x84385c50b09B77cDB9058E94F78dce06D66E25De
const spctContract = new ethers.Contract('0x84385c50b09B77cDB9058E94F78dce06D66E25De', abi, signer)
// spcl address: 0xb0655f7c94902bCb13e600Eb25eF423D1D7e75Af
const spclContract = new ethers.Contract('0xb0655f7c94902bCb13e600Eb25eF423D1D7e75Af', abi, signer)
// router address: 0xAcAa4833646eE3d019F4904074A4B644E2222e93
const routerContract = new ethers.Contract('0xAcAa4833646eE3d019F4904074A4B644E2222e93', abi, signer)

function enableLiquidityTabs() {
  [...document.querySelectorAll(".on-market-open")].forEach(el => el.classList.remove('disabled'))
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
  
  let paused = await spctContract.paused();
  document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";

  if (!paused) {
    // todo: add in whitelist check here
    document.querySelector('#buy-button').classList.remove('disabled')
  }
  
  let taxStatus = await spctContract.taxOn();
  document.querySelector('#tax').innerHTML = taxStatus ? "2%" /*await spctContract.taxPercent()*/ : "0%";

  document.querySelector('#blocknum').innerHTML = `block: ${provider.blockNumber}`
  // set up live block listener
  provider.on("block", blockN => {
    document.querySelector('#blocknum').innerHTML = `block: ${blockN}`
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
    addTransactionRow({
      spct: ethers.utils.formatEther(ethers.BigNumber.from(log.args.eth).mul(5)),
      eth: ethers.utils.formatEther(log.args.eth),
      sender: log.args.sender,
      time: new Date((await log.getBlock()).timestamp*1000),
    })
  });

  const addTransactionRow = async (data) => {
    const row = document.createElement('tr')
    const col1 = document.createElement('td')
    const col2 = document.createElement('td')
    const col3 = document.createElement('td')
    const col4 = document.createElement('td')

    col1.innerHTML = data.spct
    col2.innerHTML = data.eth
    col3.innerHTML = data.sender
    col4.innerHTML = data.time

    row.appendChild(col1)
    row.appendChild(col2)
    row.appendChild(col3)
    row.appendChild(col4)

    document.querySelector('#transactions').prepend(row);
  }

  // live updates
  spctContract.on("Buy", async (sender, eth, event) => {
    console.log("EVENT: Buy",sender, eth, event)
    addTransactionRow({
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

  window.Withdraw = async function () {
    if (this.classList.contains("disabled")) return
    if (confirm(`Withdraw ${await provider.getBalance(spctContract.address)} eth & ${} spct to liquidity pool?`)) {
      try {
        await spctContract.withdraw()
        alert("funds deposited to liquidity pool")
      } catch (e) {
        console.error(e)
        alert(e.message)
      }
    }
  }

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
