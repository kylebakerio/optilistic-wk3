const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");

describe("SPCToken", () => {
  let owner, treasury, addr2, addr3, addrs, spctoken, tothemoon, router;
  let first = true;

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

    await tothemoon.setRouter(router.address);

    if (first) {
      first = false;
      console.log(['owner','tothemoon', 'spclContract','router'].map(walletName => `${walletName == "owner" ? "owner/spct_treasury" : walletName}: ${eval(walletName).address}`))
    }
  });

  describe("wk2", () => {
    it("Sets owner to deployer", async () => {
      const projectOwner = await tothemoon.owner();
      expect(projectOwner).to.be.equal(owner.address);
    });

    it("Sets treasury correctly", async () => {
      const publicTreasury = await tothemoon.treasury();
      expect(publicTreasury).to.be.equal(treasury.address);
    });

    it("Mints 500k tokens", async () => {
      const tokens = await tothemoon.totalSupply();
      expect(tokens).to.be.equal(parseEther("500000"));
    });

    it("Disables tax by default", async () => {
      const taxOn = await tothemoon.taxOn();
      expect(taxOn).to.be.equal(false);
    });

    it("Allows enabling tax", async () => {
      await tothemoon.setTaxStatus(true);
      const taxOn = await tothemoon.taxOn();
      expect(taxOn).to.be.equal(true);
    });

    it("Allows disabling tax after enabling tax", async () => {
      await tothemoon.setTaxStatus(true);
      await tothemoon.setTaxStatus(false);
      const taxOn = await tothemoon.taxOn();
      expect(taxOn).to.be.equal(false);
    });

    it("Takes no tax for transfers when tax is off", async () => {
      await tothemoon.setTaxStatus(false);
      await tothemoon.connect(owner).transfer(addr3.address, 100);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(1);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(2);

      const addr3Balance = await tothemoon.balanceOf(addr3.address);
      expect(addr3Balance).to.be.equal(100);
    });

    it("Takes 2% tax for transfers when tax is on", async () => {
      await tothemoon.setTaxStatus(true);
      await tothemoon.connect(owner).transfer(addr3.address, 100);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(1);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(2);

      const addr3Balance = await tothemoon.balanceOf(addr3.address);
      expect(addr3Balance).to.be.equal(98);
    });
  });

  describe("wk3", async () => {
    it("Allows owner to initially withdraw 5:1 amounts SPCT/ETH to liquidity pool", async () => {
      // progress phase, buy to load up some fundraised cash in treasury

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(1);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(2);      

      await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("1000") });
      expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1000"));

      // liquidity transfered, should now be eth in the contract that can be withdrawn
      await expect(
        await tothemoon.connect(owner).withdraw()
      ).to.changeEtherBalance(spclContract, parseEther("1000"));

      // withdrawl should also send spct to contract
      const liquidSPCT = await tothemoon.balanceOf(spclContract.address);
      expect(liquidSPCT).to.be.equal(parseEther("5000"));

      // as a result, treasury should now have spcl
      const spclReceived = await spclContract.balanceOf(treasury.address);
      // console.log("spcl given to spct:", ethers.utils.formatEther(spclReceived), treasury.address)
      expect(spclReceived.gt("0")).to.be.equal(true);
    });

    it("Allows owner to withdraw SPCT/ETH to liquidity pool after liquidity is already present", async () => {
      // progress phase, buy to load up some fundraised cash in treasury
      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(1);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(2);      

      await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("1100") });
      expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1100"));

      // liquidity transfered, should now be eth in the contract that can be withdrawn
      await expect(
        await tothemoon.connect(owner).withdraw()
      ).to.changeEtherBalance(spclContract, parseEther("1100"));

      // withdrawl should also send spct to contract
      let liquidSPCT = await tothemoon.balanceOf(spclContract.address);
      expect(liquidSPCT).to.be.equal(parseEther( (1100 * 5) + ""));

      // as a result, treasury should now have spcl
      const spclReceived = await spclContract.balanceOf(treasury.address);
      // console.log("spcl given to spct:", ethers.utils.formatEther(spclReceived), treasury.address)
      expect(spclReceived.gt("0")).to.be.equal(true);

      //
      // now a second user buys as well
      await expect(
        await tothemoon.connect(moreAddrs[1]).buy({ value: parseEther("1200") })
      ).to.changeEtherBalance(tothemoon, parseEther("1200"));


      expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther(1200 + 1100 + ""));
      // they should have 1200 now

      await expect(
        await tothemoon.connect(owner).withdraw()
      ).to.changeEtherBalance(spclContract, parseEther("1200"));

      // withdrawl should also send spct to contract
      liquidSPCT = await tothemoon.balanceOf(spclContract.address);
      expect(liquidSPCT).to.be.equal(parseEther((1100 * 5) + (1200 * 5) + ""));

      let spclReceived2 = await spclContract.balanceOf(treasury.address);
      // console.log("received <before> vs <after>", ethers.utils.formatEther(spclReceived), ethers.utils.formatEther(spclReceived2));
      expect(spclReceived2.gt(spclReceived)).to.be.equal(true);
    });
  });

});
