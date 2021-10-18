//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISPCT is IERC20 {
	function increaseAllowanceTX(address, uint256) external returns (bool);
	function owner() external view returns (address);
}
interface ISPCL is IERC20 {
	function mint(address, uint) external payable;
	function burn(uint _howMuchSPCL, address _withdrawTo) external returns(uint eth, uint spct);
	function swap(uint _spctToSwap, address recipient, bool _simulate) external payable returns(uint tokenInAfterFee, uint tokenOutAmount);
}

contract Router is Ownable {
	ISPCT public spctContract;
	address public SPCTaddress;
	ISPCL public spclContract;
	address public SPCLaddress;

	constructor(address _SPCT, address _SPCL) {
		SPCTaddress = _SPCT;
		spctContract = ISPCT(SPCTaddress);
		SPCLaddress = _SPCL;
		spclContract = ISPCL(SPCLaddress);
	}

	function haveLiquidity() public view returns(bool) {
		// console.log('router: current liquidity of <eth> <spct>', SPCLaddress.balance / 1 ether, spctContract.balanceOf(SPCLaddress) / 1 ether);
		return SPCLaddress.balance > 0 && spctContract.balanceOf(SPCLaddress) > 0;
	}

	// only payable so we can look at msg.value and deduct it when evaluating price
	function getSPCTtoETH10000000() public payable returns(uint scaledPrice) {
		require(haveLiquidity(), "no_liquidity");
		scaledPrice = (spctContract.balanceOf(SPCLaddress) * 10000000) / (SPCLaddress.balance - msg.value);
		// console.log("<scaled price> <spctbalance> <ethbalance>", scaledPrice, spctContract.balanceOf(SPCLaddress)/1 ether, (SPCLaddress.balance - msg.value)/1 ether);
		return scaledPrice;
	}

		// only payable so we can look at msg.value and deduct it when evaluating price
	function getETHtoSPCT10000000() public payable returns(uint scaledPrice) {
		require(haveLiquidity(), "no_liquidity");
		scaledPrice = ((SPCLaddress.balance - msg.value)  * 10000000) / (spctContract.balanceOf(SPCLaddress));
		// console.log("<scaled price> <spctbalance> <ethbalance>", scaledPrice, spctContract.balanceOf(SPCLaddress)/1 ether, (SPCLaddress.balance - msg.value)/1 ether);
		return scaledPrice;
	}

	function addLiquidity(uint amountSPCT, address spclReceiver) external payable {
		bool increasedAllowance = spctContract.increaseAllowanceTX(SPCLaddress, amountSPCT);
		require(increasedAllowance, "allowance_fail"); // (spender, amount)

		spclContract.mint{value: msg.value}(spclReceiver, amountSPCT);
	}

	function removeLiquidity(uint _howMuchSPCL, address _withdrawTo, uint _minEth, uint _minSPCT) external returns(uint eth, uint spct) {
		// spclContract.transferFrom(msg.sender, SPCLaddress, _howMuchSPCL); // send liquidity to spcl
		(eth, spct) = spclContract.burn(_howMuchSPCL, _withdrawTo); // burn it

		require(eth >= _minEth, 'min_eth_not_met');
		require(spct >= _minSPCT, 'min_spct_not_met');
	}

	// for swapping spct <-> eth; 
	// if _spctToSwap is > 0, swaps spct -> eth; 
	// if _spctToSwap = 0, swaps eth -> spct
	function swap(uint _maxSlip, uint _spctToSwap, bool _simulate) external payable returns(uint) {
		// console.log("<<start swap>>");
		uint conversionRate;
		if (_spctToSwap > 0) {
			// spct -> eth
			bool increasedAllowance = spctContract.increaseAllowanceTX(SPCLaddress, _spctToSwap);
			require(increasedAllowance, "allowance_fail");
			// console.log('~~~spct val will be <rate>',getSPCTtoETH10000000());
			// conversionRate = getSPCTtoETH10000000();
			conversionRate = getETHtoSPCT10000000();
		} else {
			// eth -> spct
			// console.log('~~~eth val will be <rate>', getETHtoSPCT10000000());
			conversionRate = getSPCTtoETH10000000();
		}
		(uint tokenInAfterFee, uint tokenOutAmount) = spclContract.swap{value: msg.value}(_spctToSwap, msg.sender, _simulate);

		bool slippageIsTolerable;
		uint slip10000;
		// console.log("slippage input <rate>*<tokenInAfterFee>, <tokenOutAmount>", conversionRate, tokenInAfterFee, tokenOutAmount);
		if (_spctToSwap > 0) {
			(slippageIsTolerable, slip10000) = slippageTolerable((conversionRate * tokenInAfterFee)/10000000, tokenOutAmount, _maxSlip);
		} else {
			(slippageIsTolerable, slip10000) = slippageTolerable((conversionRate * tokenInAfterFee)/10000000, tokenOutAmount, _maxSlip);
		}		
		// console.log('<slip10000>',slip10000);
		require(slippageIsTolerable, "too_much_slip");

		// console.log("<<end swap>>");
		return slip10000;
	}

	// convenience wrapper method for swapping eth -> spct
	// for some reason this won't compile...?
	// function swapFromEth(uint _maxSlip) external payable {
	// 	swap(_maxSlip, 0);
	// }

	// _maxSlip unit is percent of percent, or .01 percent, or (1/10000)
	// so, '100' = 1%, '10' = .1%, '1000' = 10%
	function slippageTolerable(uint _nominalValue, uint _tradeValue, uint _maxSlip) internal pure returns (bool, uint slip10000) {
		// console.log('slip calc vars, <nom> <trade> <slip allowed>', _nominalValue, _tradeValue, _maxSlip);
		// uint rawSlip = ( (_nominalValue / _tradeValue) * 10000 ) - _maxSlip;
		uint rawSlip = 10000 - ( (_tradeValue * 10000) / (_nominalValue ) ) ; // percent, *10k to allow .01% precision

		// console.log("<raw slip %> vs. <tolerance>", rawSlip, _maxSlip);
		return (rawSlip < _maxSlip, rawSlip); 
	}

	// likely remove
	receive() external payable {
		// console.log('receive', msg.value);
	}

	// likely remove
	fallback () external payable {
		// console.log('fallback', msg.value);
	}
}


/*
Transferring tokens to an LP pool requires two transactions:

Trader grants allowance to contract X for Y tokens
--> grants allowance to SPCL for Y tokens

Trader invokes contract X to make the transfer
--> trader needs to call SPCL contract directly

Write a router contract to handles these transactions. Be sure it can:

Add / remove liquidity
Swap tokens, rejecting if the slippage is above a given amount
*/

/*
	router calls SPCT.approve() for msg.sender to SPCL
	router calls SPCT.transferFrom to SPCL from msg.sender
*/