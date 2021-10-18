async function main() {
  let [deployer] = await ethers.getSigners();

  const gabsPubKey = '0x92c9Ce45fdBA89F810F8580120adacB6e9e7657F';
  const myPubKey1 = '0xCA6b8EaB76F76B458b1c43c0C5f500b33f63F475';
  const myPubKey2 = '0xeF3d604297aF0FA63d175233B01Db945F9676Fdb';
  const myPubKey3 = '0x957cDDa06C0A76a233aBEE17c7285c0b8C987062';

  const treasuryAddr = myPubKey2;
  console.log("Deploying contracts with the account:", deployer.address); // should match myPubKey1, btw

  const preDeployBalance = (await deployer.getBalance()).toString();
  console.log("Account balance before:", preDeployBalance);

  // probably don't need to be deploying this separately, actually.
  // const SPCToken = await ethers.getContractFactory("SPCToken");
  // const spctoken = await SPCToken.deploy(treasuryAddr);
  // console.log("SPCToken address:", spctoken.address);

  const whitelist = [gabsPubKey, myPubKey1, myPubKey2];
  const ToTheMoon = await ethers.getContractFactory("ToTheMoon");
  const tothemoon = await ToTheMoon.deploy(whitelist, treasuryAddr);

  console.log("ToTheMoon address:", tothemoon.address);
  console.log("Whitelisted contributors:", whitelist);

  // this doesn't work, probably because we're not waiting for the next block...? maybe?
  // const postDeployBalance = (await deployer.getBalance()).toString();
  // console.log("Account balance after:", postDeployBalance);
  // console.log("Cost:",preDeplaoyBalance - postDeployBalance);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
