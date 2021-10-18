//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";


contract SPCToken is Ownable, ERC20Pausable {
    address public spclAddress;
    address public routerAddress;
    address public treasury;
    bool public taxOn = false;

    event Tax(bool taxOn);

    // 18 decimals, mimics eth/wei
    constructor() ERC20("SPCT","SpaceToken") {
        treasury = owner();
        _mint(owner(), 500000 ether); // not actually ether, just the same multiple as ether
    }

    function setTaxStatus(bool _newTaxStatus) external onlyOwner {
        taxOn = _newTaxStatus;
        emit Tax(taxOn);
    }

    // custom version of the openzeppelin increaseAllowance that allows us to bypass the
    // separate `allow` call traditionally needed by ERC20 contracts when calling via the router
    // by using tx.origin instead of msg.sender, but for safety, is only allowed to be called by
    // known safe contract, which can be updated if router is replaced in future. 
    function increaseAllowanceTX(address spender, uint256 addedValue) external returns (bool) {
        require(msg.sender == routerAddress || msg.sender == spclAddress, "internal_only");
        // console.log("INCREASE ALLOWANCE",tx.origin, msg.sender, spender, addedValue);
        _approve(tx.origin, spender, allowance(tx.origin, spender) + addedValue);
        console.log('new allowance', allowance(tx.origin, spender));
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        console.log("spct transfer", sender, recipient, amount / 1 ether);
        if (taxOn) {
            ERC20._transfer(sender, treasury, (amount / 100) * 2);
            ERC20._transfer(sender, recipient, (amount / 100) * (100 - 2) );
        } else {
            ERC20._transfer(sender, recipient, amount);
        }
    }
}
