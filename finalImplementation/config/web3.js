// config/web3.js
const { Web3 } = require("web3");
const MyMerkleTree = require("../../build/contracts/MerkleTree.json");
const HospitalToken = require("../../build/contracts/HospitalToken.json");
require("dotenv").config();

const owner =
  process.env.OWNER_ADDRESS || "0xfe391679B6F02E94358A74CB5148591eA73db8CC";

/**
 * Initializes and returns the Web3 configuration with contract instances.
 * @returns {Promise<{web3: Web3, merkleTreeContract: any, hospitalTokenContract: any, owner: string}>}
 */
const initializeWeb3 = async () => {
  try {
    // Initialize Web3 instance using environment variable
    const web3 = new Web3(
      process.env.WEB3_PROVIDER_URL || "HTTP://127.0.0.1:7545"
    );

    // Get the network ID
    const networkId = await web3.eth.net.getId();
    console.log(`Connected to network ID: ${networkId}`);

    // Initialize MerkleTree contract
    const deployedNetworkMerkleTree = MyMerkleTree.networks[networkId];
    if (!deployedNetworkMerkleTree) {
      throw new Error(
        `MerkleTree contract not deployed on network ID ${networkId}`
      );
    }
    const merkleTreeContract = new web3.eth.Contract(
      MyMerkleTree.abi,
      deployedNetworkMerkleTree.address,
      { from: owner }
    );
    console.log(
      `MerkleTree Contract Address: ${merkleTreeContract.options.address}`
    );

    // Initialize HospitalToken contract
    const deployedNetworkHospitalToken = HospitalToken.networks[networkId];
    if (!deployedNetworkHospitalToken) {
      throw new Error(
        `HospitalToken contract not deployed on network ID ${networkId}`
      );
    }
    const hospitalTokenContract = new web3.eth.Contract(
      HospitalToken.abi,
      deployedNetworkHospitalToken.address,
      { from: owner }
    );
    console.log(
      `HospitalToken Contract Address: ${hospitalTokenContract.options.address}`
    );

    return {
      web3,
      merkleTreeContract,
      hospitalTokenContract,
      owner,
    };
  } catch (error) {
    console.error("Failed to initialize Web3 configuration:", error);
    throw error;
  }
};

module.exports = initializeWeb3;
