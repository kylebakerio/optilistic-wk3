const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");

describe("SPCToken", () => {
  let owner, treasury, addr2, addr3, addrs, spctoken;

  beforeEach(async () => {
    // [owner, treasury, addr2, addr3, ...addrs] = await ethers.getSigners();


    ;[owner, treasury, ...addrs] = await ethers.getSigners();

    [addr2, addr3, ...moreAddrs] = addrs.slice(0, addrs.length/2);
    whitelistAddrs = addrs.slice(addrs.length/2, addrs.length);

    const ToTheMoon = await ethers.getContractFactory("ToTheMoon");
    tothemoon = await ToTheMoon.deploy(addrs.map(a => a.address), treasury.address);


    // const SPCToken = await ethers.getContractFactory("SPCToken");
    const SPCToken = await ethers.getContractFactory("ToTheMoon"); // switch to this; it inherits from SPCToken, so can test all of SPCToken in context, and also necessary to test some features.
    spctoken = await SPCToken.deploy(addrs.map(a => a.address), treasury.address); // , parseEther("1.5")
  });

  describe("wk2", () => {
    it("Sets owner to deployer", async () => {
      const projectOwner = await spctoken.owner();
      expect(projectOwner).to.be.equal(owner.address);
    });

    it("Sets treasury correctly", async () => {
      const publicTreasury = await spctoken.treasury();
      expect(publicTreasury).to.be.equal(treasury.address);
    });

    it("Mints 500k tokens", async () => {
      const tokens = await spctoken.totalSupply();
      expect(tokens).to.be.equal(parseEther("500000"));
    });

    it("Disables tax by default", async () => {
      const taxOn = await spctoken.taxOn();
      expect(taxOn).to.be.equal(false);
    });

    it("Allows enabling tax", async () => {
      await spctoken.setTaxStatus(true);
      const taxOn = await spctoken.taxOn();
      expect(taxOn).to.be.equal(true);
    });

    it("Allows disabling tax after enabling tax", async () => {
      await spctoken.setTaxStatus(true);
      await spctoken.setTaxStatus(false);
      const taxOn = await spctoken.taxOn();
      expect(taxOn).to.be.equal(false);
    });

    it("Allows onlyOwner to mint new tokens", async () => {
      let tokens;
      tokens = await spctoken.totalSupply();
      expect(tokens).to.be.equal( parseEther("500000") );

      await spctoken.connect(owner).mint( parseEther("2000") )
      tokens = await spctoken.totalSupply();
      expect(tokens).to.be.equal( parseEther("502000") );

      await expect(
        spctoken.connect(addr2).mint( parseEther("3000") )
      ).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      tokens = await spctoken.totalSupply();
      expect(tokens).to.be.equal( parseEther("502000") );
    });

    it("Takes no tax for transfers when tax is off", async () => {
      await spctoken.setTaxStatus(false);
      await spctoken.connect(owner).transfer(addr3.address, 100);

      await spctoken.connect(owner).progressPhase();
      phase = await spctoken.phase();
      expect(phase).to.be.equal(1);

      await spctoken.connect(owner).progressPhase();
      phase = await spctoken.phase();
      expect(phase).to.be.equal(2);

      const addr3Balance = await spctoken.balanceOf(addr3.address);
      expect(addr3Balance).to.be.equal(100);
    });

    it("Takes 2% tax for transfers when tax is on", async () => {
      await spctoken.setTaxStatus(true);
      await spctoken.connect(owner).transfer(addr3.address, 100);

      await spctoken.connect(owner).progressPhase();
      phase = await spctoken.phase();
      expect(phase).to.be.equal(1);

      await spctoken.connect(owner).progressPhase();
      phase = await spctoken.phase();
      expect(phase).to.be.equal(2);

      const addr3Balance = await spctoken.balanceOf(addr3.address);
      expect(addr3Balance).to.be.equal(98);
    });
  });

});
