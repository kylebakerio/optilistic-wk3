# Audit

## File commit reviewed
Done By: Ezenwankwo Gabriel
Date: 05 10 2021
Repo Commit: https://github.com/kylebakerio/optilistic-wk2/tree/93acce26da513862e6220938fa8965c26d04b213

## issue-1
**[Code Quality]** Override implementation not necessary
SPCToken.sol On line 26, the following code
```
function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
    }
```
This override doesn't perform any extra function, hence not needed.

## issue-2
**[code quality]** variable type
SPCToken.sol On line 26, the following code
```
  uint public taxPercent = 2;
```
Using a constant declaration would better save gas as the compiler does not reserve a storage slot for these variables, and every occurrence is replaced by the respective value.
reference: https://dev.to/javier123454321/solidity-gas-optimizations-pt-2-constants-570d

## issue-3
**[High]** Private contributors must be predetermined before contract deployment
ToTheMoon.sol On line 26
```
  constructor(address[] memory _whitelist, address _treasury) SPCToken(_treasury) {
    for (uint i = 0; i < _whitelist.length; i++) {
      whitelist[_whitelist[i]] = true;
    }
  }
```
This implementation would require the whitelisted address to be known before the contract is deployed. A function that allows only owner to add whitelisted addresses while the phase is open would resolve this.

## issue-4
**[Code Quality]** Unused local variable
ToTheMoon.sol On line 48
```
   (bool sent, bytes memory data) = payable(treasury).call{value: msg.value}("");
```
data is not used in the function, should be removed

## issue-5
**[Code Quality]** ERC20 Pausable modifier
ToTheMoon.sol On line 65
```
  require(!paused(), "fundraising_paused");
```
Since we inheritted the ERC20Pausable contract, it's best to comply by using the modifier check "whenNotPaused" as line 65 repeats same function

## issue-6
**[High]** Error when whitelisted user contribution
ToTheMoon.sol On line 74
```
  require(msg.value + contributions[msg.sender] <= 1000 ether, "1000eth_limit");
```
General Phase Requirement: During this phase, the individual contribution limit should be 1,000 Ether
All users (including whitelisted users) should be able to make contributions not more than 1,000 Ether.
line 74 would impair this functionality as they wouldn't be able to make 1,000 Ether contribution if they initially contributed on the Seed phase

## issue-7
**[High]** treasury gets all contract fund
ToTheMoon.sol On line 48
```
  (bool sent, bytes memory data) = payable(treasury).call{value: msg.value}("");
```
Only Requirement: A 2% tax on every transfer that gets put into a treasury
Line 48 deligates all funds deposited into the contract to the treasury account which is not the requirement

## issue-8
**[Low]** Test requirement
test/to-the-moon.js On line 229
```
  it ("Only allows token transfers upon phase 2", async () => {
```
Requirement: Token should be minted only on phase open
The test was meant to assert that token transfer happens only on phase 2, but from ToTheMoon contract, all buy request mints a new token (as "from" is always the "minter" (on line 58 ToTheMoon.sol)). Also this was not tested for the phase 2 as was stated in test case

----

response:
1. agreed, this was necessary previously for a compiler error, forgot to remove it when I fixed the issue later.
2. agreed
3. not other behavior was specified as required, so I did not add what I thought of as an unrequested feature--when I picture this scenario, the whitelisted investors are known in advance, especially since in a 'normal' ICO, phases are time-based.
4. agreed
5. agreed I guess. didn't know that modifier was available. probably cleaner that way.
6. I believe you have misunderstood the spec; if they contributed more than 1k in the first phase, they should not be able to contribute during the second phase, as I understand?
7. from what I understand, indeed, all funds raised this way should be transfered to the treasury. Technically the spec doesn't specify where the eth used to purchase tokens should go, but the only alternative would be the contract holding it itself, which is not specified, and makes less sense to me.
8. agreed--did not finish writing that test. Thanks for pointing that out, slipped through the cracks there at the end. I just finished it now, however, and the intended functionality does work as expected.