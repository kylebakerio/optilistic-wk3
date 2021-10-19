//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

import "./SPCToken.sol";

interface IRouter {
    function getSPCTtoETH10000000(uint) external view returns(uint);
    function addLiquidity(uint amountSPCT, address spclReceiver) external payable;
    function haveLiquidity() external view returns(bool);
}

contract ToTheMoon is SPCToken {
    uint public fundraiseTotal;
    IRouter public router;

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

    constructor(address[] memory _whitelist) SPCToken() {
        treasury = owner();
        for (uint i = 0; i < _whitelist.length; i++) {
            whitelist[_whitelist[i]] = true;
        }
    }

    function setRouter(address _router) external onlyOwner {
        routerAddress = _router;
        router = IRouter(_router);
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
        // for wk2 spec, I had auto-transfers into treasury; this has now been moved to withdraw() in SPCToken.sol 
        // (bool sent, ) = payable(treasury).call{value: msg.value}(""); // this is moved for wk3 to be in withdraw() 
        // require(sent, "Failed to send Ether");
        fundraiseTotal += msg.value;
        contributions[msg.sender] += msg.value;
        ERC20._transfer(owner(), msg.sender, msg.value * 5); // 5:1 initial mint value
        emit Buy(msg.sender, msg.value);
    }

    // spec:
    // Add a withdraw function to your ICO contract that allows you to moves the invested funds to your liquidity contract. 
    // How exactly you do this is up to you; just make sure it's possible to deposit an even worth of each asset.
    function withdraw() external onlyOwner {
        require(address(this).balance > 0, "no_eth");
        uint ethBalance = address(this).balance;

        if (router.haveLiquidity()) {
            // console.log("before call");
            uint spctPrice = router.getSPCTtoETH10000000(0) / 10000000;
            // console.log("has liquidity, adding more liquidity, price is", spctPrice);
            router.addLiquidity{value: ethBalance}(spctPrice * ethBalance, treasury);
        }
        else {
            // console.log("no liquidity, initial liquidity add event");
            router.addLiquidity{value: ethBalance}(5 * ethBalance, treasury);
        }
    }

    // prevent scenario where not enough spct is left to deposit it into liquidity pool
    // could happen from selling out of spct, or from price of spct going up
    function getTrappedEth() external onlyOwner {
        require(address(this).balance > 0, "no_eth");
        require(router.haveLiquidity(), "can_open_market"); // uncomment if desire to force liquidity deposits

        // uncomment block if desire to force liquidity deposits when possible
        // uint ethBalance = address(this).balance;
        // uint spctPrice = router.getSPCTtoETH10000000(0) / 10000000;
        // require(spctPrice * ethBalance > balanceOf(owner()),"can_deposit_liquidity");
        
        (bool sent, ) = payable(treasury).call{value: address(this).balance}(""); // this is moved for wk3 to be in withdraw() 
        require(sent, "Failed to send Ether");
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)  internal virtual override {
        require(from == owner() || to == owner() || phase == Phases.Open, "transfers_forbidden");
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
