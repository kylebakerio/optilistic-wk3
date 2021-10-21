# comments
- the very last updates related to event updates around the ability to use the 'simulation' argument. In the end, this is not an ideal or necessary implementation--I didn't yet know about the concept of doing a 'static call' that can be used instead. This would be removed.
- a deadline timestamp for calls should be added


# excuses
oct 19:
alright, should be acceptable. deployed functional front end.
I encourage you to play with the deployed front end to test the contract, but if you find a mistake, there's a good change the bug is in the front end, not the contract--be sure to confirm your finding by writing a test in the test code against the contract directly.


oct 18 2021:
Lost half of project time to moving, traveling, working, got permission to finish over weekend instead. Code is messy right now. Front end portion is not added. Tests are passing, requirements are met (including optional requirement for slippage check), but just barely.


# deployed ICO/Liquidity/Swapping front end
works with rinkeby eth
only tested with metamask wallet
https://spctoken.surge.sh
tested with metamask connected to rinkeby.

# commands:
make sure to `npm install`

to run tests:
`npx hardhat test`

to deploy to rinkeby:
`npx hardhat run scripts/deploy.js --network rinkeby`

to run local server, go into `frontend` folder and run:
`npx http-server -S`

to deploy front end, go into `frontend` folder and run
`surge`

# to create a fresh iteration of the front end
- check deploy script, set your own whitelist 
- make sure your hardhat.config.js is setup right with your own private key; 
	- I do this using .env file:
	- so, add in your own alchemy and rinkeby private key in a .env, or do it your own way
	- .env file should be at same folder depth as hardhat.config.js, and should look like this:
```
RINKEBY_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALCHEMY_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
run deploy script for rinkeby:
`npx hardhat run scripts/deploy.js --network rinkeby`


## based off of a....
### Basic Sample Hardhat Project
This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
node scripts/sample-script.js
npx hardhat help
```
