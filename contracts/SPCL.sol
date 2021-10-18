//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

// import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@uniswap/lib/contracts/libraries/Babylonian.sol';

interface ISPCT is IERC20 {
	function increaseAllowance(address, uint256) external returns (bool);
}

contract SPCL is ERC20 {
	ISPCT public spctContract;
	address public SPCTaddress;
	// address public router;

	constructor(address _SPCT/*, address _router*/) ERC20('SpaceLiquidityPool', 'SPCL') {
		SPCTaddress = _SPCT;
		spctContract = ISPCT(SPCTaddress);
		// router = _router;
	}

	function addLiquidity(address _who, uint _amountSPCT) public payable {
		if (spctContract.balanceOf(address(this)) == 0) {
			// console.log("initial liquidity event spcl; from:",_who);
			// adding first liquidity
			spctContract.transferFrom(_who, address(this), _amountSPCT);
			uint spctLiquidityAdded = spctContract.balanceOf(address(this));
			require(spctLiquidityAdded > 0, "no_spct_added");
			mint(_who, spctLiquidityAdded, msg.value);
		} else {
			// already have liquidity
			uint spctToAccept = quote(msg.value, address(this).balance, spctContract.balanceOf(address(this)));
			// console.log("given <eth> accept <spct>; was given <spct>>", msg.value / 1 ether, spctToAccept / 1 ether, _amountSPCT / 1 ether);
			require(_amountSPCT >= spctToAccept, "insufficient_spct_provided");
			uint existingLiquidity = spctContract.balanceOf(address(this));
			spctContract.transferFrom(_who, address(this), spctToAccept);
			uint spctLiquidityAdded = spctContract.balanceOf(address(this)) - existingLiquidity;
			mint(_who, spctLiquidityAdded, msg.value);
		}
	}

	function mint(address _who, uint spctAdded, uint ethAdded) private {
		uint amountToMint = Babylonian.sqrt(spctAdded * ethAdded);
		// console.log("minting <spcl> <to>:", amountToMint, amountToMint / 1 ether, _who);
		_mint(_who, amountToMint);
	}

	function burn(uint _howMuchSPCL, address _withdrawTo) public returns(uint spclToETH, uint spclToSPCT) {
		uint toBurn = _howMuchSPCL; // balanceOf(_withdrawTo);
		uint contractETH = address(this).balance;
		uint contractSPCT = spctContract.balanceOf(address(this));
		uint totalSupply = totalSupply();
		uint hydratedSPCL = toBurn ** 2;
		// console.log('totalsupply', totalSupply / 1 ether);
		spclToETH = contractETH / (totalSupply / toBurn);
		spclToSPCT = contractSPCT / (totalSupply / toBurn);
		// console.log('contract <eth> <spct>', contractETH / 1 ether, contractSPCT / 1 ether);
		// console.log('<spcl> turned into <eth> & <spct>', toBurn / 1 ether, spclToETH / 1 ether, spclToSPCT / 1 ether);
		_burn(_withdrawTo, toBurn);
		spctContract.transfer(_withdrawTo, spclToSPCT);
		(bool sent, ) = _withdrawTo.call{value: spclToETH}("");
        require(sent, "sending_eth_failed");
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
	function swap(uint _spctToSwap, address recipient, bool _simulate) external payable returns(uint tokenInAfterFee, uint tokenOutAmount) {
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
			}
			else {
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
			}
			else {
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

