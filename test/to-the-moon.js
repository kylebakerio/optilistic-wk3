const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");

describe("ToTheMoon", () => {
  let owner, treasury, addrs, addr2, addr3, whitelistAddrs, spctoken;

  beforeEach(async () => {
    ;[owner, treasury, ...addrs] = await ethers.getSigners();
    // addr2, addr3 are not on whitelist, just general members of public
    

    [addr2, addr3, ...moreAddrs] = addrs.slice(0, addrs.length/2);
    whitelistAddrs = addrs.slice(addrs.length/2, addrs.length);

    // console.log("before....")
    // ;whitelistAddrs = ethers.getSigner(25);
    // let list2 = (await ethers.getSigners(25)) // this arg does nothing.

    // console.log('compare', owner.address, list2[0].address)

    // throw new Error()

    const ToTheMoon = await ethers.getContractFactory("ToTheMoon");
    tothemoon = await ToTheMoon.deploy(whitelistAddrs.map(a => a.address), treasury.address); // , parseEther("1.5")
  });

  describe("Spec", () => {
    it("Creates the ICO Phase-0 whitelist", async () => {
      // await tothemoon.contribute({ value: parseEther("1") });

      let onWhitelist = await tothemoon.whitelist(owner.address);
      expect(onWhitelist).to.be.equal(false);

      onWhitelist = await tothemoon.whitelist(whitelistAddrs[0].address);
      expect(onWhitelist).to.be.equal(true);

      onWhitelist = await tothemoon.whitelist(whitelistAddrs[1].address);
      expect(onWhitelist).to.be.equal(true);

      onWhitelist = await tothemoon.whitelist(treasury.address);
      expect(onWhitelist).to.be.equal(false);

      onWhitelist = await tothemoon.whitelist(addr2.address);
      expect(onWhitelist).to.be.equal(false);

      onWhitelist = await tothemoon.whitelist(addr3.address);
      expect(onWhitelist).to.be.equal(false);
    });

    it("Adds the treasury on deploy", async () => {
      const treasuryAddr = await tothemoon.treasury();
      expect(treasuryAddr).to.be.equal(treasury.address);
    });

    it("Initializes to Phase 0", async () => {
      const phase = await tothemoon.phase();
      expect(phase).to.be.equal(0);
    });

    it("Allows onlyOwner to progress through phases correctly", async () => {
      let phase = await tothemoon.phase();
      expect(phase).to.be.equal(0);

      // this throws an error, as desired, but need to set test to correctly expect the error
      // await tothemoon.connect(addr2).progressPhase();
      // phase = await tothemoon.phase();
      // expect(phase).to.be.equal(0);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(1);

      await tothemoon.connect(owner).progressPhase();
      phase = await tothemoon.phase();
      expect(phase).to.be.equal(2);

      // this throws an error, as desired, but need to set test to correctly expect the error
      // await tothemoon.connect(owner).progressPhase();
      // phase = await tothemoon.phase();
      // expect(phase).to.be.equal(2);      

      // probably use this pattern:
      /*
      await expect(
        spctoken.connect(addr2).increaseSupply(33)
      ).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      */
    });

    it("Allows onlyOwner to toggle pausing fundraising contributions + inits unpaused", async () => {
      let pause = await tothemoon.paused();
      expect(pause).to.be.equal(false);
      expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));

      // whitelist address, because we're in phase 0 here
      await tothemoon.connect(whitelistAddrs[0]).buy({ value: parseEther("1") });
      // check if deposited
      expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1"));

      await tothemoon.connect(owner).togglePause();
      pause = await tothemoon.paused();
      expect(pause).to.be.equal(true);

      await expect(
        tothemoon.connect(whitelistAddrs[0]).buy({ value: parseEther("1") })
      ).to.be.revertedWith("fundraising_paused");

      await tothemoon.connect(owner).togglePause();
      pause = await tothemoon.paused();
      expect(pause).to.be.equal(false);

      await tothemoon.connect(whitelistAddrs[1]).buy({ value: parseEther("2") });
      // check if deposited
      expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("3"));
      // check if deposited
    });








    describe("Phase 0", () => {
      it("Only allows whitelisted contributors", async () => {
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));
        await tothemoon.connect(whitelistAddrs[0]).buy({ value: parseEther("1") });
        // check if deposited
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1"));
        
        await expect(
          tothemoon.connect(addr2).buy({ value: parseEther("1") })
        ).to.be.revertedWith("whitelist_only");

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1"));
      });

      it("Allows max individual contrib of 1.5k eth", async () => {
        // console.log("LENGTH: ",whitelistAddrs.length)

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));

        const lastSigner = whitelistAddrs[0];

        await expect(
          tothemoon.connect(lastSigner).buy({ value: parseEther("1501") })
        ).to.be.revertedWith("1500eth_limit");

        await tothemoon.connect(whitelistAddrs[0]).buy({ value: parseEther("1500") })
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1500"));

      });

      it("Allows max total contrib of 15k eth", async () => {
        // console.log("LENGTH: ",whitelistAddrs.length)

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));

        let i;
        for (i = 0; i < 9; i++) {
          await tothemoon.connect(whitelistAddrs[i]).buy({ value: parseEther("1500") });
        }
        await tothemoon.connect(whitelistAddrs[++i]).buy({ value: parseEther("1400") });

        // check if deposited
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("14900"));
        
        const lastSigner = whitelistAddrs[++i];

        await expect(
          tothemoon.connect(lastSigner).buy({ value: parseEther("101") })
        ).to.be.revertedWith("15keth_limit");

        await tothemoon.connect(whitelistAddrs[i]).buy({ value: parseEther("100") })

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("15000"));
      });
    })


    describe("Phase 1", () => {
      beforeEach(async () => {
        await tothemoon.connect(owner).progressPhase();
        phase = await tothemoon.phase();
        expect(phase).to.be.equal(1);
      })

      it("Allows non-whitelisted contributos", async () => {
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));
        await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("1") });
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1"));
      });

      it("Allows max individual contrib of 1k eth", async () => {
        // console.log("LENGTH: ",moreAddrs.length)

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));

        const lastSigner = moreAddrs[0];

        await expect(
          tothemoon.connect(lastSigner).buy({ value: parseEther("1001") })
        ).to.be.revertedWith("1000eth_limit");

        await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("1000") })
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1000"));

      });

      it("Allows max total contrib of 30k eth", async () => {
        // console.log("LENGTH: ",moreAddrs.length)

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));

        let i;
        for (i = 0; i < 19; i++) {
          await tothemoon.connect(whitelistAddrs[i]).buy({ value: parseEther("1000") });
        }
        for (i = 0; i < 10; i++) {
          await tothemoon.connect(moreAddrs[i]).buy({ value: parseEther("1000") });
        }
        await tothemoon.connect(moreAddrs[++i]).buy({ value: parseEther("500") });

        // check if deposited
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("29500"));
        
        const lastSigner = moreAddrs[++i];

        await expect(
          tothemoon.connect(lastSigner).buy({ value: parseEther("501") })
        ).to.be.revertedWith("30keth_limit");

        await tothemoon.connect(whitelistAddrs[i]).buy({ value: parseEther("500") })

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("30000"));
      });
    });


    describe("Phase 2", () => {
      it ("Only allows token transfers upon phase 2", async () => {
        await tothemoon.connect(owner).progressPhase();
        phase = await tothemoon.phase();
        expect(phase).to.be.equal(1);

        await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("1000") });
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1000"));

        expect(await tothemoon.balanceOf(moreAddrs[0].address))
        .to.be.equal(parseEther("5000"));
      })

      it("Releases tokens at 5:1 SPCT:eth ratio", async () => {
        await tothemoon.connect(owner).progressPhase();
        phase = await tothemoon.phase();
        expect(phase).to.be.equal(1);

        await tothemoon.connect(moreAddrs[0]).buy({ value: parseEther("1000") });
        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("1000"));

        expect(await tothemoon.balanceOf(moreAddrs[0].address))
        .to.be.equal(parseEther("5000"));
      });

      it("Disables purchase/contrib caps", async () => {
        await tothemoon.connect(owner).progressPhase();
        await tothemoon.connect(owner).progressPhase();
        phase = await tothemoon.phase();
        expect(phase).to.be.equal(2);

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther("0"));

        let i;
        for (i = 0; i < 12; i++) {
          await tothemoon.connect(whitelistAddrs[i]).buy({ value: parseEther("4444") });
        }

        expect(await tothemoon.fundraiseTotal()).to.be.equal(parseEther( (12*4444)+"" ));

      });
    })


  });

});

    // spec:
    // total goal: 30k ether

    // Phase 0 / seed:
    // [ ] whitelist ICO only
    // [ ] max TOTAL contribution of 15k ether
    // [ ] max INDIVIDUAL contribution is 1.5k

    // Phase 1 / general:
    // [ ] ICO open to public
    // [ ] total contrib limit of 30k ether
    // [ ] individual contrib 1k

    // Phase 2 / open:
    // [ ] no more individual contrib limit
    // [ ] tokens released at 1-to-5 eth-to-SPC
    // [ ] trading allowed

    // [x] owner can pause/resume at any time
    // [x] owner moves phases forward manually

    // [ ] probably need to override all the ERC20 methods with necessary controls...