const hre = require("hardhat");

async function main() {
  const reg = await hre.ethers.deployContract("UrbanIssueRegistry");
  await reg.waitForDeployment();
  console.log("UrbanIssueRegistry déployé à :", await reg.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });