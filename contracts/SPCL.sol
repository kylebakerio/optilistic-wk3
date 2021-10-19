//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@uniswap/lib/contracts/libraries/Babylonian.sol';

interface ISPCT is IERC20 {}

contract SPCL is ERC20, Ownable {
	ISPCT public spctContract;
	address public SPCTaddress;
	bool public marketOpen = false;

	event Mint(address liquidityProvider, uint ethIn, uint spctIn, uint spclOut);
	event Burn(address liquidityProvider, uint spclIn, uint ethOut, uint spctOut);
	event SwapEth(address swapper, uint ethIn, uint spctOut);
	event SwapSpct(address swapper, uint spctIn, uint ethOut);
	event simulateSwap(address swapper, uint input, uint output, bool ethIn); // if `ethIn` true, `in` is eth, if false, `in` is spct

	constructor(address _SPCT) ERC20('SpaceLiquidityPool', 'SPCL') {
		SPCTaddress = _SPCT;
		spctContract = ISPCT(SPCTaddress);
	}

	uint private unlocked = 1;
	modifier lock() {
	    require(unlocked == 1, 'UniswapV2: LOCKED');
	    unlocked = 0;
	    _;
	    unlocked = 1;
	}

	function mint(address _who, uint _amountSPCT) public payable lock {
		// console.log("<msg.sender>, <tx.origin>, <SPCTaddress>", msg.sender, tx.origin, SPCTaddress);
		require(marketOpen || _who == owner(), "market_closed");
		if (!marketOpen) {
			marketOpen = true;
		}

		uint spctLiquidityAdded;
		if (spctContract.balanceOf(address(this)) == 0) {
			// console.log("initial liquidity event spcl; from:",_who);
			// adding first liquidity
			spctContract.transferFrom(_who, address(this), _amountSPCT);
			spctLiquidityAdded = spctContract.balanceOf(address(this));
		} else {
			// already have liquidity
			uint spctToAccept = quote(msg.value, address(this).balance, spctContract.balanceOf(address(this)));
			require(_amountSPCT >= spctToAccept, "insufficient_spct_offered");
			// console.log("given <eth> accept <spct>; was given <spct>>", msg.value / 1 ether, spctToAccept / 1 ether, _amountSPCT / 1 ether);
			uint existingLiquidity = spctContract.balanceOf(address(this));
			spctContract.transferFrom(_who, address(this), spctToAccept);
			spctLiquidityAdded = spctContract.balanceOf(address(this)) - existingLiquidity;
			require(spctLiquidityAdded >= spctToAccept, "insufficient_spct_received");
		}
		require(spctLiquidityAdded > 0, "no_spct_added");
		uint amountToMint = Babylonian.sqrt(spctLiquidityAdded * msg.value);
		// console.log("minting <spcl> <to>:", amountToMint, amountToMint / 1 ether, _who);
		_mint(_who, amountToMint);
		emit Mint(_who, msg.value, spctLiquidityAdded, amountToMint);
	}

	function burn(uint _howMuchSPCL, address _withdrawTo) public lock returns(uint spclToETH, uint spclToSPCT) {
		uint toBurn = _howMuchSPCL; // balanceOf(_withdrawTo);
		uint contractETH = address(this).balance;
		uint contractSPCT = spctContract.balanceOf(address(this));
		uint totalSupply = totalSupply();
		// console.log('totalsupply', totalSupply / 1 ether);
		spclToETH = contractETH / (totalSupply / toBurn);
		spclToSPCT = contractSPCT / (totalSupply / toBurn);
		// console.log('contract <eth> <spct>', contractETH / 1 ether, contractSPCT / 1 ether);
		// console.log('<spcl> turned into <eth> & <spct>', toBurn / 1 ether, spclToETH / 1 ether, spclToSPCT / 1 ether);
		_burn(_withdrawTo, toBurn);
		spctContract.transfer(_withdrawTo, spclToSPCT);
		(bool sent, ) = _withdrawTo.call{value: spclToETH}("");
        require(sent, "sending_eth_failed");
        emit Burn(_withdrawTo, _howMuchSPCL, spclToETH, spclToSPCT);
	}

	// lifted close to directly from https://github.com/Uniswap/v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol#L35
	// explained here: https://ethereum.org/en/developers/tutorials/uniswap-v2-annotated-code/
	// used to determine how much of amountB can be deposited given amountA and pre-existing liqudity in reserveA and reserveB
	// or, for us: given X of eth, return needed Y of spct
	// "given some amount of an asset and pair reserves, returns an equivalent amount of the other asset"
	function quote(uint ethDeposit, uint ethReserve, uint spctReserve) internal view returns (uint spctDeposit) {
		// console.log("quote, reserves: <eth> & <spct>", ethReserve / 1 ether, spctReserve / 1 ether);
	    require(ethDeposit > 0, 'spcl: no_eth_provided');
	    require(ethReserve > 0 && spctReserve > 0, 'spcl: no_reserves');
	    spctDeposit = (ethDeposit * spctReserve) / (ethReserve - msg.value);
	}

	// use wrapper version for slip control + SPCT appoval convenience method
	// for swapping spct <-> eth; 
	// if _spctToSwap is > 0, swaps spct -> eth; 
	// if _spctToSwap = 0, swaps eth -> spct
	function swap(uint _spctToSwap, address recipient, bool _simulate) external payable lock returns(uint, uint) {
		require(marketOpen, "market_closed");
		uint reserveTokenOut;
		uint reserveTokenIn;
		uint tokenInAfterFee;
		uint tokenOutAmount;
		if (_spctToSwap > 0) {
			// console.log("SPCT -> ETH <spctIn>", _spctToSwap);
			reserveTokenIn = spctContract.balanceOf(address(this));
			reserveTokenOut = address(this).balance;
			tokenInAfterFee = (_spctToSwap * 99) / 100;
			tokenOutAmount = reserveTokenOut - (reserveTokenIn * reserveTokenOut) / (reserveTokenIn + tokenInAfterFee);

			if (_simulate == false) {
				spctContract.transferFrom(recipient, address(this), _spctToSwap);

				// console.log("sending eth <to> <amt>", recipient, tokenOutAmount);
				(bool sent, ) = recipient.call{value: tokenOutAmount}("");
		        require(sent, "sending_eth_failed");
		        emit SwapSpct(recipient, _spctToSwap, tokenOutAmount);
			}
			else {
				emit simulateSwap(recipient, _spctToSwap, tokenOutAmount, true);
				// console.log("simulation, will not send <tokenOutAmount> to <recipient>",tokenOutAmount,recipient);
			}
		} else {
			// console.log("ETH -> SPCT <ethIn>", msg.value);
			reserveTokenIn = address(this).balance;
			reserveTokenOut = spctContract.balanceOf(address(this));
			tokenInAfterFee = (msg.value * 99) / 100;
			tokenOutAmount = reserveTokenOut - (reserveTokenIn * reserveTokenOut) / (reserveTokenIn + tokenInAfterFee);
			
			if (_simulate == false) {
				// console.log("sending spct <to> <amt>", recipient, tokenOutAmount);
				spctContract.transfer(recipient, tokenOutAmount);
				emit SwapEth(recipient, msg.value, tokenOutAmount);
			}
			else {
				(bool sent, ) = recipient.call{value: msg.value}(""); // send eth back! otherwise we'll accept the eth! untested, todo
				emit simulateSwap(recipient, msg.value, tokenOutAmount, false);
				// console.log("simulation, will not send <tokenOutAmount> to <recipient>",tokenOutAmount,recipient);
			}
		}
		// console.log("spcl swap: <tokenInAfterFee> <tokenOutAmount>", tokenInAfterFee, tokenOutAmount );
		return (tokenInAfterFee, tokenOutAmount);
	}


	receive() external payable {
		// console.log('spcl receive', msg.value);
	}

	fallback () external payable {
		// console.log('spcl fallback', msg.value);
	}
}

/* 
	Write an ERC-20 contract for your pool's LP tokens.
	Write a liquidity pool contract that:
	Mints LP tokens for liquidity deposits (ETH + SPC tokens)
	Burns LP tokens to return liquidity to holder
	Accepts trades with a 1% fee
*/

// steps router will take when interacting with SPCL, or that a user could take directly:

// (1) approve SPCT, 
// (2) tell SPCL to transferFrom according to approval + send Eth
	// this triggers minting to user

