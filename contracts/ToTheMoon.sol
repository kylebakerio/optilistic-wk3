//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "./SPCToken.sol";

// handles the ICO
contract ToTheMoon is SPCToken {
    uint public fundraiseTotal;

    enum Phases {
        Seed,
        General,
        Open
    }
    Phases public phase;

    mapping(address => uint) public contributions;
    mapping(address => bool) public whitelist;

    constructor(address[] memory _whitelist, address _treasury) SPCToken(_treasury) {
        // add phase 0 whitelist here
        treasury = _treasury;
        for (uint i = 0; i < _whitelist.length; i++) { // todo: get length correctly
            whitelist[_whitelist[i]] = true;
        }
    }

    function progressPhase() external onlyOwner {
        require(uint(phase) <= 2, "final_phase");
        phase = Phases(uint(phase)+1); // https://jeancvllr.medium.com/solidity-tutorial-all-about-enums-684adcc0b38e
    }

    // https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC20Pausable
    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    function ethToToken() private {
        // payable to treasury
        // transfer 5:1 token
        (bool sent, bytes memory data) = payable(treasury).call{value: msg.value}("");
        require(sent, "Failed to send Ether");
        ERC20._transfer(minter, msg.sender, msg.value * 5); // can we call it without tax this way?
        fundraiseTotal += msg.value;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)  internal virtual override {
        require(from == minter || to == minter || phase == Phases.Open, "transfers_forbidden");
        // to == minter | initial mint allowed
        // from == minter | transfering minted tokens to investors allowed
        super._beforeTokenTransfer(from, to, amount);
    }

    // function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
    //     super._beforeTokenTransfer(from, to, amount);
    // }

    function buy() external payable {
        require(!paused(), "fundraising_paused"); // this is a dupe of logic in ERC30Pausable, but run here allows failing early
        if (phase == Phases.Seed) {
            require(whitelist[msg.sender], "whitelist_only");
            require(msg.value <= 1500 ether, "1500eth_limit");
            require(msg.value + fundraiseTotal <= 15000 ether, "15keth_limit");
            ethToToken();
        }
        else if (phase == Phases.General) {
            require(msg.value <= 1000 ether, "1000eth_limit");
            require(msg.value + fundraiseTotal <= 30000 ether, "30keth_limit");
            ethToToken();
        }
        else if (phase == Phases.Open) {
            ethToToken();
        }
    }
}
