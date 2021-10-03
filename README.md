# deployed
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


# Basic Sample Hardhat Project

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
