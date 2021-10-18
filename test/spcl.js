const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");

describe("Pool+Router", () => {
  let owner, treasury, addr2, addr3, addrs, spctoken, tothemoon, router;
  const provider = ethers.provider;

  function formatEther(bigNumber) {
    return ethers.utils.formatEther( bigNumber.toString() )
  }

  async function icoPurchase() {
    // progress phase, buy to load up some fundraised cash in treasury
    await tothemoon.connect(owner).progressPhase();
    phase = await tothemoon.phase();
    expect(phase).to.be.equal(1);

    await tothemoon.connect(owner).progressPhase();
    phase = await tothemoon.phase();
    expect(phase).to.be.equal(2);      

    await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("100") });
    expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("100"));
    // liquidity transfered, should now be eth in the contract that can be withdrawn
  };

  async function openMarket() {
    // make initial purchase at 5:1 ratio via withdraw(), which opens the market
    await expect(
      await tothemoon.connect(owner).withdraw()
    ).to.changeEtherBalance(spclContract, parseEther("100"));

    // withdrawl should also send spct to contract
    let liquidSPCT = await tothemoon.balanceOf(spclContract.address);
    expect(liquidSPCT).to.be.equal(parseEther( (100 * 5) + ""));

    // as a result, treasury should now have spcl
    const spclReceivedTreasury = await spclContract.balanceOf(treasury.address);
    // console.log("spcl given to spct:", ethers.utils.formatEther(spclReceivedTreasury), treasury.address)
    expect(spclReceivedTreasury.gt("0")).to.be.equal(true);
    expect(ethers.utils.formatEther(spclReceivedTreasury.toString()).slice(0,8)).to.be.equal(("" + Math.sqrt((100*5) * 100)).slice(0,8));
    // console.log("<<<<END SETUP>>>>")
  };

  beforeEach(async () => {
    ;[owner, ...addrs] = await ethers.getSigners();

    treasury = owner;

    [addr2, addr3, ...moreAddrs] = addrs.slice(0, addrs.length/2);
    whitelistAddrs = addrs.slice(addrs.length/2, addrs.length);

    // needed to test some more complex implementation features, as ToTheMoon inherits from and uses SPCT
    const ToTheMoon = await ethers.getContractFactory("ToTheMoon");
    tothemoon = await ToTheMoon.deploy(addrs.map(a => a.address));

    // required that we specify this when deploying ToTheMoon, because required by SPCToken
    const SPCL = await ethers.getContractFactory("SPCL");
    spclContract = await SPCL.deploy(tothemoon.address);

    // required that we specify this when deploying ToTheMoon, because required by SPCToken
    const Router = await ethers.getContractFactory("Router");
    router = await Router.deploy(tothemoon.address, spclContract.address);

    await tothemoon.setRouter(spclContract.address, router.address);
  });

  describe("Spec", async () => {
    it("Does not allow depositing liquidity until market is opened by withdraw() call from tothemoon ICO contract", async () => {
      await expect(
        router.connect(moreAddrs[0]).addLiquidity(parseEther("500"), moreAddrs[0].address, {value: parseEther("100")})
      ).to.be.revertedWith("market_closed");

      await icoPurchase();

      await expect(
        router.connect(moreAddrs[0]).addLiquidity(parseEther("500"), moreAddrs[0].address, {value: parseEther("100")})
      ).to.be.revertedWith("market_closed");

      await openMarket()

      // now any wallet with SPCT should have access to the market
      await router.connect(moreAddrs[0]).addLiquidity(parseEther("500"), moreAddrs[0].address, {value: parseEther("100")});

      let spclReceived = await spclContract.balanceOf(moreAddrs[0].address);
      expect(spclReceived.gt(0)).to.be.equal(true);
    });

    it("Rejects liquidity being added if not enough SPCT is provided", async () => {
      await icoPurchase();

      await openMarket()

      // now any wallet with SPCT should have access to the market
      await expect(
        router.connect(moreAddrs[0]).addLiquidity(parseEther("400"), moreAddrs[0].address, {value: parseEther("100")})
      ).to.be.revertedWith('insufficient_spct');

      let spclReceived = await spclContract.balanceOf(moreAddrs[0].address);
      expect(spclReceived.gt(0)).to.be.equal(false);
    });

    it("Returns the correct amount of SPCL when adding liquidity after post-initial liquidity deposit", async () => {
      await icoPurchase();
      await openMarket();

      // const spclBefore = (await spclContract.totalSupply())  ;

      // console.log(">> total supply spcl before", ethers.utils.formatEther( (await spclContract.totalSupply()).toString() ) )
      // now any wallet with SPCT should have access to the market
      await router.connect(moreAddrs[0]).addLiquidity(parseEther("500"), moreAddrs[0].address, {value: parseEther("100")});

      let spclReceived = await spclContract.balanceOf(moreAddrs[0].address);
      // console.log("<received> spcl vs <expected>:", formatEther(spclReceived.toString()), ("" + Math.sqrt((100*5) * 100)).slice(0,3))
      // console.log("TREASURY <received> spcl vs <expected>:", ethers.utils.formatEther(spclReceived.toString()).slice(0,8), ("" + Math.sqrt((100*5) * 100)).slice(0,8) );
      expect(spclReceived.toString().slice(0,3)).to.be.equal(("" + Math.sqrt((100*5) * 100)).slice(0,3));

      // const spclAfter = (await spclContract.totalSupply())
      // console.log(">> total supply spcl after", (await spclContract.totalSupply()).toString() )
      // console.log('spcl difference after 500/100 addition to pool', formatEther(spclBefore), formatEther(spclAfter), formatEther(spclAfter.sub(spclBefore)))
    });

    it("Burns spcl back into spct and eth correctly (no swap fees), both from router and from spcl directly, including fractional amounts and with minimums", async () => {
      await icoPurchase();
      await openMarket();

      // now any wallet with SPCT should have access to the market
      await router.connect(moreAddrs[0]).addLiquidity(parseEther("500"), moreAddrs[0].address, {value: parseEther("100")});

      let spclReceived = await spclContract.balanceOf(moreAddrs[0].address);
      // console.log("<received> spcl vs <expected>:", formatEther(spclReceived.toString()), ("" + Math.sqrt((100*5) * 100)).slice(0,3));
      // console.log("TREASURY <received> spcl vs <expected>:", ethers.utils.formatEther(spclReceived.toString()).slice(0,8), ("" + Math.sqrt((100*5) * 100)).slice(0,8) );
      expect(spclReceived.toString().slice(0,3)).to.be.equal(("" + Math.sqrt((100*5) * 100)).slice(0,3));

      const userSpctBefore = (await tothemoon.balanceOf(moreAddrs[0].address));
      // console.log('>>>spct before', formatEther(userSpctBefore).toString())

      // done as three transactions to test ability to burn fractions of liquidity

      await expect(
        // await spclContract.connect(moreAddrs[0]).burn(spclReceived.div(2), moreAddrs[0].address)
        await router.removeLiquidity(spclReceived.div(2), moreAddrs[0].address, 0, 0)
      ).to.changeEtherBalance(moreAddrs[0], parseEther("50"));

      await expect(
        await spclContract.connect(moreAddrs[0]).burn(spclReceived.div(4), moreAddrs[0].address)
        // await router.removeLiquidity(spclReceived, moreAddrs[0].address, 0, 0)
      ).to.changeEtherBalance(moreAddrs[0], parseEther("25"));

      await expect(
        router.removeLiquidity(spclReceived.div(4), moreAddrs[0].address, parseEther("26"), 0)
      ).to.be.revertedWith('min_eth_not_met')

      await expect(
        router.removeLiquidity(spclReceived.div(4), moreAddrs[0].address, 0, parseEther((25 * 5) + 1 + ""))
      ).to.be.revertedWith('min_spct_not_met')

      await expect(
        await spclContract.connect(moreAddrs[0]).burn(spclReceived.div(4), moreAddrs[0].address)
        // await router.removeLiquidity(spclReceived, moreAddrs[0].address, 0, 0)
      ).to.changeEtherBalance(moreAddrs[0], parseEther("25"));

      const userSpctReturned = (await tothemoon.balanceOf(moreAddrs[0].address));
      // console.log('>>>spct returned', formatEther(userSpctReturned))

      expect(await spclContract.balanceOf(moreAddrs[0].address)).to.be.equal(0);
      expect(formatEther(userSpctReturned.sub(userSpctBefore))).to.be.equal("500.0");

      // how to get balance:
      // const addr0Balance = await provider.getBalance(moreAddrs[0].address);
    });

    it("Fails swaps that slip more than allowed", async () => {
      await icoPurchase();
      await openMarket();

      await expect(
        router.connect(addr3).swap(1,0,false,{value: parseEther("2")})
      ).to.be.revertedWith('too_much_slip')

      // let addr3SPCT = (await tothemoon.balanceOf(addr3.address))
      // console.log('from 2 eth to:', formatEther(addr3SPCT))
      // expect(addr3SPCT.gt(0)).to.be.equal(true)
    });

    it("Allows eth->spct swaps", async () => {
      await icoPurchase();
      await openMarket();

      // const spctPrice = (await router.getSPCTtoETH10000000())
      // .div(10000000);
      // console.log("price before swap:", spctPrice);

      await router.connect(addr2).swap(600, 0, false, {value: parseEther("2")});
      let addr2SPCT = (await tothemoon.balanceOf(addr2.address))

      // console.log('from 2 eth to:', formatEther(addr2SPCT))
      expect(Number(formatEther(addr2SPCT))).to.be.at.least((2*5) - ((2*5)*.06)) // specified 6% slippage with 600
      expect(Number(formatEther(addr2SPCT))).to.be.at.most((2*5)) // specified 6% slippage with 600
    });

    it("Allows spct->eth swaps", async () => {
      await icoPurchase();
      await openMarket();

      // const spctPrice = (await router.getSPCTtoETH10000000())
      // .div(10000000);
      // console.log("price before swap:", spctPrice);

      // first: buy spct
      await tothemoon.connect(moreAddrs[1]).buy({ value: parseEther("2") });
      let moreAddrsSPCTBefore = (await tothemoon.balanceOf(spclContract.address))
      // console.log("user spct before",formatEther(moreAddrsSPCTBefore))

      // for some reason this is returning zero, even though logs show it should return 195 (which should then be divided by 
      // 10000 to produce 0.0195% slip expected)
      // const expectedSlip = await router.connect(moreAddrs[1]).swap(10000, parseEther((5*2)+""),true)
      // console.log('expected slip (not working...)', (await expectedSlip).value.toString());

      const moreAddrs1BalanceBefore = await provider.getBalance(moreAddrs[1].address);
      // await expect(
      await router.connect(moreAddrs[1]).swap(600, parseEther((5*2)+""),false)
      // ).to.changeEtherBalance(moreAddrs[1], parseEther("2"));
      const moreAddrs1BalanceAfter = await provider.getBalance(moreAddrs[1].address);

      const moreAddrs1EthReceived = moreAddrs1BalanceAfter - moreAddrs1BalanceBefore;
      // console.log('from 10 spct to <eth>:', formatEther(moreAddrs1EthReceived))

      expect(Number(formatEther(moreAddrs1EthReceived))).to.be.at.least(2 - (2*.06)) // specified 6% slippage with 600
      expect(Number(formatEther(moreAddrs1EthReceived))).to.be.at.most(2) // specified 6% slippage with 600

      moreAddrsSPCTAfter = (await tothemoon.balanceOf(spclContract.address))
      // console.log("user spct after swap...",formatEther(moreAddrsSPCTAfter))
      expect(Number(formatEther(moreAddrsSPCTAfter)) - Number(formatEther(moreAddrsSPCTBefore))).to.be.equal(10)
    });
 
    it("takes 1% fee, deposits fee into liquidity pool, which is collected proportionally by liquidity providers", async () => {
      await icoPurchase();
      await openMarket();

      // now any wallet with SPCT should have access to the market
      await router.connect(moreAddrs[0]).addLiquidity(parseEther("500"), moreAddrs[0].address, {value: parseEther("100")});

      let spclReceived = await spclContract.balanceOf(moreAddrs[0].address);
      // console.log("<received> spcl vs <expected>:", formatEther(spclReceived.toString()), ("" + Math.sqrt((100*5) * 100)).slice(0,3));
      // console.log("TREASURY <received> spcl vs <expected>:", ethers.utils.formatEther(spclReceived.toString()).slice(0,8), ("" + Math.sqrt((100*5) * 100)).slice(0,8) );
      expect(spclReceived.toString().slice(0,3)).to.be.equal(("" + Math.sqrt((100*5) * 100)).slice(0,3));

      const userSpctBefore = (await tothemoon.balanceOf(moreAddrs[0].address));
      // console.log('>>>spct before', formatEther(userSpctBefore).toString())

      await router.connect(addr2).swap(600, 0, false, {value: parseEther("2")});
      let addr2SPCT = (await tothemoon.balanceOf(addr2.address))

      await expect(
        // await spclContract.connect(moreAddrs[0]).burn(moreAddrs[0].address)
        await router.removeLiquidity(spclReceived, moreAddrs[0].address, 0, 0)
      ).to.changeEtherBalance(moreAddrs[0], parseEther("101")); // 2 eth went into pool, and moreAddrs[0] owns 50% of pool

      const userSpctReturned = (await tothemoon.balanceOf(moreAddrs[0].address));
      // console.log('>>>spct returned', formatEther(userSpctReturned))

      expect(await spclContract.balanceOf(moreAddrs[0].address)).to.be.equal(0);
      expect(Number(formatEther(userSpctReturned.sub(userSpctBefore)))).to.be.lessThan(500);

      // why ~495?
      // at 1:5, we swapped 2eth
      // that means we returned ~10 SPC
      // since this user has 50% of pool, they should have lost 5~ SPC and gained 1eth
      // ~because I don't want to re-implement calculation for slippage precisely in JS,
      // as that's just asking for wasting time, and is honestly a weak test, as either could have
      // errors, and would likely be written just to match each other, which doesn't itself show
      // anything about correctness, and can only test consistency.
      expect(Math.round(Number(formatEther(userSpctReturned.sub(userSpctBefore))))).to.be.equal(495);
    });
  });

});
