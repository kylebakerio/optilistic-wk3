//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

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

    event Buy(address indexed sender, uint eth);
    event Phase(uint8 phase);
    event Pause(bool paused);

    constructor(address[] memory _whitelist, address _treasury) SPCToken(_treasury) {
        treasury = _treasury;
        for (uint i = 0; i < _whitelist.length; i++) {
            whitelist[_whitelist[i]] = true;
        }
    }

    function progressPhase() external onlyOwner {
        require(uint(phase) <= 2, "final_phase");
        phase = Phases(uint(phase)+1);
        emit Phase(uint8(phase));
    }

    // https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC20Pausable
    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
        emit Pause(paused());
    }

    function ethToToken() private {
        (bool sent, ) = payable(treasury).call{value: msg.value}("");
        require(sent, "Failed to send Ether");
        fundraiseTotal += msg.value;
        contributions[msg.sender] += msg.value;
        ERC20._transfer(minter, msg.sender, msg.value * 5); // 5:1 initial mint value
        emit Buy(msg.sender, msg.value);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)  internal virtual override {
        require(from == minter || to == minter || phase == Phases.Open, "transfers_forbidden");
        // to == minter | initial mint allowed
        // from == minter | transfering minted tokens to investors allowed
        super._beforeTokenTransfer(from, to, amount);
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return phase < Phases.Open ? 0 : ERC20.balanceOf(account);
    }

    function buy() external payable {
        require(!paused(), "fundraising_paused");
        if (phase == Phases.Seed) {
            require(whitelist[msg.sender], "whitelist_only");
            require(msg.value + contributions[msg.sender] <= 1500 ether, "1500eth_limit");
            require(msg.value + fundraiseTotal <= 15000 ether, "15keth_limit");
        }
        else if (phase == Phases.General) {
            require(msg.value + contributions[msg.sender] <= 1000 ether, "1000eth_limit");
            require(msg.value + fundraiseTotal <= 30000 ether, "30keth_limit");
        }
        ethToToken();
    }
}
