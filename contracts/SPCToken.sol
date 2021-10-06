//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

contract SPCToken is Ownable, ERC20Pausable {
    address public treasury;
    address internal minter;
    bool public taxOn = false;

    event Tax(bool taxOn);

    // 18 decimals, mimics eth/wei
    constructor(address _treasury) ERC20("SPCT","SpaceToken") {
        treasury = _treasury;
        minter = msg.sender;
        _mint(minter, 500000 ether); // not actually ether, just the same multiple as ether
    }

    function increaseSupply(uint _amount) external onlyOwner {
        _mint(msg.sender, _amount);
    }

    function setTaxStatus(bool _newTaxStatus) external onlyOwner {
        taxOn = _newTaxStatus;
        emit Tax(taxOn);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        if (taxOn) {
            ERC20._transfer(sender, treasury, (amount / 100) * 2);
            ERC20._transfer(sender, recipient, (amount / 100) * (100 - 2) );
        } else {
            ERC20._transfer(sender, recipient, amount);
        }
    }
}
