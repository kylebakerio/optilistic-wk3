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
    // [x] flag that toggles 2% tax on/off
    // [x] flag is init to false

    uint taxPercent = 2;
    // [x] 2% tax on transfers

    // 18 decimals, mimics eth/wei
    constructor(address _treasury) ERC20("SPCT","SpaceToken") {
        treasury = _treasury;
        minter = msg.sender;
        _mint(minter, 500000 ether); // not actually ether, just the same multiple as ether
    }

    // not sure why this is needed, but get an error requiring it.
    // this is just a naive solution, but will get us going forward for now.
    // see: https://forum.openzeppelin.com/t/typeerror-derived-contract-must-override-function-beforetokentransfer/2469/9
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
    }

    // using openzeppelin's version instead?
    // modifier onlyOwner() {
    //     require(msg.sender == owner, "Not owner");
    //     _;
    // }

    // mintable by owner
    function increaseSupply(uint _amount) external onlyOwner {
        _mint(msg.sender, _amount);
    }

    // [x] implement owner settable tax flag
    function setTaxStatus(bool _newTaxStatus) external onlyOwner {
        taxOn = _newTaxStatus;
    }

    // [x] implement tax
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        if (taxOn) {
            // todo: check math for rounding issues
            // payable(treasury).transfer((msg.value / 100) * taxPercent);
            ERC20._transfer(_msgSender(), treasury, (amount / 100) * taxPercent);
        }
        // todo: check math for rounding issues
        ERC20._transfer(_msgSender(), recipient, taxOn ? ((amount/100)*(100-taxPercent)) : amount);
    }
}
