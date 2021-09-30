const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");

describe("SPCToken", () => {
  let owner, treasury, addr2, addr3, addrs, spctoken;

  beforeEach(async () => {
    [owner, treasury, addr2, addr3, ...addrs] = await ethers.getSigners();

    const SPCToken = await ethers.getContractFactory("SPCToken");
    spctoken = await SPCToken.deploy(treasury.address); // , parseEther("1.5")
  });

  describe("Spec", () => {
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

      await spctoken.connect(owner).increaseSupply( parseEther("2000") )
      tokens = await spctoken.totalSupply();
      expect(tokens).to.be.equal( parseEther("502000") );

      await expect(
        spctoken.connect(addr2).increaseSupply( parseEther("3000") )
      ).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      tokens = await spctoken.totalSupply();
      expect(tokens).to.be.equal( parseEther("502000") );
    });

    it("Takes no tax for transfers when tax is off", async () => {
      await spctoken.setTaxStatus(false);
      await spctoken.connect(owner).transfer(addr3.address, 100);
      const addr3Balance = await spctoken.balanceOf(addr3.address);
      expect(addr3Balance).to.be.equal(100);
    });

    it("Takes 2% tax for transfers when tax is on", async () => {
      console.warn("not sure why, but seems to be taxing the initial 500k token mint currently...")
      await spctoken.setTaxStatus(true);
      await spctoken.connect(owner).transfer(addr3.address, 100);
      const addr3Balance = await spctoken.balanceOf(addr3.address);
      expect(addr3Balance).to.be.equal(98);
    });

    // Gilbert mentioned this wasn't necessary.
    // it("TODO: Somehow handles amounts below 100 wei", async () => {
    //   await spctoken.setTaxStatus(true);
    //   await spctoken.connect(owner).transfer(addr3.address, 1);
    //   const addr3Balance = await spctoken.balanceOf(addr3.address);
    //   expect(addr3Balance).to.be.equal(.98);
    // });
  });

  // describe("Only owner", () => {
  //   it("Only owner can cancel project manually", async () => {
  //     await expect(project.connect(addr1).cancelProject()).to.be.revertedWith(
  //       "Only owner allowed."
  //     );
  //   });

  //   it("Only owner can withdraw funds if funding goal is reached", async () => {
  //     await project.contribute({ value: parseEther("1.5") });
  //     await expect(
  //       project.connect(addr1).withdrawContributedFundsOwner(parseEther("1"))
  //     ).to.be.revertedWith("Only owner allowed.");
  //   });
  // });

  // describe("Contributing", () => {
  //   it("Contributes and gets balance assigned", async () => {
  //     await project.contribute({ value: parseEther("0.1") });

  //     const availableBalance = await project.contributions(owner.address);
  //     expect(availableBalance).to.be.equal(parseEther("0.1"));
  //   });

  //   it("Checks for minimum contribution", async () => {
  //     await expect(
  //       project.contribute({ value: parseEther("0.001") })
  //     ).to.be.revertedWith("Value must be at least 0.01 ETH.");
  //   });

  //   describe("Awarding tiers", () => {
  //     it("Returns a user their NFT id", async () => {
  //       await project.contribute({ value: parseEther("1") });

  //       const nft = await project.tierOf(owner.address);
  //       expect(nft.toString()).to.not.be.equal("0");
  //     });

  //     it("Awards gold tier", async () => {
  //       await project.contribute({ value: parseEther("1") });

  //       const tier = await project.getUserTier();
  //       expect(tier).to.be.equal("3");

  //       const nft = await project.tierOf(owner.address);
  //       expect(await project.ownerOf(nft)).to.be.equal(owner.address);
  //     });
  //     it("Awards silver tier", async () => {
  //       await project.contribute({ value: parseEther("0.8") });

  //       const tier = await project.getUserTier();
  //       expect(tier).to.be.equal("2");

  //       const nft = await project.tierOf(owner.address);
  //       expect(await project.ownerOf(nft)).to.be.equal(owner.address);
  //     });

  //     it("Awards gold tier", async () => {
  //       await project.contribute({ value: parseEther("0.2") });

  //       const tier = await project.getUserTier();
  //       expect(tier).to.be.equal("1");

  //       const nft = await project.tierOf(owner.address);
  //       expect(await project.ownerOf(nft)).to.be.equal(owner.address);
  //     });
  //   });
  // });

  // describe("Project succesful", async () => {
  //   it("Reverts contribution if funding goal reached", async () => {
  //     await project.contribute({ value: parseEther("1.5") });

  //     await expect(
  //       project.contribute({ value: parseEther("0.1") })
  //     ).to.be.revertedWith("Contribution is not allowed anymore.");
  //   });

  //   it("Allows last contribution to go above funding goal", async () => {
  //     await project.contribute({ value: parseEther("1.4") });

  //     await project.contribute({ value: parseEther("0.6") });

  //     const currentFunding = await project.totalFunding();
  //     expect(currentFunding).to.be.equal(parseEther("2"));
  //   });

  //   it("Reverts owner withdrawal if project still going", async () => {
  //     await project.contribute({ value: parseEther("0.4") });
  //     await expect(
  //       project.withdrawContributedFundsOwner(parseEther("0.1"))
  //     ).to.be.revertedWith("Funding goal not reached yet.");
  //   });

  //   it("Allows owner to withdraw an amount", async () => {
  //     await project.connect(addr1).contribute({ value: parseEther("1.4") });
  //     await project.connect(addr2).contribute({ value: parseEther("1") });
  //     await expect(
  //       await project.withdrawContributedFundsOwner(parseEther("1"))
  //     ).to.changeEtherBalance(owner, parseEther("1"));
  //   });

  //   it("Reverts if owner tries to withdraw more than available", async () => {
  //     await project.connect(addr1).contribute({ value: parseEther("1.4") });
  //     await project.connect(addr2).contribute({ value: parseEther("1") });
  //     await project.withdrawContributedFundsOwner(parseEther("2"));
  //     await expect(
  //       project.withdrawContributedFundsOwner(parseEther("1"))
  //     ).to.be.revertedWith("Not enough funds available");
  //   });
  // });

  // describe("Project fails", async () => {
  //   it("Fails project when 30 days pass", async () => {
  //     const date = new Date();
  //     date.setDate(date.getDate() + 30);
  //     const thirtyDaysFromNow = date.getTime();

  //     await network.provider.send("evm_setNextBlockTimestamp", [
  //       thirtyDaysFromNow,
  //     ]);
  //     await ethers.provider.send("evm_mine");

  //     await expect(
  //       project.contribute({ value: parseEther("0.1") })
  //     ).to.be.revertedWith("Contribution is not allowed anymore.");

  //     expect(await project.isProjectCanceled()).to.be.true;
  //   });

  //   it("Blocks contributions", async () => {
  //     await project.cancelProject();
  //     await expect(
  //       project.contribute({ value: parseEther("0.4") })
  //     ).to.be.revertedWith("Contribution is not allowed anymore.");
  //   });

  //   it("Reverts withdrawal if project still going", async () => {
  //     await project.contribute({ value: parseEther("0.4") });
  //     await expect(project.withdrawContribution()).to.be.revertedWith(
  //       "Project still going."
  //     );
  //   });

  //   it("Allows contributors to withdraw their funds", async () => {
  //     await project.contribute({ value: parseEther("0.4") });
  //     await project.cancelProject();
  //     await expect(await project.withdrawContribution()).to.changeEtherBalance(
  //       owner,
  //       parseEther("0.4")
  //     );
  //   });

  //   it("Revokes tier after withdrawing", async () => {
  //     await project.contribute({ value: parseEther("0.4") });
  //     await project.cancelProject();
  //     await project.withdrawContribution();

  //     const nft = await project.tierOf(owner.address);
  //     expect(nft).to.be.equal("0");

  //     expect(await project.ownerOf(nft)).to.be.equal(
  //       ethers.constants.AddressZero
  //     );
  //   });

  //   it("Reverts if no funds are available", async () => {
  //     await project.contribute({ value: parseEther("1") });
  //     await project.cancelProject();
  //     await expect(
  //       project.connect(addr1).withdrawContribution()
  //     ).to.be.revertedWith("No available funds");
  //   });
  // });
});
