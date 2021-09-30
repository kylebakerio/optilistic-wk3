async function main() {
  const [deployer, treasury, ...signers] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const SPCToken = await ethers.getContractFactory("SPCToken");
  const spctoken = await SPCToken.deploy(treasury.address);

  console.log("SPCToken address:", spctoken.address);

  const whitelist = signers.map(a => a.address);
  const ToTheMoon = await ethers.getContractFactory("ToTheMoon");
  const tothemoon = await ToTheMoon.deploy(whitelist, treasury.address);

  console.log("ToTheMoon address:", tothemoon.address);
  console.log("Whitelisted contributors:", whitelist);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });