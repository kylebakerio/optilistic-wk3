// using this guide to start: https://www.zastrin.com/tutorials/build-an-ethereum-dapp-using-ethersjs

const provider = new ethers.providers.Web3Provider(window.ethereum)

const signer = provider.getSigner(0);
let account 

//v3: 
const contract = new ethers.Contract('0xC2CA5E96069d1678B62704F9791cdaE798dE1C4A', abi, signer)

;(async function() {
  // if I don't have this little block, won't work when deployed, only locally...
  [account] = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  // put on window for debugging, obvs don't do this.
  window.userAddress = await signer.getAddress();
  console.log(userAddress)

  if ((await contract.owner()).toUpperCase() == userAddress.toUpperCase()) {
    console.log("owner, showing admin buttons")
    ;[...document.querySelectorAll('.owner-only')].forEach(el => {
      el.style.display = "unset";
    })
  } else {
    console.log("not contract owner")
  }
  
  console.log('treasury', ethers.utils.formatEther(await contract.totalSupply()) );

  document.querySelector('#user-balance').innerHTML = ethers.utils.formatEther(await contract.balanceOf(userAddress));
  document.querySelector('#invested').innerHTML = ethers.utils.formatEther(await contract.fundraiseTotal());
  document.querySelector('#all-spct').innerHTML = ethers.utils.formatEther(ethers.BigNumber.from(await contract.fundraiseTotal()).mul(5));

  const phase = (await contract.phase());
  document.querySelector('#phase').innerHTML = phase == 0 ? "Seed" : phase == 1 ? "General" : "Open";
  
  let paused = await contract.paused();
  document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";

  if (!paused) {
    // todo: add in whitelist check here
    document.querySelector('#buy-button').classList.remove('disabled')
  }
  
  let taxStatus = await contract.taxOn();
  document.querySelector('#tax').innerHTML = taxStatus ? "2%" /*await contract.taxPercent()*/ : "0%";

  document.querySelector('#blocknum').innerHTML = `block: ${provider.blockNumber}`
  // set up live block listener
  provider.on("block", blockN => {
    document.querySelector('#blocknum').innerHTML = `block: ${blockN}`
  })

  //
  // get the historical event record:
  //
  // Get the filter (the second null could be omitted)
  const filter = contract.filters.Buy(null, null);

  // Query the filter (the latest could be omitted)
  const logs = await contract.queryFilter(filter, 0);

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
  contract.on("Buy", async (sender, eth, event) => {
    console.log("EVENT: Buy",sender, eth, event)
    addTransactionRow({
      spct: ethers.utils.formatEther(ethers.BigNumber.from(event.args.eth).mul(5)),
      eth: ethers.utils.formatEther(event.args.eth),
      sender: event.args.sender,
      time: new Date((await event.getBlock()).timestamp*1000),
    })
    document.querySelector('#user-balance').innerHTML = ethers.utils.formatEther(await contract.balanceOf(userAddress));
    document.querySelector('#invested').innerHTML = ethers.utils.formatEther(await contract.fundraiseTotal());
    document.querySelector('#all-spct').innerHTML = ethers.utils.formatEther(ethers.BigNumber.from(await contract.fundraiseTotal()).mul(5));
  })
  contract.on("Phase", (phase) => {
    console.log("EVENT: Phase",phase)
    document.querySelector('#phase').innerHTML = phase == 0 ? "Seed" : phase == 1 ? "General" : "Open";
  })
  contract.on("Pause", (paused) => {
    // also, grey out buy button
    console.log("EVENT: Pause",paused, event);
    document.querySelector('#pause').innerHTML = paused ? "Yes" : "No";
    if (paused) {
      document.querySelector('#buy-button').classList.add('disabled')
    } else {
      document.querySelector('#buy-button').classList.remove('disabled')
    }
  })
  contract.on("Tax", (taxOn) => {
    console.log("EVENT: Tax",taxOn, event)
    document.querySelector('#tax').innerHTML = taxOn ? "2%" /*await contract.taxPercent()*/ : "0%";
  })


  // button handlers
  window.Tax = async function() {
      try {
        await contract.setTaxStatus(!taxStatus);
      } catch (e) {
        console.error(e)
        alert(e.message)
      }
  };

  window.Buy = async function() {
    try {
      await contract.buy({
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
      await contract.progressPhase();
      alert("progressed phase")
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }

  window.Pause = async function() {
    try {
      await contract.togglePause();
    } catch (e) {
      console.error(e)
      alert(e.message)
    }
  }

})()
